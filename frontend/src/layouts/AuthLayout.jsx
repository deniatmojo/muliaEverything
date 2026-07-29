import React from 'react';
import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    // min-h-screen memastikan layout mengambil minimal seluruh tinggi layar
    // flex items-center justify-center menempatkan konten tepat di tengah
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4 transition-colors duration-300">
      {/* Di sinilah komponen Login.jsx nanti akan di-render */}
      <Outlet />
    </div>
  );
}