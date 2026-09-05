// Service modul SO: parse BOQ Excel, kurs RMB->IDR, diff material, approval.
import * as XLSX from 'xlsx';
import { pool } from './db.js';
import { saveBase64File } from './utils.js';

// ====================================================================
// PARSER FILE BOQ EXCEL
// Hanya sheet berawalan "BOQ-" (material & frame) + "CONSOLIDATED" (pallet)
// ====================================================================

const num = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};
const str = (v) => (v === null || v === undefined ? null : String(v).trim() || null);
const isFrameCode = (code) => /^MPF(\s|$)/i.test(String(code || ''));

export function parseBoqWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const result = {
    customerName: null,
    projectNumber: null,
    palletCount: null,
    sheets: [],
    materials: [], // dikembalikan TERPISAH per sheet+identitas (belum diagregasi antar sheet)
    frames: [],
  };

  for (const sheetName of wb.SheetNames) {
    const upper = sheetName.toUpperCase();

    if (upper === 'CONSOLIDATED') {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null });
      for (const row of rows) {
        if (!Array.isArray(row)) continue;
        const idx = row.findIndex((c) => String(c ?? '').trim().toUpperCase() === 'TOTAL:');
        if (idx !== -1 && row[idx + 1] != null && !isNaN(parseFloat(row[idx + 1]))) {
          const p = parseFloat(row[idx + 1]);
          if (p) result.palletCount = p;
        }
      }
      continue;
    }

    if (!upper.startsWith('BOQ-')) continue; // abaikan CONFIG, MATERIAL_*, CALC, dst.

    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null });
    if (result.customerName == null && rows[0]?.[1] === 'Customer Name') result.customerName = str(rows[0][2]);
    if (result.projectNumber == null && rows[0]?.[4] === 'Project Number') result.projectNumber = str(rows[0][6]);

    const matMap = new Map(); // key per sheet: article|dim1|dim2|colour|currency
    const frmMap = new Map();

    let blockCurrency = 'RMB'; // blok pertama di tiap sheet BOQ = import (RMB)
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || [];
      const col0 = String(row[0] ?? '').trim().toUpperCase();
      const col1 = String(row[1] ?? '').trim().toUpperCase();

      // Header blok: QTY | Article Code ... kolom 10 menandakan mata uang blok
      if (col0 === 'QTY' || col1 === 'ARTICLE CODE') {
        const priceHeader = String(row[10] ?? '').toUpperCase();
        if (priceHeader.includes('IDR') || priceHeader.includes('RP')) blockCurrency = 'IDR';
        else if (priceHeader.includes('RMB') || priceHeader.includes('CNY')) blockCurrency = 'RMB';
        continue;
      }
      // TOTAL-1 menandai akhir blok import -> blok berikutnya lokal
      if (col0.startsWith('TOTAL')) {
        if (col0.includes('1')) blockCurrency = 'IDR';
        continue;
      }

      const qty = parseFloat(row[0]);
      if (isNaN(qty) || !row[1]) continue;

      const articleCode = str(row[1]);
      const dim1 = str(row[2]);
      const dim2 = str(row[3]);
      const colour = str(row[7]);
      const ral = str(row[8]);
      const unitWeight = num(row[9]);
      const unitPrice = num(row[10]);
      const description = str(row[13]);
      const notes = str(row[14]);

      // MPF = frame assembly, bukan material
      if (isFrameCode(articleCode)) {
        const key = `${articleCode}|${dim1}|${dim2}`;
        if (!frmMap.has(key)) frmMap.set(key, { articleCode, dim1, dim2, qty: 0, description });
        frmMap.get(key).qty += qty;
        continue;
      }

      const key = `${articleCode}|${dim1}|${dim2}|${colour}|${blockCurrency}`;
      if (!matMap.has(key)) matMap.set(key, { sheet: sheetName, articleCode, description, dim1, dim2, colour, ral, currency: blockCurrency, qty: 0, unitWeight, unitPrice, notes });
      const m = matMap.get(key);
      m.qty += qty;
      if (!m.description && description) m.description = description;
    }

    if (matMap.size || frmMap.size) result.sheets.push(sheetName);
    result.materials.push(...matMap.values());
    result.frames.push(...frmMap.values());
  }

  if (result.materials.length === 0 && result.frames.length === 0) {
    throw new Error('Tidak ada baris material ditemukan pada sheet BOQ-. Periksa format file.');
  }
  return result;
}

