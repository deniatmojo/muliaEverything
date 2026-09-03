import nodemailer from 'nodemailer';
import 'dotenv/config';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false, // port 587 pakai STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Kirim email verifikasi akun.
 * Mengembalikan true jika terkirim, false jika gagal (tidak melempar error,
 * supaya approval user tidak gagal hanya karena email).
 */
export async function sendVerificationEmail(to, nama, role, token) {
  const link = `${process.env.FRONTEND_URL}/verify?token=${token}`;
  const text =
    `Halo ${nama},\n\nAkun Anda telah disetujui sebagai ${role}.\n\nKlik untuk aktifkan akun Anda:\n${link}\n\nLink ini berlaku 24 jam.`;
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 560px; margin: auto; border: 1px solid #e5e7eb; border-radius: 8px;">
      <h2 style="color:#0F3B6C; margin-top:0;">MULIA EVERYTHING</h2>
      <p>Halo <b>${nama}</b>,</p>
      <p>Akun Anda telah disetujui sebagai: <b>${role}</b>.</p>
      <p>Silakan klik tombol di bawah untuk mengaktifkan akun Anda (berlaku 24 jam):</p>
      <p style="text-align:center; margin: 28px 0;">
        <a href="${link}" style="background:#0084C9; color:#fff; padding: 12px 28px; text-decoration:none; border-radius:6px; font-weight:bold;">Verifikasi Akun</a>
      </p>
      <p style="color:#6b7280; font-size:12px;">Jika tombol tidak berfungsi, salin link berikut ke browser:<br>${link}</p>
    </div>`;

  try {
    await transporter.sendMail({
      from: `"Mulia Everything" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Persetujuan Akun - Mulia Everything',
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error('Gagal kirim email verifikasi:', err.message);
    return false;
  }
}
