import { Router } from 'express';
import { pool } from '../db.js';
import { ok, fail, recordLog, createNotification, saveBase64File, extractMentionedUsers } from '../utils.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

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
