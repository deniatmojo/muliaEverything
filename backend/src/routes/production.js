// Route modul Production: job per mesin, pencatatan output operator (app & QR publik),
// buffer stock, dan ringkasan dashboard. Membaca data SO; menulis hanya ke tabel
// production_* dan kolom so.progress (write-back yang disetujui).
import { Router } from 'express';
import crypto from 'node:crypto';
import { pool } from '../db.js';
import { ok, fail, newId, recordLog } from '../utils.js';
import { requireAuth } from '../middleware/auth.js';
import { ensureJobsForActiveVersion, recomputeSoProgress, recordOutput } from '../productionService.js';

const router = Router();

const MACHINES = ['upright', 'bracing', 'beam', 'welding', 'painting'];
const PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:5173';

const jobView = (j) => ({
  id: j.id, soId: j.so_id, machine: j.machine, articleCode: j.article_code,
  dim1: j.dim1 ?? null, dim2: j.dim2 ?? null, colour: j.colour ?? null,
  qtyTarget: Number(j.qty_target), qtyDone: Number(j.qty_done), status: j.status,
  startedAt: j.started_at, finishedAt: j.finished_at, updatedAt: j.updated_at,
});

async function getSoSummary(soId) {
  const [[so]] = await pool.query(
    `SELECT s.id, s.customer, s.project_name, s.company, s.project_number, s.status, s.stage,
            s.progress, s.pallet_count, v.version_no AS active_version
     FROM so s LEFT JOIN so_versions v ON v.id = s.active_version_id WHERE s.id = ?`,
    [soId]
  );
  return so || null;
}

// ====================================================================
// ENDPOINT PUBLIK (halaman scan QR lapangan, tanpa login)
// ====================================================================

async function loadValidToken(token) {
  const [[t]] = await pool.query('SELECT * FROM production_qr_tokens WHERE token = ?', [token]);
  if (!t) return { error: 'QR tidak ditemukan.', code: 404 };
  if (t.revoked) return { error: 'QR ini sudah dicabut.', code: 403 };
  if (new Date(t.expires_at) < new Date()) return { error: 'QR sudah kedaluwarsa. Minta admin generate QR baru.', code: 403 };
  return { t };
}

// GET /api/production/public/:token — detail SO + job per mesin untuk diupdate
router.get('/public/:token', async (req, res) => {
  const { error, code, t } = await loadValidToken(req.params.token);
  if (error) return fail(res, error, code);
  const so = await getSoSummary(t.so_id);
  if (!so) return fail(res, 'SO tidak ditemukan', 404);
  const [jobs] = await pool.query(
    "SELECT * FROM production_jobs WHERE so_id = ? AND status IN ('queued','running','paused','done') ORDER BY machine, article_code, dim1",
    [t.so_id]
  );
  const pct = jobs.length
    ? Math.round(jobs.reduce((a, j) => a + Math.min(j.qty_done, j.qty_target), 0) / jobs.reduce((a, j) => a + j.qty_target, 0) * 100)
    : 0;
  return ok(res, 'Data produksi dimuat', {
    so, progress: pct, expiresAt: t.expires_at, qrId: t.id,
    jobs: jobs.map(jobView),
  });
});

// POST /api/production/public/:token/output { jobId, qty, note, operatorNama }
router.post('/public/:token/output', async (req, res) => {
  const { error, code, t } = await loadValidToken(req.params.token);
  if (error) return fail(res, error, code);
  const { jobId, qty, note, operatorNama } = req.body || {};
  if (!jobId) return fail(res, 'Job wajib dipilih.', 422);
  if (!operatorNama || !String(operatorNama).trim()) return fail(res, 'Nama operator wajib diisi.', 422);

  const [[job]] = await pool.query(
    "SELECT * FROM production_jobs WHERE id = ? AND so_id = ? AND status IN ('queued','running','paused')",
    [jobId, t.so_id]
  );
  if (!job) return fail(res, 'Job tidak ditemukan atau sudah selesai.', 404);

  const hasil = await recordOutput({
    job, qty: parseFloat(qty), note, inputVia: 'qr', qrTokenId: t.id,
    operatorNama: String(operatorNama), userId: null,
  });
  if (hasil.error) return fail(res, hasil.error, 422);
  await recomputeSoProgress(t.so_id);
  return ok(res, hasil.selesai ? `Output tercatat — job ${job.article_code} selesai!` : 'Output tercatat', hasil, 201);
});

// ====================================================================
// ENDPOINT APLIKASI (login)
// ====================================================================
router.use(requireAuth);

