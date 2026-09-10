// Detail Production per SO (halaman "Atur Produksi"): job nyata per mesin dari backend,
// tombol Update Progress bagi admin, kartu Buffer Stock, generate QR untuk admin produksi
// lapangan, dan Catatan Produksi (kanal chat SO "#produksi" — terbawa dari modul SO).
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import {
  ArrowLeft, LayoutDashboard, Activity, ClipboardList, Factory, ScanLine, Layers, Flame, Paintbrush,
  ExternalLink, Loader2, Search, MessageSquareText, Send, QrCode, Boxes, Plus, X, Copy, Ban, CheckCircle2,
} from 'lucide-react';
import { callApi } from '../../services/api';
import {
  MACHINES, STAGES, MACHINE_LABEL, isStockMaterial, jobPct, jobsPct, jobStatusLabel, jobStatusStyle,
} from './productionData';

const fmtNum = (n) => new Intl.NumberFormat('id-ID').format(n || 0);
const machineIcon = { factory: Factory, 'scan-line': ScanLine, layers: Layers, flame: Flame, paintbrush: Paintbrush };

const inputCls = 'text-xs font-medium border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 rounded-lg px-3 py-2 text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0084C9]/30';

const DURATIONS = [
  { key: '1d', label: '1 hari' },
  { key: '7d', label: '7 hari' },
  { key: '30d', label: '30 hari' },
  { key: 'production', label: 'Selama produksi' },
];

