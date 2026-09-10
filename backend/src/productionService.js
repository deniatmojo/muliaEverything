// Service modul Production: generate job dari material BOQ versi aktif, rekonsiliasi
// saat versi berubah (hasil produksi jadi buffer stock), dan hitung progress SO.
// Membaca data SO secara read-only; satu-satunya penulisan ke modul SO adalah
// kolom so.progress (disetujui pemilik aplikasi).
import { pool } from './db.js';

// ==== Aturan domain produksi (cermin productionData.js di frontend) ====

// MPU -> roll upright | MPD -> roll bracing | MPB -> roll beam lalu welding
export function mapMaterialToMachine(articleCode) {
  const code = String(articleCode || '').trim().toUpperCase();
  if (/^MPU\s/.test(code)) return 'upright';
  if (/^MPD\s/.test(code)) return 'bracing';
  if (/^MPB\s/.test(code)) return 'beam';
  return null;
}

// Material produksi = lokal IDR, MPU/MPD/MPB (MPF frame & safety pin bukan produksi)
export function isProductionMaterial(m) {
  if (m.currency !== 'IDR') return false;
  return mapMaterialToMachine(m.article_code ?? m.articleCode) !== null;
}

// Tahapan pipeline: MPB -> beam + welding; semua lewat painting kecuali GALVA
export function pipelineFor(articleCode, colour) {
  const machine = mapMaterialToMachine(articleCode);
  const isGalva = String(colour || '').trim().toUpperCase() === 'GALVA';
  const stages = [];
  if (machine === 'upright') stages.push('upright');
  if (machine === 'bracing') stages.push('bracing');
  if (machine === 'beam') stages.push('beam', 'welding');
  if (!isGalva) stages.push('painting');
  return stages;
}

// ====================================================================
// GENERATE / REKONSILIASI JOB TERHADAP VERSI AKTIF
// - Job dibuat sekaligus untuk semua tahap pipeline (produksi paralel).
// - Bila versi aktif berganti: job lama dicocokkan ke material versi baru
//   (key: machine|article|dim1|dim2|colour). Job tanpa pasangan & sudah
//   menghasilkan output -> 'buffered' (buffer stock); belum menghasilkan -> 'cancelled'.
// ====================================================================

const JOB_KEY = (m) => `${m.machine}|${m.article}|${m.dim1 ?? ''}|${m.dim2 ?? ''}|${m.colour ?? ''}`;

