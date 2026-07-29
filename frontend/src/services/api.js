// Lokasi File: src/services/api.js

// Tempel URL GAS Anda secara langsung di sini (Hardcode)
const GAS_URL = 'https://script.google.com/a/macros/mulia41.com/s/AKfycbzMmIYwitzK4WHJ_I6PqQz9iOmLw3vo1Nje18xpBB680eXNBiQ0F4MDOjW8b8X3VBsr/exec';

/**
 * Universal API Caller untuk Google Apps Script
 * Wajib menggunakan method POST dan Content-Type text/plain untuk bypass CORS
 * 
 * @param {string} action - Nama instruksi/router di GAS (contoh: 'INIT_DB', 'LOGIN')
 * @param {object} data - Objek payload yang dikirim ke GAS
 * @returns {Promise<object>} Response standar dari GAS { status, message, data, code }
 */
export const callApi = async (action, data = {}) => {
  try {
    const payload = JSON.stringify({ action, data });

    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: payload,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Parse hasil text dari GAS kembali menjadi JSON
    const result = await response.json();
    return result;

  } catch (error) {
    console.error(`API Error (${action}):`, error);
    return {
      status: 'error',
      message: error.message || 'Terjadi kesalahan koneksi ke server GAS.',
      data: null,
      code: 500
    };
  }
};