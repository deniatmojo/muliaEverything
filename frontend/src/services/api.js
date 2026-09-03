// Lokasi File: src/services/api.js
// Terhubung ke backend Node.js + MySQL (dulu Google Apps Script).
// Signature callApi(action, data) dipertahankan agar komponen tidak perlu diubah.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Peta action lama (era GAS) -> endpoint REST backend baru
const ROUTES = {
  LOGIN:                { method: 'POST', path: () => '/auth/login' },
  REGISTER:             { method: 'POST', path: () => '/auth/register' },
  VERIFY_TOKEN:         { method: 'POST', path: () => '/auth/verify-token' },

  GET_PENDING_USERS:    { method: 'GET',  path: () => '/admin/users?status=pending' },
  GET_ACTIVE_USERS:     { method: 'GET',  path: () => '/admin/users?status=active' },
  GET_ROLES:            { method: 'GET',  path: () => '/admin/roles' },
  APPROVE_USER:         { method: 'POST', path: () => '/admin/approve-user' },
  SAVE_ROLE:            { method: 'POST', path: () => '/admin/save-role' },
  UPDATE_USER_ROLE:     { method: 'POST', path: () => '/admin/update-user-role' },

  GET_PROFILE:          { method: 'GET',  path: () => '/me/profile' },
  UPDATE_PROFILE:       { method: 'PUT',  path: () => '/me/profile' },
  UPDATE_PASSWORD:      { method: 'PUT',  path: () => '/me/password' },
  UPLOAD_AVATAR:        { method: 'POST', path: () => '/me/avatar' },

  GET_MY_ACTIVITIES:    { method: 'GET',  path: () => '/me/my-activities' },

  // === Sistem baru: notifikasi, username, SO, chat ===
  GET_MY_NOTIFICATIONS: { method: 'GET',  path: () => '/me/notifications' },
  READ_NOTIFICATIONS:   { method: 'POST', path: () => '/me/notifications/read' },
  GET_USER_DIRECTORY:   { method: 'GET',  path: () => '/users/directory' },
  GET_SO_NOTES:         { method: 'GET',  path: (d) => `/so/${encodeURIComponent(d.soId)}/notes` },
  ADD_SO_NOTE:          { method: 'POST', path: (d) => `/so/${encodeURIComponent(d.soId)}/notes` },
  GET_SO_CHAT:          { method: 'GET',  path: (d) => `/so/${encodeURIComponent(d.soId)}/chat` },
  SEND_SO_CHAT:         { method: 'POST', path: (d) => `/so/${encodeURIComponent(d.soId)}/chat` },
  START_CHAT:           { method: 'POST', path: () => '/chat/start' },
  GET_CONVERSATIONS:    { method: 'GET',  path: () => '/chat/conversations' },
  GET_CHAT_MESSAGES:    { method: 'GET',  path: (d) => `/chat/${encodeURIComponent(d.conversationId)}/messages${d.afterId ? `?afterId=${d.afterId}` : ''}` },
  SEND_CHAT_MESSAGE:    { method: 'POST', path: (d) => `/chat/${encodeURIComponent(d.conversationId)}/messages` },
};

/**
 * Universal API Caller ke backend MySQL
 *
 * @param {string} action - Nama instruksi/router (contoh: 'LOGIN', 'GET_ROLES')
 * @param {object} data - Objek payload yang dikirim ke backend
 * @returns {Promise<object>} Response standar { status, message, data, code }
 */
export const callApi = async (action, data = {}) => {
  try {
    const route = ROUTES[action];
    if (!route) {
      return { status: 'error', message: `Action tidak dikenal: ${action}`, data: null, code: 404 };
    }

    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('token');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_URL}${route.path(data)}`, {
      method: route.method,
      headers,
      body: route.method === 'GET' ? undefined : JSON.stringify(data),
    });

    // Backend selalu membalas JSON format standar; jika tidak (mis. server mati), tangkap di sini
    const result = await response.json();

    // Token kadaluarsa/tidak valid: bersihkan sesi dan arahkan ke login
    // agar user tidak terjebak di halaman yang semua datanya gagal dimuat.
    if (result.code === 401 && !['LOGIN', 'REGISTER', 'VERIFY_TOKEN'].includes(action)) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // hanya redirect jika belum di halaman auth agar tidak loop
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?expired=1';
      }
    }

    return result;

  } catch (error) {
    console.error(`API Error (${action}):`, error);
    return {
      status: 'error',
      message: 'Terjadi kesalahan koneksi ke server. Pastikan backend berjalan.',
      data: null,
      code: 500
    };
  }
};
