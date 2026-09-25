// Modul Working Order (tab On Going Production): upload WO harian oleh admin,
// daftar WO + progress, papan antrean per mesin dengan drag-and-drop penuh,
// dan pengaturan kode akses halaman operator per mesin.
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Loader2, X, ClipboardList, GripVertical, Pause, Play, Copy,
  KeyRound, Link2, CheckCircle2, TrendingUp, Layers,
} from 'lucide-react';
import { callApi } from '../../services/api';
import { MACHINES, isProductionMaterial, pipelineFor, woItemPct, woStatusLabel, woStatusStyle } from './productionData';
import WoDetailModal from './WoDetailModal';

const fmtNum = (n) => new Intl.NumberFormat('id-ID').format(n || 0);
const inputCls = 'text-xs border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 rounded-lg px-2.5 py-2 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0084C9]/30 w-full';
const UNITS = ['Btg', 'Pcs', 'Kg'];
const emptyRow = () => ({ item: '', lengthMm: '', qtyTarget: '', unit: 'Btg', rawMaterial: '', multiplierWeight: '', reqGalva: false, coilNumber: '', machine: 'upright' });

export default function WorkingOrder({ projects = [], projectsLoading = false, onOpenProject = () => {} }) {
  const navigate = useNavigate();
  const me = JSON.parse(localStorage.getItem('user') || 'null');

  const [woList, setWoList] = useState([]);
  const [boards, setBoards] = useState([]);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [woSearch, setWoSearch] = useState('');
  const [woDetail, setWoDetail] = useState(null); // woId untuk modal summary

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const load = () => {
    setLoading(true);
    Promise.all([
      callApi('PRODUCTION_WO_LIST'),
      callApi('PRODUCTION_QUEUE'),
      callApi('PRODUCTION_MACHINES'),
    ]).then(([wo, q, m]) => {
      if (wo.status === 'success') setWoList(wo.data || []);
      if (q.status === 'success') setBoards(q.data || []);
      if (m.status === 'success') setMachines(m.data || []);
      setLoading(false);
    });
  };
  useEffect(() => { load(); }, []);

  const woFiltered = woList.filter((w) => {
    const q = woSearch.toLowerCase().trim();
    if (!q) return true;
    return [w.id, w.soId, w.customer, w.projectCode, w.preparedBy].some((v) => String(v || '').toLowerCase().includes(q));
  });

  // ==== Drag & drop per mesin ====
  const [drag, setDrag] = useState(null); // { machine, index }

  const handleDrop = async (machine, toIndex) => {
    if (!drag || drag.machine !== machine) return;
    const board = boards.find((b) => b.machine === machine);
    const list = [...board.items];
    const [moved] = list.splice(drag.index, 1);
    list.splice(toIndex, 0, moved);
    setBoards((prev) => prev.map((b) => (b.machine === machine ? { ...b, items: list } : b)));
    setDrag(null);
    const res = await callApi('PRODUCTION_QUEUE_REORDER', { machine, itemIds: list.map((i) => i.id) });
    if (res.status !== 'success') { alert(res.message); load(); }
    else showToast('Urutan antrean diperbarui');
  };

  const itemAction = async (item, action) => {
    const res = await callApi('PRODUCTION_WO_STATUS', { itemId: item.id, action });
    if (res.status !== 'success') { alert(res.message); return; }
    showToast(res.message);
    load();
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gray-900 dark:bg-black text-white text-sm rounded-xl px-4 py-3 shadow-lg">
          <CheckCircle2 size={15} className="text-teal-400" /> {toast}
        </div>
      )}

      {/* Header Working Order */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><ClipboardList size={16} className="text-aira-navy dark:text-aira-cyan" /> Working Order</h2>
          <p className="text-xs text-gray-400 mt-0.5">Upload WO harian — item masuk otomatis ke antrean mesin masing-masing. Langsung aktif + notifikasi ke tim SO.</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0084C9] to-[#0EA5A5] text-white text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 shrink-0">
          <Plus size={14} /> Upload WO
        </button>
      </div>

      {/* Papan antrean per mesin */}
      <div>
        <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Layers size={16} className="text-aira-navy dark:text-aira-cyan" /> Papan Antrean Mesin</h3>
        <p className="text-xs text-gray-400 mb-4 -mt-2">Tarik pegangan di kiri baris untuk mengubah urutan antrean (drag-and-drop penuh). Kartu "Berjalan" bisa di-pause, lalu antrean di bawahnya dikerjakan duluan.</p>
        {loading && <p className="text-sm text-gray-400 py-6 text-center"><Loader2 size={18} className="animate-spin inline mr-2" />Memuat antrean…</p>}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {boards.map((b) => {
            const meta = MACHINES.find((m) => m.key === b.machine);
            // Hanya yang benar-benar BERJALAN yang tidak bisa di-drag.
            // Item PAUSED ikut daftar drag-and-drop (skema project urgent: pause A, drag B ke atas).
            const running = b.items.filter((i) => i.status === 'running');
            const antrian = b.items.filter((i) => i.status === 'queued' || i.status === 'paused');
            return (
              <div key={b.machine} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{meta.name}</p>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${running.some((r) => r.status === 'running') ? 'bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300'}`}>
                    {running.some((r) => r.status === 'running') ? 'Running' : 'Idle'} · {b.items.length} item
                  </span>
                </div>

                {/* Kartu berjalan / pause */}
                {running.map((it) => (
                  <div key={it.id} className="mb-3 rounded-xl border border-sky-100 dark:border-sky-900/40 bg-sky-50/50 dark:bg-sky-900/10 p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-bold text-gray-800 dark:text-gray-100">{it.item} <span className="font-normal text-gray-400">· {it.lengthMm ?? '-'} mm</span></p>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${woStatusStyle[it.status]}`}>{woStatusLabel[it.status]}</span>
                        {it.status === 'running' && (
                          <button onClick={() => itemAction(it, 'pause')} title="Pause WO ini, kerjakan antrean berikutnya"
                            className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 hover:bg-amber-100"><Pause size={12} /></button>
                        )}
                        {it.status === 'paused' && (
                          <button onClick={() => itemAction(it, 'resume')} title="Lanjutkan WO ini"
                            className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100"><Play size={12} /></button>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400 mb-2">{it.woId} · {it.soId} · <span className="font-semibold text-gray-500 dark:text-gray-300">{it.customer || '-'}</span> · {fmtNum(it.qtyDone)}/{fmtNum(it.qtyTarget)} {it.unit}</p>
                    <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#0084C9] to-[#0EA5A5]" style={{ width: `${woItemPct(it)}%` }} />
                    </div>
                  </div>
                ))}
                {running.length === 0 && antrian.length > 0 && <p className="text-[11px] text-gray-400 mb-3">Belum ada WO berjalan — antrean teratas akan dikerjakan pertama.</p>}

                {/* Antrean drag-and-drop */}
                {antrian.length === 0 && running.length === 0 && <p className="text-xs text-gray-400 py-3 text-center">Antrean kosong.</p>}
                <div className="space-y-2">
                  {antrian.map((it, idx) => (
                    <div key={it.id}
                      draggable
                      onDragStart={() => setDrag({ machine: b.machine, index: idx })}
                      onDragEnd={() => setDrag(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(b.machine, idx)}
                      className={`flex items-center gap-2.5 rounded-xl border p-2.5 cursor-grab active:cursor-grabbing transition-colors ${
                        drag?.machine === b.machine && drag.index === idx ? 'opacity-40 border-dashed' : 'border-gray-100 dark:border-gray-700 hover:border-[#0084C9]/40'}`}>
                      <GripVertical size={14} className="text-gray-300 dark:text-gray-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{it.item} <span className="font-normal text-gray-400">· {it.lengthMm ?? '-'} mm · {fmtNum(it.qtyTarget)} {it.unit}</span></p>
                        <p className="text-[10px] text-gray-400 truncate">{it.woId} · {it.soId} · <span className="font-semibold text-gray-500 dark:text-gray-300">{it.customer || '-'}</span></p>
                        {it.status === 'paused' && <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${woStatusStyle.paused}`}>Pause · {woItemPct(it)}%</span>}
                      </div>
                      {it.qtyDone > 0 && (
                        <div className="w-16 shrink-0">
                          <div className="h-1 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                            <div className="h-full rounded-full bg-[#0084C9]" style={{ width: `${woItemPct(it)}%` }} />
                          </div>
                        </div>
                      )}
                      {it.status === 'paused' && (
                        <button onClick={() => itemAction(it, 'resume')} title="Lanjutkan WO ini"
                          className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 shrink-0"><Play size={12} /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Project sedang produksi */}
      {projects.length > 0 || projectsLoading ? (
        <div>
          <h2 className="font-bold text-gray-900 dark:text-white mb-3">Project Sedang Produksi</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {projects.map((s) => (
              <div key={s.id} onClick={() => onOpenProject(s.id)}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 cursor-pointer hover:border-[#0084C9]/40 transition-colors">
                <p className="text-xs font-bold text-aira-navy dark:text-aira-cyan">{s.id}</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{s.projectName || s.customer || '-'}</p>
                <p className="text-xs text-gray-400 mb-3">{s.customer || '-'}</p>
                <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                  <span>{fmtNum(s.woDone)}/{fmtNum(s.woTarget)} pcs</span>
                  <span className="font-bold text-aira-navy dark:text-aira-cyan">{s.progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#0084C9] to-[#0EA5A5]" style={{ width: `${s.progress}%` }} />
                </div>
              </div>
            ))}
            {projectsLoading && <div className="text-center text-gray-400 text-sm py-8"><Loader2 size={18} className="animate-spin inline mr-2" />Memuat…</div>}
          </div>
        </div>
      ) : null}

      {/* Riwayat Working Order (nomor dua dari bawah) */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-5 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">Riwayat Working Order</h3>
            <p className="text-xs text-gray-400 mt-0.5">Klik baris untuk summary lengkap WO. <button onClick={() => navigate('/production/wo')} className="font-semibold text-aira-navy dark:text-aira-cyan hover:underline">Lihat semua WO →</button></p>
          </div>
          <div className="relative sm:w-64">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={woSearch} onChange={(e) => setWoSearch(e.target.value)} placeholder="Cari No. WO / SO / customer..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 rounded-lg text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0084C9]/30" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400 text-xs uppercase">
              <tr>
                {['No. WO', 'SO', 'Customer', 'Item', 'Progress WO', 'Prepared By', 'Tanggal'].map((h) => (
                  <th key={h} className="font-semibold px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading && <tr><td colSpan="7" className="px-4 py-10 text-center text-gray-400"><Loader2 size={18} className="animate-spin inline mr-2" />Memuat…</td></tr>}
              {!loading && woFiltered.length === 0 && <tr><td colSpan="7" className="px-4 py-10 text-center text-gray-400 text-sm">{woSearch ? 'Tidak ada WO yang cocok.' : 'Belum ada WO. Klik "Upload WO" untuk membuat yang pertama.'}</td></tr>}
              {woFiltered.slice(0, 10).map((w) => (
                <tr key={w.id} onClick={() => setWoDetail(w.id)} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer">
                  <td className="px-4 py-3 font-bold text-aira-navy dark:text-aira-cyan whitespace-nowrap">{w.id}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{w.soId}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{w.customer || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{w.jumlahItem} item</td>
                  <td className="px-4 py-3 w-44">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#0084C9] to-[#0EA5A5]" style={{ width: `${w.progress}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 w-9">{w.progress}%</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{fmtNum(w.totalDone)}/{fmtNum(w.totalTarget)} pcs</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{w.preparedBy || '-'}</td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{new Date(w.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && woFiltered.length > 10 && (
            <button onClick={() => navigate('/production/wo')} className="w-full py-2.5 text-xs font-semibold text-[#0084C9] dark:text-cyan-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 border-t border-gray-100 dark:border-gray-700">
              + {woFiltered.length - 10} WO lainnya — buka arsip lengkap
            </button>
          )}
        </div>
      </div>

      {/* Kode akses mesin (halaman operator) */}
      <MachineAccessPanel machines={machines} onSaved={load} showToast={showToast} />

      {/* Modal summary WO */}
      {woDetail && <WoDetailModal woId={woDetail} onClose={() => setWoDetail(null)} onUpdated={load} />}

      {/* Form upload WO */}
      {showForm && <WoForm onClose={() => setShowForm(false)} onDone={(msg) => { setShowForm(false); showToast(msg); load(); }} me={me} />}
    </div>
  );
}

// ==== Pengaturan kode akses + link operator ====
const MachineAccessPanel = ({ machines, onSaved, showToast }) => {
  const [edit, setEdit] = useState(null); // machine
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);

  const simpan = async (machine) => {
    setSaving(true);
    const res = await callApi('PRODUCTION_MACHINE_CODE', { machine, code });
    setSaving(false);
    if (res.status !== 'success') { alert(res.message); return; }
    setEdit(null); setCode('');
    showToast(res.message);
    onSaved();
  };

  const operatorLink = (m) => `${window.location.origin}/production/machine/${m}`;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
      <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1 flex items-center gap-2"><KeyRound size={15} className="text-aira-navy dark:text-aira-cyan" /> Kode Akses Halaman Operator</h3>
      <p className="text-xs text-gray-400 mb-4">Setiap mesin punya link operator sendiri (tanpa login, dilindungi kode akses). Bagikan link + kode ke operator mesin.</p>
      <div className="space-y-2">
        {machines.map((m) => {
          const meta = MACHINES.find((x) => x.key === m.machine);
          return (
            <div key={m.machine} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-gray-100 dark:border-gray-700 p-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-800 dark:text-gray-100">{meta?.name || m.machine}</p>
                <p className="text-[11px] text-gray-400 flex items-center gap-1 truncate">
                  <Link2 size={11} className="shrink-0" /> {operatorLink(m.machine)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${m.codeSet ? 'bg-teal-50 dark:bg-teal-400/10 text-teal-700 dark:text-teal-300' : 'bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300'}`}>
                  {m.codeSet ? 'Kode aktif' : 'Belum ada kode'}
                </span>
                <button onClick={() => { navigator.clipboard?.writeText(operatorLink(m.machine)); showToast('Link operator dikopi'); }}
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-aira-navy dark:hover:text-aira-cyan" title="Kopi link"><Copy size={12} /></button>
                {edit === m.machine ? (
                  <div className="flex items-center gap-1.5">
                    <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Kode baru" className={inputCls + ' !w-28'} />
                    <button onClick={() => simpan(m.machine)} disabled={saving || code.trim().length < 3}
                      className="px-2.5 py-1.5 rounded-lg bg-aira-navy dark:bg-aira-cyan text-white dark:text-gray-900 text-[11px] font-semibold disabled:opacity-50">Simpan</button>
                    <button onClick={() => { setEdit(null); setCode(''); }} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white"><X size={13} /></button>
                  </div>
                ) : (
                  <button onClick={() => setEdit(m.machine)}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                    {m.codeSet ? 'Ubah kode' : 'Setel kode'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==== Form upload WO ====
const WoForm = ({ onClose, onDone, me }) => {
  const [sos, setSos] = useState([]);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState(null); // SO terpilih
  const [boqMats, setBoqMats] = useState([]); // material produksi BOQ versi aktif SO terpilih
  const [committed, setCommitted] = useState({}); // sisa kuota WO: key item|len|machine -> qty sudah ter-WO
  const [rows, setRows] = useState(Array.from({ length: 5 }, emptyRow));
  const [preparedBy, setPreparedBy] = useState(me?.nama || '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    callApi('SO_LIST').then((res) => {
      if (res.status === 'success') setSos(res.data || []);
    });
  }, []);

  // Saat project dipilih: muat BOQ versi aktif untuk validasi matching item WO
  const pilihSo = (so) => {
    setPicked(so);
    setSearch(so.project_number || so.id);
    setBoqMats([]);
    setCommitted({});
    callApi('SO_DETAIL', { soId: so.id }).then((res) => {
      if (res.status === 'success') setBoqMats((res.data.materials || []).filter(isProductionMaterial));
    });
    // total qty WO yang sudah dibuat per item|length|mesin (untuk batas sisa kuota vs BOQ)
    callApi('PRODUCTION_WO_LIST', { soId: so.id }).then((res) => {
      if (res.status !== 'success') return;
      const map = {};
      (res.data.items || []).filter((it) => it.status !== 'cancelled').forEach((it) => {
        const k = `${String(it.item).trim()}|${String(it.lengthMm ?? '').trim()}|${it.machine}`;
        map[k] = (map[k] || 0) + it.qtyTarget;
      });
      setCommitted(map);
    });
  };

  // Validasi satu baris terhadap BOQ: item+length harus ada, mesin sesuai pipeline
  const validasiBaris = (r) => {
    if (!String(r.item || '').trim()) return { ok: true, kosong: true }; // baris belum diisi — dilewati
    if (!picked || boqMats.length === 0) return { ok: false, pesan: 'Pilih / tunggu data BOQ termuat' };
    const boq = boqMats.find((m) => String(m.articleCode).trim() === String(r.item).trim()
      && String(m.dim1 ?? '').trim() === String(r.lengthMm || '').trim());
    if (!boq) return { ok: false, pesan: `Tidak ada di BOQ (${r.item} · ${r.lengthMm || '-'} mm)` };
    if (!pipelineFor(boq.articleCode, boq.colour).includes(r.machine)) {
      return { ok: false, pesan: `Mesin harus: ${pipelineFor(boq.articleCode, boq.colour).join('/')}` };
    }
    // batas qty: total WO mesin ini tidak boleh melebihi kebutuhan BOQ
    const k = `${String(r.item).trim()}|${String(r.lengthMm || '').trim()}|${r.machine}`;
    const sudahWo = committed[k] || 0;
    const sisa = boq.qty - sudahWo;
    const qty = parseFloat(r.qtyTarget) || 0;
    if (qty > sisa) {
      return { ok: false, pesan: `Maks ${Math.max(0, sisa)} (BOQ ${boq.qty}, sudah ter-WO ${sudahWo})` };
    }
    return { ok: true };
  };
  const adaInvalid = rows.some((r) => !validasiBaris(r).ok);

  const hasil = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return [];
    return sos.filter((s) =>
      String(s.project_number || '').toLowerCase().includes(q)
      || String(s.id).toLowerCase().includes(q)
      || String(s.project_name || '').toLowerCase().includes(q)
      || String(s.customer || '').toLowerCase().includes(q)
    ).slice(0, 8);
  }, [sos, search]);

  const setRow = (i, field, val) => setRows((p) => p.map((r, k) => (k === i ? { ...r, [field]: val } : r)));

  const submit = async () => {
    if (!picked) { alert('Pilih Kode Project dulu (cari lalu klik).'); return; }
    const items = rows.filter((r) => r.item.trim() || String(r.qtyTarget).trim());
    if (items.length === 0) { alert('Isi minimal satu baris item.'); return; }
    const invalid = rows.map((r) => ({ r, v: validasiBaris(r) })).filter((x) => !x.v.ok);
    if (invalid.length) {
      alert('WO DITOLAK — item tidak match dengan BOQ SO ini:\n' + invalid.map((x) => `• ${x.r.item} · ${x.r.lengthMm || '-'} mm — ${x.v.pesan}`).join('\n'));
      return;
    }
    setSubmitting(true);
    const res = await callApi('PRODUCTION_WO_CREATE', {
      soId: picked.id,
      projectCode: picked.project_number || null,
      customer: picked.customer || null,
      preparedBy,
      items,
    });
    setSubmitting(false);
    if (res.status !== 'success') { alert(res.message); return; }
    onDone(res.message);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xl w-full max-w-5xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 rounded-t-2xl z-10">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">Upload Working Order</h3>
            <p className="text-xs text-gray-400">Cari kode project → No SO & Customer terisi otomatis → isi tabel item → submit.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Header WO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Kode Project (cari)</label>
              <div className="relative mt-1">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  disabled={!!picked}
                  placeholder={picked ? picked.project_number || picked.id : 'Ketik kode project / SO…'}
                  className={inputCls + ' !pl-8 !py-2.5 !text-sm'} />
                {picked && (
                  <button onClick={() => { setPicked(null); setSearch(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-rose-500"><X size={13} /></button>
                )}
              </div>
              {!picked && search && hasil.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 shadow-lg overflow-hidden">
                  {hasil.map((s) => (
                    <button key={s.id} onClick={() => pilihSo(s)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-600/50 text-xs">
                      <span className="font-bold text-gray-800 dark:text-gray-100">{s.project_number || '-'}</span>
                      <span className="text-gray-400"> · {s.id} · {s.project_name || '-'} · {s.customer || '-'}</span>
                    </button>
                  ))}
                </div>
              )}
              {!picked && search && hasil.length === 0 && (
                <p className="text-[11px] text-rose-400 mt-1">Project tidak ditemukan di SO.</p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">No SO</label>
              <input value={picked?.id ?? ''} readOnly placeholder="Terisi otomatis"
                className={inputCls + ' !py-2.5 !text-sm !bg-gray-50 dark:!bg-gray-900/60'} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Customer</label>
              <input value={picked?.customer ?? ''} readOnly placeholder="Terisi otomatis"
                className={inputCls + ' !py-2.5 !text-sm !bg-gray-50 dark:!bg-gray-900/60'} />
            </div>
          </div>

          {/* Tabel item */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Item WO</label>
              <button onClick={() => setRows((p) => [...p, emptyRow()])}
                className="text-[11px] font-semibold text-aira-navy dark:text-aira-cyan hover:underline flex items-center gap-1"><Plus size={11} /> Tambah baris</button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
              <table className="w-full text-xs min-w-[900px]">
                <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400">
                  <tr>
                    {['Item', 'Length (mm)', 'Prod. Qty (Btg)', 'Unit', 'Raw Material', 'Mult. Weight (Kg)', 'Req. Galva', 'Coil Number', 'Machine'].map((h) => (
                      <th key={h} className="font-semibold px-2.5 py-2.5 text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {rows.map((r, i) => {
                    const v = validasiBaris(r);
                    return (
                    <tr key={i} className={v.ok ? '' : 'bg-rose-50/50 dark:bg-rose-900/10'}>
                      <td className="px-2 py-1.5">
                        <input value={r.item} onChange={(e) => setRow(i, 'item', e.target.value)} placeholder="mis. MPD 1015"
                          title={v.ok ? '' : v.pesan}
                          className={inputCls + ` !w-28 ${v.ok ? '' : '!border-rose-400 !ring-1 !ring-rose-300'}`} />
                        {!v.ok && <p className="text-[9px] text-rose-500 mt-0.5 w-28 leading-tight">{v.pesan}</p>}
                      </td>
                      <td className="px-2 py-1.5"><input value={r.lengthMm} onChange={(e) => setRow(i, 'lengthMm', e.target.value)} placeholder="mis. 1045" className={inputCls + ' !w-20'} /></td>
                      <td className="px-2 py-1.5"><input type="number" min="1" value={r.qtyTarget} onChange={(e) => setRow(i, 'qtyTarget', e.target.value)} className={inputCls + ' !w-20'} /></td>
                      <td className="px-2 py-1.5">
                        <select value={r.unit} onChange={(e) => setRow(i, 'unit', e.target.value)} className={inputCls + ' !w-16' }>
                          {UNITS.map((u) => <option key={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5"><input value={r.rawMaterial} onChange={(e) => setRow(i, 'rawMaterial', e.target.value)} className={inputCls + ' !w-28'} /></td>
                      <td className="px-2 py-1.5"><input type="number" min="0" step="0.01" value={r.multiplierWeight} onChange={(e) => setRow(i, 'multiplierWeight', e.target.value)} className={inputCls + ' !w-20'} /></td>
                      <td className="px-2 py-1.5 text-center">
                        <input type="checkbox" checked={r.reqGalva} onChange={(e) => setRow(i, 'reqGalva', e.target.checked)} className="w-4 h-4 accent-[#0EA5A5]" />
                      </td>
                      <td className="px-2 py-1.5"><input value={r.coilNumber} onChange={(e) => setRow(i, 'coilNumber', e.target.value)} className={inputCls + ' !w-24'} /></td>
                      <td className="px-2 py-1.5">
                        <select value={r.machine} onChange={(e) => setRow(i, 'machine', e.target.value)} className={inputCls + ' !w-36'}>
                          {MACHINES.map((m) => <option key={m.key} value={m.key}>{m.short}</option>)}
                        </select>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {adaInvalid && (
              <p className="text-[11px] text-rose-500 mt-2">Ada baris merah yang tidak match dengan BOQ versi aktif SO ini — perbaiki article code / length / mesin sebelum submit. Item di luar BOQ harus lewat perubahan BOQ (approval) dulu.</p>
            )}
            {!adaInvalid && picked && (
              <p className="text-[11px] text-teal-600 dark:text-teal-400 mt-2">Semua baris match dengan BOQ versi aktif — siap submit.</p>
            )}
          </div>

          {/* Konfirmasi */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="sm:w-72">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Prepared By</label>
              <input value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)}
                className={inputCls + ' !py-2.5 !text-sm mt-1'} />
            </div>
            <div className="flex-1" />
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Batal</button>
              <button onClick={submit} disabled={submitting || adaInvalid || !picked}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0084C9] to-[#0EA5A5] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-60 flex items-center gap-1.5">
                {submitting ? <Loader2 size={13} className="animate-spin" /> : <TrendingUp size={13} />} Submit WO
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
