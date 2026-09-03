import { Router } from 'express';
import { pool } from '../db.js';
import { ok, fail, newId, newToken } from '../utils.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendVerificationEmail } from '../mailer.js';

const router = Router();
router.use(requireAuth, requireRole('Developer'));

const userCols = 'id, nama, email, role, status, position, phone, avatar_url, created_at';

// GET users by status (pending / active / approved)
router.get('/users', async (req, res) => {
  const { status } = req.query;
  if (!['pending', 'active', 'approved'].includes(status))
    return fail(res, 'Parameter status tidak valid', 422);
  const [rows] = await pool.query(
    `SELECT ${userCols} FROM users WHERE status = ? ORDER BY created_at DESC`,
    [status]
  );
  return ok(res, 'Data diambil', rows);
});

// GET roles
router.get('/roles', async (req, res) => {
  const [rows] = await pool.query('SELECT id, nama_role, akses_menu FROM roles ORDER BY nama_role');
  return ok(res, 'Data roles diambil', rows.map((r) => ({
    id: r.id,
    nama_role: r.nama_role,
    akses_menu: typeof r.akses_menu === 'string' ? JSON.parse(r.akses_menu) : r.akses_menu,
  })));
});

// APPROVE USER (set role + kirim email verifikasi)
router.post('/approve-user', async (req, res) => {
  const { userId, role } = req.body || {};
  if (!userId || !role) return fail(res, 'userId dan role wajib diisi.', 422);

  const [[roleAda]] = await pool.query('SELECT id FROM roles WHERE nama_role = ?', [role]);
  if (!roleAda) return fail(res, 'Role tidak ditemukan', 404);

  const [[user]] = await pool.query('SELECT * FROM users WHERE id = ? AND status = ?', [userId, 'pending']);
  if (!user) return fail(res, 'User tidak ditemukan / sudah diproses', 404);

  const verifyToken = newToken();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 jam
  await pool.query(
    "UPDATE users SET role = ?, status = 'approved', verify_token = ?, token_expires = ? WHERE id = ?",
    [role, verifyToken, expires, userId]
  );

  const terkirim = await sendVerificationEmail(user.email, user.nama, role, verifyToken);
  if (terkirim) return ok(res, 'Akun disetujui dan Email terkirim!');
  return ok(res, 'Akun disetujui, tapi gagal kirim email otomatis. Minta user cek lagi / kirim ulang.');
});

// CREATE / UPDATE ROLE
router.post('/save-role', async (req, res) => {
  const { id, nama_role, akses_menu } = req.body || {};
  if (!nama_role || !Array.isArray(akses_menu)) return fail(res, 'nama_role dan akses_menu wajib diisi.', 422);
  const menuJson = JSON.stringify(akses_menu);

  if (id) {
    const [hasil] = await pool.query(
      'UPDATE roles SET nama_role = ?, akses_menu = ? WHERE id = ?',
      [nama_role, menuJson, id]
    );
    if (hasil.affectedRows === 0) return fail(res, 'Role tidak ditemukan', 404);
    return ok(res, 'Role diubah');
  }
  await pool.query('INSERT INTO roles (id, nama_role, akses_menu) VALUES (?, ?, ?)', [
    newId('r'), nama_role, menuJson,
  ]);
  return ok(res, 'Role dibuat', null, 201);
});

// UPDATE USER ROLE
router.post('/update-user-role', async (req, res) => {
  const { userId, role } = req.body || {};
  if (!userId || !role) return fail(res, 'userId dan role wajib diisi.', 422);
  const [hasil] = await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
  if (hasil.affectedRows === 0) return fail(res, 'User tidak ditemukan', 404);
  return ok(res, 'Role diubah');
});

export default router;
