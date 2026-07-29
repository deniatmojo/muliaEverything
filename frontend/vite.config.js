import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    cors: true,
    // Semua konfigurasi proxy dan HMR ke server lama Aira telah dihapus
    // karena sekarang kita 100% menggunakan Google Apps Script
  },
})