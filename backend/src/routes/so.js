import { Router } from 'express';
import { pool } from '../db.js';
import { ok, fail, recordLog, createNotification, saveBase64File, extractMentionedUsers, newId } from '../utils.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  parseBoqWorkbook, syncMaterialDictionary, getKursRmbIdr, computeTotals,
  diffMaterials, diffFrames, diffForm, insertVersionRows, normalizeMaterial, normalizeFrame,
} from '../soService.js';

const router = Router();
router.use(requireAuth);

// ====================================================================
// MASTER SO: LIST, CREATE, DETAIL, DELETE
// ====================================================================

// GET /api/so/kurs — kurs RMB→IDR hari ini (untuk kalkulasi budget live di frontend)
router.get('/kurs', async (req, res) => {
  const kursInfo = await getKursRmbIdr();
  if (!kursInfo) return fail(res, 'Kurs RMB→IDR belum tersedia, coba lagi nanti.', 503);
  return ok(res, 'Kurs dimuat', { kurs: kursInfo.kurs, source: kursInfo.source, date: kursInfo.date });
});

// GET /api/so — daftar semua SO + ringkasan versi aktif
router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT s.id, s.project_number, s.customer, s.project_name, s.sales_name,
            s.status, s.stage, s.progress, s.pallet_count, s.budget_idr,
            s.has_pending_change, s.created_at,
            v.version_no AS active_version,
            (SELECT COUNT(*) FROM so_materials m WHERE m.version_id = s.active_version_id) AS material_count,
            u.nama AS created_by_nama
     FROM so s
     LEFT JOIN so_versions v ON v.id = s.active_version_id
     LEFT JOIN users u ON u.id = s.created_by
     ORDER BY s.created_at DESC`
  );
  return ok(res, 'Daftar SO dimuat', rows);
});

// POST /api/so/create — buat SO baru (form + file excel awal, langsung aktif V.1)
router.post('/create', async (req, res) => {
  const { form, excel } = req.body || {};
  const f = form || {};
  const soId = String(f.soNumber || '').trim();
  if (!soId) return fail(res, 'Nomor SO wajib diisi.', 422);

  const [[ada]] = await pool.query('SELECT id FROM so WHERE id = ?', [soId]);
  if (ada) return fail(res, `Nomor SO ${soId} sudah terdaftar.`, 409);

  let parsed = null;
  let filePath = null, fileName = null;
  let kursInfo = null;

  if (excel?.base64Data) {
    try {
      const raw = excel.base64Data.includes(',') ? excel.base64Data.split(',')[1] : excel.base64Data;
      const buffer = Buffer.from(raw, 'base64');
      parsed = parseBoqWorkbook(buffer);
      filePath = saveBase64File(excel.base64Data, 'application/vnd.ms-excel', excel.fileName || `${soId}.xlsx`, 'so');
      fileName = excel.fileName || null;
    } catch (err) {
      return fail(res, 'Gagal membaca file Excel: ' + err.message, 422);
    }
  }
  kursInfo = await getKursRmbIdr();

  const totals = parsed ? computeTotals(parsed.materials) : { totalWeight: 0, importRmb: 0, lokalIdr: 0 };
  const kurs = kursInfo?.kurs ?? null;
  const budget = Math.round(totals.lokalIdr + totals.importRmb * (kurs || 0));
  const pallet = parsed?.palletCount ?? (parseInt(f.palletCount) || null);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO so (id, project_number, customer, project_name, company, sales_name, address,
        pallet_count, budget_idr, kurs, kurs_date, start_production, first_delivery, start_installation,
        target_installation, description, status, stage, progress, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [soId, f.projectNumber || parsed?.projectNumber || null, f.customerName || parsed?.customerName || null,
        f.projectName || null, f.companyName || null, f.salesName || null, f.address || null,
        pallet, budget, kurs, kursInfo?.date || null, f.startProduction || null, f.firstDelivery || null,
        f.startInstallation || null, f.targetInstallation || null, f.description || null,
        parsed ? 'active' : 'draft', 'produksi', 0, req.user.id]
    );
    const [ver] = await conn.query(
      `INSERT INTO so_versions (so_id, version_no, source, file_path, file_name, kurs, kurs_date,
        total_weight, total_import_rmb, total_lokal_idr, pallet_count, status, created_by, approved_at, approved_by)
       VALUES (?,1,?,?,?,?,?,?,?,?,?, 'active', ?, NOW(), ?)`,
      [soId, parsed ? (filePath ? 'excel' : 'excel') : 'initial', filePath, fileName, kurs, kursInfo?.date || null,
        totals.totalWeight, totals.importRmb, totals.lokalIdr, pallet, req.user.id, req.user.id]
    );
    if (parsed) {
      await insertVersionRows(conn, ver.insertId, soId, parsed.materials, parsed.frames);
    }
    await conn.query('UPDATE so SET active_version_id = ? WHERE id = ?', [ver.insertId, soId]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    return fail(res, 'Gagal menyimpan SO: ' + err.message, 500);
  } finally {
    conn.release();
  }

  if (parsed) await syncMaterialDictionary(parsed.materials, soId);
  await recordLog(req.user.id, 'SO_CREATE', `Membuat SO ${soId}`);
  return ok(res, `SO ${soId} berhasil dibuat`, { id: soId }, 201);
});

// GET /api/so/:soId/detail — master + material/frame versi aktif + riwayat versi + pending request
router.get('/:soId/detail', async (req, res) => {
  const soId = req.params.soId;
  const [[so]] = await pool.query('SELECT * FROM so WHERE id = ?', [soId]);
  if (!so) return fail(res, 'SO tidak ditemukan', 404);

  const [materials] = await pool.query(
    'SELECT * FROM so_materials WHERE version_id = ? ORDER BY sheet, article_code',
    [so.active_version_id]
  );
  const [frames] = await pool.query(
    'SELECT * FROM so_frames WHERE version_id = ? ORDER BY article_code',
    [so.active_version_id]
  );
  const [versions] = await pool.query(
    `SELECT id, version_no, source, file_name, kurs, kurs_date, status, created_at
     FROM so_versions WHERE so_id = ? ORDER BY version_no DESC`, [soId]
  );
  const [[pending]] = await pool.query(
    `SELECT id, type, submitted_at FROM so_change_requests WHERE so_id = ? AND status = 'pending'`,
    [soId]
  );
  return ok(res, 'Detail SO dimuat', {
    so, materials: materials.map(normalizeMaterial), frames: frames.map(normalizeFrame),
    versions, pending: pending || null,
  });
});

// DELETE /api/so/:soId — hanya Developer
router.delete('/:soId', requireRole('Developer'), async (req, res) => {
  const soId = req.params.soId;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // catatan & chat SO memakai id polos (notes) dan pola "SO#modul" (chat)
    await conn.query('DELETE FROM so_notes WHERE so_id = ?', [soId]);
    await conn.query('DELETE FROM so_chat_messages WHERE so_id = ? OR so_id LIKE ?', [soId, `${soId}#%`]);
    await conn.query('DELETE FROM so_materials WHERE so_id = ?', [soId]);
    await conn.query('DELETE FROM so_frames WHERE so_id = ?', [soId]);
    await conn.query('DELETE FROM so WHERE id = ?', [soId]); // cascade: versions + change requests
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    conn.release();
    return fail(res, 'Gagal menghapus SO: ' + err.message, 500);
  }
  conn.release();
  await recordLog(req.user.id, 'SO_DELETE', `Menghapus SO ${soId} permanen`);
  return ok(res, `SO ${soId} telah dihapus permanen`);
});