// GET /api/production/overview — statistik dashboard & status mesin hari ini
router.get('/overview', async (req, res) => {
  const [projects] = await pool.query(
    `SELECT s.id, s.customer, s.project_name, s.status, s.progress,
            (SELECT COALESCE(SUM(j.qty_target), 0) FROM production_jobs j
              WHERE j.so_id = s.id AND j.status IN ('queued','running','paused','done')) AS total_target,
            (SELECT COALESCE(SUM(LEAST(j.qty_done, j.qty_target)), 0) FROM production_jobs j
              WHERE j.so_id = s.id AND j.status IN ('queued','running','paused','done')) AS total_done,
            (SELECT COUNT(*) FROM production_jobs j WHERE j.so_id = s.id AND j.status = 'running') AS running_jobs
     FROM so s
     WHERE s.status = 'active'
       AND EXISTS (SELECT 1 FROM production_jobs j WHERE j.so_id = s.id AND j.status IN ('running','paused','done'))
     ORDER BY s.progress DESC`
  );

  const [today] = await pool.query(
    'SELECT COALESCE(SUM(qty), 0) AS qty FROM production_output_logs WHERE created_at >= CURDATE()'
  );
  const [yesterday] = await pool.query(
    'SELECT COALESCE(SUM(qty), 0) AS qty FROM production_output_logs WHERE created_at >= CURDATE() - INTERVAL 1 DAY AND created_at < CURDATE()'
  );

  // Output 14 hari terakhir (aktual dari log; target menyusul saat fitur target harian ada)
  const [series] = await pool.query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COALESCE(SUM(qty), 0) AS qty
     FROM production_output_logs
     WHERE created_at >= CURDATE() - INTERVAL 13 DAY
     GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d') ORDER BY d`
  );
  const mapByDate = new Map(series.map((r) => [String(r.d), Number(r.qty)]));
  const days = [], actual = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push(`${d.getDate()}/${d.getMonth() + 1}`);
    actual.push(mapByDate.get(key) || 0);
  }

  // Status mesin dederivasi dari job running; painting dsb. belum terhubung maintenance
  const [machineRows] = await pool.query(
    `SELECT machine,
            SUM(status = 'running') AS running,
            SUM(status IN ('queued','running','paused')) AS aktif,
            SUM(status IN ('queued','running','paused','done')) AS total,
            SUM(LEAST(qty_done, qty_target)) AS done, SUM(qty_target) AS target
     FROM production_jobs WHERE status IN ('queued','running','paused','done') GROUP BY machine`
  );
  const machines = MACHINES.map((key) => {
    const r = machineRows.find((m) => m.machine === key);
    return {
      key,
      status: Number(r?.running) > 0 ? 'running' : 'idle',
      runningJobs: Number(r?.running) || 0,
      totalJobs: Number(r?.total) || 0,
      done: Number(r?.done) || 0,
      target: Number(r?.target) || 0,
    };
  });

  // Job yang sedang berjalan per mesin (tab On Going)
  const [ongoing] = await pool.query(
    `SELECT j.*, s.customer, s.project_name FROM production_jobs j
     JOIN so s ON s.id = j.so_id
     WHERE j.status = 'running' ORDER BY j.updated_at DESC LIMIT 50`
  );

  const totalTarget = projects.reduce((a, p) => a + Number(p.total_target), 0);
  const totalDone = projects.reduce((a, p) => a + Number(p.total_done), 0);
  return ok(res, 'Overview produksi dimuat', {
    cards: {
      activeProjects: projects.length,
      totalMaterialDone: totalDone,
      totalMaterialTarget: totalTarget,
      outputToday: Number(today[0]?.qty) || 0,
      outputYesterday: Number(yesterday[0]?.qty) || 0,
    },
    output14d: { days, actual },
    machines,
    projects: projects.map((p) => ({
      ...p, progress: Number(p.progress) || 0,
      totalTarget: Number(p.total_target), totalDone: Number(p.total_done),
    })),
    ongoing: ongoing.map((j) => ({ ...jobView(j), customer: j.customer, projectName: j.project_name })),
  });
});

// GET /api/production/buffer-stock — hasil produksi yang tak terpakai karena BOQ berubah
router.get('/buffer-stock', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM v_production_buffer_stock ORDER BY origin_so_id, article_code'
  );
  return ok(res, 'Buffer stock dimuat', rows.map((r) => ({
    originSoId: r.origin_so_id, articleCode: r.article_code, dim1: r.dim1, dim2: r.dim2,
    colour: r.colour, jobCount: Number(r.jumlah_job), qtyBuffer: Number(r.qty_buffer),
  })));
});

