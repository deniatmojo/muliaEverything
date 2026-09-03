import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { fail } from '../utils.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return fail(res, 'Tidak ada token. Silakan login.', 401);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return fail(res, 'Token tidak valid atau kadaluarsa.', 401);
  }
}

// Hanya role tertentu (mis. Developer) yang boleh akses endpoint manajemen user/role
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return fail(res, 'Anda tidak memiliki izin untuk aksi ini.', 403);
    }
    next();
  };
}