// ====================================================================
// CHANGE REQUESTS: UPLOAD EXCEL BARU, EDIT MANUAL, APPROVAL
// ====================================================================

async function notifyDevelopers({ actorId, title, message, link }) {
  const [devs] = await pool.query("SELECT id FROM users WHERE role = 'Developer' AND status = 'active'");
  for (const d of devs) {
    await createNotification({ userId: d.id, actorId, type: 'SO_APPROVAL', title, message, link });
  }
}

// util: ambil state aktif untuk perbandingan diff
async function getActiveState(soId) {
  const [[so]] = await pool.query('SELECT * FROM so WHERE id = ?', [soId]);
  if (!so) return null;
  const [materials] = await pool.query('SELECT * FROM so_materials WHERE version_id = ?', [so.active_version_id]);
  const [frames] = await pool.query('SELECT * FROM so_frames WHERE version_id = ?', [so.active_version_id]);
  return { so, materials: materials.map(normalizeMaterial), frames: frames.map(normalizeFrame) };
}

function buildImpact(soOld, totalsOld, totalsNew, palletNew, kurs) {
  const budgetOld = Math.round(totalsOld.lokalIdr + totalsOld.importRmb * (kurs || soOld.kurs || 0));
  const budgetNew = Math.round(totalsNew.lokalIdr + totalsNew.importRmb * (kurs || soOld.kurs || 0));
  return {
    pallet: { before: soOld.pallet_count, after: palletNew },
    berat: { before: totalsOld.totalWeight, after: totalsNew.totalWeight },
    importRMB: { before: totalsOld.importRmb, after: totalsNew.importRmb },
    lokalIDR: { before: totalsOld.lokalIdr, after: totalsNew.lokalIdr },
    budget: { before: budgetOld, after: budgetNew },
  };
}

