// SO Control Panel: antrean approval perubahan SO, riwayat, dan kelola (hapus) SO.
// Adaptasi dari mockup so-approval-control.html dengan palet Mulia Everything.
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Search, CheckCircle2, XCircle, Trash2, Eye, Upload, PencilLine,
  Check, X, TrendingUp, TrendingDown, FileEdit, PlusCircle, MinusCircle, LayoutGrid, AlertTriangle,
} from 'lucide-react';
import { callApi } from '../../services/api';

const fmtIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
const fmtNum = (n, d = 0) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n || 0);
const fmtRMB = (n) => '¥' + fmtNum(n, 2);
const fmtKg = (n) => fmtNum(n, 0) + ' kg';

const relTime = (ts) => {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
};

const IMPACT_CARDS = [
  { key: 'berat', label: 'Total Berat', fmt: fmtKg, invert: false },
  { key: 'importRMB', label: 'Nilai Import (RMB)', fmt: fmtRMB, invert: true },
  { key: 'lokalIDR', label: 'Nilai Lokal (IDR)', fmt: fmtIDR, invert: true },
  { key: 'budget', label: 'Budget Total', fmt: fmtIDR, invert: true },
];

const DiffRow = ({ tone, children }) => (
  <div className={`rounded-lg px-3 py-2 text-sm flex flex-wrap items-center gap-x-2 gap-y-0.5 ${
    tone === 'new' ? 'bg-emerald-50 dark:bg-emerald-900/10 border-l-4 border-emerald-500'
    : tone === 'deleted' ? 'bg-rose-50/70 dark:bg-rose-900/10 border-l-4 border-rose-500'
    : 'bg-amber-50/70 dark:bg-amber-900/10 border-l-4 border-amber-500'}`}>
    {children}
  </div>
);

