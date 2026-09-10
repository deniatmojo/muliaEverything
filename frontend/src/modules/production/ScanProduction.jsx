// Halaman publik hasil scan QR produksi (tanpa login) untuk admin produksi lapangan.
// Menampilkan detail SO + job kelima mesin; operator memilih job dan menginput qty output.
// Pola sama seperti /qc/scan/:code — berada di luar ProtectedRoute.
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Factory, ScanLine, Layers, Flame, Paintbrush, Loader2, CheckCircle2, AlertTriangle,
  User, Hash, Briefcase, ClipboardList, Plus, RefreshCw,
} from 'lucide-react';
import { callApi } from '../../services/api';
import { MACHINES, jobPct, jobStatusLabel, jobStatusStyle } from './productionData';

const fmtNum = (n) => new Intl.NumberFormat('id-ID').format(n || 0);
const machineIcon = { factory: Factory, 'scan-line': ScanLine, layers: Layers, flame: Flame, paintbrush: Paintbrush };

export default function ScanProduction() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form update
  const [selJob, setSelJob] = useState(null);
  const [qty, setQty] = useState('');
  const [operator, setOperator] = useState(localStorage.getItem('prod_operator_nama') || '');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sukses, setSukses] = useState(null);

  const load = () => {
    setLoading(true); setError(null);
    callApi('PRODUCTION_SCAN_GET', { token }).then((res) => {
      if (res.status === 'success') setData(res.data);
      else setError(res.message);
      setLoading(false);
    });
  };
  useEffect(() => { load(); }, [token]); // eslint-disable-line

  const pilihJob = (job) => {
    setSelJob(job); setQty(''); setNote(''); setSukses(null);
  };

  const submit = async () => {
    if (!selJob) return;
    const q = parseFloat(qty);
    if (!(q > 0)) return;
    setSubmitting(true);
    const res = await callApi('PRODUCTION_SCAN_OUTPUT', { token, jobId: selJob.id, qty: q, note, operatorNama: operator });
    setSubmitting(false);
    if (res.status !== 'success') { alert(res.message); return; }
    localStorage.setItem('prod_operator_nama', operator.trim());
    setSukses({ msg: res.message, job: selJob });
    setSelJob(null); setQty(''); setNote('');
    load();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-aira-navy dark:bg-aira-cyan flex items-center justify-center text-white dark:text-gray-900 shrink-0">
            <Factory size={19} />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-aira-navy dark:text-white leading-tight">Update Progress Produksi</h1>
            <p className="text-xs text-gray-400">Mulia Everything · halaman lapangan tanpa login</p>
          </div>
        </div>

        {loading && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-10 text-center text-gray-400">
            <Loader2 className="animate-spin inline mb-2" size={22} /><p className="text-sm">Memuat data produksi…</p>
          </div>
        )}

        {error && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-rose-100 dark:border-rose-900/40 p-8 text-center">
            <AlertTriangle size={26} className="text-rose-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">Tidak bisa membuka halaman</p>
            <p className="text-xs text-gray-400">{error}</p>
          </div>
        )}

        {sukses && !loading && !error && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40 rounded-2xl p-4 flex items-start gap-3">
            <CheckCircle2 size={20} className="text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{sukses.msg}</p>
              <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">{sukses.job.articleCode} · {fmtNum(qty || sukses.job.qtyDone)} pcs dicatat atas nama {operator.trim() || '—'}</p>
            </div>
          </div>
        )}

        {data && !loading && !error && (<>
          {/* Detail SO */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-900/30 text-[#0084C9] dark:text-sky-400 text-[11px] font-semibold">{data.so.active_version ? `BOQ V.${data.so.active_version} aktif` : '—'}</span>
              <button onClick={load} className="text-[11px] font-semibold text-gray-400 hover:text-gray-700 dark:hover:text-white flex items-center gap-1">
                <RefreshCw size={11} /> Muat ulang
              </button>
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{data.so.customer || 'Customer'}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{data.so.project_name || 'Project'}</p>
            <div className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
              <p className="flex items-center gap-2"><Hash size={13} className="text-gray-400 shrink-0" /> Nomor SO: <b className="text-gray-800 dark:text-gray-100 font-mono">{data.so.id}</b></p>
              {data.so.project_number && <p className="flex items-center gap-2"><Briefcase size={13} className="text-gray-400 shrink-0" /> Nomor Project: <b className="text-gray-800 dark:text-gray-100">{data.so.project_number}</b></p>}
              <p className="flex items-center gap-2"><User size={13} className="text-gray-400 shrink-0" /> Perusahaan: <b className="text-gray-800 dark:text-gray-100">{data.so.company || '-'}</b></p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-500 dark:text-gray-400 font-medium">Progress keseluruhan</span>
                <span className="font-bold text-aira-navy dark:text-aira-cyan">{data.progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#0084C9] to-[#0EA5A5]" style={{ width: `${data.progress}%` }} />
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400 px-1 flex items-center gap-1.5"><ClipboardList size={12} /> Pilih job di bawah untuk mengupdate progress. Kelima mesin produksi ditampilkan sesuai tahap masing-masing.</p>

          {/* Job per mesin */}
          {MACHINES.map((m) => {
            const jobs = (data.jobs || []).filter((j) => j.machine === m.key);
            const Icon = machineIcon[m.icon];
            return (
              <div key={m.key} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-aira-navy/10 dark:bg-aira-cyan/20 flex items-center justify-center text-aira-navy dark:text-aira-cyan shrink-0">
                    <Icon size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{m.name}</p>
                    <p className="text-[11px] text-gray-400">{jobs.filter((j) => j.status === 'running').length} berjalan · {jobs.length} job</p>
                  </div>
                </div>
                {jobs.length === 0 && <p className="text-xs text-gray-400 py-2">Tidak ada job di mesin ini.</p>}
                <div className="space-y-2">
                  {jobs.map((j) => {
                    const pct = jobPct(j);
                    return (
                      <button key={j.id} onClick={() => j.status !== 'done' && pilihJob(j)} disabled={j.status === 'done'}
                        className={`w-full text-left rounded-xl p-3 border transition-colors ${
                          selJob?.id === j.id ? 'border-[#0084C9] bg-sky-50/60 dark:bg-sky-900/20'
                          : j.status === 'done' ? 'border-gray-100 dark:border-gray-700 opacity-60 cursor-default'
                          : 'border-gray-100 dark:border-gray-700 hover:border-[#0084C9]/40'}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs font-bold text-gray-800 dark:text-gray-100">{j.articleCode} <span className="font-normal text-gray-400">· {j.dim1 ?? '-'} · {j.colour ?? '-'}</span></p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${jobStatusStyle[j.status]}`}>{jobStatusLabel[j.status]}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-[#0084C9] to-[#0EA5A5]" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">{fmtNum(j.qtyDone)}/{fmtNum(j.qtyTarget)} pcs</span>
                        </div>
                        {j.status !== 'done' && <p className="text-[11px] font-semibold text-[#0084C9] dark:text-sky-400 mt-1.5 flex items-center gap-1"><Plus size={11} /> Update progress</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Form update (muncul saat job dipilih) */}
          {selJob && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelJob(null)} />
              <div className="relative bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xl w-full max-w-sm p-5">
                <h3 className="font-bold text-gray-900 dark:text-white mb-1">Update Progress</h3>
                <p className="text-xs text-gray-400 mb-4">{selJob.articleCode} · {MACHINES.find((m) => m.key === selJob.machine).name}</p>
                <div className="bg-gray-50 dark:bg-gray-900/40 rounded-xl p-3 text-xs text-gray-500 dark:text-gray-400 mb-4 flex justify-between">
                  <span>Sudah: <b className="text-gray-800 dark:text-gray-100">{fmtNum(selJob.qtyDone)}</b> / {fmtNum(selJob.qtyTarget)} pcs</span>
                  <span>Sisa: {fmtNum(Math.max(0, selJob.qtyTarget - selJob.qtyDone))}</span>
                </div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Nama operator</label>
                <input value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="Nama Anda"
                  className="w-full mt-1 mb-3 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 rounded-xl px-3 py-2.5 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#0084C9]/30" />
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Qty output baru (pcs)</label>
                <input type="number" min="1" inputMode="numeric" autoFocus value={qty} onChange={(e) => setQty(e.target.value)}
                  className="w-full mt-1 mb-3 text-base font-semibold border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 rounded-xl px-3 py-2.5 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#0084C9]/30" />
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Catatan (opsional)</label>
                <input value={note} onChange={(e) => setNote(e.target.value)}
                  className="w-full mt-1 mb-4 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 rounded-xl px-3 py-2.5 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#0084C9]/30" />
                <div className="flex gap-2">
                  <button onClick={() => setSelJob(null)} className="flex-1 px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-600 dark:text-gray-300">Batal</button>
                  <button onClick={submit} disabled={submitting || !(parseFloat(qty) > 0) || !operator.trim()}
                    className="flex-[2] px-3 py-3 rounded-xl bg-gradient-to-r from-[#0084C9] to-[#0EA5A5] text-white text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5">
                    {submitting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Simpan Output
                  </button>
                </div>
              </div>
            </div>
          )}

          <p className="text-[11px] text-gray-400 text-center pb-4">
            QR berlaku s.d. {new Date(data.expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} ·
            data tersimpan otomatis ke sistem produksi
          </p>
        </>)}
      </div>
    </div>
  );
}
