import React, { useEffect, useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  X,
  ShieldCheck,
  Briefcase // 1. Import ikon Briefcase untuk modul SO
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function Sidebar({ isOpen, setIsOpen }) {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(null);

  // Mengambil data user dari localStorage saat Sidebar dimuat
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    }
  }, []);

  // 🌟 KAMUS MENU UTAMA (Kembali disinkronkan berdasarkan PATH sesuai isi Google Sheet Anda!)
  const menuItems = [
    { title: 'Dashboard', path: '/', icon: LayoutDashboard },
    { title: 'Profil Karyawan', path: '/profil', icon: Users },
    { title: 'Project / SO', path: '/so', icon: Briefcase }, // 2. Tambahkan menu SO di sini tanpa tag < />
    { title: 'Developer', path: '/developer', icon: ShieldCheck },
  ];

  // 🛡️ LOGIKA PENYARINGAN MENU DINAMIS (Mencocokkan Array Path dari Google Sheets)
  const filteredMenuItems = menuItems.filter(menu => {
    if (!currentUser) return false;

    // KONDISI 1: Jika yang login adalah Developer, buka SEMUA menu!
    if (currentUser.role === 'Developer') return true;
    
    // Ambil daftar path dari database (bawaan objek user)
    const allowedMenus = currentUser.menus || currentUser.akses_menu || [];
    
    // KONDISI 2: Cocokkan apakah PATH menu saat ini terdaftar di dalam allowedMenus dari Google Sheet
    return allowedMenus.includes(menu.path);
  });

  return (
    <>
      {/* Overlay Gelap untuk HP */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        ></div>
      )}

      {/* Kontainer Sidebar */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-30 w-72 bg-aira-navy text-white h-screen flex flex-col 
          transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 shadow-2xl lg:shadow-none
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header Logo Mulia Everything */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-aira-cyan flex items-center justify-center font-bold text-white">M</div>
            <h1 className="text-xl font-bold text-white tracking-wide">
              MULIA <span className="text-aira-cyan">EVERYTHING</span>
            </h1>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white transition-colors p-1"
          >
            <X size={24} />
          </button>
        </div>

        {/* Area Navigasi */}
        <div className="flex-1 overflow-y-auto py-6 px-4 custom-scrollbar">
          <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Menu Utama</p>
          <nav className="space-y-1.5">
            {filteredMenuItems.map((menu, index) => {
              const isActive = location.pathname === menu.path;
              return (
                <Link 
                  key={index}
                  to={menu.path} 
                  onClick={() => setIsOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                    ${isActive 
                      ? 'bg-aira-cyan/10 text-aira-cyan font-medium border border-aira-cyan/20' 
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }
                  `}
                >
                  <menu.icon 
                    size={20} 
                    className={`${isActive ? 'text-aira-cyan' : 'text-gray-500 group-hover:text-gray-300'} transition-colors`}
                  />
                  <span>{menu.title}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Sidebar */}
        <div className="p-6 border-t border-white/10 bg-black/10">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <div className="flex flex-col">
              <p className="text-xs text-gray-400 font-medium">Mulia Enterprise v1.0</p>
              {currentUser && (
                <p className="text-[10px] text-aira-cyan mt-0.5 uppercase tracking-wider">{currentUser.role}</p>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}