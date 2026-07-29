import React, { useContext, useState, useRef, useEffect } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { Sun, Moon, Bell, Menu, User, LogOut, Settings, Loader2, Activity } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { callApi } from '../services/api';

export default function Topbar({ onMenuClick }) {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const navigate = useNavigate(); 
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isLoadingNotif, setIsLoadingNotif] = useState(false);
  const [recentActivities, setRecentActivities] = useState([]);

  const profileRef = useRef(null);
  const notifRef = useRef(null);

  const [userData, setUserData] = useState({ id: '', nama: 'User', role: 'Staff', avatar_url: '' });

  // Fungsi memuat data user, bisa dipanggil ulang saat ada event perubahan profil
  const loadUserData = () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUserData(JSON.parse(storedUser));
    }
  };

  useEffect(() => {
    loadUserData();
    // Mendengarkan event kustom dari Profile.jsx saat foto/nama diubah
    window.addEventListener('userUpdated', loadUserData);
    return () => document.removeEventListener('userUpdated', loadUserData);
  }, []);

  const getInitials = (namaLengkap) => {
    if (!namaLengkap) return 'U';
    const words = namaLengkap.trim().split(' ');
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return words[0][0].toUpperCase();
  };

  const getDirectImageUrl = (url) => {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
      const match = url.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w200`;
      }
    }
    return url;
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Menutup dropdown jika klik di luar area
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) setIsProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(event.target)) setIsNotifOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fungsi untuk mengambil notifikasi dari GAS
  const toggleNotifications = async () => {
    if (isNotifOpen) {
      setIsNotifOpen(false);
      return;
    }
    
    setIsNotifOpen(true);
    setIsProfileOpen(false);
    setIsLoadingNotif(true);

    try {
      const res = await callApi('GET_MY_ACTIVITIES', { userId: userData.id });
      if (res.status === 'success') {
        // Ambil maksimal 5 aktivitas terbaru untuk notifikasi cepat
        setRecentActivities(res.data.slice(0, 5));
      }
    } catch (error) {
      console.error("Gagal memuat notifikasi", error);
    } finally {
      setIsLoadingNotif(false);
    }
  };

  const displayName = userData?.nama || 'User';
  const displayRole = userData?.role || 'Staff';
  const displayAvatar = userData?.avatar_url ? getDirectImageUrl(userData.avatar_url) : '';

  return (
    <header className="h-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 lg:px-8 transition-colors duration-300 z-10 relative">
      
      <div className="flex items-center">
        <button onClick={onMenuClick} className="p-2 -ml-2 mr-4 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-aira-navy dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden transition-colors">
          <Menu size={24} />
        </button>
        <h2 className="hidden sm:block text-xl font-bold text-gray-800 dark:text-white">
          Selamat Datang, {displayName.split(' ')[0]} 👋
        </h2>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        
        <button onClick={toggleTheme} className="p-2.5 rounded-full bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-aira-cyan transition-all">
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        {/* Lonceng Notifikasi */}
        <div className="relative" ref={notifRef}>
          <button onClick={toggleNotifications} className="relative p-2.5 rounded-full bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-aira-cyan transition-all">
            <Bell size={20} />
            <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-800"></span>
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden transform transition-all">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <p className="font-semibold text-gray-800 dark:text-white">Aktivitas Terakhir</p>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {isLoadingNotif ? (
                  <div className="flex justify-center items-center p-8">
                    <Loader2 className="animate-spin text-aira-cyan" size={24} />
                  </div>
                ) : recentActivities.length > 0 ? (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {recentActivities.map((log) => (
                      <div key={log.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-aira-cyan/10 text-aira-cyan rounded-lg">
                            <Activity size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800 dark:text-white">{log.action}</p>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{log.description}</p>
                            <p className="text-[10px] text-gray-400 mt-2">{log.date}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    <p className="text-sm">Belum ada aktivitas tercatat.</p>
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-gray-100 dark:border-gray-700 text-center bg-gray-50 dark:bg-gray-800/80">
                <Link to="/profil" onClick={() => setIsNotifOpen(false)} className="text-xs font-medium text-aira-cyan hover:underline">Lihat Riwayat Lengkap di Profil</Link>
              </div>
            </div>
          )}
        </div>

        <div className="hidden sm:block w-px h-8 bg-gray-200 dark:bg-gray-700 mx-2"></div>

        {/* Profil Dropdown */}
        <div className="relative" ref={profileRef}>
          <button onClick={() => {setIsProfileOpen(!isProfileOpen); setIsNotifOpen(false)}} className="flex items-center gap-3 p-1 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            
            {/* Logika Pintar: Tampilkan Foto jika ada, jika tidak tampilkan Inisial */}
            {displayAvatar ? (
              <img 
                src={displayAvatar} 
                alt="Avatar" 
                className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-700 shadow-sm"
                onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${displayName.replace(' ', '+')}&background=0084C9&color=fff`; }}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-aira-navy to-aira-cyan text-white flex items-center justify-center font-bold text-sm shadow-md">
                {getInitials(displayName)}
              </div>
            )}
            
            <div className="hidden md:block text-left mr-2">
              <p className="text-sm font-semibold text-gray-800 dark:text-white leading-tight">{displayName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{displayRole}</p>
            </div>
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-3 w-56 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden transform transition-all">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 md:hidden">
                <p className="font-semibold text-gray-800 dark:text-white">{displayName}</p>
                <p className="text-xs text-gray-500">{displayRole}</p>
              </div>
              <div className="p-2">
                <Link to="/profil" onClick={() => setIsProfileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-aira-cyan rounded-xl transition-colors">
                  <User size={18} /> Profil Saya
                </Link>
                <Link to="/pengaturan" onClick={() => setIsProfileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-aira-cyan rounded-xl transition-colors">
                  <Settings size={18} /> Pengaturan
                </Link>
                <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
                
                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors">
                  <LogOut size={18} /> Keluar Sistem
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}