// GET /api/production/:soId/jobs — siapkan job versi aktif + daftar job + buffer SO
router.get('/:soId/jobs', async (req, res) => {
  const soId = req.params.soId;
  const so = await getSoSummary(soId);
  if (!so) return fail(res, 'SO tidak ditemukan', 404);

  const hasil = await ensureJobsForActiveVersion(soId, req.user.id);
  if (hasil.error) return fail(res, hasil.error, 422);

  const [jobs] = await pool.query(
    "SELECT * FROM production_jobs WHERE so_id = ? AND status IN ('queued','running','paused','done') ORDER BY machine, article_code, dim1",
    [soId]
  );
  const [buffered] = await pool.query(
    "SELECT * FROM production_jobs WHERE so_id = ? AND status = 'buffered' AND qty_done > 0 ORDER BY article_code",
    [soId]
  );
  const [tokens] = await pool.query(
    `SELECT id, token, expires_at, revoked, created_at FROM production_qr_tokens
     WHERE so_id = ? AND revoked = 0 ORDER BY created_at DESC LIMIT 5`,
    [soId]
  );
  const pct = await recomputeSoProgress(soId);
  return ok(res, 'Job produksi dimuat', {
    so: { ...so, progress: pct },
    jobs: jobs.map(jobView),
    buffer: buffered.map(jobView),
    qrTokens: tokens.map((t) => ({ id: t.id, url: `${PUBLIC_URL}/production/scan/${t.token}`, expiresAt: t.expires_at, createdAt: t.created_at })),
  });
});

// POST /api/production/jobs/:id/output { qty, note } — update dari halaman admin
router.post('/jobs/:id/output', async (req, res) => {
  const { qty, note } = req.body || {};
  const [[job]] = await pool.query(
    "SELECT * FROM production_jobs WHERE id = ? AND status IN ('queued','running','paused')",
    [req.params.id]
  );
  if (!job) return fail(res, 'Job tidak ditemukan atau sudah selesai.', 404);

  const hasil = await recordOutput({
    job, qty: parseFloat(qty), note, inputVia: 'app', userId: req.user.id,
  });
  if (hasil.error) return fail(res, hasil.error, 422);
  const pct = await recomputeSoProgress(job.so_id);
  await recordLog(req.user.id, 'PRODUCTION_OUTPUT', `Update output job #${job.id} (${job.article_code} @ ${job.machine}) +${qty}`);
  return ok(res, hasil.selesai ? `Output tercatat — job ${job.article_code} selesai!` : 'Output tercatat', { ...hasil, progress: pct }, 201);
});

// POST /api/production/:soId/qr { duration: '1d'|'7d'|'30d'|'production' } — generate QR lapangan
router.post('/:soId/qr', async (req, res) => {
  const soId = req.params.soId;
  const { duration } = req.body || {};
  const [[so]] = await pool.query('SELECT id FROM so WHERE id = ?', [soId]);
  if (!so) return fail(res, 'SO tidak ditemukan', 404);

  const days = duration === '1d' ? 1 : duration === '7d' ? 7 : duration === '30d' ? 30 : null;
  const expiresAt = days ? new Date(Date.now() + days * 86400000) : new Date('2099-12-31');
  const id = newId('qrt');
  const token = crypto.randomBytes(24).toString('hex');
  await pool.query(
    'INSERT INTO production_qr_tokens (id, so_id, token, expires_at, created_by) VALUES (?,?,?,?,?)',
    [id, soId, token, expiresAt.toISOString().slice(0, 19).replace('T', ' '), req.user.id]
  );
  await recordLog(req.user.id, 'PRODUCTION_QR', `Generate QR lapangan untuk SO ${soId} (${duration})`);
  return ok(res, 'QR berhasil dibagikan', {
    id, url: `${PUBLIC_URL}/production/scan/${token}`, expiresAt,
  }, 201);
});

// POST /api/production/qr/:id/revoke — cabut QR
router.post('/qr/:id/revoke', async (req, res) => {
  const { id } = req.params;
  const [hasil] = await pool.query('UPDATE production_qr_tokens SET revoked = 1 WHERE id = ?', [id]);
  if (!hasil.affectedRows) return fail(res, 'Token tidak ditemukan', 404);
  await recordLog(req.user.id, 'PRODUCTION_QR', `Mencabut QR lapangan ${id}`);
  return ok(res, 'QR dicabut');
});

export default router;
