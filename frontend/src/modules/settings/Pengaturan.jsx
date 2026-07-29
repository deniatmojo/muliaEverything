import React from 'react';
import { Settings, Bell, Lock, User } from 'lucide-react';

export default function Pengaturan() {
  return (
    <div className="space-y-6">
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-aira-navy dark:text-aira-cyan flex items-center gap-3">
          <Settings size={28} /> Pengaturan Sistem
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Kustomisasi preferensi akun dan aplikasi Anda di sini.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dummy Card 1 */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 flex items-start gap-4">
          <div className="p-3 bg-aira-cyan/10 text-aira-cyan rounded-xl"><User size={24} /></div>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-white">Profil Preferensi</h3>
            <p className="text-sm text-gray-500 mt-1">Ubah foto profil dan detail identitas (Segera Hadir).</p>
          </div>
        </div>

        {/* Dummy Card 2 */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 flex items-start gap-4">
          <div className="p-3 bg-aira-navy/10 text-aira-navy dark:text-gray-300 rounded-xl"><Lock size={24} /></div>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-white">Keamanan & Sandi</h3>
            <p className="text-sm text-gray-500 mt-1">Perbarui kata sandi dan autentikasi 2 langkah (Segera Hadir).</p>
          </div>
        </div>
      </div>

    </div>
  );
}