import { Router } from 'express';
import { pool } from '../db.js';
import { ok, fail, newId, saveBase64File } from '../utils.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// id percakapan selalu memasangkan user dengan urutan alfabetis agar unik
function convIdFor(a, b) {
  return [a, b].sort().join('__');
}

// MULAI / AMBIL PERCAKAPAN DENGAN SEORANG USER
// POST /api/chat/start { userId }
router.post('/start', async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return fail(res, 'userId wajib diisi.', 422);
  if (userId === req.user.id) return fail(res, 'Tidak bisa chat dengan diri sendiri.', 422);

  const [[tujuan]] = await pool.query(
    "SELECT id, nama, username, avatar_url FROM users WHERE id = ? AND status = 'active'",
    [userId]
  );
  if (!tujuan) return fail(res, 'User tidak ditemukan / tidak aktif', 404);

  const id = convIdFor(req.user.id, userId);
  await pool.query(
    'INSERT IGNORE INTO conversations (id, user1_id, user2_id) VALUES (?, ?, ?)',
    [id, ...[req.user.id, userId].sort()]
  );
  return ok(res, 'Percakapan siap', { conversation_id: id, partner: tujuan });
});

// DAFTAR PERCAKAPAN + JUMLAH PESAN BELUM DIBACA
// GET /api/chat/conversations
router.get('/conversations', async (req, res) => {
  const me = req.user.id;
  const [rows] = await pool.query(
    `SELECT c.id, c.last_message_at,
            CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END AS partner_id
     FROM conversations c
     WHERE c.user1_id = ? OR c.user2_id = ?
     ORDER BY c.last_message_at DESC`,
    [me, me, me]
  );

  const hasil = [];
  for (const r of rows) {
    const [[partner]] = await pool.query(
      'SELECT id, nama, username, avatar_url, position FROM users WHERE id = ?',
      [r.partner_id]
    );
    if (!partner) continue;
    const [[last]] = await pool.query(
      'SELECT content, attachment_name, sender_id, created_at FROM chat_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1',
      [r.id]
    );
    const [[{ unread }]] = await pool.query(
      `SELECT COUNT(*) AS unread FROM chat_messages m
       WHERE m.conversation_id = ? AND m.sender_id <> ?
         AND NOT EXISTS (SELECT 1 FROM chat_message_reads r WHERE r.message_id = m.id AND r.user_id = ?)`,
      [r.id, me, me]
    );
    hasil.push({
      conversation_id: r.id,
      partner,
      last_message: last
        ? { content: last.content, attachment_name: last.attachment_name, mine: last.sender_id === me, date: last.created_at }
        : null,
      unread,
    });
  }
  return ok(res, 'Daftar percakapan dimuat', hasil);
});

// PESAN SEBUAH PERCAKAPAN (opsional ?afterId= untuk polling)
// GET /api/chat/:id/messages
router.get('/:id/messages', async (req, res) => {
  const me = req.user.id;
  const [[conv]] = await pool.query('SELECT * FROM conversations WHERE id = ?', [req.params.id]);
  if (!conv || (conv.user1_id !== me && conv.user2_id !== me))
    return fail(res, 'Percakapan tidak ditemukan', 404);

  const afterId = Number(req.query.afterId || 0);
  const [rows] = await pool.query(
    `SELECT m.id, m.sender_id, m.content, m.attachment_path, m.attachment_name, m.created_at AS date,
            u.nama AS sender_nama, u.avatar_url AS sender_avatar
     FROM chat_messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = ? AND m.id > ?
     ORDER BY m.id ASC
     LIMIT 200`,
    [conv.id, afterId]
  );

  // pesan dari lawan otomatis ditandai sudah dibaca saat dilihat
  await pool.query(
    `INSERT IGNORE INTO chat_message_reads (message_id, user_id)
     SELECT m.id, ? FROM chat_messages m
     WHERE m.conversation_id = ? AND m.sender_id <> ?`,
    [me, conv.id, me]
  );

  const partnerId = conv.user1_id === me ? conv.user2_id : conv.user1_id;
  const [[partner]] = await pool.query(
    'SELECT id, nama, username, avatar_url, position FROM users WHERE id = ?',
    [partnerId]
  );
  return ok(res, 'Pesan dimuat', { partner, items: rows });
});

// KIRIM PESAN (teks dan/atau lampiran base64)
// POST /api/chat/:id/messages { content, base64Data, mimeType, fileName }
router.post('/:id/messages', async (req, res) => {
  const me = req.user.id;
  const { content, base64Data, mimeType, fileName } = req.body || {};
  if ((!content || !content.trim()) && !base64Data)
    return fail(res, 'Pesan atau lampiran wajib ada.', 422);

  const [[conv]] = await pool.query('SELECT * FROM conversations WHERE id = ?', [req.params.id]);
  if (!conv || (conv.user1_id !== me && conv.user2_id !== me))
    return fail(res, 'Percakapan tidak ditemukan', 404);

  let attachmentPath = null;
  let attachmentName = null;
  if (base64Data) {
    try {
      attachmentPath = saveBase64File(base64Data, mimeType || 'application/octet-stream', fileName, 'chat');
      attachmentName = fileName || 'lampiran';
    } catch (err) {
      return fail(res, 'Lampiran: ' + err.message, 422);
    }
  }

  const [hasil] = await pool.query(
    `INSERT INTO chat_messages (conversation_id, sender_id, content, attachment_path, attachment_name)
     VALUES (?, ?, ?, ?, ?)`,
    [conv.id, me, content?.trim() || null, attachmentPath, attachmentName]
  );
  await pool.query('UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?', [conv.id]);

  // TIDAK membuat notifikasi lonceng - chat pribadi cukup badge pada bubble chat
  return ok(res, 'Pesan terkirim', { id: hasil.insertId }, 201);
});

export default router;
