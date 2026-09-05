// Upload BOQ versi baru: pilih file → parsing server → preview diff → kirim untuk approval.
// Adaptasi dari mockup mulia-boq-preview.html dengan palet Mulia Everything.
import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, UploadCloud, Loader2, CheckCircle2, AlertTriangle, Info, Trash2,
  TrendingUp, TrendingDown, Minus, Send, ShieldCheck,
} from 'lucide-react';
import { callApi } from '../../services/api';

const fmtIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
const fmtNum = (n, d = 0) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n || 0);
const fmtRMB = (n) => '¥' + fmtNum(n, 2);
const fmtKg = (n) => fmtNum(n, 1) + ' kg';

const SHEETS = ['BOQ-Standard Items', 'BOQ-Non Standard Items', 'BOQ-Standard Frame Protector'];

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsDataURL(file);
});

const StatusChip = ({ status }) =>
  status === 'new' ? <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold">Baru</span>
  : status === 'deleted' ? <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-[11px] font-semibold">Dihapus</span>
  : <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[11px] font-semibold">Berubah</span>;

const DiffVal = ({ oldV, newV, fmt }) => {
  if (oldV === undefined || oldV === null) return <span className="font-medium">{fmt(newV)}</span>;
  if (newV === undefined || newV === null) return <span className="line-through text-gray-400">{fmt(oldV)}</span>;
  if (String(oldV) === String(newV)) return <span>{fmt(newV)}</span>;
  return <><span className="line-through text-gray-400 text-xs mr-1">{fmt(oldV)}</span><span className="font-semibold">{fmt(newV)}</span></>;
};

