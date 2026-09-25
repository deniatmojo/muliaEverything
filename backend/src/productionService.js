// Service modul Production — basis WORKING ORDER (WO):
// job mesin kini berasal dari WO yang diupload admin (bukan digenerate dari BOQ).
// Menulis balik so.progress: hasil WO dicocokkan ke total kebutuhan BOQ versi aktif.
import { pool } from './db.js';

export const MACHINES = ['upright', 'bracing', 'beam', 'welding', 'painting'];

// ==== Aturan domain produksi (cermin productionData.js di frontend) ====

export function mapMaterialToMachine(articleCode) {
  const code = String(articleCode || '').trim().toUpperCase();
  if (/^MPU\s/.test(code)) return 'upright';
  if (/^MPD\s/.test(code)) return 'bracing';
  if (/^MPB\s/.test(code)) return 'beam';
  return null;
}

// Material produksi = lokal IDR, MPU/MPD/MPB (MPF frame & safety pin bukan produksi)
export function isProductionMaterial(m) {
  if ((m.currency || '').toUpperCase() !== 'IDR') return false;
  const code = String(m.article_code || '').trim().toUpperCase();
  if (/^MPF(\s|$)/.test(code)) return false;
  if (/SAFETY/.test(code) || /^MSP\s/.test(code)) return false;
  return mapMaterialToMachine(code) !== null;
}

// ====================================================================
// NOMOR WO: WO-YYYYMMDD-001 (reset per hari)
// ====================================================================
export async function nextWoId() {
  const today = new Date();
  const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const [[row]] = await pool.query(
    "SELECT COUNT(*) AS n FROM production_wo WHERE id LIKE ?", [`WO-${ymd}-%`]
  );
  return `WO-${ymd}-${String((row?.n || 0) + 1).padStart(3, '0')}`;
}

