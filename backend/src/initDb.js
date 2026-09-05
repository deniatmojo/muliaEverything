// Inisialisasi database: jalankan schema.sql lalu buat akun Super Admin jika belum ada.
// Pakai: npm run init-db
import { readFileSync } from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { pool } from './db.js';

async function main() {
  const schema = readFileSync(path.resolve('sql/schema.sql'), 'utf8');
  const statements = schema
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const sql of statements) {
    // pisahkan per-statement; multiple statements dalam satu query() tidak didukung prepared
    await pool.query(sql.replace(/--.*$/gm, ''));
  }
  console.log('Schema berhasil dibuat.');

  const [[ada]] = await pool.query("SELECT id FROM users WHERE email = 'admin@mulia.com'");
  if (!ada) {
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query(
      `INSERT INTO users (id, nama, email, username, password_hash, role, status, position, phone)
       VALUES ('u-1', 'Super Admin', 'admin@mulia.com', 'superadmin', ?, 'Developer', 'active', 'Pemilik Sistem', '08123456789')`,
      [hash]
    );
    console.log('Super Admin dibuat: admin@mulia.com / admin123');
  } else {
    console.log('Super Admin sudah ada, dilewati.');
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
