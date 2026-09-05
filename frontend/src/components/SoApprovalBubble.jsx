// Bubble "SO Control Panel" — hanya untuk role Developer, pojok kiri bawah.
// Bintik merah muncul saat ada permintaan approval yang menunggu.
import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ShieldCheck, X } from 'lucide-react';
import { callApi } from '../services/api';
import SoControlPanel from '../modules/so/SoControlPanel';

export default function SoApprovalBubble() {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [open, setOpen] = useState(false);
  const pollRef = useRef(null);

  // Hanya tampil di dalam modul SO
  const inSoModule = location.pathname === '/so' || location.pathname.startsWith('/so/');

  useEffect(() => {
    try { setUser(JSON.parse(localStorage.getItem('user') || 'null')); } catch { setUser(null); }
  }, []);

  const isDev = user?.role === 'Developer' && inSoModule;

  useEffect(() => {
    if (!isDev) return;
    const load = async () => {
      const res = await callApi('SO_PENDING_CHANGES');
      if (res.status === 'success') setPendingCount((res.data || []).length);
    };
    load();
    pollRef.current = setInterval(load, 30000); // refresh tiap 30 detik
    return () => clearInterval(pollRef.current);
  }, [isDev, open]);

  if (!isDev) return null;

  return (
    <>
      {/* Bubble — di desktop digeser ke kanan sidebar (w-72 = 288px + jarak 24px) */}
      <div className="fixed bottom-6 left-6 lg:left-[312px] z-40">
        <button onClick={() => setOpen(true)}
          className="relative w-14 h-14 rounded-full bg-[#0F3B6C] dark:bg-[#0084C9] text-white shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform">
          <ShieldCheck size={24} />
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-rose-500 border-2 border-gray-50 dark:border-gray-900 text-[11px] font-bold flex items-center justify-center animate-pulse">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Panel — di desktop digeser ke kanan sidebar (w-72) agar tidak menutupi menu */}
      {open && (
        <div className="fixed inset-0 lg:left-72 z-50 bg-black/30 sm:bg-transparent" onClick={() => setOpen(false)}>
          <div className="fixed inset-x-0 bottom-0 lg:inset-y-6 lg:right-6 lg:left-6 w-full lg:max-w-6xl lg:mx-auto h-[92vh] lg:h-auto bg-gray-50 dark:bg-gray-900 lg:border lg:border-gray-200 lg:dark:border-gray-700 rounded-t-3xl lg:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-end px-4 pt-4 shrink-0">
              <button onClick={() => setOpen(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <SoControlPanel onClose={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
