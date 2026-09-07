// Lihat Pengajuan (read-only): isi permintaan perubahan SO dari sudut pandang pengaju.
// Tanpa tombol aksi — hanya untuk memeriksa apa saja yang diajukan.
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, FileEdit, PlusCircle, MinusCircle, PencilLine, LayoutGrid,
  TrendingUp, TrendingDown, Minus, Eye, Clock3, CheckCircle2, XCircle, FileSpreadsheet,
} from 'lucide-react';
import { callApi } from '../../services/api';

const fmtIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
const fmtNum = (n, d = 0) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n || 0);
const fmtRMB = (n) => '¥' + fmtNum(n, 2);
const fmtKg = (n) => fmtNum(n, 0) + ' kg';

const IMPACT_CARDS = [
  { key: 'pallet', label: 'Total Pallet', fmt: fmtNum, invert: false },
  { key: 'berat', label: 'Total Berat Material', fmt: fmtKg, invert: false },
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

export default function ViewChangeRequest() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    callApi('SO_CHANGE_DETAIL', { id }).then((res) => {
      if (res.status !== 'success') { setError(res.message); return; }
      setData(res.data);
    });
  }, [id]);

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center">
        <XCircle size={40} className="mx-auto text-rose-400 mb-3" />
        <p className="text-gray-600 dark:text-gray-300">{error}</p>
        <button onClick={() => navigate('/so')} className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#0F3B6C] dark:bg-[#0084C9]">Kembali ke Dashboard SO</button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="h-[50vh] flex flex-col items-center justify-center text-gray-400 gap-3">
        <Loader2 className="animate-spin" size={28} />
        <p className="text-sm">Memuat isi pengajuan...</p>
      </div>
    );
  }

  const { request: req, so, draftMaterials, draftFrames } = data;
  const d = req.diff || {};
  const imp = req.impact || {};

  const statusBadge = req.status === 'pending'
    ? <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"><Clock3 size={13} /> Menunggu Approval</span>
    : req.status === 'approved'
    ? <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"><CheckCircle2 size={13} /> Disetujui</span>
    : <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400"><XCircle size={13} /> Ditolak</span>;

  const groups = [
    { title: 'Perubahan Field Project', icon: FileEdit, rows: (d.form || []).map((f, i) => (
      <DiffRow key={i} tone="changed">
        <span className="font-medium text-gray-700 dark:text-gray-200">{f.label}:</span>
        <span className="text-gray-500 dark:text-gray-400">{String(f.from ?? '-')}</span>
        <span className="text-gray-400">→</span>
        <span className="font-medium text-gray-700 dark:text-gray-200">{String(f.to ?? '-')}</span>
      </DiffRow>
    ))},
    { title: 'Material Berubah', icon: PencilLine, rows: (d.materials?.changed || []).map((m) => (
      <DiffRow key={m.articleCode + (m.dim1 ?? '')} tone="changed">
        <span className="font-medium text-gray-700 dark:text-gray-200 w-full">{m.articleCode}</span>
        {(m.changes || []).map((c) => (
          <span key={c.field} className="flex flex-wrap items-center gap-x-2 text-gray-500 dark:text-gray-400 w-full">
            <span>{c.label}:</span><span>{String(c.from ?? '-')}</span><span className="text-gray-400">→</span>
            <span className="font-medium text-gray-700 dark:text-gray-200">{String(c.to ?? '-')}</span>
          </span>
        ))}
      </DiffRow>
    ))},
    { title: 'Material Baru', icon: PlusCircle, rows: (d.materials?.added || []).map((m) => (
      <DiffRow key={m.articleCode} tone="new">
        <span className="font-medium text-gray-700 dark:text-gray-200">{m.articleCode}</span>
        <span className="text-gray-500 dark:text-gray-400"> — {m.description || fmtNum(m.qty) + ' pcs'}</span>
      </DiffRow>
    ))},
    { title: 'Material Dihapus', icon: MinusCircle, rows: (d.materials?.removed || []).map((m) => (
      <DiffRow key={m.articleCode} tone="deleted">
        <span className="font-medium text-gray-700 dark:text-gray-200 line-through decoration-rose-400">{m.articleCode}</span>
        <span className="text-gray-500 dark:text-gray-400"> — {m.description || ''}</span>
      </DiffRow>
    ))},
    { title: 'Frame (MPF)', icon: LayoutGrid, rows: (d.frames?.changed || []).map((f) => (
      <DiffRow key={f.articleCode} tone="changed">
        <span className="font-medium text-gray-700 dark:text-gray-200">{f.articleCode}:</span>
        <span className="text-gray-500 dark:text-gray-400">{fmtNum(f.from)}</span>
        <span className="text-gray-400">→</span>
        <span className="font-medium text-gray-700 dark:text-gray-200">{fmtNum(f.to)}</span>
      </DiffRow>
    ))},
  ].filter((g) => g.rows.length > 0);

  const matTable = (type, title) => {
    const items = draftMaterials.filter((m) => (type === 'import' ? m.currency !== 'IDR' : m.currency === 'IDR'));
    if (!items.length) return null;
    const fmt = type === 'import' ? fmtRMB : fmtIDR;
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 font-semibold text-sm text-gray-800 dark:text-white flex items-center justify-between">
          <span>{title}</span><span className="text-xs text-gray-400 font-normal">{items.length} baris</span>
        </div>
        <div className="overflow-x-auto max-h-[420px] custom-scrollbar">
          <table className="w-full text-sm min-w-[850px]">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/70 text-left text-xs text-gray-500 dark:text-gray-400">
              <tr>{['Article Code', 'Dim 1', 'Colour', 'QTY', 'Harga Unit', 'Total Harga', 'Description'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.map((m, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-3 py-2 font-mono text-xs font-bold text-[#0F3B6C] dark:text-cyan-400 whitespace-nowrap">{m.articleCode}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{m.dim1 ?? '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{m.colour ?? '-'}</td>
                  <td className="px-3 py-2 font-bold whitespace-nowrap">{fmtNum(m.qty)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmt(m.unitPrice)}</td>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{fmt(m.qty * m.unitPrice)}</td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400 max-w-[220px] truncate" title={m.description ?? ''}>{m.description ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <button onClick={() => navigate('/so')} className="mt-1 w-9 h-9 rounded-xl flex items-center justify-center border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0">
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-[#0F3B6C] dark:text-white">Pengajuan Perubahan SO {req.so_id}</h1>
              {statusBadge}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
              <span>Diajukan oleh {req.requester?.nama}</span>
              <span>·</span>
              <span>{new Date(req.submitted_at).toLocaleString('id-ID')}</span>
              {req.draft_version_no && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-900/30 text-[#0084C9] dark:text-sky-400 text-xs font-semibold"><FileSpreadsheet size={11} /> V.{req.draft_version_no}</span>}
              {req.file_name && <span className="text-xs text-gray-400">{req.file_name}</span>}
            </p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 shrink-0">
          <Eye size={13} /> Mode lihat saja — terkunci
        </span>
      </div>

      {/* Banner status */}
      <div className="flex items-start gap-3 rounded-2xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/10 px-4 py-3 text-sm text-[#0F3B6C] dark:text-sky-300">
        <Eye size={16} className="mt-0.5 shrink-0" />
        <p>Halaman ini hanya menampilkan isi pengajuan Anda. Perubahan tidak bisa diedit di sini — menunggu keputusan Developer.</p>
      </div>
      {req.reject_reason && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          <XCircle size={16} className="mt-0.5 shrink-0" />
          <p><span className="font-semibold">Ditolak: </span>{req.reject_reason}</p>
        </div>
      )}

      {/* DAMPAK */}
      {imp.budget && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {IMPACT_CARDS.map((c) => {
              const b = imp[c.key]?.before ?? 0, a = imp[c.key]?.after ?? 0;
              const delta = a - b;
              return (
                <div key={c.key} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 shadow-sm px-4 py-3.5">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">{c.label}</p>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-xs text-gray-400 line-through">{c.fmt(b)}</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{c.fmt(a)}</span>
                  </div>
                  {delta !== 0 && (
                    <p className={`text-xs font-medium mt-1 flex items-center gap-1 ${(delta > 0) === c.invert ? 'text-rose-500' : 'text-[#0EA5A5]'}`}>
                      {delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {delta > 0 ? '+' : ''}{c.fmt(Math.abs(delta))}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* DIFF GROUPS */}
      {groups.length === 0 && (
        <div className="text-center text-sm text-gray-400 py-8">Tidak ada perubahan material/field pada pengajuan ini.</div>
      )}
      <div className="space-y-5">
        {groups.map((g) => {
          const Icon = g.icon;
          return (
            <div key={g.title} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3 flex items-center gap-1.5">
                <Icon size={14} /> {g.title}
              </p>
              <div className="space-y-1.5">{g.rows}</div>
            </div>
          );
        })}
      </div>

      {/* DRAFT MATERIAL LENGKAP */}
      <div className="space-y-5">
        <h2 className="text-base font-bold text-gray-800 dark:text-white">Daftar Material Lengkap (usulan baru)</h2>
        {matTable('import', 'Material Import (RMB)')}
        {matTable('lokal', 'Material Lokal (IDR)')}
      </div>

      <div className="pt-2">
        <Link to={`/so/detail/${req.so_id}`} className="text-sm font-semibold text-[#0084C9] dark:text-cyan-400 hover:underline">→ Buka Detail SO {req.so_id}</Link>
      </div>
    </div>
  );
}