// POST /api/so/:soId/upload — upload excel versi baru → draft + change request (menunggu approval)
router.post('/:soId/upload', async (req, res) => {
  const soId = req.params.soId;
  const { base64Data, fileName } = req.body || {};
  if (!base64Data) return fail(res, 'File Excel wajib diunggah.', 422);

  const [[so]] = await pool.query('SELECT * FROM so WHERE id = ?', [soId]);
  if (!so) return fail(res, 'SO tidak ditemukan', 404);
  if (so.has_pending_change) return fail(res, 'SO ini masih memiliki permintaan perubahan yang menunggu approval. Selesaikan dulu.', 409);

  let parsed;
  try {
    const raw = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    parsed = parseBoqWorkbook(Buffer.from(raw, 'base64'));
  } catch (err) {
    return fail(res, 'Gagal membaca file Excel: ' + err.message, 422);
  }

  const kursInfo = await getKursRmbIdr();
  const kurs = kursInfo?.kurs ?? so.kurs;
  const filePath = saveBase64File(base64Data, 'application/vnd.ms-excel', fileName || `${soId}.xlsx`, 'so');

  const active = await getActiveState(soId);
  const totalsNew = computeTotals(parsed.materials);
  const totalsOld = computeTotals(active.materials);
  const palletNew = parsed.palletCount ?? so.pallet_count;
  const diff = {
    form: [], // upload baru tidak menyentuh form
    materials: diffMaterials(active.materials, parsed.materials),
    frames: diffFrames(active.frames, parsed.frames),
  };
  const impact = buildImpact(so, totalsOld, totalsNew, palletNew, kurs);

  const conn = await pool.getConnection();
  let requestId, versionNo;
  try {
    await conn.beginTransaction();
    const [[lastVer]] = await conn.query(
      'SELECT COALESCE(MAX(version_no), 0) AS v FROM so_versions WHERE so_id = ?', [soId]
    );
    versionNo = lastVer.v + 1;
    const [ver] = await conn.query(
      `INSERT INTO so_versions (so_id, version_no, source, file_path, file_name, kurs, kurs_date,
        total_weight, total_import_rmb, total_lokal_idr, pallet_count, status, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [soId, versionNo, 'excel', filePath, fileName || null, kurs, kursInfo?.date || null,
        totalsNew.totalWeight, totalsNew.importRmb, totalsNew.lokalIdr, palletNew, 'pending', req.user.id]
    );
    await insertVersionRows(conn, ver.insertId, soId, parsed.materials, parsed.frames);
    requestId = newId('cr');
    await conn.query(
      `INSERT INTO so_change_requests (id, so_id, type, status, draft_version_id, diff, impact, requester_id)
       VALUES (?,?, 'excel', 'pending', ?, ?, ?, ?)`,
      [requestId, soId, ver.insertId, JSON.stringify(diff), JSON.stringify(impact), req.user.id]
    );
    await conn.query('UPDATE so SET has_pending_change = 1 WHERE id = ?', [soId]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    conn.release();
    return fail(res, 'Gagal memproses upload: ' + err.message, 500);
  }
  conn.release();

  await syncMaterialDictionary(parsed.materials, soId);
  await recordLog(req.user.id, 'SO_UPLOAD', `Upload BOQ V.${versionNo} untuk ${soId} (draft preview)`);
  return ok(res, 'Draft V.' + versionNo + ' berhasil diparse — periksa preview sebelum dikirim', { requestId, versionNo }, 201);
});

// POST /api/so/changes/:id/submit — kirim draft (hasil preview) ke antrean approval Developer
router.post('/changes/:id/submit', async (req, res) => {
  const [[cr]] = await pool.query("SELECT cr.*, s.id AS so_id FROM so_change_requests cr JOIN so s ON s.id = cr.so_id WHERE cr.id = ? AND cr.status = 'pending' AND cr.confirmed_at IS NULL", [req.params.id]);
  if (!cr) return fail(res, 'Draft tidak ditemukan / sudah dikirim', 404);
  if (cr.requester_id !== req.user.id) return fail(res, 'Hanya pengaju yang bisa mengirim draft ini.', 403);
  await pool.query('UPDATE so_change_requests SET confirmed_at = NOW() WHERE id = ?', [cr.id]);
  await recordLog(req.user.id, 'SO_SUBMIT', `Mengirim perubahan SO ${cr.so_id} untuk approval`);
  const typeLabel = cr.type === 'excel' ? `mengupload BOQ baru` : `mengajukan edit manual`;
  await notifyDevelopers({
    actorId: req.user.id,
    title: `Perubahan SO ${cr.so_id} menunggu approval`,
    message: `${req.user.nama} ${typeLabel} pada SO ${cr.so_id}.`,
    link: `/so`,
  });
  return ok(res, 'Perubahan dikirim, menunggu approval Developer');
});

// POST /api/so/:soId/manual-submit — hasil edit manual → change request
router.post('/:soId/manual-submit', async (req, res) => {
  const soId = req.params.soId;
  const { form, materials, frames } = req.body || {};
  if (!Array.isArray(materials)) return fail(res, 'Data material tidak valid.', 422);

  const [[so]] = await pool.query('SELECT * FROM so WHERE id = ?', [soId]);
  if (!so) return fail(res, 'SO tidak ditemukan', 404);
  if (so.has_pending_change) return fail(res, 'SO ini masih memiliki permintaan perubahan yang menunggu approval.', 409);

  const active = await getActiveState(soId);
  const totalsNew = computeTotals(materials);
  const totalsOld = computeTotals(active.materials);
  const palletNew = form?.palletCount != null ? parseInt(form.palletCount) : so.pallet_count;
  const diff = {
    form: diffForm(active.so, {
      customer: form.customerName, project_name: form.projectName, company: form.companyName,
      sales_name: form.salesName, address: form.address, start_production: form.startProduction,
      first_delivery: form.firstDelivery, start_installation: form.startInstallation,
      target_installation: form.targetInstallation, description: form.description,
    }),
    materials: diffMaterials(active.materials, materials),
    frames: diffFrames(active.frames, Array.isArray(frames) ? frames : []),
  };
  const impact = buildImpact(so, totalsOld, totalsNew, palletNew, so.kurs);

  const requestId = newId('cr');
  await pool.query(
    `INSERT INTO so_change_requests (id, so_id, type, status, payload, diff, impact, requester_id, confirmed_at)
     VALUES (?,?, 'manual', 'pending', ?, ?, ?, ?, NOW())`,
    [requestId, soId, JSON.stringify({ form: form || {}, materials, frames: frames || [], __totals: totalsNew }),
      JSON.stringify(diff), JSON.stringify(impact), req.user.id]
  );
  await pool.query('UPDATE so SET has_pending_change = 1 WHERE id = ?', [soId]);
  await recordLog(req.user.id, 'SO_EDIT', `Mengajukan edit manual pada SO ${soId}`);
  await notifyDevelopers({
    actorId: req.user.id,
    title: `Perubahan SO ${soId} menunggu approval`,
    message: `${req.user.nama} mengajukan edit manual pada SO ${soId}.`,
    link: `/so`,
  });
  return ok(res, 'Perubahan dikirim, menunggu approval Developer', { requestId }, 201);
});

// GET /api/so/changes/pending — antrean approval (termasuk draft yang belum dikirim pengajunya)
router.get('/changes/pending', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT cr.id, cr.so_id, cr.type, cr.confirmed_at, cr.diff, cr.impact, cr.submitted_at,
            u.nama AS requester_nama, u.username AS requester_username, u.avatar_url AS requester_avatar,
            v.version_no AS draft_version_no, v.file_name
     FROM so_change_requests cr
     JOIN users u ON u.id = cr.requester_id
     LEFT JOIN so_versions v ON v.id = cr.draft_version_id
     WHERE cr.status = 'pending'
     ORDER BY cr.confirmed_at IS NULL, cr.submitted_at ASC`
  );
  const list = rows.map((r) => ({
    ...r,
    diff: typeof r.diff === 'string' ? JSON.parse(r.diff) : r.diff,
    impact: typeof r.impact === 'string' ? JSON.parse(r.impact) : r.impact,
  }));
  return ok(res, 'Antrean approval dimuat', list);
});

// GET /api/so/changes/history
router.get('/changes/history', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT cr.id, cr.so_id, cr.type, cr.status, cr.submitted_at, cr.decided_at, cr.reject_reason,
            req.nama AS requester_nama, appr.nama AS approver_nama
     FROM so_change_requests cr
     JOIN users req ON req.id = cr.requester_id
     LEFT JOIN users appr ON appr.id = cr.decided_by
     WHERE cr.status IN ('approved','rejected')
     ORDER BY cr.decided_at DESC LIMIT 200`
  );
  return ok(res, 'Riwayat approval dimuat', rows);
});

// GET /api/so/changes/:id — detail change request (preview diff)
router.get('/changes/:id', async (req, res) => {
  const [[cr]] = await pool.query(
    `SELECT cr.*, u.nama AS requester_nama, u.username AS requester_username,
            v.version_no AS draft_version_no, v.file_name, v.kurs AS draft_kurs, v.kurs_date AS draft_kurs_date
     FROM so_change_requests cr
     JOIN users u ON u.id = cr.requester_id
     LEFT JOIN so_versions v ON v.id = cr.draft_version_id
     WHERE cr.id = ?`, [req.params.id]
  );
  if (!cr) return fail(res, 'Permintaan tidak ditemukan', 404);
  let draftMaterials = [], draftFrames = [];
  if (cr.draft_version_id) {
    const [m] = await pool.query('SELECT * FROM so_materials WHERE version_id = ?', [cr.draft_version_id]);
    const [fr] = await pool.query('SELECT * FROM so_frames WHERE version_id = ?', [cr.draft_version_id]);
    draftMaterials = m.map(normalizeMaterial); draftFrames = fr.map(normalizeFrame);
  } else if (cr.payload) {
    const p = typeof cr.payload === 'string' ? JSON.parse(cr.payload) : cr.payload;
    draftMaterials = p.materials || []; draftFrames = p.frames || [];
  }
  const [[so]] = await pool.query('SELECT id, customer, project_name, has_pending_change FROM so WHERE id = ?', [cr.so_id]);
  return ok(res, 'Detail permintaan dimuat', {
    request: {
      id: cr.id, so_id: cr.so_id, type: cr.type, status: cr.status, submitted_at: cr.submitted_at,
      requester: { nama: cr.requester_nama, username: cr.requester_username },
      draft_version_no: cr.draft_version_no, file_name: cr.file_name,
      kurs: cr.draft_kurs ?? null, kurs_date: cr.draft_kurs_date ?? null,
      diff: typeof cr.diff === 'string' ? JSON.parse(cr.diff) : cr.diff,
      impact: typeof cr.impact === 'string' ? JSON.parse(cr.impact) : cr.impact,
    },
    so, draftMaterials, draftFrames,
  });
});

// POST /api/so/changes/:id/approve — hanya Developer
router.post('/changes/:id/approve', requireRole('Developer'), async (req, res) => {
  const [[cr]] = await pool.query('SELECT * FROM so_change_requests WHERE id = ? AND status = ?', [req.params.id, 'pending']);
  if (!cr) return fail(res, 'Permintaan tidak ditemukan / sudah diproses', 404);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (cr.type === 'excel') {
      const [[draft]] = await conn.query('SELECT * FROM so_versions WHERE id = ?', [cr.draft_version_id]);
      const setClause = ', has_pending_change = 0';
      const [[ver]] = await conn.query(
        'SELECT total_lokal_idr, total_import_rmb, kurs FROM so_versions WHERE id = ?', [cr.draft_version_id]
      );
      const budget = Math.round(ver.total_lokal_idr + ver.total_import_rmb * (ver.kurs || 0));
      await conn.query("UPDATE so_versions SET status = 'superseded' WHERE so_id = ? AND status = 'active'", [cr.so_id]);
      await conn.query(
        "UPDATE so_versions SET status = 'active', approved_at = NOW(), approved_by = ? WHERE id = ?",
        [req.user.id, cr.draft_version_id]
      );
      await conn.query(
        `UPDATE so SET active_version_id = ?, pallet_count = ?, kurs = ?, kurs_date = ?, budget_idr = ?,
          has_pending_change = 0, status = 'active' WHERE id = ?`,
        [cr.draft_version_id, draft.pallet_count, draft.kurs, draft.kurs_date, budget, cr.so_id]
      );
    } else {
      // manual: buat versi baru dari payload, terapkan form
      const payload = typeof cr.payload === 'string' ? JSON.parse(cr.payload) : cr.payload;
      const f = payload.form || {};
      const [[lastVer]] = await conn.query(
        'SELECT COALESCE(MAX(version_no), 0) AS v FROM so_versions WHERE so_id = ?', [cr.so_id]
      );
      const [ver] = await conn.query(
        `INSERT INTO so_versions (so_id, version_no, source, kurs, kurs_date, total_weight, total_import_rmb,
          total_lokal_idr, pallet_count, status, created_by, approved_at, approved_by)
         VALUES (?,?, 'manual', (SELECT kurs FROM so WHERE id = ?), (SELECT kurs_date FROM so WHERE id = ?),
          ?, ?, ?, ?, 'active', ?, NOW(), ?)`,
        [cr.so_id, lastVer.v + 1, cr.so_id, cr.so_id,
          payload.__totals?.totalWeight ?? 0, payload.__totals?.importRmb ?? 0, payload.__totals?.lokalIdr ?? 0,
          f.palletCount != null ? parseInt(f.palletCount) : null, cr.requester_id, req.user.id]
      );
      await insertVersionRows(conn, ver.insertId, cr.so_id, payload.materials || [], payload.frames || []);
      await conn.query("UPDATE so_versions SET status = 'superseded' WHERE so_id = ? AND status = 'active' AND id <> ?", [cr.so_id, ver.insertId]);

      // ganti nomor SO bila diedit
      let soIdFinal = cr.so_id;
      const newSoId = String(f.soNumber || '').trim();
      if (newSoId && newSoId !== cr.so_id) {
        const [[bentrok]] = await conn.query('SELECT id FROM so WHERE id = ?', [newSoId]);
        if (bentrok) throw new Error(`Nomor SO ${newSoId} sudah dipakai SO lain.`);
        await conn.query('UPDATE so SET id = ? WHERE id = ?', [newSoId, cr.so_id]); // cascade FK versions & requests
        await conn.query('UPDATE so_materials SET so_id = ? WHERE so_id = ?', [newSoId, cr.so_id]);
        await conn.query('UPDATE so_frames SET so_id = ? WHERE so_id = ?', [newSoId, cr.so_id]);
        await conn.query('UPDATE so_notes SET so_id = ? WHERE so_id = ?', [newSoId, cr.so_id]);
        await conn.query('UPDATE so_chat_messages SET so_id = ? WHERE so_id = ? OR so_id LIKE ?',
          [newSoId, cr.so_id, `${cr.so_id}#%`]);
        soIdFinal = newSoId;
      }
      await conn.query(
        `UPDATE so SET active_version_id = ?, has_pending_change = 0, status = 'active',
          customer = ?, project_name = ?, company = ?, sales_name = ?, address = ?,
          start_production = ?, first_delivery = ?, start_installation = ?, target_installation = ?,
          description = ?, pallet_count = COALESCE(?, pallet_count) WHERE id = ?`,
        [ver.insertId, f.customerName || null, f.projectName || null, f.companyName || null, f.salesName || null,
          f.address || null, f.startProduction || null, f.firstDelivery || null, f.startInstallation || null,
          f.targetInstallation || null, f.description || null,
          f.palletCount != null ? parseInt(f.palletCount) : null, soIdFinal]
      );
      // hitung ulang budget dari versi baru
      const [[nv]] = await conn.query('SELECT total_lokal_idr, total_import_rmb FROM so_versions WHERE id = ?', [ver.insertId]);
      const [[soRow]] = await conn.query('SELECT kurs FROM so WHERE id = ?', [soIdFinal]);
      const budget = Math.round(nv.total_lokal_idr + nv.total_import_rmb * (soRow.kurs || 0));
      await conn.query('UPDATE so SET budget_idr = ? WHERE id = ?', [budget, soIdFinal]);
      await conn.query(
        "UPDATE so_change_requests SET status = 'approved', decided_at = NOW(), decided_by = ? WHERE id = ?",
        [req.user.id, cr.id]
      );
      await conn.commit();
      conn.release();
      await recordLog(req.user.id, 'SO_APPROVE', `Menyetujui perubahan manual SO ${soIdFinal}`);
      await createNotification({
        userId: cr.requester_id, actorId: req.user.id, type: 'SO_APPROVAL',
        title: `Perubahan SO ${soIdFinal} disetujui`,
        message: 'Perubahan yang Anda ajukan telah disetujui dan diterapkan.',
        link: `/so/detail/${soIdFinal}`,
      });
      return ok(res, 'Perubahan disetujui & diterapkan');
    }

    await conn.query(
      "UPDATE so_change_requests SET status = 'approved', decided_at = NOW(), decided_by = ? WHERE id = ?",
      [req.user.id, cr.id]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    conn.release();
    return fail(res, 'Gagal menyetujui: ' + err.message, 500);
  }
  conn.release();
  await recordLog(req.user.id, 'SO_APPROVE', `Menyetujui upload BOQ baru SO ${cr.so_id}`);
  await createNotification({
    userId: cr.requester_id, actorId: req.user.id, type: 'SO_APPROVAL',
    title: `Perubahan SO ${cr.so_id} disetujui`,
    message: 'Upload BOQ versi baru Anda telah disetujui dan diterapkan.',
    link: `/so/detail/${cr.so_id}`,
  });
  return ok(res, 'Perubahan disetujui & diterapkan');
});

