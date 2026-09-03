import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';

// Pastikan path import ini sesuai dengan struktur folder Anda
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ChatBubble from '../components/ChatBubble';

export default function AdminLayout() {
  // State global untuk layout: Mengontrol Sidebar di layar Mobile (HP)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    // Kontainer paling luar: Mengambil tinggi penuh layar (h-screen) dan menyembunyikan scrollbar ganda (overflow-hidden)
    <div className="flex h-screen w-full bg-gray-50 dark:bg-gray-900 overflow-hidden font-sans transition-colors duration-300">
      
      {/* 1. Sidebar Component: Kita oper state ke sini */}
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      {/* 2. Area Konten Utama (Kanan) */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative w-full">
        
        {/* Topbar Component: Kita oper fungsi untuk membuka Sidebar di HP */}
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />

        {/* Area Render Dinamis (Scrollable) */}
        {/* Di sinilah tempat konten utama (seperti Kalkulator BOQ, Profil, dll) akan digonta-ganti oleh Router */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
          
          {/* <Outlet /> adalah "lubang" ajaib dari React Router DOM */}
          <Outlet />

        </main>

        {/* Chat pribadi antar pengguna (bubble pojok kanan bawah) */}
        <ChatBubble />
      </div>
    </div>
  );
}