export async function ensureJobsForActiveVersion(soId, userId = null) {
  const [[so]] = await pool.query('SELECT id, active_version_id FROM so WHERE id = ?', [soId]);
  if (!so) return { error: 'SO tidak ditemukan' };
  if (!so.active_version_id) return { error: 'SO belum memiliki versi material aktif' };

  const [materials] = await pool.query(
    'SELECT * FROM so_materials WHERE version_id = ?',
    [so.active_version_id]
  );
  const prodMaterials = materials.filter(isProductionMaterial);

  // Kebutuhan job versi aktif: satu entri per material x tahap pipeline
  const wanted = new Map(); // JOB_KEY -> { material, machine, qty }
  for (const m of prodMaterials) {
    for (const machine of pipelineFor(m.article_code, m.colour)) {
      wanted.set(`${machine}|${m.article_code}|${m.dim1 ?? ''}|${m.dim2 ?? ''}|${m.colour ?? ''}`, {
        material: m, machine, qty: Number(m.qty) || 0,
      });
    }
  }

  const [existing] = await pool.query(
    "SELECT * FROM production_jobs WHERE so_id = ? AND status IN ('queued','running','paused','done','buffered')",
    [soId]
  );
  const existingMap = new Map(existing.map((j) => [`${j.machine}|${j.article_code}|${j.dim1 ?? ''}|${j.dim2 ?? ''}|${j.colour ?? ''}`, j]));

  const conn = await pool.getConnection();
  let created = 0, updated = 0, buffered = 0, cancelled = 0;
  try {
    await conn.beginTransaction();

    // 1. Job baru / penyesuaian target dari material versi aktif
    for (const [key, w] of wanted) {
      const old = existingMap.get(key);
      if (!old) {
        await conn.query(
          `INSERT INTO production_jobs (so_id, version_id, material_id, machine, article_code, dim1, dim2, colour, qty_target, status, created_by)
           VALUES (?,?,?,?,?,?,?,?,?, 'queued', ?)`,
          [soId, so.active_version_id, w.material.id, w.machine, w.material.article_code,
            w.material.dim1 ?? null, w.material.dim2 ?? null, w.material.colour ?? null, w.qty, userId]
        );
        created++;
      } else if (old.version_id !== so.active_version_id || Number(old.qty_target) !== w.qty) {
        // material sama tapi versi/target berubah: pertahankan progres (qty_done)
        const newDone = Math.min(Number(old.qty_done), w.qty);
        const status = old.status === 'buffered' ? old.status
          : newDone >= w.qty && w.qty > 0 ? 'done' : (newDone > 0 ? 'running' : old.status);
        await conn.query(
          `UPDATE production_jobs SET version_id = ?, material_id = ?, qty_target = ?, qty_done = ?, status = ?,
            finished_at = CASE WHEN ? = 'done' THEN COALESCE(finished_at, NOW()) ELSE finished_at END
           WHERE id = ?`,
          [so.active_version_id, w.material.id, w.qty, newDone, status, status, old.id]
        );
        updated++;
      }
      existingMap.delete(key); // sudah dipakai
    }

    // 2. Job lama tanpa pasangan di versi baru
    for (const [, j] of existingMap) {
      if (j.version_id === so.active_version_id) continue; // job versi aktif tanpa perubahan
      if (Number(j.qty_done) > 0) {
        await conn.query("UPDATE production_jobs SET status = 'buffered' WHERE id = ?", [j.id]);
        buffered++;
      } else {
        await conn.query("UPDATE production_jobs SET status = 'cancelled' WHERE id = ?", [j.id]);
        cancelled++;
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    conn.release();
    return { error: 'Gagal menyiapkan job produksi: ' + err.message };
  }
  conn.release();
  return { created, updated, buffered, cancelled };
}

// ====================================================================
// HITUNG PROGRESS SO DARI JOB (write-back so.progress, disetujui)
// Progress = rata-rata penyelesaian semua job aktif (queued/running/paused/done).
// ====================================================================
export async function recomputeSoProgress(soId) {
  const [[row]] = await pool.query(
    `SELECT COALESCE(SUM(LEAST(qty_done, qty_target)), 0) AS done, COALESCE(SUM(qty_target), 0) AS target
     FROM production_jobs WHERE so_id = ? AND status IN ('queued','running','paused','done')`,
    [soId]
  );
  const pct = row && row.target > 0 ? Math.min(100, Math.round((row.done / row.target) * 100)) : 0;
  await pool.query('UPDATE so SET progress = ? WHERE id = ?', [pct, soId]);
  return pct;
}

// ====================================================================
// CATAT OUTPUT (dipakai route app & publik QR)
// ====================================================================
export async function recordOutput({ job, qty, note, inputVia, qrTokenId = null, operatorNama = null, userId = null }) {
  if (!(qty > 0)) return { error: 'Qty harus lebih besar dari 0.' };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO production_output_logs (job_id, qty, note, input_via, qr_token_id, operator_nama, created_by)
       VALUES (?,?,?,?,?,?,?)`,
      [job.id, qty, note?.trim() || null, inputVia, qrTokenId, operatorNama?.trim() || null, userId]
    );
    const newDone = Number(job.qty_done) + qty;
    const selesai = newDone >= Number(job.qty_target) && Number(job.qty_target) > 0;
    await conn.query(
      `UPDATE production_jobs SET
         qty_done = ?, status = ?,
         started_at = COALESCE(started_at, NOW()),
         finished_at = CASE WHEN ? THEN NOW() ELSE finished_at END
       WHERE id = ?`,
      [newDone, selesai ? 'done' : 'running', selesai, job.id]
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
