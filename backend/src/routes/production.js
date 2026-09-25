// Route modul Production — basis WORKING ORDER (WO):
// upload WO admin, papan antrean per mesin (drag-drop), output operator (app + halaman
// publik per mesin dengan kode akses), dan progress SO vs BOQ. QR lama & job otomatis
// dari BOQ sudah tidak dipakai. Membaca data SO; menulis hanya ke tabel production_*
// dan kolom so.progress (write-back yang disetujui).
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { ok, fail, recordLog, createNotification } from '../utils.js';
import { requireAuth } from '../middleware/auth.js';
import {
  MACHINES, createWo, recordWoOutput, setWoItemStatus, reorderQueue,
  recomputeSoProgress, soProductionSummary,
} from '../productionService.js';

const router = Router();

const itemCols = `wi.id, wi.wo_id, wi.so_id, wi.machine, wi.item, wi.length_mm, wi.qty_target, wi.unit,
  wi.raw_material, wi.multiplier_weight, wi.req_galva, wi.coil_number, wi.qty_done, wi.status,
  wi.queue_order, wi.started_at, wi.finished_at, wi.updated_at`;

const itemView = (r) => ({
  id: r.id, woId: r.wo_id, soId: r.so_id, machine: r.machine, item: r.item,
  lengthMm: r.length_mm ?? null, qtyTarget: Number(r.qty_target), unit: r.unit,
  rawMaterial: r.raw_material ?? null, multiplierWeight: r.multiplier_weight != null ? Number(r.multiplier_weight) : null,
  reqGalva: !!r.req_galva, coilNumber: r.coil_number ?? null,
  qtyDone: Number(r.qty_done), status: r.status, queueOrder: r.queue_order,
  startedAt: r.started_at, finishedAt: r.finished_at, updatedAt: r.updated_at,
  customer: r.customer ?? null, projectCode: r.project_code ?? null,
});

// Broadcast notifikasi ke semua user aktif yang boleh mengakses modul SO
// (pola sama dengan notifySoUsers di routes/so.js — user '/so' = user produksi/pengiriman/dst.)
async function notifySoUsers({ actorId, title, message, link, excludeIds = [] }) {
  const [users] = await pool.query(
    `SELECT u.id FROM users u
     JOIN roles r ON r.nama_role = u.role
     WHERE u.status = 'active' AND JSON_CONTAINS(r.akses_menu, JSON_QUOTE('/so'))`
  );
  for (const usr of users) {
    if (excludeIds.includes(usr.id)) continue;
    await createNotification({ userId: usr.id, actorId, type: 'PRODUCTION', title, message, link });
  }
}

async function getWoItem(id) {
  const [[item]] = await pool.query(
    `SELECT ${itemCols} FROM production_wo_items wi WHERE wi.id = ?`, [id]
  );
  return item || null;
}

// ====================================================================
// HALAMAN OPERATOR PER MESIN (tanpa login, kode akses mesin)
// ====================================================================

async function verifyMachineCode(machine, code) {
  if (!MACHINES.includes(machine)) return { error: 'Mesin tidak dikenal.', code: 404 };
  const [[row]] = await pool.query('SELECT code_hash FROM production_machine_access WHERE machine = ?', [machine]);
  if (!row?.code_hash) return { error: 'Kode akses mesin ini belum disetel admin.', code: 404 };
  if (!code) return { error: 'Kode akses wajib diisi.', code: 401 };
  const benar = await bcrypt.compare(String(code), row.code_hash);
  if (!benar) return { error: 'Kode akses salah.', code: 401 };
  return { ok: true };
}

async function machineQueue(machine) {
  const [items] = await pool.query(
    `SELECT ${itemCols}, w.project_code, w.customer
     FROM production_wo_items wi JOIN production_wo w ON w.id = wi.wo_id
     WHERE wi.machine = ? AND wi.status IN ('running','paused','queued')
     ORDER BY wi.status = 'running' DESC, wi.queue_order ASC`,
    [machine]
  );
  return items.map(itemView);
}