export default function UploadVersion() {
  const { id } = useParams();
  const navigate = useNavigate();
  const inputRef = useRef(null);

  // page: 1 pilih file | 2 parsing | 3 preview | 4 terkirim
  const [page, setPage] = useState(1);
  const [so, setSo] = useState(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState(null);
  const [request, setRequest] = useState(null); // { request, so, draftMaterials, draftFrames }
  const [tab, setTab] = useState('material');
  const [search, setSearch] = useState('');
  const [kategori, setKategori] = useState('all');
  const [tampil, setTampil] = useState('semua');
  const [checked, setChecked] = useState(false);
  const [sending, setSending] = useState(false);
  const [discardModal, setDiscardModal] = useState(false);
  const [stepDone, setStepDone] = useState(0);

  useEffect(() => {
    callApi('SO_DETAIL', { soId: id }).then((res) => {
      if (res.status !== 'success') { alert(res.message); navigate('/so'); return; }
      setSo(res.data.so);
    });
  }, [id, navigate]);

  const handleFile = async (file) => {
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) { setError('Format tidak didukai. Unggah file .xlsx atau .xls.'); return; }
    setError(null);
    setFileName(file.name);
    setPage(2);
    setStepDone(0);
    // animasi checklist
    const steps = 6;
    let i = 0;
    const iv = setInterval(() => { i += 1; setStepDone(i); if (i >= steps) clearInterval(iv); }, 350);

    const base64 = await fileToBase64(file);
    const res = await callApi('SO_UPLOAD_VERSION', { soId: id, base64Data: base64, fileName: file.name });
    if (res.status !== 'success') {
      clearInterval(iv);
      setError(res.message);
      setPage(1);
      return;
    }
    // tunggu animasi minimal lalu ambil detail untuk preview
    setTimeout(async () => {
      const det = await callApi('SO_CHANGE_DETAIL', { id: res.data.requestId });
      if (det.status !== 'success') { setError(det.message); setPage(1); return; }
      setRequest(det.data);
      setPage(3);
    }, Math.max(0, 2300 - Date.now() % 1000));
  };

  const submitForApproval = async () => {
    setSending(true);
    const res = await callApi('SO_CHANGE_SUBMIT', { id: request.request.id });
    setSending(false);
    if (res.status !== 'success') { alert(res.message); return; }
    setPage(4);
  };

  const discard = async () => {
    const res = await callApi('SO_CHANGE_DISCARD', { id: request.request.id });
    if (res.status !== 'success') { alert(res.message); return; }
    setRequest(null); setChecked(false); setDiscardModal(false); setPage(1);
    // refresh status lock
    callApi('SO_DETAIL', { soId: id }).then((r) => r.status === 'success' && setSo(r.data.so));
  };

  const activeVersion = so?.active_version ?? 'V.1';

  // ============ RENDER ============
  if (page === 1) {
    return (
      <div className="w-full">
        <HeaderBack title="Upload BOQ Versi Baru" so={so} id={id} badge={`V.${activeVersion} aktif`} />
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10 px-4 py-3">
          <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300">Data aktif tidak akan berubah sampai perubahan ini disetujui oleh Developer. Hanya daftar material yang akan ditimpa — data form project (timeline, alamat, dll.) tidak terpengaruh.</p>
        </div>

        {so?.has_pending_change ? (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-100/70 dark:bg-gray-800/40 px-4 py-4 flex items-center justify-between gap-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">SO ini sedang menunggu approval perubahan lain.</p>
            <button disabled className="px-3 py-1.5 rounded-lg bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm cursor-not-allowed">Upload</button>
          </div>
        ) : (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
            className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800/60 shadow-sm hover:border-[#0084C9] cursor-pointer px-6 py-14 flex flex-col items-center text-center transition"
          >
            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
            <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-gray-700 flex items-center justify-center mb-4">
              <UploadCloud size={28} className="text-[#0F3B6C] dark:text-[#0084C9]" />
            </div>
            <p className="font-semibold text-gray-700 dark:text-gray-200">Tarik file Excel BOQ ke sini, atau klik untuk memilih</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Hanya sheet berawalan "BOQ-" dan "CONSOLIDATED" yang dibaca</p>
            <span className="mt-5 px-4 py-2 rounded-xl bg-[#0F3B6C] dark:bg-[#0084C9] text-white text-sm font-semibold">Pilih File Excel</span>
          </div>
        )}
      </div>
    );
  }

  if (page === 2) {
    const steps = ['Baca sheet BOQ-Standard Items', 'Baca sheet BOQ-Non Standard Items', 'Baca sheet BOQ-Standard Frame Protector', 'Baca sheet CONSOLIDATED (total pallet)', 'Ambil kurs RMB → IDR hari ini', 'Hitung perbedaan vs versi aktif'];
    return (
      <div className="w-full max-w-4xl mx-auto mt-10">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 shadow-sm px-6 py-8">
          <div className="flex flex-col items-center text-center mb-6">
            <Loader2 size={44} className="animate-spin text-[#0084C9] mb-4" />
            <p className="font-semibold text-gray-800 dark:text-white">Membaca sheet BOQ &amp; CONSOLIDATED...</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{fileName}</p>
          </div>
          <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden mb-6">
            <div className="h-full bg-[#0084C9] transition-all duration-500" style={{ width: `${(stepDone / steps.length) * 100}%` }} />
          </div>
          <ul className="space-y-2.5">
            {steps.map((s, i) => (
              <li key={s} className={`flex items-center gap-2.5 text-sm ${i < stepDone ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
                {i < stepDone ? <CheckCircle2 size={16} className="text-[#0EA5A5] shrink-0" /> : <span className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600 shrink-0" />}
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (page === 4) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center mb-5">
            <CheckCircle2 size={36} className="text-[#0EA5A5]" />
          </div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Perubahan dikirim, menunggu approval Developer</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Data aktif {id} tetap menggunakan V.{activeVersion} sampai perubahan disetujui. Anda akan diberi tahu lewat notifikasi setelah ada keputusan.</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => navigate(`/so/detail/${id}`)} className="px-4 py-2.5 rounded-xl bg-[#0F3B6C] dark:bg-[#0084C9] text-white text-sm font-semibold hover:bg-[#0a2c52] dark:hover:bg-cyan-600">Kembali ke Detail SO</button>
          </div>
        </div>
      </div>
    );
  }

  // ---- PAGE 3: PREVIEW ----
  const req = request.request;
  const imp = req.impact;
  const diff = req.diff;
  const draftMats = request.draftMaterials || [];

  const diffKey = (m) => `${m.sheet ?? ''}|${m.articleCode}|${m.dim1 ?? ''}|${m.dim2 ?? ''}|${m.colour ?? ''}|${m.currency}`;
  const changedMap = new Map((diff?.materials?.changed || []).map((m) => [diffKey(m), m]));
  const addedSet = new Set((diff?.materials?.added || []).map(diffKey));
  const removedSet = new Set((diff?.materials?.removed || []).map(diffKey));

  const filtered = draftMats.filter((m) => {
    const k = diffKey(m);
    const q = search.toLowerCase().trim();
    if (q && !String(m.articleCode).toLowerCase().includes(q)) return false;
    if (kategori !== 'all' && m.sheet !== kategori) return false;
    const st = addedSet.has(k) ? 'new' : removedSet.has(k) ? 'deleted' : changedMap.has(k) ? 'changed' : 'same';
    if (tampil === 'berubah' && st !== 'changed') return false;
    if (tampil === 'baru' && st !== 'new') return false;
    if (tampil === 'dihapus' && st !== 'deleted') return false;
    if (tampil === 'semua' && st === 'same') return true;
    return true;
  });

  const Delta = ({ before, after, fmt, invert }) => {
    const d = (after ?? 0) - (before ?? 0);
    if (d === 0) return <span className="text-xs text-gray-400 inline-flex items-center gap-1"><Minus size={12} /> tidak berubah</span>;
    const up = d > 0;
    const good = invert ? !up : up;
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${good ? 'text-teal-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'}`}>
        {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {up ? '+' : ''}{fmt(d)}
      </span>
    );
  };

  const SummaryCard = ({ label, before, after, fmt, invert }) => (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 shadow-sm px-4 py-3.5">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">{label}</p>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="text-sm text-gray-400 line-through">{fmt(before)}</span>
        <span className="text-base font-bold text-gray-900 dark:text-white">{fmt(after)}</span>
      </div>
      <div className="mt-1"><Delta before={before} after={after} fmt={fmt} invert={invert} /></div>
    </div>
  );

  const MatTable = ({ type, title }) => {
    const items = filtered.filter((m) => (type === 'import' ? m.currency !== 'IDR' : m.currency === 'IDR'));
    const fmtHarga = type === 'import' ? fmtRMB : fmtIDR;
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 shadow-sm overflow-hidden mb-5">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 font-semibold text-sm text-gray-800 dark:text-white flex items-center justify-between">
          <span>{title}</span><span className="text-xs text-gray-400 font-normal">{items.length} baris</span>
        </div>
        <div className="overflow-x-auto max-h-[420px] custom-scrollbar">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/70 text-left text-xs text-gray-500 dark:text-gray-400">
              <tr>{['Article Code', 'Dim 1', 'Colour', 'QTY', 'Berat Unit', 'Harga Unit', 'Total Berat', 'Total Harga', 'Description'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.length === 0 && <tr><td colSpan="9" className="px-4 py-6 text-center text-gray-400 text-sm">Tidak ada data yang cocok dengan filter.</td></tr>}
              {items.map((m, i) => {
                const k = diffKey(m);
                const st = addedSet.has(k) ? 'new' : removedSet.has(k) ? 'deleted' : 'changed';
                const ch = changedMap.get(k);
                const rowCls = st === 'new' ? 'bg-emerald-50/70 dark:bg-emerald-900/10' : st === 'deleted' ? 'bg-rose-50/60 dark:bg-rose-900/10' : st === 'changed' ? 'bg-amber-50/50 dark:bg-amber-900/10' : '';
                const strike = st === 'deleted' ? 'line-through text-gray-400' : '';
                const getCh = (field) => ch?.changes?.find((c) => c.field === field);
                const qtyC = getCh('qty'), hargaC = getCh('unitPrice');
                return (
                  <tr key={i} className={rowCls}>
                    <td className={`px-3 py-2 font-mono text-xs font-bold text-[#0F3B6C] dark:text-cyan-400 ${strike} whitespace-nowrap`}>
                      <span className="flex items-center gap-1.5">{m.articleCode}{st !== 'same' && <StatusChip status={st} />}</span>
                    </td>
                    <td className={`px-3 py-2 ${strike}`}>{m.dim1 ?? '-'}</td>
                    <td className={`px-3 py-2 ${strike}`}>{m.colour ?? '-'}</td>
                    <td className={`px-3 py-2 ${qtyC ? 'bg-amber-100/50 dark:bg-amber-900/20' : ''} ${strike}`}>
                      <DiffVal oldV={qtyC?.from} newV={m.qty} fmt={fmtNum} />
                    </td>
                    <td className={`px-3 py-2 ${strike}`}>{fmtKg(m.unitWeight)}</td>
                    <td className={`px-3 py-2 ${hargaC ? 'bg-amber-100/50 dark:bg-amber-900/20' : ''} ${strike}`}>
                      <DiffVal oldV={hargaC?.from} newV={m.unitPrice} fmt={fmtHarga} />
                    </td>
                    <td className={`px-3 py-2 ${strike}`}>{fmtKg(m.qty * m.unitWeight)}</td>
                    <td className={`px-3 py-2 font-medium ${strike}`}>{fmtHarga(m.qty * m.unitPrice)}</td>
                    <td className={`px-3 py-2 text-gray-500 dark:text-gray-400 max-w-[200px] truncate ${strike}`} title={m.description ?? ''}>{m.description ?? '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const countChanged = (diff?.materials?.changed || []).length;
  const countNew = (diff?.materials?.added || []).length;
  const countDeleted = (diff?.materials?.removed || []).length;
  const inputCls = 'px-3 py-2 rounded-xl text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0084C9]/30';

  return (
    <div className="pb-28">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-bold text-[#0F3B6C] dark:text-white">Preview Perubahan</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-1">
            <span className="font-mono">{req.file_name || fileName}</span>
            <span className="px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-900/30 text-[#0084C9] dark:text-sky-400 text-xs font-semibold">V.{activeVersion} → V.{req.draft_version_no}</span>
            <span>·</span><span>Diupload hari ini</span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 px-3 py-2 text-xs">
          <span className="text-gray-400">Kurs saat upload </span>
          <span className="font-semibold text-gray-700 dark:text-gray-200">
            1 RMB = {fmtIDR(req.kurs ?? so?.kurs)}
            {req.kurs_date && <span className="text-gray-400 font-normal"> ({new Date(req.kurs_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })})</span>}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => setDiscardModal(true)} className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Buang Draft</button>
      </div>

      {/* IMPACT SUMMARY */}
      {imp && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <SummaryCard label="Total Pallet" before={imp.pallet.before} after={imp.pallet.after} fmt={fmtNum} />
            <SummaryCard label="Total Berat Material" before={imp.berat.before} after={imp.berat.after} fmt={fmtKg} invert />
            <SummaryCard label="Nilai Import" before={imp.importRMB.before} after={imp.importRMB.after} fmt={fmtRMB} invert />
            <SummaryCard label="Nilai Lokal" before={imp.lokalIDR.before} after={imp.lokalIDR.after} fmt={fmtIDR} invert />
          </div>
          <div className="rounded-2xl bg-[#0F3B6C] dark:bg-gray-800 dark:border dark:border-gray-700 text-white px-5 py-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-xs text-white/60 dark:text-gray-400 mb-1">Budget Total (Lokal + Import × Kurs)</p>
              <p className="text-2xl font-extrabold">{fmtIDR(imp.budget.after)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-white/70 dark:text-gray-400 line-through">{fmtIDR(imp.budget.before)}</span>
              <span className="px-2.5 py-1 rounded-full bg-amber-400/90 text-[#0F3B6C] text-xs font-bold inline-flex items-center gap-1">
                {imp.budget.after >= imp.budget.before ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {imp.budget.after >= imp.budget.before ? '+' : ''}{fmtIDR(imp.budget.after - imp.budget.before)}
              </span>
            </div>
          </div>
        </>
      )}

      {/* TABS */}
      <div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-gray-700 pb-1">
        {[['material', 'Material'], ['frame', 'Frame (MPF)'], ['field', 'Field yang Tidak Berubah']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3.5 py-2 text-sm font-semibold rounded-xl transition ${tab === k ? 'bg-[#0F3B6C] text-white dark:bg-[#0084C9]' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'material' && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari article code..." className={`${inputCls} flex-1 min-w-[180px]`} />
            <select value={kategori} onChange={(e) => setKategori(e.target.value)} className={inputCls}>
              <option value="all">Semua Sheet</option>
              {SHEETS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={tampil} onChange={(e) => setTampil(e.target.value)} className={inputCls}>
              <option value="semua">Tampilkan Semua</option>
              <option value="berubah">Berubah saja</option>
              <option value="baru">Baru saja</option>
              <option value="dihapus">Dihapus saja</option>
            </select>
          </div>
          <MatTable type="import" title="Material Import (RMB)" />
          <MatTable type="lokal" title="Material Lokal (IDR)" />
        </>
      )}

      {tab === 'frame' && (
        <div>
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10 px-4 py-3">
            <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">MPF bukan material — komponen penyusunnya sudah terekspansi pada tabel Material.</p>
          </div>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/60 text-left text-xs text-gray-500 dark:text-gray-400">
                <tr>{['Article Code', 'Dim 1', 'Dim 2', 'QTY'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {(request.draftFrames || []).map((f, i) => {
                  const ch = (diff?.frames?.changed || []).find((c) => c.articleCode === f.articleCode && c.dim1 === f.dim1);
                  return (
                    <tr key={i}>
                      <td className="px-3 py-2 font-mono text-xs font-bold text-[#0F3B6C] dark:text-cyan-400">{f.articleCode}{ch && <StatusChip status="changed" />}</td>
                      <td className="px-3 py-2">{f.dim1 ?? '-'}</td>
                      <td className="px-3 py-2">{f.dim2 ?? '-'}</td>
                      <td className="px-3 py-2 bg-amber-100/50 dark:bg-amber-900/20"><DiffVal oldV={ch?.from} newV={f.qty} fmt={fmtNum} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'field' && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 shadow-sm px-5 py-6 flex items-start gap-3">
          <ShieldCheck size={20} className="text-[#0EA5A5] mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm mb-1 text-gray-800 dark:text-white">Data form project tidak berubah</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">Upload file BOQ ini hanya menimpa daftar material dan frame (MPF). Field pada form project — misalnya <span className="font-medium">Start Produksi, alamat pengiriman, dan catatan lain</span> — tidak ikut berubah.</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">Gunakan menu <span className="font-semibold text-[#0F3B6C] dark:text-cyan-400">Edit</span> untuk mengubah data form.</p>
          </div>
        </div>
      )}

      {/* STICKY PANEL — di desktop digeser ke kanan sidebar agar tidak menimpa menu */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-72 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <span className="font-semibold text-gray-800 dark:text-gray-100">{countChanged} material berubah</span> · {countNew} baru · {countDeleted} dihapus
          </p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="w-4 h-4 rounded" />
              Saya sudah memeriksa perubahan ini
            </label>
            <button disabled={!checked || sending} onClick={submitForApproval}
              className={`px-4 py-2 rounded-xl text-sm font-semibold text-white transition inline-flex items-center gap-2 ${checked ? 'bg-[#0F3B6C] dark:bg-[#0084C9] hover:bg-[#0a2c52] dark:hover:bg-cyan-600' : 'bg-[#0F3B6C]/40 dark:bg-[#0084C9]/40 cursor-not-allowed'}`}>
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Kirim untuk Approval
            </button>
          </div>
        </div>
      </div>

      {/* DISCARD MODAL */}
      {discardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setDiscardModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mb-3">
              <Trash2 size={20} className="text-rose-600" />
            </div>
            <h3 className="font-bold mb-1 text-gray-800 dark:text-white">Buang draft ini?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Perubahan pada draft ini akan hilang. Data aktif V.{activeVersion} tidak akan terpengaruh.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDiscardModal(false)} className="px-3.5 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Batal</button>
              <button onClick={discard} className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold">Buang Draft</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const HeaderBack = ({ title, so, id, badge }) => {
  const navigate = useNavigate();
  return (
    <div className="flex items-start gap-3 mb-6">
      <button onClick={() => navigate(`/so/detail/${id}`)} className="mt-1 w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-300">
        <ArrowLeft size={16} />
      </button>
      <div>
        <h1 className="text-xl font-bold text-[#0F3B6C] dark:text-white">{title}</h1>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          <span>{id}</span><span>·</span><span>{so?.customer ?? ''}</span><span>·</span><span>{so?.project_name ?? ''}</span>
          <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-[#0F3B6C] dark:text-cyan-400 text-xs font-semibold">{badge}</span>
        </div>
      </div>
    </div>
  );
};
