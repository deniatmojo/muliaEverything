import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { ok, fail, newId, newToken, recordLog } from '../utils.js';
import { requireAuth } from '../middleware/auth.js';
import 'dotenv/config';

const router = Router();

// LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {}; // "email" boleh berisi username ATAU email
  if (!email || !password) return fail(res, 'Username/email dan password wajib diisi.', 422);

  const [[user]] = await pool.query(
    'SELECT * FROM users WHERE email = ? OR username = ?',
    [email, email]
  );
  if (!user) return fail(res, 'Email atau password salah', 401);

  const cocok = await bcrypt.compare(password, user.password_hash);
  if (!cocok) return fail(res, 'Email atau password salah', 401);

  if (user.status === 'pending')
    return fail(res, 'Akun Anda masih dalam antrean persetujuan.', 403);
  if (user.status === 'approved')
    return fail(res, 'Akun Anda belum diverifikasi. Cek link verifikasi.', 403);

  let menus = [];
  if (user.role) {
    const [[role]] = await pool.query('SELECT akses_menu FROM roles WHERE nama_role = ?', [user.role]);
    // mysql2 kadang sudah mem-parse kolom JSON, kadang masih string
    if (role) menus = typeof role.akses_menu === 'string' ? JSON.parse(role.akses_menu) : role.akses_menu;
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, username: user.username, role: user.role, nama: user.nama },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  await recordLog(user.id, 'LOGIN', 'Berhasil masuk ke dalam portal Mulia Everything');

  return ok(res, 'Login berhasil', {
    token,
    user: {
      id: user.id,
      nama: user.nama,
      email: user.email,
      username: user.username || '',
      role: user.role,
      menus,
      avatar_url: user.avatar_url || '',
    },
  });
});

// REGISTER
router.post('/register', async (req, res) => {
  const { nama, email, password, username } = req.body || {};
  if (!nama || !email || !password) return fail(res, 'Nama, email, dan password wajib diisi.', 422);

  const [[ada]] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (ada) return fail(res, 'Email ini sudah terdaftar!', 409);

  if (username) {
    if (!/^[a-zA-Z0-9._]{3,50}$/.test(username))
      return fail(res, 'Username 3-50 karakter, hanya huruf, angka, titik, dan underscore.', 422);
    const [[adaUname]] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (adaUname) return fail(res, 'Username ini sudah dipakai user lain!', 409);
  }

  const password_hash = await bcrypt.hash(password, 10);
  const id = newId('u');
  await pool.query(
    'INSERT INTO users (id, nama, email, username, password_hash, status) VALUES (?, ?, ?, ?, ?, ?)',
    [id, nama, email, username || null, password_hash, 'pending']
  );
  return ok(res, 'Pendaftaran berhasil. Silakan tunggu persetujuan.', null, 201);
});

// VERIFY TOKEN (aktivasi akun dari link email)
router.post('/verify-token', async (req, res) => {
  const { token } = req.body || {};
  if (!token) return fail(res, 'Token tidak valid/kadaluarsa.', 400);

  const [[user]] = await pool.query(
    'SELECT * FROM users WHERE verify_token = ? AND status = ?',
    [token, 'approved']
  );
  if (!user) return fail(res, 'Token tidak valid/kadaluarsa.', 400);
  if (user.token_expires && new Date(user.token_expires) < new Date())
    return fail(res, 'Token sudah kadaluarsa. Minta admin untuk mengirim ulang email.', 400);

  await pool.query(
    "UPDATE users SET status = 'active', verify_token = NULL, token_expires = NULL WHERE id = ?",
    [user.id]
  );
  return ok(res, 'Akun berhasil diverifikasi!');
});


export default router;