// POST /api/production/public/machine/:machine/verify { code } — cek kode akses
router.post('/public/machine/:machine/verify', async (req, res) => {
  const cek = await verifyMachineCode(req.params.machine, req.body?.code);
  if (cek.error) return fail(res, cek.error, cek.code);
  const items = await machineQueue(req.params.machine);
  return ok(res, 'Kode akses benar', { machine: req.params.machine, items });
});

// GET /api/production/public/machine/:machine?code= — antrean WO mesin
router.get('/public/machine/:machine', async (req, res) => {
  const cek = await verifyMachineCode(req.params.machine, req.query.code);
  if (cek.error) return fail(res, cek.error, cek.code);
  const items = await machineQueue(req.params.machine);
  return ok(res, 'Antrean dimuat', { machine: req.params.machine, items });
});

// POST /api/production/public/machine/:machine/output { code, itemId, qty, operatorNama, note }
// Operator hanya boleh mengupdate WO TERATAS antrean mesin (diatur admin via pause + drag).
router.post('/public/machine/:machine/output', async (req, res) => {
  const { code, itemId, qty, operatorNama, note } = req.body || {};
  const cek = await verifyMachineCode(req.params.machine, code);
  if (cek.error) return fail(res, cek.error, cek.code);
  if (!operatorNama || !String(operatorNama).trim()) return fail(res, 'Nama operator wajib diisi.', 422);

  const item = await getWoItem(itemId);
  if (!item || item.machine !== req.params.machine || !['queued', 'running', 'paused'].includes(item.status)) {
    return fail(res, 'Item WO tidak ditemukan / sudah selesai.', 404);
  }

  const [[teratas]] = await pool.query(
    `SELECT id FROM production_wo_items
     WHERE machine = ? AND status IN ('running','paused','queued')
     ORDER BY status = 'running' DESC, queue_order ASC LIMIT 1`,
    [req.params.machine]
  );
  if (!teratas || teratas.id !== item.id) {
    return fail(res, 'Hanya WO teratas antrean yang bisa diupdate. Minta admin untuk pause WO aktif dan menaikkan WO yang ingin dikerjakan.', 403);
  }
  const hasil = await recordWoOutput({
    item, qty: parseFloat(qty), note, inputVia: 'operator',
    operatorNama: String(operatorNama),
  });
  if (hasil.error) return fail(res, hasil.error, 422);
  await recomputeSoProgress(item.so_id);
  return ok(res, hasil.selesai ? `Output tercatat — ${item.item} selesai!` : 'Output tercatat', hasil, 201);
});

// ====================================================================
// ENDPOINT APLIKASI (login)
// ====================================================================
router.use(requireAuth);

// POST /api/production/wo { soId, projectCode, customer, preparedBy, items[] }
router.post('/wo', async (req, res) => {
  const { soId, projectCode, customer, preparedBy, items } = req.body || {};
  const [[so]] = await pool.query('SELECT id, customer FROM so WHERE id = ?', [soId]);
  if (!so) return fail(res, 'Nomor SO tidak ditemukan di sistem.', 404);

  const hasil = await createWo({
    soId, projectCode, customer, preparedBy, items, userId: req.user.id,
  });
  if (hasil.error) return fail(res, hasil.error, 422);

  await recordLog(req.user.id, 'WO_CREATE', `Upload WO ${hasil.woId} untuk SO ${soId} (${hasil.jumlahItem} item)`);
  await notifySoUsers({
    actorId: req.user.id,
    title: `Working Order baru ${hasil.woId}`,
    message: `${req.user.nama} mengupload WO ${hasil.woId} untuk SO ${soId} — ${hasil.jumlahItem} item masuk antrean mesin.`,
    link: '/production',
    excludeIds: [req.user.id],
  });
  return ok(res, `WO ${hasil.woId} berhasil dibuat — ${hasil.jumlahItem} item masuk antrean mesin`, hasil, 201);
});