// POST /api/so/changes/:id/reject — hanya Developer, alasan wajib
router.post('/changes/:id/reject', requireRole('Developer'), async (req, res) => {
  const { reason } = req.body || {};
  if (!reason || !reason.trim()) return fail(res, 'Alasan penolakan wajib diisi.', 422);
  const [[cr]] = await pool.query('SELECT * FROM so_change_requests WHERE id = ? AND status = ?', [req.params.id, 'pending']);
  if (!cr) return fail(res, 'Permintaan tidak ditemukan / sudah diproses', 404);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (cr.draft_version_id) {
      await conn.query("UPDATE so_versions SET status = 'rejected' WHERE id = ?", [cr.draft_version_id]);
    }
    await conn.query(
      "UPDATE so_change_requests SET status = 'rejected', decided_at = NOW(), decided_by = ?, reject_reason = ? WHERE id = ?",
      [req.user.id, reason.trim(), cr.id]
    );
    await conn.query('UPDATE so SET has_pending_change = 0 WHERE id = ?', [cr.so_id]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    conn.release();
    return fail(res, 'Gagal menolak: ' + err.message, 500);
  }
  conn.release();
  await recordLog(req.user.id, 'SO_REJECT', `Menolak perubahan SO ${cr.so_id}: ${reason.trim()}`);
  await createNotification({
    userId: cr.requester_id, actorId: req.user.id, type: 'SO_APPROVAL',
    title: `Perubahan SO ${cr.so_id} ditolak`,
    message: `Ditolak: ${reason.trim()}`,
    link: `/so/detail/${cr.so_id}`,
  });
  return ok(res, 'Perubahan ditolak & pengaju diberi tahu');
});

