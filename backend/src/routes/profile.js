import { Router } from 'express';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pool } from '../db.js';
import { ok, fail, recordLog, createNotification, saveBase64File } from '../utils.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET PROFILE
router.get('/profile', async (req, res) => {
  const [[user]] = await pool.query(
    'SELECT nama, email, username, position, phone, avatar_url FROM users WHERE id = ?',
    [req.user.id]
  );
  if (!user) return fail(res, 'Data profil tidak ditemukan', 404);
  return ok(res, 'Data profil dimuat', {
    name: user.nama || '',
    email: user.email || '',
    username: user.username || '',
    position: user.position || 'Karyawan Mulia Everything',
    phone_number: user.phone || '',
    avatar_url: user.avatar_url || '',
  });
});

// UPDATE PROFILE (termasuk username)
router.put('/profile', async (req, res) => {
  const { name, phone_number, position, username } = req.body || {};
  if (!name) return fail(res, 'Nama tidak boleh kosong.', 422);

  if (username !== undefined && username !== null && username !== '') {
    if (!/^[a-zA-Z0-9._]{3,50}$/.test(username))
      return fail(res, 'Username 3-50 karakter, hanya huruf, angka, titik, dan underscore.', 422);
    const [[dipakai]] = await pool.query(
      'SELECT id FROM users WHERE username = ? AND id <> ?',
      [username, req.user.id]
    );
    if (dipakai) return fail(res, 'Username ini sudah dipakai user lain!', 409);
  }

  const [hasil] = await pool.query(
    'UPDATE users SET nama = ?, position = ?, phone = ?, username = ? WHERE id = ?',
    [name, position || null, phone_number || null, username || null, req.user.id]
  );
  if (hasil.affectedRows === 0) return fail(res, 'Gagal menyimpan profil', 404);
  await recordLog(req.user.id, 'UPDATE_PROFILE', 'Memperbarui informasi dasar profil');
  await createNotification({
    userId: req.user.id,
    actorId: req.user.id,
    type: 'ACTIVITY',
    title: 'Profil diperbarui',
    message: 'Informasi dasar profil Anda berhasil diperbarui.',
    link: '/profil',
  });
  return ok(res, 'Profil berhasil diperbarui');
});

// UPDATE PASSWORD
router.put('/password', async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) return fail(res, 'Password lama dan baru wajib diisi.', 422);
  if (newPassword.length < 6) return fail(res, 'Password baru minimal 6 karakter.', 422);

  const [[user]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!user) return fail(res, 'Pengguna tidak ditemukan', 404);

  const cocok = await bcrypt.compare(oldPassword, user.password_hash);
  // 400 (bukan 401) agar tidak memicu auto-logout token di frontend
  if (!cocok) return fail(res, 'Kata sandi lama tidak sesuai.', 400);

  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
  await recordLog(req.user.id, 'UPDATE_PASSWORD', 'Mengubah kata sandi akun keamanan');
  return ok(res, 'Kata sandi berhasil diperbarui');
});

// UPLOAD AVATAR (JSON base64, kompatibel dengan cara lama di GAS)
import fs from 'node:fs';

router.post('/avatar', async (req, res) => {
  const { base64Data, mimeType, fileName } = req.body || {};
  if (!base64Data) return fail(res, 'Data file tidak ada.', 422);

  const extByMime = {
    'image/jpeg': '.jpg', 'image/png': '.png',
    'image/webp': '.webp', 'image/gif': '.gif',
  };
  if (!extByMime[mimeType]) return fail(res, 'Tipe file tidak didukung. Gunakan JPG/PNG/WebP/GIF.', 422);

  let avatarUrl;
  try {
    avatarUrl = saveBase64File(base64Data, mimeType, fileName, 'avatars', 2 * 1024 * 1024);
  } catch (err) {
    return fail(res, err.message, 422);
  }
  await pool.query('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, req.user.id]);
  await recordLog(req.user.id, 'UPLOAD_AVATAR', 'Mengunggah dan mengganti foto profil baru');
  await createNotification({
    userId: req.user.id,
    actorId: req.user.id,
    type: 'ACTIVITY',
    title: 'Foto profil diperbarui',
    message: 'Foto profil Anda berhasil diganti.',
    link: '/profil',
  });
  return ok(res, 'Avatar berhasil diunggah!', { avatar_url: avatarUrl });
});

// RIWAYAT AKTIVITAS SAYA
router.get('/my-activities', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, action_type AS action, description, created_at AS date, status
     FROM logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
    [req.user.id]
  );
  return ok(res, 'Riwayat aktivitas dimuat', rows);
});

export default router;