// GET /api/production/wo?soId= — daftar WO + progress (+ item bila filter soId)
router.get('/wo', async (req, res) => {
  const { soId } = req.query;
  let rows;
  if (soId) {
    [rows] = await pool.query(
      `SELECT w.*, u.nama AS created_by_nama,
              (SELECT COUNT(*) FROM production_wo_items i WHERE i.wo_id = w.id AND i.status <> 'cancelled') AS jumlah_item,
              (SELECT COALESCE(SUM(LEAST(i.qty_done, i.qty_target)), 0) FROM production_wo_items i WHERE i.wo_id = w.id AND i.status <> 'cancelled') AS total_done,
              (SELECT COALESCE(SUM(i.qty_target), 0) FROM production_wo_items i WHERE i.wo_id = w.id AND i.status <> 'cancelled') AS total_target
       FROM production_wo w LEFT JOIN users u ON u.id = w.created_by
       WHERE w.so_id = ? ORDER BY w.created_at DESC`, [soId]
    );
    const [items] = await pool.query(
      `SELECT ${itemCols} FROM production_wo_items wi WHERE wi.so_id = ?
        ORDER BY wi.machine, wi.queue_order`, [soId]
    );
    return ok(res, 'Daftar WO dimuat', {
      list: rows.map(woView),
      items: items.map(itemView),
    });
  }
  [rows] = await pool.query(
    `SELECT w.*, u.nama AS created_by_nama,
            (SELECT COUNT(*) FROM production_wo_items i WHERE i.wo_id = w.id AND i.status <> 'cancelled') AS jumlah_item,
            (SELECT COALESCE(SUM(LEAST(i.qty_done, i.qty_target)), 0) FROM production_wo_items i WHERE i.wo_id = w.id AND i.status <> 'cancelled') AS total_done,
            (SELECT COALESCE(SUM(i.qty_target), 0) FROM production_wo_items i WHERE i.wo_id = w.id AND i.status <> 'cancelled') AS total_target
     FROM production_wo w LEFT JOIN users u ON u.id = w.created_by
     ORDER BY w.created_at DESC LIMIT 200`
  );
  return ok(res, 'Daftar WO dimuat', rows.map(woView));
});

const woView = (r) => ({
  id: r.id, soId: r.so_id, projectCode: r.project_code, customer: r.customer,
  preparedBy: r.prepared_by, createdBy: r.created_by_nama, createdAt: r.created_at,
  jumlahItem: Number(r.jumlah_item), totalDone: Number(r.total_done), totalTarget: Number(r.total_target),
  progress: Number(r.total_target) > 0 ? Math.round((Number(r.total_done) / Number(r.total_target)) * 100) : 0,
});

// GET /api/production/wo/:id — detail satu WO (header + semua item) untuk modal mengambang
router.get('/wo/:id', async (req, res) => {
  const [[w]] = await pool.query(
    `SELECT w.*, u.nama AS created_by_nama FROM production_wo w
     LEFT JOIN users u ON u.id = w.created_by WHERE w.id = ?`, [req.params.id]
  );
  if (!w) return fail(res, 'WO tidak ditemukan', 404);
  const [items] = await pool.query(
    `SELECT ${itemCols} FROM production_wo_items wi WHERE wi.wo_id = ?
     ORDER BY wi.machine, wi.queue_order`, [req.params.id]
  );
  const list = woView(w);
  return ok(res, 'Detail WO dimuat', { ...list, items: items.map(itemView) });
});

// GET /api/production/queue — papan antrean semua mesin
router.get('/queue', async (req, res) => {
  const [items] = await pool.query(
    `SELECT ${itemCols}, w.project_code, w.customer, s.progress AS so_progress, s.project_name
     FROM production_wo_items wi
     JOIN production_wo w ON w.id = wi.wo_id
     JOIN so s ON s.id = wi.so_id
     WHERE wi.status IN ('running','paused','queued')
     ORDER BY wi.status = 'running' DESC, wi.queue_order ASC`
  );
  const boards = MACHINES.map((machine) => ({
    machine,
    items: items.filter((i) => i.machine === machine).map(itemView),
  }));
  return ok(res, 'Papan antrean dimuat', boards);
});

