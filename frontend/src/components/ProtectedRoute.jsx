import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

export default function ProtectedRoute() {
  const location = useLocation();
  
  // 1. ATURAN DASAR (Persis seperti kode lama Anda yang sangat stabil)
  const isDevMode = localStorage.getItem('isDevMode') === 'true';
  const isAuthenticated = localStorage.getItem('token') !== null;

  // Jika tidak ada tiket dan bukan mode dev, tendang ke login
  if (!isDevMode && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 2. Ambil data identitas user
  const userStr = localStorage.getItem('user');
  let user = null;
  try { 
    user = JSON.parse(userStr); 
  } catch (e) {}

  // Jika Mode Dev aktif ATAU yang login adalah Developer (God Mode), buka semua gerbang!
  if (isDevMode || user?.role === 'Developer') {
    return <Outlet />; // Silakan lewat dan render halamannya
  }

  // ==========================================
  // 3. PENGAMANAN URL (Mencegah Akses Paksa)
  // ==========================================
  const currentPath = location.pathname;

  // ZONA AMAN: Selalu izinkan akses ke '/' (Dashboard). 
  // Ini memastikan cangkang <AdminLayout> dan <Sidebar> TIDAK PERNAH hancur/blank.
  if (currentPath === '/') {
    return <Outlet />;
  }

  // Cek apakah URL yang diketik paksa oleh user (misal: /developer) ada di izinnya
  if (user && user.akses_menu) {
    const allowedMenus = Array.isArray(user.akses_menu) ? user.akses_menu : [];
    
    // Mengecek kesesuaian URL
    const isAllowed = allowedMenus.some(menu => currentPath.startsWith(menu) && menu !== '/');
    
    if (!isAllowed) {
      // JIKA DILARANG: Jangan crash, cukup kembalikan user secara halus ke Dashboard (Zona Aman)
      return <Navigate to="/" replace />;
    }
  }

  // Jika lolos semua pemeriksaan, render halamannya
  return <Outlet />;
}