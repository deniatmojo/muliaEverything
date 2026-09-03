import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import profileRoutes from './routes/profile.js';
import notificationRoutes from './routes/notifications.js';
import userRoutes from './routes/users.js';
import soRoutes from './routes/so.js';
import chatRoutes from './routes/chat.js';
import { fail } from './utils.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Izinkan semua port dev lokal + domain produksi dari FRONTEND_URL
app.use(cors({
  origin: (origin, cb) => {
    const diizinkan = !origin
      || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      || origin === process.env.FRONTEND_URL;
    if (diizinkan) return cb(null, true);
    cb(new Error('Origin tidak diizinkan oleh CORS'));
  },
}));
app.use(express.json({ limit: '15mb' })); // lampiran dikirim base64 di dalam JSON
app.use('/uploads', express.static('uploads'));

app.get('/', (req, res) => {
  res.send('<h1>Mulia Everything API Status: OK 🚀</h1><p>Sistem Backend Aktif (Node + MySQL).</p>');
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/me', profileRoutes);
app.use('/api/me', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/so', soRoutes);
app.use('/api/chat', chatRoutes);

// 404 & error handler
app.use((req, res) => fail(res, 'Action tidak ditemukan', 404));
app.use((err, req, res, next) => {
  console.error(err);
  fail(res, 'Terjadi kesalahan pada server: ' + err.message, 500);
});

app.listen(PORT, () => {
  console.log(`Mulia backend berjalan di http://localhost:${PORT}`);
});