// POST /api/production/wo/items/:id/output { qty, note } — update dari halaman admin
router.post('/wo/items/:id/output', async (req, res) => {
  const { qty, note } = req.body || {};
  const item = await getWoItem(req.params.id);
  if (!item || !['queued', 'running', 'paused'].includes(item.status)) {
    return fail(res, 'Item WO tidak ditemukan / sudah selesai.', 404);
  }
  const hasil = await recordWoOutput({
    item, qty: parseFloat(qty), note, inputVia: 'app', userId: req.user.id,
  });
  if (hasil.error) return fail(res, hasil.error, 422);
  const pct = await recomputeSoProgress(item.so_id);
  await recordLog(req.user.id, 'WO_OUTPUT', `Update output ${item.wo_id}/${item.item} @ ${item.machine} +${qty}`);
  return ok(res, hasil.selesai ? `Output tercatat — ${item.item} selesai!` : 'Output tercatat', { ...hasil, soProgress: pct }, 201);
});

// POST /api/production/wo/items/:id/status { action: pause|resume|cancel }
router.post('/wo/items/:id/status', async (req, res) => {
  const item = await getWoItem(req.params.id);
  if (!item) return fail(res, 'Item WO tidak ditemukan.', 404);
  const hasil = await setWoItemStatus(item, req.body?.action);
  if (hasil.error) return fail(res, hasil.error, 422);
  await recordLog(req.user.id, 'WO_STATUS', `${req.body.action} item ${item.wo_id}/${item.item} @ ${item.machine}`);
  return ok(res, `Status item diubah ke ${hasil.status}`, hasil);
});

// POST /api/production/queue/reorder { machine, itemIds[] }
router.post('/queue/reorder', async (req, res) => {
  const { machine, itemIds } = req.body || {};
  const hasil = await reorderQueue(machine, itemIds);
  if (hasil.error) return fail(res, hasil.error, 422);
  return ok(res, 'Urutan antrean diperbarui');
});

// GET /api/production/machines — status kode akses tiap mesin + link operator
router.get('/machines', async (req, res) => {
  const [rows] = await pool.query('SELECT machine, code_hash, updated_at FROM production_machine_access');
  const machines = MACHINES.map((m) => {
    const r = rows.find((x) => x.machine === m);
    return { machine: m, codeSet: !!r?.code_hash, updatedAt: r?.updated_at ?? null };
  });
  return ok(res, 'Status kode akses dimuat', machines);
});

// POST /api/production/machines/:machine/code { code } — setel/ubah kode akses
router.post('/machines/:machine/code', async (req, res) => {
  const { code } = req.body || {};
  if (!code || String(code).trim().length < 3) return fail(res, 'Kode akses minimal 3 karakter.', 422);
  const machine = req.params.machine;
  if (!MACHINES.includes(machine)) return fail(res, 'Mesin tidak dikenal.', 404);
  const hash = await bcrypt.hash(String(code).trim(), 10);
  await pool.query(
    `INSERT INTO production_machine_access (machine, code_hash, updated_by) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE code_hash = VALUES(code_hash), updated_by = VALUES(updated_by)`,
    [machine, hash, req.user.id]
  );
  await recordLog(req.user.id, 'WO_MACHINE_CODE', `Setel kode akses mesin ${machine}`);
  return ok(res, `Kode akses mesin ${machine} disimpan`);
});

// GET /api/production/so/:soId/summary — progress SO vs BOQ per mesin (widget DetailSO)
router.get('/so/:soId/summary', async (req, res) => {
  const hasil = await soProductionSummary(req.params.soId);
  if (hasil.error) return fail(res, hasil.error, 404);
  return ok(res, 'Ringkasan produksi SO dimuat', hasil);
});

