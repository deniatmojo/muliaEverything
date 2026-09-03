import { Router } from 'express';
import { pool } from '../db.js';
import { ok } from '../utils.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// DIREKTORI PENGGUNA AKTIF — untuk @mention dan memilih lawan chat
router.get('/directory', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, nama, username, email, position, avatar_url
     FROM users WHERE status = 'active' AND id <> ?
     ORDER BY nama`,
    [req.user.id]
  );
  return ok(res, 'Direktori pengguna dimuat', rows);
});

export default router;
