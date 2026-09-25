// Modal mengambang berisi summary satu Working Order (header + item + progress).
// Dipakai kartu Riwayat WO di On Going Production dan halaman arsip /production/wo.
import React, { useState, useEffect } from 'react';
import { X, Loader2, ClipboardList, User, Building2, Factory, Pencil, Ban } from 'lucide-react';
import { callApi } from '../../services/api';
import { MACHINES, woItemPct, woStatusLabel, woStatusStyle } from './productionData';

const fmtNum = (n) => new Intl.NumberFormat('id-ID').format(n || 0);

export default function WoDetailModal({ woId, onClose, onUpdated }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [busy, setBusy] = useState(null); // itemId yang sedang diproses

  const muatUlang = () => {
    callApi('PRODUCTION_WO_DETAIL', { woId }).then((res) => {
      if (res.status === 'success') setData(res.data);
    });
  };

  // Pembatalan item HANYA lewat modifikasi WO ini (tombol batal di papan mesin sudah dihapus)
  const batalkanItem = async (it) => {
    if (!confirm(`Batalkan item ${it.item} (${it.lengthMm ?? '-'} mm) dari WO ini?`)) return;
    setBusy(it.id);
    const res = await callApi('PRODUCTION_WO_STATUS', { itemId: it.id, action: 'cancel' });
    setBusy(null);
    if (res.status !== 'success') { alert(res.message); return; }
    muatUlang();
    onUpdated?.();
  };

  useEffect(() => {
    callApi('PRODUCTION_WO_DETAIL', { woId }).then((res) => {
      if (res.status === 'success') setData(res.data);
      else setError(res.message);
    });
  }, [woId]);

  const machineName = (key) => MACHINES.find((m) => m.key === key)?.short || key;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
        {error && (
          <div className="p-8 text-center">
            <p className="text-sm text-rose-500">{error}</p>
            <button onClick={onClose} className="mt-3 text-xs font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-white">Tutup</button>
          </div>
        )}
        {!data && !error && (
          <div className="p-12 text-center text-gray-400"><Loader2 className="animate-spin inline mr-2" size={20} />Memuat WO…</div>
        )}
        {data && (<>
          {/* Header */}
          <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <ClipboardList size={15} className="text-aira-navy dark:text-aira-cyan" />
                <h3 className="font-bold text-gray-900 dark:text-white">{data.id}</h3>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${data.progress >= 100 ? 'bg-teal-50 dark:bg-teal-400/10 text-teal-700 dark:text-teal-300' : 'bg-sky-50 dark:bg-sky-900/30 text-[#0084C9] dark:text-sky-400'}`}>
                  {data.progress >= 100 ? 'Selesai' : `${data.progress}%`}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><Factory size={11} /> SO <b className="text-gray-800 dark:text-gray-100">{data.soId}</b></span>
                <span className="flex items-center gap-1"><Building2 size={11} /> {data.customer || '-'} · {data.projectCode || '-'}</span>
                <span className="flex items-center gap-1"><User size={11} /> Prepared by <b className="text-gray-800 dark:text-gray-100">{data.preparedBy || '-'}</b></span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setEditMode((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                  editMode ? 'bg-[#0EA5A5] text-white' : 'border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                <Pencil size={11} /> {editMode ? 'Selesai Modifikasi' : 'Modifikasi WO'}
              </button>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white"><X size={18} /></button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="px-5 pt-4">
            <div className="flex justify-between text-[11px] text-gray-400 mb-1">
              <span>Progress WO</span>
              <span>{fmtNum(data.totalDone)}/{fmtNum(data.totalTarget)} pcs</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#0084C9] to-[#0EA5A5]" style={{ width: `${data.progress}%` }} />
            </div>
          </div>

          {editMode && (
            <div className="mx-5 mt-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 px-3.5 py-2.5 text-[11px] text-amber-700 dark:text-amber-400">
              Mode modifikasi: pembatalan item WO hanya dilakukan dari sini. Item yang sudah selesai (done) tidak dapat dibatalkan.
            </div>
          )}

          {/* Tabel item */}
          <div className="p-5 overflow-y-auto custom-scrollbar">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400 uppercase">
                <tr>
                  {['Item', 'Length (mm)', 'Mesin', 'WO Qty', 'Selesai', 'Progress', 'Status', ...(editMode ? ['Aksi'] : [])].map((h) => (
                    <th key={h} className="font-semibold px-3 py-2.5 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {(data.items || []).map((it) => (
                  <tr key={it.id} className={it.status === 'cancelled' ? 'opacity-50' : ''}>
                    <td className="px-3 py-2.5 font-bold text-gray-800 dark:text-gray-100 whitespace-nowrap">{it.item}{it.reqGalva ? ' · GALVA' : ''}</td>
                    <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">{it.lengthMm ?? '-'}</td>
                    <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-aira-navy/10 text-aira-navy dark:bg-aira-cyan/20 dark:text-aira-cyan">{machineName(it.machine)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">{fmtNum(it.qtyTarget)} {it.unit}</td>
                    <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">{fmtNum(it.qtyDone)}</td>
                    <td className="px-3 py-2.5 w-28">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-[#0084C9] to-[#0EA5A5]" style={{ width: `${woItemPct(it)}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-400 w-8">{woItemPct(it)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${woStatusStyle[it.status]}`}>{woStatusLabel[it.status]}</span></td>
                    {editMode && (
                      <td className="px-3 py-2.5">
                        {it.status === 'done'
                          ? <span className="text-[10px] text-gray-400">Item selesai — tidak bisa dibatalkan</span>
                          : (
                            <button onClick={() => batalkanItem(it)} disabled={busy === it.id}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-semibold text-rose-500 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-1 disabled:opacity-50">
                              <Ban size={10} /> {busy === it.id ? 'Memproses…' : 'Batalkan'}
                            </button>
                          )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>)}
      </div>
    </div>
  );
}
