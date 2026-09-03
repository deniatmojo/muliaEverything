import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { pool } from './db.js';

// Format respons standar, sama seperti konvensi GAS lama
export function ok(res, message, data = null, code = 200) {
  return res.status(code).json({ status: 'success', message, data, code });
}
export function fail(res, message, code = 400) {
  return res.status(code).json({ status: 'error', message, data: null, code });
}

export const newId = (prefix) => `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
export const newToken = () => crypto.randomBytes(32).toString('hex');

export async function recordLog(userId, actionType, description, status = 'Sukses') {
  await pool.query(
    'INSERT INTO logs (user_id, action_type, description, status) VALUES (?, ?, ?, ?)',
    [userId, actionType, description, status]
  );
}

/**
 * Buat notifikasi lonceng untuk seorang user.
 * type: ACTIVITY | SO_NOTE | SO_CHAT | MENTION | CHAT (CHAT tidak dipakai - chat pribadi pakai badge bubble)
 */
export async function createNotification({ userId, actorId = null, type, title, message = null, link = null }) {
  // jangan buat notifikasi untuk diri sendiri
  if (userId === actorId) return;
  await pool.query(
    'INSERT INTO notifications (user_id, actor_id, type, title, message, link) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, actorId, type, title, message, link]
  );
}

/**
 * Simpan file hasil upload base64 ke folder tujuan (relatif root backend).
 * Mengembalikan path publik "/uploads/<subdir>/<nama>".
 */
export function saveBase64File(base64Data, mimeType, originalName, subdir, maxBytes = 10 * 1024 * 1024) {
  const raw = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const buffer = Buffer.from(raw, 'base64');
  if (buffer.length === 0) throw new Error('File kosong atau bukan base64 yang valid.');
  if (buffer.length > maxBytes) throw new Error('Ukuran file melebihi batas maksimal.');

  const namaFile = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(originalName || '')}`;
  const dir = path.join('uploads', subdir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, namaFile), buffer);
  return `/uploads/${subdir}/${namaFile}`;
}

/**
 * Ambil semua @username yang disebut dalam teks, balikkan daftar user (id, username).
 * Format mention: @username (huruf, angka, titik, underscore).
 */
export async function extractMentionedUsers(text) {
  const names = [...new Set((text.match(/@([a-zA-Z0-9._]+)/g) || []).map((m) => m.slice(1)))];
  if (names.length === 0) return [];
  const placeholders = names.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT id, username, nama FROM users WHERE username IN (${placeholders}) AND status = 'active'`,
    names
  );
  return rows;
}
