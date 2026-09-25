// Arsip Working Order: daftar semua WO yang pernah dibuat dengan pencarian.
// Klik baris membuka modal mengambang berisi summary WO tersebut.
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Loader2, ClipboardList } from 'lucide-react';
import { callApi } from '../../services/api';
import WoDetailModal from './WoDetailModal';

const fmtNum = (n) => new Intl.NumberFormat('id-ID').format(n || 0);

export default function WoArchive() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null); // woId

  useEffect(() => {
    callApi('PRODUCTION_WO_LIST').then((res) => {
      if (res.status === 'success') setList(res.data || []);
      setLoading(false);
    });
  }, []);

  const q = search.toLowerCase().trim();
  const filtered = q
    ? list.filter((w) => [w.id, w.soId, w.customer, w.projectCode, w.preparedBy]
        .some((v) => String(v || '').toLowerCase().includes(q)))
    : list;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/production')} className="w-9 h-9 rounded-xl flex items-center justify-center border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-aira-navy dark:text-white flex items-center gap-2">
              <ClipboardList size={18} /> Arsip Working Order
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Semua WO yang pernah dibuat — klik baris untuk melihat summary lengkap.</p>
          </div>
        </div>
        <div className="relative sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari No. WO / SO / customer..."
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-xl text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0084C9]/30" />
        </div>
      </div>

      {/* Tabel */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400 text-xs uppercase">
              <tr>
                {['No. WO', 'SO', 'Kode Project', 'Customer', 'Item', 'Progress', 'Prepared By', 'Tanggal'].map((h) => (
                  <th key={h} className="font-semibold px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading && <tr><td colSpan="8" className="px-4 py-12 text-center text-gray-400"><Loader2 size={18} className="animate-spin inline mr-2" />Memuat…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan="8" className="px-4 py-12 text-center text-gray-400 text-sm">{q ? `Tidak ada WO yang cocok dengan "${search}".` : 'Belum ada WO.'}</td></tr>}
              {filtered.map((w) => (
                <tr key={w.id} onClick={() => setDetail(w.id)} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer">
                  <td className="px-4 py-3 font-bold text-aira-navy dark:text-aira-cyan whitespace-nowrap">{w.id}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{w.soId}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{w.projectCode || '-'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{w.customer || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{w.jumlahItem} item</td>
                  <td className="px-4 py-3 w-44">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#0084C9] to-[#0EA5A5]" style={{ width: `${w.progress}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 w-9">{w.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{w.preparedBy || '-'}</td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{new Date(w.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detail && <WoDetailModal woId={detail} onClose={() => setDetail(null)} onUpdated={() => {
        callApi('PRODUCTION_WO_LIST').then((res) => { if (res.status === 'success') setList(res.data || []); });
      }} />}
    </div>
  );
}