// ====================================================================
// KAMUS MATERIAL — simpan article code + deskripsi unik
// ====================================================================
export async function syncMaterialDictionary(materials, soId) {
  const seen = new Map();
  for (const m of materials) {
    if (m.articleCode && m.description && !seen.has(m.articleCode)) {
      seen.set(m.articleCode, m.description);
    }
  }
  for (const [code, desc] of seen) {
    await pool.query(
      `INSERT INTO materials (article_code, description, first_seen_so) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE description = VALUES(description)`,
      [code, desc.slice(0, 500), soId]
    );
  }
}

// ====================================================================
// KURS RMB (CNY) -> IDR
// Sumber utama API gratis; fallback kurs tersimpan terakhir / manual.
// ====================================================================
export async function getKursRmbIdr() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/CNY', { signal: AbortSignal.timeout(8000) });
    const json = await res.json();
    const rate = json?.rates?.IDR;
    if (rate && rate > 500 && rate < 10000) {
      return { kurs: rate, source: 'erapi', date: new Date() };
    }
  } catch (e) { /* lanjut fallback */ }
  // fallback: kurs dari versi terakhir yang tersimpan
  const [[last]] = await pool.query(
    'SELECT kurs, kurs_date FROM so_versions WHERE kurs IS NOT NULL ORDER BY created_at DESC LIMIT 1'
  );
  if (last?.kurs) return { kurs: last.kurs, source: 'last-known', date: last.kurs_date || new Date() };
  return null;
}

// ====================================================================
// HITUNG TOTALAN
// ====================================================================
export function computeTotals(materials) {
  let totalWeight = 0, importRmb = 0, lokalIdr = 0;
  for (const m of materials) {
    totalWeight += (m.qty || 0) * (m.unitWeight || 0);
    if (m.currency === 'IDR') lokalIdr += (m.qty || 0) * (m.unitPrice || 0);
    else importRmb += (m.qty || 0) * (m.unitPrice || 0);
  }
  return { totalWeight, importRmb, lokalIdr };
}

// ====================================================================
// DIFF dua daftar material/frame (key: sheet|article|dim1|dim2|colour|currency)
// ====================================================================
const MAT_KEY = (m) => `${m.sheet ?? ''}|${m.articleCode ?? ''}|${m.dim1 ?? ''}|${m.dim2 ?? ''}|${m.colour ?? ''}|${m.currency ?? ''}`;
const FRM_KEY = (f) => `${f.articleCode ?? ''}|${f.dim1 ?? ''}|${f.dim2 ?? ''}`;

const MAT_FIELDS = [
  { key: 'qty', label: 'QTY' },
  { key: 'unitWeight', label: 'Berat Unit' },
  { key: 'unitPrice', label: 'Harga Unit' },
  { key: 'description', label: 'Description' },
  { key: 'ral', label: 'RAL' },
];

export function diffMaterials(oldList, newList) {
  const oldMap = new Map(oldList.map((m) => [MAT_KEY(m), m]));
  const newMap = new Map(newList.map((m) => [MAT_KEY(m), m]));
  const result = { changed: [], added: [], removed: [], unchanged: 0 };

  for (const [key, nm] of newMap) {
    const om = oldMap.get(key);
    if (!om) { result.added.push(nm); continue; }
    const changes = [];
    for (const f of MAT_FIELDS) {
      if (String(om[f.key] ?? '') !== String(nm[f.key] ?? '')) {
        changes.push({ field: f.key, label: f.label, from: om[f.key], to: nm[f.key] });
      }
    }
    if (changes.length) result.changed.push({ ...nm, changes });
    else result.unchanged++;
  }
  for (const [key, om] of oldMap) {
    if (!newMap.has(key)) result.removed.push(om);
  }
  return result;
}