// ====================================================================
// BUAT WO: item masuk ekor antrean masing-masing mesin
// ====================================================================
export async function createWo({ soId, projectCode, customer, preparedBy, items, userId }) {
  if (!soId) return { error: 'No SO wajib diisi.' };
  if (!Array.isArray(items) || items.length === 0) return { error: 'Minimal satu item WO.' };

  const bersih = [];
  for (const it of items) {
    const item = String(it.item || '').trim();
    const qty = parseFloat(it.qtyTarget);
    if (!item) continue; // baris kosong dilewati
    if (!(qty > 0)) return { error: `Qty untuk item ${item} harus lebih dari 0.` };
    if (!MACHINES.includes(it.machine)) return { error: `Mesin tidak valid untuk item ${item}.` };
    bersih.push({
      machine: it.machine, item, length_mm: it.lengthMm ? String(it.lengthMm).trim() : null,
      qty_target: qty, unit: ['Btg', 'Pcs', 'Kg'].includes(it.unit) ? it.unit : 'Btg',
      raw_material: it.rawMaterial?.trim() || null,
      multiplier_weight: parseFloat(it.multiplierWeight) || null,
      req_galva: it.reqGalva ? 1 : 0,
      coil_number: it.coilNumber?.trim() || null,
    });
  }
  if (bersih.length === 0) return { error: 'Minimal satu item WO terisi lengkap.' };

  // VALIDASI MATCHING KE BOQ: setiap item harus ada di material produksi versi aktif SO ini
  // (article code + length string persis) dan mesinnya harus sesuai pipeline item tersebut.
  const [[so]] = await pool.query('SELECT id, active_version_id FROM so WHERE id = ?', [soId]);
  if (!so) return { error: 'Nomor SO tidak ditemukan di sistem.' };
  const [materials] = await pool.query('SELECT * FROM so_materials WHERE version_id = ?', [so.active_version_id]);
  const boqMap = new Map(
    materials.filter(isProductionMaterial).map((m) => [`${String(m.article_code).trim()}|${String(m.dim1 ?? '').trim()}`, m])
  );
  const tidakMatch = [];
  for (const it of bersih) {
    const boq = boqMap.get(`${it.item}|${it.length_mm ?? ''}`);
    if (!boq) {
      tidakMatch.push(`${it.item} (${it.length_mm ?? '-'} mm) — tidak ada di BOQ versi aktif`);
      continue;
    }
    const stages = [];
    const base = mapMaterialToMachine(boq.article_code);
    if (base === 'beam') stages.push('beam', 'welding'); else if (base) stages.push(base);
    if (String(boq.colour || '').trim().toUpperCase() !== 'GALVA') stages.push('painting');
    if (!stages.includes(it.machine)) {
      tidakMatch.push(`${it.item} (${it.length_mm ?? '-'} mm) — mesin ${it.machine} tidak sesuai (harus: ${stages.join('/')})`);
    }
  }
  if (tidakMatch.length) {
    return { error: `WO DITOLAK — item tidak match dengan BOQ SO ini: ${tidakMatch.join('; ')}. Periksa kembali article code & length, atau ajukan perubahan BOQ dulu.` };
  }

  // VALIDASI QTY: total qty WO (belum dibatalkan) per material+panjang+mesin tidak boleh
  // melebihi kebutuhan BOQ. Tahapan berjalan sendiri-sendiri (bracing & painting sama-sama
  // boleh sebesar kebutuhan, karena memproses part yang sama).
  const sudahAda = {};
  for (const it of bersih) {
    const k = `${it.item}|${it.length_mm ?? ''}|${it.machine}`;
    if (sudahAda[k] === undefined) {
      const [[row]] = await pool.query(
        `SELECT COALESCE(SUM(qty_target), 0) AS q FROM production_wo_items
         WHERE so_id = ? AND item = ? AND (length_mm = ? OR (length_mm IS NULL AND ? IS NULL))
           AND machine = ? AND status <> 'cancelled'`,
        [soId, it.item, it.length_mm, it.length_mm, it.machine]
      );
      sudahAda[k] = Number(row.q);
    }
    const boq = boqMap.get(`${it.item}|${it.length_mm ?? ''}`);
    const sisa = Number(boq.qty) - sudahAda[k];
    if (it.qty_target > sisa) {
      return { error: `WO DITOLAK — ${it.item} (${it.length_mm ?? '-'} mm) di mesin ${it.machine}: maksimal ${Math.max(0, sisa)} ${it.unit} (kebutuhan BOQ ${boq.qty}, sudah ter-WO ${sudahAda[k]}).` };
    }
    sudahAda[k] += it.qty_target;
  }

  const woId = await nextWoId();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO production_wo (id, so_id, project_code, customer, prepared_by, created_by)
       VALUES (?,?,?,?,?,?)`,
      [woId, soId, projectCode || null, customer || null, preparedBy || null, userId]
    );
    for (const it of bersih) {
      const [[max]] = await conn.query(
        "SELECT COALESCE(MAX(queue_order), 0) AS q FROM production_wo_items WHERE machine = ? AND status IN ('queued','running','paused')",
        [it.machine]
      );
      await conn.query(
        `INSERT INTO production_wo_items (wo_id, so_id, machine, item, length_mm, qty_target, unit,
           raw_material, multiplier_weight, req_galva, coil_number, status, queue_order)
         VALUES (?,?,?,?,?,?,?,?,?,?,?, 'queued', ?)`,
        [woId, soId, it.machine, it.item, it.length_mm, it.qty_target, it.unit,
          it.raw_material, it.multiplier_weight, it.req_galva, it.coil_number, max.q + 1]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    conn.release();
    return { error: 'Gagal menyimpan WO: ' + err.message };
  }
  conn.release();
  await recomputeSoProgress(soId);
  return { woId, jumlahItem: bersih.length };
}

// ====================================================================
// CATAT OUTPUT (app admin & halaman operator via kode akses mesin)
// ====================================================================
export async function recordWoOutput({ item, qty, note, inputVia, operatorNama = null, userId = null }) {
  if (!(qty > 0)) return { error: 'Qty harus lebih besar dari 0.' };
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO production_output_logs (job_id, wo_item_id, qty, note, input_via, operator_nama, created_by)
       VALUES (NULL, ?, ?, ?, ?, ?, ?)`,
      [item.id, qty, note?.trim() || null, inputVia, operatorNama?.trim() || null, userId]
    );
    const newDone = Number(item.qty_done) + qty;
    const selesai = newDone >= Number(item.qty_target) && Number(item.qty_target) > 0;
    await conn.query(
      `UPDATE production_wo_items SET
         qty_done = ?, status = ?,
         started_at = COALESCE(started_at, NOW()),
         finished_at = CASE WHEN ? THEN NOW() ELSE finished_at END
       WHERE id = ?`,
      [newDone, selesai ? 'done' : 'running', selesai, item.id]
    );
    await conn.commit();
    return { qtyDone: newDone, selesai };
  } catch (err) {
    await conn.rollback();
    return { error: 'Gagal menyimpan output: ' + err.message };
  } finally {
    conn.release();
  }
}

// ====================================================================
// STATUS ITEM WO: pause / resume / cancel
// ====================================================================
export async function setWoItemStatus(item, action) {
  const map = {
    pause: { dari: ['running'], ke: 'paused' },
    resume: { dari: ['paused'], ke: 'running' },
    cancel: { dari: ['queued', 'paused', 'running'], ke: 'cancelled' },
  };
  const rule = map[action];
  if (!rule) return { error: 'Aksi tidak dikenal.' };
  if (!rule.dari.includes(item.status)) return { error: `Item berstatus ${item.status} tidak bisa di-${action}.` };
  await pool.query('UPDATE production_wo_items SET status = ? WHERE id = ?', [rule.ke, item.id]);
  return { status: rule.ke };
}

// ====================================================================
// REORDER ANTREAN (hasil drag-and-drop per mesin)
// ====================================================================
export async function reorderQueue(machine, itemIds) {
  if (!MACHINES.includes(machine)) return { error: 'Mesin tidak valid.' };
  if (!Array.isArray(itemIds)) return { error: 'Daftar item tidak valid.' };
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (let i = 0; i < itemIds.length; i++) {
      await conn.query(
        "UPDATE production_wo_items SET queue_order = ? WHERE id = ? AND machine = ? AND status IN ('queued','running','paused')",
        [i + 1, itemIds[i], machine]
      );
    }
    await conn.commit();
    return { ok: true };
  } catch (err) {
    await conn.rollback();
    return { error: 'Gagal mengubah urutan: ' + err.message };
  } finally {
    conn.release();
  }
}