// POST /api/so/changes/:id/discard — pengaju (atau Developer) membuang draftnya sendiri
router.post('/changes/:id/discard', async (req, res) => {
  const [[cr]] = await pool.query('SELECT * FROM so_change_requests WHERE id = ? AND status = ?', [req.params.id, 'pending']);
  if (!cr) return fail(res, 'Permintaan tidak ditemukan / sudah diproses', 404);
  if (cr.requester_id !== req.user.id && req.user.role !== 'Developer') {
    return fail(res, 'Hanya pengaju atau Developer yang bisa membuang draft ini.', 403);
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (cr.draft_version_id) {
      await conn.query("UPDATE so_versions SET status = 'discarded' WHERE id = ?", [cr.draft_version_id]);
    }
    await conn.query("UPDATE so_change_requests SET status = 'discarded', decided_at = NOW(), decided_by = ? WHERE id = ?", [req.user.id, cr.id]);
    await conn.query('UPDATE so SET has_pending_change = 0 WHERE id = ?', [cr.so_id]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    conn.release();
    return fail(res, 'Gagal membuang draft: ' + err.message, 500);
  }
  conn.release();
  await recordLog(req.user.id, 'SO_DISCARD', `Membuang draft perubahan SO ${cr.so_id}`);
  return ok(res, 'Draft dibuang, data aktif tidak berubah');
});

// ====================================================================
// CATATAN SO (card catatan di Dashboard SO, mendukung @mention)
// ====================================================================

// GET /api/so/:soId/notes
router.get('/:soId/notes', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT n.id, n.content, n.created_at AS date,
            u.id AS user_id, u.nama AS user_nama, u.username AS user_username, u.avatar_url AS user_avatar
     FROM so_notes n
     JOIN users u ON u.id = n.user_id
     WHERE n.so_id = ?
     ORDER BY n.created_at DESC
     LIMIT 100`,
    [req.params.soId]
  );
  return ok(res, 'Catatan dimuat', rows);
});

// POST /api/so/:soId/notes  { content }
router.post('/:soId/notes', async (req, res) => {
  const { content } = req.body || {};
  if (!content || !content.trim()) return fail(res, 'Isi catatan tidak boleh kosong.', 422);

  const soId = req.params.soId;
  const [hasil] = await pool.query(
    'INSERT INTO so_notes (so_id, user_id, content) VALUES (?, ?, ?)',
    [soId, req.user.id, content.trim()]
  );
  await recordLog(req.user.id, 'SO_NOTE', `Membuat catatan pada SO ${soId}`);
  await createNotification({
    userId: req.user.id,
    actorId: req.user.id,
    type: 'ACTIVITY',
    title: 'Catatan SO dibuat',
    message: `Catatan Anda pada SO ${soId} berhasil disimpan.`,
    link: `/so/detail/${soId.split('#')[0]}`,
  });

  // Setiap user yang di-@mention mendapat notifikasi menuju detail SO
  const mentioned = await extractMentionedUsers(content);
  for (const m of mentioned) {
    await createNotification({
      userId: m.id,
      actorId: req.user.id,
      type: 'MENTION',
      title: `Anda di-tag oleh @${req.user.username || req.user.nama}`,
      message: `Dalam catatan SO ${soId}: "${content.trim().slice(0, 80)}${content.length > 80 ? '...' : ''}"`,
      link: `/so/detail/${soId.split('#')[0]}`,
    });
  }

  return ok(res, 'Catatan disimpan', { id: hasil.insertId, mentioned: mentioned.length }, 201);
});

// ====================================================================
// CHAT DI DETAIL SO (komentar per SO, mendukung lampiran + @mention)
// ====================================================================

// GET /api/so/:soId/chat
router.get('/:soId/chat', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.id, c.content, c.attachment_path, c.attachment_name, c.created_at AS date,
            u.id AS user_id, u.nama AS user_nama, u.username AS user_username, u.avatar_url AS user_avatar
     FROM so_chat_messages c
     JOIN users u ON u.id = c.user_id
     WHERE c.so_id = ?
     ORDER BY c.created_at ASC
     LIMIT 200`,
    [req.params.soId]
  );
  return ok(res, 'Chat SO dimuat', rows);
});

