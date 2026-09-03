import { Router } from 'express';
import { pool } from '../db.js';
import { ok, fail } from '../utils.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// NOTIFIKASI LONCENG (terbaru dulu, maks 30)
router.get('/notifications', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT n.id, n.type, n.title, n.message, n.link, n.is_read,
            n.created_at AS date, n.actor_id,
            u.nama AS actor_nama, u.avatar_url AS actor_avatar
     FROM notifications n
     LEFT JOIN users u ON u.id = n.actor_id
     WHERE n.user_id = ?
     ORDER BY n.created_at DESC
     LIMIT 30`,
    [req.user.id]
  );
  const [[{ jumlah_belum_dibaca }]] = await pool.query(
    'SELECT COUNT(*) AS jumlah_belum_dibaca FROM notifications WHERE user_id = ? AND is_read = 0',
    [req.user.id]
  );
  return ok(res, 'Notifikasi dimuat', { items: rows, unread: jumlah_belum_dibaca });
});

// TANDAI SUDAH DIBACA (satu atau semua sekaligus)
router.post('/notifications/read', async (req, res) => {
  const { ids } = req.body || {};
  if (Array.isArray(ids) && ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    await pool.query(
      `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id IN (${placeholders})`,
      [req.user.id, ...ids]
    );
  } else {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
  }
  return ok(res, 'Notifikasi ditandai dibaca');
});

export default router;
