import { Router } from 'express';
import { pool } from '../db.js';
import { ok } from '../utils.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

// Direktori Tim Maintenance: user aktif yang role-nya punya akses menu /maintenance
// (Developer tidak ditampilkan, sama seperti pola QC Team)
router.get('/team', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.nama, u.email, u.role, u.phone, u.avatar_url
     FROM users u
     JOIN roles r ON r.nama_role = u.role
     WHERE u.status = 'active'
       AND u.role <> 'Developer'
       AND JSON_SEARCH(r.akses_menu, 'one', '/maintenance') IS NOT NULL
     ORDER BY u.nama`
  );
  return ok(res, 'Data tim maintenance diambil', rows);
});

export default router;
