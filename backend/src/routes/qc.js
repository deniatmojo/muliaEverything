import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { pool } from '../db.js';
import { ok, fail, newId, recordLog } from '../utils.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const STATUS_ITEMS = ['Ready to Use', 'In Checking', 'Reject', 'Stock'];
const QC_PROCESSES = ['Unchecking', 'Passes'];

// Field wajib per tipe label
const REQUIRED_FIELDS = {
  bundle: ['customer', 'so_number', 'product_name', 'qty', 'bundle_no', 'total_bundles'],
  coil: ['type_coil', 'no_coil'],
  packaging: [],
};

const sanitizeData = (type, data = {}) => {
  const bersih = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string') bersih[k] = v.trim();
    else bersih[k] = v;
  }
  return bersih;
};

const genCode = () => {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `QC-${yy}${mm}${dd}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
};

const publikView = (row) => ({
  id: row.id,
  code: row.code,
  type: row.type,
  data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
  status_item: row.status_item,
  qc_process: row.qc_process,
  inspector: row.inspector,
  note: row.note || null,
  locked: row.scan_updated_at !== null,
  scan_updated_at: row.scan_updated_at,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

// ==============================
// ENDPOINT PUBLIK (halaman scan, tanpa login)
// ==============================

// Detail item berdasarkan kode QR
router.get('/public/:code', async (req, res) => {
  const [[row]] = await pool.query('SELECT * FROM qc_items WHERE code = ?', [req.params.code]);
  if (!row) return fail(res, 'Kode QC tidak ditemukan. Pastikan label masih valid.', 404);
  return ok(res, 'Data ditemukan', publikView(row));
});

// Verifikasi PIN saja (untuk membuka form update di halaman scan, belum menyimpan)
router.post('/public/:code/verify-pin', async (req, res) => {
  const { pin } = req.body || {};
  if (!pin) return fail(res, 'PIN wajib diisi.', 422);
  const [[row]] = await pool.query('SELECT * FROM qc_items WHERE code = ?', [req.params.code]);
  if (!row) return fail(res, 'Kode QC tidak ditemukan.', 404);
  if (row.scan_updated_at) return fail(res, 'Data ini sudah pernah diupdate dan terkunci.', 403);
  const pinBenar = await bcrypt.compare(String(pin), row.pin_hash);
  if (!pinBenar) return fail(res, 'PIN salah. Silakan coba lagi.', 401);
  return ok(res, 'PIN benar');
});

// Update status via halaman scan: wajib PIN benar, hanya sekali (terkunci permanen)
router.post('/public/:code/update', async (req, res) => {
  const { pin, inspector, status_item, qc_process, note = '' } = req.body || {};
  if (!pin) return fail(res, 'PIN wajib diisi.', 422);
  if (!inspector || !inspector.trim()) return fail(res, 'Nama Inspector wajib diisi.', 422);
  if (!STATUS_ITEMS.includes(status_item)) return fail(res, 'Status Item tidak valid.', 422);
  if (!QC_PROCESSES.includes(qc_process)) return fail(res, 'QC Process tidak valid.', 422);

  const [[row]] = await pool.query('SELECT * FROM qc_items WHERE code = ?', [req.params.code]);
  if (!row) return fail(res, 'Kode QC tidak ditemukan.', 404);

  if (row.scan_updated_at) {
    return fail(res, 'Data ini sudah pernah diupdate melalui halaman scan dan terkunci. Perubahan selanjutnya hubungi admin via halaman induk QC.', 403);
  }

  const pinBenar = await bcrypt.compare(String(pin), row.pin_hash);
  if (!pinBenar) return fail(res, 'PIN salah. Silakan coba lagi.', 401);

  await pool.query(
    'UPDATE qc_items SET status_item = ?, qc_process = ?, inspector = ?, note = ?, scan_updated_at = NOW(), scan_updated_by = ? WHERE id = ?',
    [status_item, qc_process, inspector.trim(), note.trim() || null, inspector.trim(), row.id]
  );
  await recordLog(null, 'QC_SCAN_UPDATE', `Inspector ${inspector.trim()} me-update item QC ${row.code} (tipe ${row.type}) via halaman scan: Status Item="${status_item}", QC Process="${qc_process}"`);
  return ok(res, 'Data QC berhasil diperbarui!');
});

// ==============================
// ENDPOINT PRIVAT (halaman induk, wajib login)
// ==============================
router.use(requireAuth);

// Daftar item (dengan pencarian & filter tipe)
router.get('/items', async (req, res) => {
  const { search = '', type = 'all' } = req.query;
  let sql = 'SELECT * FROM qc_items WHERE 1=1';
  const params = [];
  if (type !== 'all' && ['bundle', 'coil', 'packaging'].includes(type)) {
    sql += ' AND type = ?';
    params.push(type);
  }
  if (search) {
    sql += ' AND (code LIKE ? OR JSON_SEARCH(LOWER(data), \'one\', LOWER(?)) IS NOT NULL)';
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY created_at DESC LIMIT 200';
  const [rows] = await pool.query(sql, params);
  return ok(res, 'Data diambil', rows.map(publikView));
});

// Direktori QC Team: user aktif yang role-nya punya akses menu /qc (Developer tidak ditampilkan)
router.get('/team', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.nama, u.email, u.role, u.phone, u.avatar_url
     FROM users u
     JOIN roles r ON r.nama_role = u.role
     WHERE u.status = 'active'
       AND u.role <> 'Developer'
       AND JSON_SEARCH(r.akses_menu, 'one', '/qc') IS NOT NULL
     ORDER BY u.nama`
  );
  return ok(res, 'Data tim QC diambil', rows);
});