// POST /api/so/:soId/chat  { content, base64Data, mimeType, fileName }
router.post('/:soId/chat', async (req, res) => {
  const { content, base64Data, mimeType, fileName } = req.body || {};
  if ((!content || !content.trim()) && !base64Data)
    return fail(res, 'Pesan atau lampiran wajib ada.', 422);

  const soId = req.params.soId;
  let attachmentPath = null;
  let attachmentName = null;
  if (base64Data) {
    try {
      attachmentPath = saveBase64File(base64Data, mimeType || 'application/octet-stream', fileName, 'so-chat');
      attachmentName = fileName || 'lampiran';
    } catch (err) {
      return fail(res, 'Lampiran: ' + err.message, 422);
    }
  }

  const [hasil] = await pool.query(
    `INSERT INTO so_chat_messages (so_id, user_id, content, attachment_path, attachment_name)
     VALUES (?, ?, ?, ?, ?)`,
    [soId, req.user.id, content?.trim() || null, attachmentPath, attachmentName]
  );
  await recordLog(req.user.id, 'SO_CHAT', `Mengirim pesan pada chat SO ${soId}`);

  // Semua peserta chat SO lain (yang pernah menulis di chat SO ini) diberi notifikasi
  const [peserta] = await pool.query(
    'SELECT DISTINCT user_id FROM so_chat_messages WHERE so_id = ? AND user_id <> ?',
    [soId, req.user.id]
  );
  const pengirimNama = req.user.nama;
  for (const p of peserta) {
    await createNotification({
      userId: p.user_id,
      actorId: req.user.id,
      type: 'SO_CHAT',
      title: `Pesan baru di SO ${soId}`,
      message: `${pengirimNama}: ${(content || '').trim().slice(0, 80) || fileName || 'mengirim lampiran'}`,
      link: `/so/detail/${soId.split('#')[0]}`,
    });
  }

  // @mention juga dapat notifikasi (walau belum pernah ikut chat)
  if (content) {
    const mentioned = await extractMentionedUsers(content);
    for (const m of mentioned) {
      if (peserta.some((p) => p.user_id === m.id)) continue; // sudah dapat di atas
      await createNotification({
        userId: m.id,
        actorId: req.user.id,
        type: 'MENTION',
        title: `Anda di-tag oleh @${req.user.username || req.user.nama}`,
        message: `Di chat SO ${soId}`,
        link: `/so/detail/${soId.split('#')[0]}`,
      });
    }
  }

  return ok(res, 'Pesan terkirim', { id: hasil.insertId }, 201);
});

export default router;