export function diffFrames(oldList, newList) {
  const oldMap = new Map(oldList.map((f) => [FRM_KEY(f), f]));
  const newMap = new Map(newList.map((f) => [FRM_KEY(f), f]));
  const result = { changed: [], added: [], removed: [] };
  for (const [key, nf] of newMap) {
    const of_ = oldMap.get(key);
    if (!of_) { result.added.push(nf); continue; }
    if (String(of_.qty) !== String(nf.qty)) result.changed.push({ ...nf, from: of_.qty, to: nf.qty });
  }
  for (const [key, of_] of oldMap) if (!newMap.has(key)) result.removed.push(of_);
  return result;
}

// Diff field form SO (label Indonesia mengikuti UI)
export const SO_FORM_FIELDS = [
  { key: 'customer', label: 'Nama Customer' },
  { key: 'project_name', label: 'Nama Project' },
  { key: 'company', label: 'Nama PT' },
  { key: 'sales_name', label: 'Nama Sales' },
  { key: 'address', label: 'Alamat' },
  { key: 'start_production', label: 'Start Produksi' },
  { key: 'first_delivery', label: 'Tgl Kiriman Pertama' },
  { key: 'start_installation', label: 'Tgl Mulai Instalasi' },
  { key: 'target_installation', label: 'Target Selesai Instalasi' },
  { key: 'description', label: 'Keterangan' },
];

export function diffForm(oldForm, newForm) {
  const changes = [];
  for (const f of SO_FORM_FIELDS) {
    const ov = oldForm?.[f.key] ?? null;
    const nv = newForm?.[f.key] ?? null;
    if (String(ov ?? '') !== String(nv ?? '')) changes.push({ field: f.key, label: f.label, from: ov, to: nv });
  }
  return changes;
}

// ====================================================================
// SIMPAN VERSI + BARIS MATERIAL/FRAME
// ====================================================================
export async function insertVersionRows(conn, versionId, soId, materials, frames) {
  for (const m of materials) {
    await conn.query(
      `INSERT INTO so_materials (version_id, so_id, sheet, article_code, description, dim1, dim2, colour, ral, qty, unit_weight, unit_price, currency, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [versionId, soId, m.sheet ?? null, m.articleCode, m.description ?? null, m.dim1 ?? null, m.dim2 ?? null,
        m.colour ?? null, m.ral ?? null, m.qty || 0, m.unitWeight || 0, m.unitPrice || 0, m.currency || 'RMB', m.notes ?? null]
    );
  }
  for (const f of frames) {
    await conn.query(
      `INSERT INTO so_frames (version_id, so_id, article_code, dim1, dim2, qty, description)
       VALUES (?,?,?,?,?,?,?)`,
      [versionId, soId, f.articleCode, f.dim1 ?? null, f.dim2 ?? null, f.qty || 0, f.description ?? null]
    );
  }
}

// Normalisasi baris DB (snake_case) ke bentuk internal (camelCase)
export const normalizeMaterial = (r) => ({
  sheet: r.sheet, articleCode: r.article_code ?? r.articleCode, description: r.description ?? null,
  dim1: r.dim1 ?? null, dim2: r.dim2 ?? null, colour: r.colour ?? null, ral: r.ral ?? null,
  qty: Number(r.qty ?? 0), unitWeight: Number(r.unit_weight ?? r.unitWeight ?? 0),
  unitPrice: Number(r.unit_price ?? r.unitPrice ?? 0), currency: r.currency ?? 'RMB', notes: r.notes ?? null,
});
export const normalizeFrame = (r) => ({
  articleCode: r.article_code ?? r.articleCode, dim1: r.dim1 ?? null, dim2: r.dim2 ?? null,
  qty: Number(r.qty ?? 0), description: r.description ?? null,
});

export { saveBase64File };