// Buat item baru (generate barcode)
router.post('/items', async (req, res) => {
  const { type, data = {}, pin, status_item = 'In Checking', qc_process = 'Unchecking', inspector = '', note = '' } = req.body || {};

  if (!['bundle', 'coil', 'packaging'].includes(type)) return fail(res, 'Tipe label tidak valid.', 422);
  if (!pin || !/^\d{4,6}$/.test(String(pin))) return fail(res, 'PIN harus berupa angka 4-6 digit.', 422);
  if (!STATUS_ITEMS.includes(status_item)) return fail(res, 'Status Item tidak valid.', 422);
  if (!QC_PROCESSES.includes(qc_process)) return fail(res, 'QC Process tidak valid.', 422);

  const bersih = sanitizeData(type, data);
  const wajib = REQUIRED_FIELDS[type] || [];
  for (const f of wajib) {
    if (!bersih[f] && bersih[f] !== 0) return fail(res, `Field "${f}" wajib diisi untuk tipe ini.`, 422);
  }

  const id = newId('qc');
  const code = genCode();
  const pin_hash = bcrypt.hashSync(String(pin), 10);

  await pool.query(
    'INSERT INTO qc_items (id, code, type, data, pin_hash, status_item, qc_process, inspector, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, code, type, JSON.stringify(bersih), pin_hash, status_item, qc_process, inspector || null, note.trim() || null, req.user?.id || null]
  );
  await recordLog(req.user?.id, 'QC_CREATE', `${req.user?.nama || 'Admin'} membuat barcode QC ${code} (tipe ${type}, item: ${bersih.product_name || bersih.no_coil || '-'})`);
  const [[row]] = await pool.query('SELECT * FROM qc_items WHERE id = ?', [id]);
  return ok(res, 'Barcode QC berhasil dibuat', publikView(row), 201);
});

// Edit item via halaman induk (bebas, tanpa PIN; PIN opsional diganti)
router.put('/items/:id', async (req, res) => {
  const { data, pin, status_item, qc_process, inspector, note } = req.body || {};

  const [[row]] = await pool.query('SELECT * FROM qc_items WHERE id = ?', [req.params.id]);
  if (!row) return fail(res, 'Item QC tidak ditemukan', 404);

  const updates = [];
  const params = [];
  const perubahan = [];
  if (data !== undefined) { updates.push('data = ?'), params.push(JSON.stringify(sanitizeData(row.type, data))); perubahan.push('data item'); }
  if (status_item !== undefined && status_item !== row.status_item) {
    if (!STATUS_ITEMS.includes(status_item)) return fail(res, 'Status Item tidak valid.', 422);
    updates.push('status_item = ?'), params.push(status_item);
    perubahan.push(`Status Item "${row.status_item}" -> "${status_item}"`);
  }
  if (qc_process !== undefined && qc_process !== row.qc_process) {
    if (!QC_PROCESSES.includes(qc_process)) return fail(res, 'QC Process tidak valid.', 422);
    updates.push('qc_process = ?'), params.push(qc_process);
    perubahan.push(`QC Process "${row.qc_process}" -> "${qc_process}"`);
  }
  if (inspector !== undefined) { updates.push('inspector = ?'), params.push(inspector || null); perubahan.push(`Inspector "${row.inspector || '-'}" -> "${inspector || '-'}"`); }
  if (note !== undefined) { updates.push('note = ?'), params.push(note || null); if ((note || '') !== (row.note || '')) perubahan.push('catatan inspeksi'); }
  if (pin) {
    if (!/^\d{4,6}$/.test(String(pin))) return fail(res, 'PIN harus berupa angka 4-6 digit.', 422);
    updates.push('pin_hash = ?'), params.push(bcrypt.hashSync(String(pin), 10));
    perubahan.push('ganti PIN akses');
  }
  if (updates.length === 0) return fail(res, 'Tidak ada perubahan yang dikirim.', 422);

  params.push(req.params.id);
  await pool.query(`UPDATE qc_items SET ${updates.join(', ')} WHERE id = ?`, params);
  await recordLog(req.user?.id, 'QC_EDIT', `${req.user?.nama || 'Admin'} mengedit item QC ${row.code}${perubahan.length ? ': ' + perubahan.join(', ') : ''}`);
  const [[baru]] = await pool.query('SELECT * FROM qc_items WHERE id = ?', [req.params.id]);
  return ok(res, 'Item QC berhasil diperbarui', publikView(baru));
});

export default router;