// GET /api/production/overview — statistik dashboard (basis WO)
router.get('/overview', async (req, res) => {
  const [woToday] = await pool.query(
    "SELECT COUNT(*) AS n FROM production_wo WHERE DATE(created_at) = CURDATE()"
  );
  const [items] = await pool.query(
    `SELECT machine,
            SUM(status = 'running') AS running,
            SUM(status IN ('queued','running','paused')) AS aktif,
            SUM(status = 'done') AS selesai,
            SUM(LEAST(qty_done, qty_target)) AS done, SUM(qty_target) AS target
     FROM production_wo_items WHERE status <> 'cancelled' GROUP BY machine`
  );
  const machines = MACHINES.map((key) => {
    const r = items.find((m) => m.machine === key);
    return {
      key,
      status: Number(r?.running) > 0 ? 'running' : 'idle',
      runningJobs: Number(r?.running) || 0,
      totalJobs: (Number(r?.aktif) || 0) + (Number(r?.selesai) || 0),
      done: Number(r?.done) || 0,
      target: Number(r?.target) || 0,
    };
  });

  const [today] = await pool.query(
    'SELECT COALESCE(SUM(qty), 0) AS qty FROM production_output_logs WHERE wo_item_id IS NOT NULL AND created_at >= CURDATE()'
  );
  const [yesterday] = await pool.query(
    'SELECT COALESCE(SUM(qty), 0) AS qty FROM production_output_logs WHERE wo_item_id IS NOT NULL AND created_at >= CURDATE() - INTERVAL 1 DAY AND created_at < CURDATE()'
  );
  const [series] = await pool.query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COALESCE(SUM(qty), 0) AS qty
     FROM production_output_logs
     WHERE wo_item_id IS NOT NULL AND created_at >= CURDATE() - INTERVAL 13 DAY
     GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d') ORDER BY d`
  );
  const mapByDate = new Map(series.map((r) => [r.d, Number(r.qty)]));
  const days = [], actual = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push(`${d.getDate()}/${d.getMonth() + 1}`);
    actual.push(mapByDate.get(key) || 0);
  }

  // Project berjalan: SO yang punya item WO aktif
  const [projects] = await pool.query(
    `SELECT s.id, s.customer, s.project_name, s.progress,
            SUM(LEAST(wi.qty_done, wi.qty_target)) AS wo_done, SUM(wi.qty_target) AS wo_target,
            SUM(wi.status = 'running') AS running_items
     FROM so s JOIN production_wo_items wi ON wi.so_id = s.id AND wi.status IN ('running','paused','queued','done')
     GROUP BY s.id, s.customer, s.project_name, s.progress
     ORDER BY running_items DESC, s.progress DESC LIMIT 50`
  );

  const [ongoing] = await pool.query(
    `SELECT ${itemCols}, w.project_code, w.customer
     FROM production_wo_items wi JOIN production_wo w ON w.id = wi.wo_id
     WHERE wi.status = 'running' ORDER BY wi.updated_at DESC LIMIT 50`
  );

  const totalTarget = machines.reduce((a, m) => a + m.target, 0);
  const totalDone = machines.reduce((a, m) => a + m.done, 0);
  return ok(res, 'Overview produksi dimuat', {
    cards: {
      woToday: Number(woToday[0]?.n) || 0,
      runningItems: machines.reduce((a, m) => a + m.runningJobs, 0),
      totalMaterialDone: totalDone,
      totalMaterialTarget: totalTarget,
      outputToday: Number(today[0]?.qty) || 0,
      outputYesterday: Number(yesterday[0]?.qty) || 0,
    },
    output14d: { days, actual },
    machines,
    projects: projects.map((p) => ({
      id: p.id, customer: p.customer, projectName: p.project_name,
      progress: Number(p.progress) || 0,
      woDone: Number(p.wo_done), woTarget: Number(p.wo_target), runningItems: Number(p.running_items),
    })),
    ongoing: ongoing.map((j) => ({ ...itemView(j), customer: j.customer, projectCode: j.project_code })),
  });
});

// GET /api/production/buffer-stock — histori buffer stock era job otomatis (tidak bertambah lagi)
router.get('/buffer-stock', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM v_production_buffer_stock ORDER BY origin_so_id, article_code'
  );
  return ok(res, 'Buffer stock dimuat', rows.map((r) => ({
    originSoId: r.origin_so_id, articleCode: r.article_code, dim1: r.dim1, dim2: r.dim2,
    colour: r.colour, jobCount: Number(r.jumlah_job), qtyBuffer: Number(r.qty_buffer),
  })));
});

export default router;