export default function DetailProduction() {
  const { soId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [so, setSo] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [buffer, setBuffer] = useState([]);
  const [qrTokens, setQrTokens] = useState([]);
  const [frames, setFrames] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [filterMachine, setFilterMachine] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  // Modal update progress & generate QR
  const [outputModal, setOutputModal] = useState(null); // { job, qty, note }
  const [qrModal, setQrModal] = useState(false);
  const [qrDuration, setQrDuration] = useState('production');
  const [qrLoading, setQrLoading] = useState(false);

  // ==== Catatan Produksi (kanal #produksi) ====
  const [notes, setNotes] = useState([]);
  const [draft, setDraft] = useState('');
  const [directory, setDirectory] = useState([]);
  const notesEndRef = useRef(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const load = () => {
    callApi('PRODUCTION_JOBS', { soId }).then((res) => {
      if (res.status !== 'success') { alert(res.message); navigate('/production'); return; }
      const d = res.data;
      setSo(d.so); setJobs(d.jobs || []); setBuffer(d.buffer || []); setQrTokens(d.qrTokens || []);
    });
  };

  useEffect(() => {
    setLoading(true);
    load();
    callApi('SO_DETAIL', { soId }).then((res) => {
      if (res.status === 'success') {
        const d = res.data;
        setFrames(d.frames || []);
        setStocks((d.materials || []).filter((m) => m.currency === 'IDR' && !/^MPF(\s|$)/i.test(String(m.articleCode || ''))).filter((m) => !/^(MPU|MPD|MPB)\s/i.test(String(m.articleCode || ''))));
      }
      setLoading(false);
    });
    callApi('GET_USER_DIRECTORY').then((res) => {
      if (res.status === 'success') setDirectory(res.data || []);
    });
  }, [soId, navigate]); // eslint-disable-line

  const loadNotes = () => {
    callApi('GET_SO_CHAT', { soId: `${soId}#produksi` }).then((res) => {
      if (res.status === 'success') setNotes(res.data || []);
    });
  };
  useEffect(() => { loadNotes(); }, [soId]); // eslint-disable-line
  useEffect(() => { notesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [notes]);

  const sendNote = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const res = await callApi('SEND_SO_CHAT', { soId: `${soId}#produksi`, content: text });
    if (res.status !== 'success') { alert(res.message); return; }
    loadNotes();
  };

  // ==== Progres nyata per mesin ====
  const jobsByMachine = useMemo(() => {
    const out = {};
    MACHINES.forEach((m) => { out[m.key] = jobs.filter((j) => j.machine === m.key); });
    return out;
  }, [jobs]);

  const stagePct = useMemo(() => {
    const out = {};
    STAGES.forEach((s) => { out[s.key] = jobsPct(jobsByMachine[s.key]); });
    return out;
  }, [jobsByMachine]);

  const overall = useMemo(() => jobsPct(jobs), [jobs]);

  // Buffer stock diagregasi per article|dim|colour (siap dialokasikan kelak)
  const bufferAgg = useMemo(() => {
    const map = new Map();
    buffer.forEach((j) => {
      const key = `${j.articleCode}|${j.dim1 ?? ''}|${j.colour ?? ''}`;
      if (!map.has(key)) map.set(key, { articleCode: j.articleCode, dim1: j.dim1, colour: j.colour, qty: 0 });
      map.get(key).qty += j.qtyDone;
    });
    return [...map.values()];
  }, [buffer]);

  const filteredMats = jobs.filter((j) => {
    const q = search.toLowerCase().trim();
    if (q && !String(j.articleCode).toLowerCase().includes(q)) return false;
    if (filterMachine && j.machine !== filterMachine) return false;
    if (filterStatus && j.status !== filterStatus) return false;
    return true;
  });

  const sectionRefs = {
    upright: useRef(null), bracing: useRef(null), beam: useRef(null), welding: useRef(null), painting: useRef(null),
  };

  // ==== Aksi ====
  const submitOutput = async () => {
    const { job } = outputModal;
    const qty = parseFloat(outputModal.qty);
    if (!(qty > 0)) return;
    const res = await callApi('PRODUCTION_OUTPUT', { jobId: job.id, qty, note: outputModal.note || '' });
    if (res.status !== 'success') { alert(res.message); return; }
    setOutputModal(null);
    showToast(res.message);
    load();
  };

  const createQr = async () => {
    setQrLoading(true);
    const res = await callApi('PRODUCTION_QR_CREATE', { soId, duration: qrDuration });
    setQrLoading(false);
    if (res.status !== 'success') { alert(res.message); return; }
    setQrTokens((p) => [res.data, ...p]);
  };

  const revokeQr = async (id) => {
    if (!confirm('Cabut QR ini? Halaman lapangan yang memakai link ini akan tertutup.')) return;
    const res = await callApi('PRODUCTION_QR_REVOKE', { id });
    if (res.status !== 'success') { alert(res.message); return; }
    setQrTokens((p) => p.filter((t) => t.id !== id));
  };

  if (loading) {
    return <div className="h-[50vh] flex flex-col items-center justify-center text-gray-400 gap-3"><Loader2 className="animate-spin" size={28} /><p className="text-sm">Memuat data produksi {soId}…</p></div>;
  }

  const MachineSection = ({ mkey }) => {
    const meta = MACHINES.find((m) => m.key === mkey);
    const Icon = machineIcon[meta.icon];
    const items = jobsByMachine[mkey];
    return (
      <section ref={sectionRefs[mkey]} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 scroll-mt-24">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-aira-navy/10 dark:bg-aira-cyan/20 flex items-center justify-center text-aira-navy dark:text-aira-cyan">
              <Icon size={19} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{meta.name}</p>
              <p className="text-xs text-gray-400">{items.filter((j) => j.status === 'running').length} job berjalan · {items.length} total job</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-gray-400">{items.length} job</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {items.length === 0 && <p className="text-xs text-gray-400 py-4">Tidak ada job di mesin ini.</p>}
          {items.map((j) => {
            const pct = jobPct(j);
            return (
              <div key={j.id} className="bg-gray-50 dark:bg-gray-900/40 rounded-xl p-3 flex flex-col gap-2 min-w-[210px] flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-800 dark:text-gray-100">{j.articleCode}</p>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${jobStatusStyle[j.status]}`}>{jobStatusLabel[j.status]}</span>
                </div>
                <p className="text-[11px] text-gray-400">{j.dim1 ?? '-'} · {j.colour ?? '-'} · {fmtNum(j.qtyDone)}/{fmtNum(j.qtyTarget)} pcs</p>
                <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#0084C9] to-[#0EA5A5]" style={{ width: `${pct}%` }} />
                </div>
                <button onClick={() => setOutputModal({ job: j, qty: '', note: '' })}
                  disabled={j.status === 'done'}
                  className={`mt-1 text-[11px] font-semibold px-2 py-1.5 rounded-lg flex items-center justify-center gap-1 ${
                    j.status === 'done'
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-aira-navy dark:bg-aira-cyan text-white dark:text-gray-900 hover:opacity-90'}`}>
                  <Plus size={11} /> {j.status === 'done' ? 'Selesai' : 'Update Progress'}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-4 mb-1">
          <span>Progress kumulatif mesin</span><span>{stagePct[mkey]}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-[#0084C9] to-[#0EA5A5]" style={{ width: `${stagePct[mkey]}%` }} />
        </div>
      </section>
    );
  };

  const renderNoteText = (text) => String(text || '').split(/(\s+)/).map((w, i) =>
    /^@[a-zA-Z0-9._]+$/.test(w)
      ? <span key={i} className="text-[#0084C9] dark:text-sky-400 font-semibold">{w}</span>
      : <span key={i}>{w}</span>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/production')} className="w-9 h-9 rounded-xl flex items-center justify-center border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0">
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-aira-navy dark:text-white truncate">Production · {soId}</h1>
              <span className="px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-900/30 text-[#0084C9] dark:text-sky-400 text-[11px] font-semibold whitespace-nowrap">
                {overall >= 100 ? 'Selesai' : 'In Production'}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{so?.project_name || '-'} · {so?.customer || '-'}</p>
          </div>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button onClick={() => setQrModal(true)}
            className="px-3.5 py-2 rounded-xl bg-[#0EA5A5] hover:bg-[#0b8787] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors">
            <QrCode size={13} /> Generate QR Lapangan
          </button>
          <button onClick={() => navigate(`/so/detail/${soId}`)}
            className="px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1.5">
            <ExternalLink size={13} /> Buka Detail SO
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gray-900 dark:bg-black text-white text-sm rounded-xl px-4 py-3 shadow-lg">
          <CheckCircle2 size={15} className="text-teal-400" /> {toast}
        </div>
      )}

      {/* Nav pill (Detail Production aktif) */}
      <div className="sticky top-0 z-10 -mx-4 lg:-mx-8 px-4 lg:px-8 py-1.5">
        <div className="flex justify-center">
          <div className="inline-flex gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full p-1.5 shadow-sm max-w-full">
            {[
              { key: 'dashboard', label: 'Dashboard', short: 'Dash', icon: LayoutDashboard, go: () => navigate('/production') },
              { key: 'ongoing', label: 'On Going Production', short: 'Ongoing', icon: Activity, go: () => navigate('/production') },
              { key: 'detail', label: 'Detail Production', short: 'Detail', icon: ClipboardList, go: () => {} },
            ].map((t) => (
              <button key={t.key} onClick={t.go}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 rounded-full text-[13px] sm:text-sm font-semibold transition-colors ${
                  t.key === 'detail' ? 'bg-aira-navy dark:bg-aira-cyan text-white dark:text-gray-900 shadow-md' : 'text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-white'}`}>
                <t.icon size={14} className="flex-shrink-0" />
                <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline whitespace-nowrap">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ===== KONTEN KIRI ===== */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Ringkasan progress */}
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="font-bold text-gray-900 dark:text-white">Ringkasan Progress</h2>
              <span className="text-xs text-gray-400">Klik tahap untuk lompat ke bagian mesin</span>
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">Progress keseluruhan</span>
              <span className="text-2xl font-bold text-aira-navy dark:text-aira-cyan">{overall}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden mb-6">
              <div className="h-full rounded-full bg-gradient-to-r from-[#0084C9] to-[#0EA5A5]" style={{ width: `${overall}%` }} />
            </div>
            <div className="flex items-center justify-between">
              {STAGES.map((s, i) => {
                const pct = stagePct[s.key];
                return (
                  <React.Fragment key={s.key}>
                    <div className="flex flex-col items-center">
                      <button onClick={() => sectionRefs[s.key].current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold transition-transform hover:scale-110 ${
                          pct >= 100 ? 'bg-teal-500 text-white' : pct > 0 ? 'bg-sky-100 dark:bg-sky-900/40 text-[#0084C9] dark:text-sky-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                        {pct >= 100 ? '✓' : i + 1}
                      </button>
                      <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300 mt-1.5 text-center">{s.label}</span>
                      <span className="text-[11px] text-gray-400">{pct}%</span>
                    </div>
                    {i < STAGES.length - 1 && <div className={`h-0.5 flex-1 mx-1 -mt-6 ${pct >= 100 ? 'bg-teal-400' : 'bg-gray-200 dark:bg-gray-700'}`} />}
                  </React.Fragment>
                );
              })}
            </div>
          </section>

          {/* Job per mesin */}
          {MACHINES.map((m) => <MachineSection key={m.key} mkey={m.key} />)}

          {/* Pemetaan material (tabel ringkas dari job) */}
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <h2 className="font-bold text-gray-900 dark:text-white mb-3">Pemetaan Material ke Mesin</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              <select value={filterMachine} onChange={(e) => setFilterMachine(e.target.value)} className={inputCls}>
                <option value="">Semua Mesin</option>
                {MACHINES.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={inputCls}>
                <option value="">Semua Status</option>
                {['queued', 'running', 'paused', 'done'].map((s) => <option key={s} value={s}>{jobStatusLabel[s]}</option>)}
              </select>
              <div className="relative flex-1 min-w-[180px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari article code..." className={`${inputCls} w-full pl-8`} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400 uppercase">
                  <tr>
                    {['Article Code', 'Dim', 'Colour', 'Mesin', 'Qty Selesai', 'Qty Target', 'Progress', 'Status'].map((h, i) => (
                      <th key={h} className={`font-semibold px-3 py-2.5 ${i === 4 || i === 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredMats.length === 0 && <tr><td colSpan="8" className="text-center text-gray-400 py-6">Tidak ada job yang cocok. Job dibuat otomatis dari material produksi MPU/MPD/MPB lokal versi BOQ aktif.</td></tr>}
                  {filteredMats.map((j) => {
                    const machine = MACHINES.find((x) => x.key === j.machine);
                    return (
                      <tr key={j.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-3 py-2.5 font-bold text-gray-800 dark:text-gray-100 whitespace-nowrap">{j.articleCode}</td>
                        <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">{j.dim1 ?? '-'}</td>
                        <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">{j.colour ?? '-'}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-aira-navy/10 text-aira-navy dark:bg-aira-cyan/20 dark:text-aira-cyan">{machine.short}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">{fmtNum(Math.min(j.qtyDone, j.qtyTarget))}</td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">{fmtNum(j.qtyTarget)}</td>
                        <td className="px-3 py-2.5 w-32">
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-[#0084C9] to-[#0EA5A5]" style={{ width: `${jobPct(j)}%` }} />
                            </div>
                            <span className="text-[10px] text-gray-400 w-8">{jobPct(j)}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${jobStatusStyle[j.status]}`}>{jobStatusLabel[j.status]}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Buffer stock, frame & stock */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
              <div className="rounded-xl border border-sky-100 dark:border-sky-900/40 bg-sky-50/40 dark:bg-sky-900/10 p-3.5">
                <p className="text-xs font-bold text-[#0084C9] dark:text-sky-400 mb-2 flex items-center gap-1.5"><Boxes size={12} /> Buffer Stock (hasil produksi tersisa)</p>
                <div className="space-y-2">
                  {bufferAgg.length === 0 && <p className="text-xs text-gray-400">Belum ada buffer. Terasa otomatis ketika BOQ berubah dan hasil produksi tak lagi terpakai.</p>}
                  {bufferAgg.map((b, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 text-xs">
                      <div>
                        <p className="font-semibold text-gray-700 dark:text-gray-200">{b.articleCode} · {fmtNum(b.qty)} pcs</p>
                        <p className="text-gray-400">{b.dim1 ? `Dim ${b.dim1}` : ''}{b.colour ? ` · ${b.colour}` : ''}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/40 text-[#0084C9] dark:text-sky-400 text-[10px] font-semibold shrink-0">Buffer</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-gray-100 dark:border-gray-700 p-3.5">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">Informasi Frame (MPF) — assembly, bukan material</p>
                <div className="space-y-2">
                  {frames.length === 0 && <p className="text-xs text-gray-400">Tidak ada data frame.</p>}
                  {frames.map((f, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 text-xs">
                      <div>
                        <p className="font-semibold text-gray-700 dark:text-gray-200">{f.articleCode} · {fmtNum(f.qty)} unit</p>
                        <p className="text-gray-400">{f.dim1 ? `Dim ${f.dim1}` : ''}{f.dim2 ? ` × ${f.dim2}` : ''}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 text-[10px] font-semibold shrink-0">Assembly info</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-gray-100 dark:border-gray-700 p-3.5">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">Material Pendukung / Stock (tidak diproduksi)</p>
                <div className="space-y-2">
                  {stocks.length === 0 && <p className="text-xs text-gray-400">Tidak ada.</p>}
                  {stocks.map((s, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 text-xs">
                      <div>
                        <p className="font-semibold text-gray-700 dark:text-gray-200">{s.articleCode}</p>
                        <p className="text-gray-400">{fmtNum(s.qty)} pcs · {isStockMaterial(s) ? 'dibeli langsung (safety pin)' : 'komponen pendukung / fastener'}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 text-[10px] font-semibold shrink-0">Beli/Stock</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ===== SIDEBAR: CATATAN PRODUKSI ===== */}
        <aside className="w-full lg:w-[360px] shrink-0 lg:sticky lg:top-24">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-[640px]">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-aira-navy/10 dark:bg-aira-cyan/20 flex items-center justify-center text-aira-navy dark:text-aira-cyan">
                  <MessageSquareText size={15} />
                </div>
                <h2 className="font-bold text-gray-900 dark:text-white text-sm">Catatan Produksi</h2>
              </div>
              <span className="text-[11px] text-gray-400">{notes.length} catatan</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {notes.length === 0 && <p className="text-center text-xs text-gray-400 py-8">Belum ada catatan produksi. Catatan dari modul SO kanal produksi akan tampil di sini.</p>}
              {notes.map((n) => (
                <div key={n.id} className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0F3B6C] to-[#0084C9] flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                    {(n.user_nama || 'U').trim().split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{n.user_nama || 'Pengguna'}</span>
                      {n.user_username && <span className="text-[11px] text-gray-400">@{n.user_username}</span>}
                      <span className="text-[11px] text-gray-300 dark:text-gray-500">· {new Date(n.date).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5 leading-snug break-words">{renderNoteText(n.content)}</p>
                  </div>
                </div>
              ))}
              <div ref={notesEndRef} />
            </div>

            <div className="p-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-end gap-2">
                <input value={draft} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendNote(); } }}
                  placeholder="Ketik catatan... tag dengan @"
                  className="flex-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0084C9]/30" />
                <button onClick={sendNote} className="w-9 h-9 rounded-xl bg-aira-navy dark:bg-aira-cyan hover:opacity-90 flex items-center justify-center text-white dark:text-gray-900 shrink-0">
                  <Send size={15} />
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">Kanal: {soId}#produksi — terbawa dari modul SO. {directory.length} user dapat di-tag.</p>
            </div>
          </div>
        </aside>
      </div>

      {/* ===== MODAL UPDATE PROGRESS ===== */}
      {outputModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOutputModal(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xl w-full max-w-sm p-5">
            <button onClick={() => setOutputModal(null)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 dark:hover:text-white"><X size={16} /></button>
            <h3 className="font-bold text-gray-900 dark:text-white mb-1">Update Progress</h3>
            <p className="text-xs text-gray-400 mb-4">{outputModal.job.articleCode} · {MACHINE_LABEL[outputModal.job.machine]} · {outputModal.job.dim1 ?? '-'}</p>
            <div className="bg-gray-50 dark:bg-gray-900/40 rounded-xl p-3 text-xs text-gray-500 dark:text-gray-400 mb-4 flex justify-between">
              <span>Sudah: <b className="text-gray-800 dark:text-gray-100">{fmtNum(outputModal.job.qtyDone)}</b> / {fmtNum(outputModal.job.qtyTarget)} pcs</span>
              <span>Sisa: {fmtNum(Math.max(0, outputModal.job.qtyTarget - outputModal.job.qtyDone))}</span>
            </div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Qty output baru (pcs)</label>
            <input type="number" min="1" autoFocus value={outputModal.qty}
              onChange={(e) => setOutputModal((p) => ({ ...p, qty: e.target.value }))}
              className="w-full mt-1 mb-3 text-sm font-semibold border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 rounded-xl px-3 py-2.5 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#0084C9]/30" />
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Catatan (opsional)</label>
            <input value={outputModal.note}
              onChange={(e) => setOutputModal((p) => ({ ...p, note: e.target.value }))}
              className="w-full mt-1 mb-4 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 rounded-xl px-3 py-2.5 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#0084C9]/30" />
            <div className="flex gap-2">
              <button onClick={() => setOutputModal(null)} className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Batal</button>
              <button onClick={submitOutput} className="flex-1 px-3 py-2.5 rounded-xl bg-gradient-to-r from-[#0084C9] to-[#0EA5A5] text-white text-xs font-semibold hover:opacity-90">Simpan Output</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL GENERATE QR ===== */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setQrModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setQrModal(false)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 dark:hover:text-white"><X size={16} /></button>
            <h3 className="font-bold text-gray-900 dark:text-white mb-1">QR untuk Admin Produksi Lapangan</h3>
            <p className="text-xs text-gray-400 mb-4">Admin lapangan cukup scan QR ini untuk membuka form update progress — tanpa login. Pilih masa berlaku lalu generate.</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {DURATIONS.map((d) => (
                <button key={d.key} onClick={() => setQrDuration(d.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${qrDuration === d.key ? 'bg-gradient-to-r from-[#0084C9] to-[#0EA5A5] text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white border border-gray-200 dark:border-gray-600'}`}>
                  {d.label}
                </button>
              ))}
            </div>
            <button onClick={createQr} disabled={qrLoading}
              className="w-full mb-4 px-3 py-2.5 rounded-xl bg-[#0EA5A5] hover:bg-[#0b8787] text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60">
              {qrLoading ? <Loader2 size={13} className="animate-spin" /> : <QrCode size={13} />} Generate QR ({DURATIONS.find((d) => d.key === qrDuration).label})
            </button>

            {qrTokens.map((t) => (
              <div key={t.id} className="border border-gray-100 dark:border-gray-700 rounded-xl p-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-gray-400">Berlaku s.d. {new Date(t.expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <button onClick={() => revokeQr(t.id)} className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 flex items-center gap-1"><Ban size={11} /> Cabut</button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-white p-2 rounded-lg border border-gray-100 shrink-0">
                    <QRCodeCanvas value={t.url} size={96} includeMargin={false} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1 truncate">{t.url}</p>
                    <button onClick={() => { navigator.clipboard?.writeText(t.url); showToast('Link QR dikopi ke clipboard'); }}
                      className="text-[11px] font-semibold text-aira-navy dark:text-aira-cyan hover:underline flex items-center gap-1">
                      <Copy size={11} /> Kopi link
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {qrTokens.length === 0 && <p className="text-xs text-gray-400 text-center py-2">Belum ada QR aktif untuk SO ini.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