export default function SoControlPanel({ onClose }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('pending');
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [soList, setSoList] = useState([]);
  const [expanded, setExpanded] = useState(new Set());
  const [rejectModal, setRejectModal] = useState(null); // { id, label }
  const [rejectReason, setRejectReason] = useState('');
  const [deleteSo, setDeleteSo] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [toast, setToast] = useState(null);
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all');

  const showToast = (msg, err = false) => { setToast({ msg, err }); setTimeout(() => setToast(null), 3200); };

  const loadAll = useCallback(async () => {
    const [p, h, s] = await Promise.all([
      callApi('SO_PENDING_CHANGES'),
      callApi('SO_CHANGES_HISTORY'),
      callApi('SO_LIST'),
    ]);
    if (p.status === 'success') setPending(p.data || []);
    if (h.status === 'success') setHistory(h.data || []);
    if (s.status === 'success') setSoList(s.data || []);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const approve = async (id) => {
    const res = await callApi('SO_CHANGE_APPROVE', { id });
    if (res.status !== 'success') { showToast(res.message, true); return; }
    showToast(res.message);
    loadAll();
  };

  const doReject = async () => {
    if (!rejectReason.trim()) return;
    const res = await callApi('SO_CHANGE_REJECT', { id: rejectModal.id, reason: rejectReason });
    if (res.status !== 'success') { showToast(res.message, true); return; }
    showToast('Perubahan ditolak, pengaju diberi tahu');
    setRejectModal(null); setRejectReason('');
    loadAll();
  };

  const doDelete = async () => {
    if (deleteConfirm.trim() !== deleteSo) return;
    const res = await callApi('SO_DELETE', { soId: deleteSo });
    if (res.status !== 'success') { showToast(res.message, true); return; }
    showToast(`${deleteSo} telah dihapus permanen`, true);
    setDeleteSo(null); setDeleteConfirm('');
    loadAll();
  };

  const pendingCard = (req) => {
    const d = req.diff || {};
    const imp = req.impact || {};
    const isOpen = expanded.has(req.id);
    const limit = isOpen ? Infinity : 3;
    const groups = [
      { title: 'Perubahan Field Project', icon: FileEdit, tone: 'changed', rows: (d.form || []).slice(0, limit).map((f) => (
        <DiffRow key={f.field} tone="changed">
          <span className="font-medium text-gray-700 dark:text-gray-200">{f.label}:</span>
          <span className="text-gray-500 dark:text-gray-400">{String(f.from ?? '-')}</span>
          <span className="text-gray-400">→</span>
          <span className="font-medium text-gray-700 dark:text-gray-200">{String(f.to ?? '-')}</span>
        </DiffRow>
      ))},
      { title: 'Material Berubah', icon: PencilLine, tone: 'changed', rows: (d.materials?.changed || []).slice(0, limit).map((m) => (
        <DiffRow key={m.articleCode + m.dim1} tone="changed">
          <span className="font-medium text-gray-700 dark:text-gray-200 w-full">{m.articleCode}</span>
          {(m.changes || []).map((c) => (
            <span key={c.field} className="flex flex-wrap items-center gap-x-2 text-gray-500 dark:text-gray-400 w-full">
              <span>{c.label}:</span><span>{String(c.from ?? '-')}</span><span className="text-gray-400">→</span>
              <span className="font-medium text-gray-700 dark:text-gray-200">{String(c.to ?? '-')}</span>
            </span>
          ))}
        </DiffRow>
      ))},
      { title: 'Material Baru', icon: PlusCircle, tone: 'new', rows: (d.materials?.added || []).slice(0, limit).map((m) => (
        <DiffRow key={m.articleCode} tone="new">
          <span className="font-medium text-gray-700 dark:text-gray-200">{m.articleCode}</span>
          <span className="text-gray-500 dark:text-gray-400"> — {m.description || fmtNum(m.qty) + ' pcs'}</span>
        </DiffRow>
      ))},
      { title: 'Material Dihapus', icon: MinusCircle, tone: 'deleted', rows: (d.materials?.removed || []).slice(0, limit).map((m) => (
        <DiffRow key={m.articleCode} tone="deleted">
          <span className="font-medium text-gray-700 dark:text-gray-200 line-through decoration-rose-400">{m.articleCode}</span>
          <span className="text-gray-500 dark:text-gray-400"> — {m.description || ''}</span>
        </DiffRow>
      ))},
      { title: 'Frame (MPF)', icon: LayoutGrid, tone: 'changed', rows: (d.frames?.changed || []).slice(0, limit).map((f) => (
        <DiffRow key={f.articleCode} tone="changed">
          <span className="font-medium text-gray-700 dark:text-gray-200">{f.articleCode}:</span>
          <span className="text-gray-500 dark:text-gray-400">{fmtNum(f.from)}</span>
          <span className="text-gray-400">→</span>
          <span className="font-medium text-gray-700 dark:text-gray-200">{fmtNum(f.to)}</span>
        </DiffRow>
      ))},
    ];
    const hidden = (d.form?.length || 0) + (d.materials?.changed?.length || 0) + (d.materials?.added?.length || 0)
      + (d.materials?.removed?.length || 0) + (d.frames?.changed?.length || 0) - groups.reduce((s, g) => s + g.rows.length, 0);

    return (
      <div key={req.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#0F3B6C] dark:bg-[#0084C9] text-white flex items-center justify-center font-semibold text-sm shrink-0">
              {(req.requester_nama || 'U').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-800 dark:text-white truncate">{req.so_id} · {imp.so_name || ''}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{req.requester_nama} · {relTime(req.submitted_at)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {req.type === 'excel' ? (
              <>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-50 dark:bg-sky-900/30 text-[#0084C9] dark:text-sky-400 flex items-center gap-1.5"><Upload size={12} /> Upload Excel Baru</span>
                <span className="text-xs text-gray-400">{req.file_name} · V.{req.draft_version_no - 1} → V.{req.draft_version_no}</span>
              </>
            ) : (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex items-center gap-1.5"><PencilLine size={12} /> Edit Manual</span>
            )}
            {!req.confirmed_at && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400" title="Pengaju belum menekan 'Kirim untuk Approval'">
                Draft · belum dikirim
              </span>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {groups.filter((g) => g.rows.length > 0).map((g) => (
            <div key={g.title}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">{g.title}</p>
              <div className="space-y-1.5">{g.rows}</div>
            </div>
          ))}
          {hidden > 0 && (
            <button onClick={() => setExpanded((s) => new Set(s).add(req.id))} className="text-xs font-medium text-[#0084C9] dark:text-cyan-400 hover:underline">
              Lihat Detail Lengkap (+{hidden} lainnya)
            </button>
          )}
          {isOpen && (
            <button onClick={() => setExpanded((s) => { const n = new Set(s); n.delete(req.id); return n; })} className="text-xs font-medium text-gray-400 hover:underline">Ciutkan detail</button>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">Dampak Perubahan</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {IMPACT_CARDS.map((c) => {
                const b = imp[c.key]?.before ?? 0, a = imp[c.key]?.after ?? 0;
                const delta = a - b;
                return (
                  <div key={c.key} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{c.label}</p>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{c.fmt(b)} → {c.fmt(a)}</p>
                    <p className={`text-xs font-medium mt-0.5 flex items-center gap-1 ${delta === 0 ? 'text-gray-400' : (delta > 0) === c.invert ? 'text-rose-500' : 'text-[#0EA5A5]'}`}>
                      {delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {delta === 0 ? 'Tidak berubah' : c.fmt(Math.abs(delta))}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-5 pt-0 flex flex-wrap gap-2">
          <button onClick={() => approve(req.id)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition">
            <Check size={15} /> Setujui &amp; Terapkan
          </button>
          <button onClick={() => setRejectModal({ id: req.id, label: `${req.so_id}` })} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 transition">
            <X size={15} /> Tolak
          </button>
        </div>
      </div>
    );
  };

  const statusStyles = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    draft: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  };
  const statusLabel = (s) => s === 'active' ? 'Aktif' : s === 'draft' ? 'Draft' : s;

  const filteredHistory = history.filter((h) => {
    if (historyFilter !== 'all' && h.status !== historyFilter) return false;
    const q = historySearch.toLowerCase().trim();
    if (q && !(String(h.so_id).toLowerCase().includes(q) || String(h.requester_nama || '').toLowerCase().includes(q))) return false;
    return true;
  });

  const inputCls = 'px-3 py-2 rounded-xl text-sm border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0084C9]/30';

  return (
    <div className="h-full flex flex-col">
      {/* HEADER */}
      <div className="shrink-0 px-5 sm:px-7 pb-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0F3B6C] dark:bg-[#0084C9] text-white flex items-center justify-center shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-[#0F3B6C] dark:text-white">SO Control Panel</h1>
              {pending.length > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">{pending.length} menunggu</span>}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Approval perubahan &amp; kontrol SO</p>
          </div>
        </div>
      </div>

      {/* TABS */}
      <nav className="px-5 sm:px-7 flex gap-6 border-b border-gray-200 dark:border-gray-700">
        {[
          ['pending', 'Menunggu Approval', pending.length],
          ['history', 'Riwayat Approval', null],
          ['manage', 'Kelola SO', null],
        ].map(([k, label, count]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`whitespace-nowrap py-3 text-sm font-semibold border-b-2 -mb-px transition ${tab === k ? 'border-[#0084C9] dark:border-cyan-400 text-[#0F3B6C] dark:text-cyan-400' : 'border-transparent text-gray-500 dark:text-gray-400'}`}>
            {label}{count != null && count > 0 && <span className="ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">{count}</span>}
          </button>
        ))}
      </nav>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {tab === 'pending' && (
          <div className="px-5 sm:px-7 py-6 space-y-5">
            {pending.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center py-24">
                <div className="w-16 h-16 rounded-full bg-teal-500/10 flex items-center justify-center mb-4">
                  <CheckCircle2 size={32} className="text-[#0EA5A5]" />
                </div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-1">Tidak ada antrean approval</h3>
                <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs">Semua perubahan SO sudah diproses. Permintaan baru akan muncul di sini.</p>
              </div>
            )}
            {pending.map(pendingCard)}
          </div>
        )}

        {tab === 'history' && (
          <div className="px-5 sm:px-7 py-6 space-y-5">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="Cari nomor SO atau pengaju..." className={`${inputCls} w-full pl-9`} />
              </div>
              <select value={historyFilter} onChange={(e) => setHistoryFilter(e.target.value)} className={inputCls}>
                <option value="all">Semua Status</option>
                <option value="approved">Disetujui</option>
                <option value="rejected">Ditolak</option>
              </select>
            </div>
            {filteredHistory.length === 0 && <div className="text-center text-sm text-gray-400 py-16">Tidak ada riwayat yang cocok.</div>}
            {filteredHistory.map((h) => (
              <div key={h.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-800 dark:text-white">{h.so_id}</p>
                    <span className="text-sm text-gray-400">·</span>
                    <p className="text-xs text-gray-400">{h.type === 'excel' ? 'Upload Excel' : 'Edit Manual'}</p>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Diajukan oleh {h.requester_nama} · {h.status === 'approved' ? 'Disetujui' : 'Ditolak'} oleh {h.approver_nama || '-'} · {new Date(h.decided_at).toLocaleString('id-ID')}
                  </p>
                  {h.reject_reason && (
                    <p className="text-xs text-rose-500 dark:text-rose-400 mt-1.5 bg-rose-50 dark:bg-rose-500/10 rounded-lg px-2.5 py-1.5 inline-block">Alasan: {h.reject_reason}</p>
                  )}
                </div>
                <div className="shrink-0">
                  {h.status === 'approved'
                    ? <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 size={12} /> Disetujui</span>
                    : <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400 flex items-center gap-1"><XCircle size={12} /> Ditolak</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'manage' && (
          <div className="px-5 sm:px-7 py-6 space-y-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800 dark:text-white">Semua Sales Order</h2>
                <span className="text-xs text-gray-400">{soList.length} SO</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                    <tr>{['Nomor SO', 'Project', 'Customer', 'Status', 'Versi Aktif', 'Jml Material', 'Budget', 'Dibuat Oleh', 'Aksi'].map((h) => <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {soList.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{s.id}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{s.project_name || '-'}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{s.customer || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.has_pending_change ? statusStyles.pending : statusStyles[s.status] || statusStyles.draft}`}>
                            {s.has_pending_change ? 'Menunggu Approval' : statusLabel(s.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{s.active_version ? `V.${s.active_version}` : '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{fmtNum(s.material_count)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{s.budget_idr ? fmtIDR(s.budget_idr) : '-'}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{s.created_by_nama || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => { onClose?.(); navigate(`/so/detail/${s.id}`); }} title="Lihat"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"><Eye size={14} /></button>
                            <button onClick={() => { setDeleteSo(s.id); setDeleteConfirm(''); }} title="Hapus"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* REJECT MODAL */}
      {rejectModal && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => setRejectModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg w-full max-w-md border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2"><XCircle size={15} className="text-rose-500" /> Tolak Perubahan</h3>
              <button onClick={() => setRejectModal(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"><X size={15} /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">Perubahan pada <span className="font-medium text-gray-700 dark:text-gray-200">{rejectModal.label}</span> akan ditolak dan dikembalikan ke pengaju. Berikan alasan penolakan.</p>
              <textarea rows={4} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Harga unit MANEX belum sesuai quotation terbaru, mohon dicek ulang." className={`${inputCls} w-full resize-none`} />
              {!rejectReason.trim() && <p className="text-xs text-rose-500">Alasan penolakan wajib diisi.</p>}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">
              <button onClick={() => setRejectModal(null)} className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300">Batal</button>
              <button onClick={doReject} disabled={!rejectReason.trim()} className={`px-4 py-2 rounded-xl text-sm font-semibold text-white ${rejectReason.trim() ? 'bg-rose-600 hover:bg-rose-700' : 'bg-rose-600/40 cursor-not-allowed'}`}>Tolak Perubahan</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODALS */}
      {deleteSo && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg w-full max-w-md border border-gray-200 dark:border-gray-700">
            {!deleteConfirm && deleteConfirm !== '' ? null : null}
            <div className="p-5 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-500/15 flex items-center justify-center mb-4">
                <AlertTriangle size={28} className="text-rose-500" />
              </div>
              <h3 className="font-semibold text-gray-800 dark:text-white mb-1.5">Hapus SO secara permanen?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Anda akan menghapus <span className="font-medium text-gray-700 dark:text-gray-200">{deleteSo}</span> beserta seluruh datanya.</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Tindakan ini <span className="font-semibold text-rose-500">tidak dapat dibatalkan</span>.</p>
            </div>
            <div className="px-5 pb-5 space-y-4">
              <div className="rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 p-3 text-sm text-rose-700 dark:text-rose-300">
                Semua material, frame, catatan, dan riwayat SO ini akan hilang permanen.
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 mb-1.5 block">Ketik <span className="font-semibold text-gray-800 dark:text-white">{deleteSo}</span> untuk melanjutkan</label>
                <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="Ketik nomor SO di sini" className={`${inputCls} w-full`} />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">
              <button onClick={() => setDeleteSo(null)} className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300">Batal</button>
              <button onClick={doDelete} disabled={deleteConfirm.trim() !== deleteSo}
                className={`px-4 py-2 rounded-xl text-sm font-semibold text-white transition ${deleteConfirm.trim() === deleteSo ? 'bg-rose-600 hover:bg-rose-700' : 'bg-rose-600/40 cursor-not-allowed'}`}>Hapus Permanen</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[70] flex items-center gap-2.5 px-4 py-3 text-sm rounded-xl shadow-lg border ${toast.err ? 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-700 text-rose-700 dark:text-rose-300' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'}`}>
          {toast.err ? <XCircle size={15} className="text-rose-500" /> : <CheckCircle2 size={15} className="text-[#0EA5A5]" />} {toast.msg}
        </div>
      )}
    </div>
  );
}