// ====================================================================
// PROGRESS SO: hasil WO dicocokkan ke total kebutuhan BOQ versi aktif
// (pencocokan: so_id sama + item = article_code + length_mm = dim1, string persis;
//  item tanpa pasangan BOQ tetap tercatat di WO progress, tidak menambah SO progress)
// ====================================================================
export async function recomputeSoProgress(soId) {
  const [[so]] = await pool.query('SELECT id, active_version_id FROM so WHERE id = ?', [soId]);
  if (!so || !so.active_version_id) return 0;

  const [materials] = await pool.query(
    'SELECT * FROM so_materials WHERE version_id = ?', [so.active_version_id]
  );
  const targets = materials.filter(isProductionMaterial);
  const totalTarget = targets.reduce((a, m) => a + (Number(m.qty) || 0), 0);
  if (totalTarget === 0) return 0;

  const [produced] = await pool.query(
    `SELECT item, length_mm, SUM(qty_done) AS qty FROM production_wo_items
     WHERE so_id = ? AND status IN ('queued','running','paused','done')
       AND qty_done > 0
     GROUP BY item, length_mm`,
    [soId]
  );
  const prodMap = new Map(produced.map((p) => [`${String(p.item).trim()}|${String(p.length_mm ?? '').trim()}`, Number(p.qty)]));

  let totalDone = 0;
  for (const m of targets) {
    const key = `${String(m.article_code).trim()}|${String(m.dim1 ?? '').trim()}`;
    totalDone += Math.min(prodMap.get(key) || 0, Number(m.qty) || 0);
  }
  const pct = Math.min(100, Math.round((totalDone / totalTarget) * 100));
  await pool.query('UPDATE so SET progress = ? WHERE id = ?', [pct, soId]);
  return pct;
}

// ====================================================================
// RINGKASAN PROGRESS SO PER MESIN (widget DetailSO & Atur Produksi)
// ====================================================================
export async function soProductionSummary(soId) {
  const [[so]] = await pool.query('SELECT id, active_version_id FROM so WHERE id = ?', [soId]);
  if (!so) return { error: 'SO tidak ditemukan' };

  const [materials] = await pool.query(
    'SELECT * FROM so_materials WHERE version_id = ?', [so.active_version_id]
  );
  const targets = materials.filter(isProductionMaterial);

  // Hasil produksi dikelompokkan PER MESIN: progres mesin hanya dihitung dari
  // WO item di mesin itu sendiri (WO painting terpisah, tidak ikut output bracing dsb.)
  const [produced] = await pool.query(
    `SELECT item, length_mm, machine, SUM(qty_done) AS qty FROM production_wo_items
     WHERE so_id = ? AND status IN ('queued','running','paused','done') AND qty_done > 0
     GROUP BY item, length_mm, machine`,
    [soId]
  );
  const prodMap = new Map(produced.map((p) => [`${String(p.item).trim()}|${String(p.length_mm ?? '').trim()}|${p.machine}`, Number(p.qty)]));
  // Gabungan (dibatasi target per material) untuk progress keseluruhan SO
  const combinedMap = new Map();
  for (const p of produced) {
    const key = `${String(p.item).trim()}|${String(p.length_mm ?? '').trim()}`;
    combinedMap.set(key, (combinedMap.get(key) || 0) + Number(p.qty));
  }

  const perMachine = MACHINES.map((machine) => {
    // target mesin = material produksi yang pipelinenya melewati mesin ini
    const items = targets.filter((m) => {
      const code = String(m.article_code || '').trim().toUpperCase();
      const galva = String(m.colour || '').trim().toUpperCase() === 'GALVA';
      const stages = [];
      const base = mapMaterialToMachine(code);
      if (!base) return false;
      if (base === 'beam') stages.push('beam', 'welding'); else stages.push(base);
      if (!galva) stages.push('painting');
      return stages.includes(machine);
    });
    let done = 0;
    const target = items.reduce((a, m) => {
      const key = `${String(m.article_code).trim()}|${String(m.dim1 ?? '').trim()}|${machine}`;
      done += Math.min(prodMap.get(key) || 0, Number(m.qty) || 0);
      return a + (Number(m.qty) || 0);
    }, 0);
    return { machine, target, done, pct: target > 0 ? Math.round((done / target) * 100) : 0 };
  });

  const matTarget = targets.reduce((a, m) => a + (Number(m.qty) || 0), 0);
  let matDone = 0;
  for (const m of targets) {
    const key = `${String(m.article_code).trim()}|${String(m.dim1 ?? '').trim()}`;
    matDone += Math.min(combinedMap.get(key) || 0, Number(m.qty) || 0);
  }
  return {
    so: soId,
    overall: matTarget > 0 ? Math.round((matDone / matTarget) * 100) : 0,
    perMachine,
    totalTarget: matTarget,
    totalDone: matDone,
  };
}
