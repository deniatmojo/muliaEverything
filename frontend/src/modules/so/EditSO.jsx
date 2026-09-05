// Edit SO: edit manual form project + akumulasi material + frame (MPF).
// Adaptasi dari mockup edit-so.html dengan palet Mulia Everything.
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Send, Pencil, Trash2, RotateCcw, Plus, ListChecks, Info, X,
  CheckCircle2, Loader2, AlertTriangle,
} from 'lucide-react';
import { callApi } from '../../services/api';

const fmtIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
const fmtNum = (n, d = 0) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n || 0);
const fmtRMB = (n) => '¥' + fmtNum(n, 2);

const SHEETS = ['BOQ-Standard Items', 'BOQ-Non Standard Items', 'BOQ-Standard Frame Protector'];

const MAT_FIELDS = [
  { key: 'qty', label: 'QTY' },
  { key: 'hargaUnit', label: 'Harga Unit' },
  { key: 'beratUnit', label: 'Berat Unit' },
  { key: 'dim1', label: 'Dim 1' },
  { key: 'dim2', label: 'Dim 2' },
  { key: 'colour', label: 'Colour' },
  { key: 'ral', label: 'RAL' },
  { key: 'description', label: 'Description' },
];

const rowBg = (status) =>
  status === 'new' ? 'bg-emerald-50 dark:bg-emerald-900/10'
  : status === 'deleted' ? 'bg-rose-50/70 dark:bg-rose-900/10'
  : status === 'changed' ? 'bg-amber-50/60 dark:bg-amber-900/10'
  : '';

const inputCls = 'w-full px-3 py-2 rounded-xl text-sm border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0084C9]/30 focus:border-[#0084C9] transition';

const FormField = ({ label, value, onChange, type = 'text', textarea, hint, excel }) => (
  <div>
    <div className="flex items-center gap-2 mb-1.5">
      <label className="text-sm font-medium text-gray-600 dark:text-gray-300">{label}</label>
      {excel && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-700/50">Dari Excel</span>}
    </div>
    {textarea ? (
      <textarea rows={2} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={`${inputCls} resize-none`} />
    ) : (
      <input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    )}
    {hint && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
  </div>
);

export default function EditSO() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [original, setOriginal] = useState(null); // { form, materials, frames, kurs }
  const [form, setForm] = useState({});
  const [soKurs, setSoKurs] = useState(0);
  const [materials, setMaterials] = useState([]); // {..., _new, _deleted}
  const [frames, setFrames] = useState([]);
  const [tab, setTab] = useState('info');
  const [search, setSearch] = useState('');
  const [kategori, setKategori] = useState('all');
  const [tipe, setTipe] = useState('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [modal, setModal] = useState(null); // { mode:'edit'|'add', item, type }
  const [done, setDone] = useState(false);
  const toastTimer = useRef(null);
  const [toast, setToast] = useState(null);
  const showToast = (msg) => { setToast(msg); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 3200); };

  useEffect(() => {
    callApi('SO_DETAIL', { soId: id }).then((res) => {
      if (res.status !== 'success') { alert(res.message); navigate('/so'); return; }
      const { so, materials: mats, frames: frms } = res.data;
      const f = {
        customerName: so.customer ?? '', projectName: so.project_name ?? '', companyName: so.company ?? '',
        salesName: so.sales_name ?? '', projectNumber: so.project_number ?? '', soNumber: so.id,
        address: so.address ?? '', palletCount: so.pallet_count ?? '',
        startProduction: so.start_production ? String(so.start_production).slice(0, 10) : '',
        firstDelivery: so.first_delivery ? String(so.first_delivery).slice(0, 10) : '',
        startInstallation: so.start_installation ? String(so.start_installation).slice(0, 10) : '',
        targetInstallation: so.target_installation ? String(so.target_installation).slice(0, 10) : '',
        description: so.description ?? '',
      };
      setOriginal({ form: { ...f }, materials: mats, frames: frms, kurs: so.kurs || 0 });
      setSoKurs(so.kurs || 0);
      setForm(f);
      setMaterials(mats.map((m) => ({
        ...m, hargaUnit: m.unitPrice, beratUnit: m.unitWeight,
      })));
      setFrames(frms.map((f2) => ({ ...f2 })));
      setLoading(false);
    });
  }, [id, navigate]);

  // ---- diff helpers ----
  const matKey = (m) => `${m.sheet ?? ''}|${m.articleCode}|${m.dim1 ?? ''}|${m.dim2 ?? ''}|${m.colour ?? ''}|${m.currency}`;
  const matStatus = (m) => {
    if (m._new) return m._deleted ? null : 'new';
    if (m._deleted) return 'deleted';
    const o = original?.materials.find((x) => matKey(x) === matKey(m));
    if (!o) return 'unchanged';
    return MAT_FIELDS.some((f) => String(m[f.key] ?? '') !== String(o[f.key === 'hargaUnit' ? 'unitPrice' : f.key === 'beratUnit' ? 'unitWeight' : f.key] ?? '')) ? 'changed' : 'unchanged';
  };

  const diffs = useMemo(() => {
    if (!original) return [];
    const out = [];
    const formFields = [
      ['customerName', 'Nama Customer'], ['projectName', 'Nama Project'], ['companyName', 'Nama PT'],
      ['salesName', 'Nama Sales'], ['soNumber', 'Nomor SO'], ['address', 'Alamat'],
      ['palletCount', 'Total Pallet Posisi'], ['startProduction', 'Start Produksi'],
      ['firstDelivery', 'Tgl Kiriman Pertama'], ['startInstallation', 'Tgl Mulai Instalasi'],
      ['targetInstallation', 'Target Selesai Instalasi'], ['description', 'Keterangan'],
    ];
    formFields.forEach(([k, label]) => {
      if (String(original.form[k] ?? '') !== String(form[k] ?? '')) {
        out.push({ tone: 'changed', text: `${label}: ${original.form[k] || '-'} → ${form[k] || '-'}` });
      }
    });
    materials.forEach((m) => {
      const st = matStatus(m);
      if (!st || st === 'unchanged') return;
      if (st === 'new') out.push({ tone: 'new', text: `${m.articleCode} ditambahkan` });
      else if (st === 'deleted') out.push({ tone: 'deleted', text: `${m.articleCode} dihapus` });
      else {
        const o = original.materials.find((x) => matKey(x) === matKey(m));
        MAT_FIELDS.forEach((f) => {
          const oKey = f.key === 'hargaUnit' ? 'unitPrice' : f.key === 'beratUnit' ? 'unitWeight' : f.key;
          if (String(m[f.key] ?? '') !== String(o[oKey] ?? '')) {
            out.push({ tone: 'changed', text: `${f.label} ${m.articleCode}: ${String(o[oKey] ?? '')} → ${String(m[f.key] ?? '')}` });
          }
        });
      }
    });
    frames.forEach((f) => {
      const o = original.frames.find((x) => x.articleCode === f.articleCode && x.dim1 === f.dim1 && x.dim2 === f.dim2);
      if (o && String(o.qty) !== String(f.qty)) {
        out.push({ tone: 'changed', text: `QTY Frame ${f.articleCode}: ${fmtNum(o.qty)} → ${fmtNum(f.qty)}` });
      }
    });
    return out;
  }, [form, materials, frames, original]);

  const totals = useMemo(() => {
    const active = materials.filter((m) => !m._deleted);
    const berat = active.reduce((s, m) => s + m.qty * m.beratUnit, 0);
    const importRmb = active.filter((m) => m.currency !== 'IDR').reduce((s, m) => s + m.qty * m.hargaUnit, 0);
    const lokalIdr = active.filter((m) => m.currency === 'IDR').reduce((s, m) => s + m.qty * m.hargaUnit, 0);
    return { berat, importRmb, lokalIdr };
  }, [materials]);

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-gray-400 gap-3">
        <Loader2 className="animate-spin" size={28} />
        <p className="text-sm">Memuat data SO {id}...</p>
      </div>
    );
  }

  const filtered = materials.filter((m) => {
    const q = search.toLowerCase().trim();
    if (q && !(String(m.articleCode).toLowerCase().includes(q) || String(m.description ?? '').toLowerCase().includes(q))) return false;
    if (kategori !== 'all' && m.sheet !== kategori) return false;
    if (tipe !== 'all' && ((tipe === 'lokal') !== (m.currency === 'IDR'))) return false;
    return true;
  });

  const openModal = (mode, type, item) => setModal({ mode, type, item: item ? { ...item } : {
    articleCode: '', description: '', dim1: '', dim2: '', colour: '', ral: '', qty: 0,
    beratUnit: 0, hargaUnit: 0, sheet: SHEETS[0], currency: type === 'lokal' ? 'IDR' : 'RMB',
  } });

  const saveModal = () => {
    if (!modal.item.articleCode.trim()) { alert('Article Code wajib diisi.'); return; }
    if (modal.mode === 'add') {
      setMaterials((prev) => [...prev, { ...modal.item, _new: true, id: `new-${Date.now()}` }]);
    } else {
      setMaterials((prev) => prev.map((m) => (m.id === modal.item.id ? { ...modal.item } : m)));
    }
    setModal(null);
  };

  const submit = async () => {
    setSaving(true);
    const payload = {
      form,
      materials: materials.filter((m) => !m._deleted).map(({ _new, _deleted, hargaUnit, beratUnit, ...m }) => ({
        ...m, unitPrice: hargaUnit, unitWeight: beratUnit,
      })),
      frames: frames.map(({ _new, _deleted, ...f }) => f),
    };
    const res = await callApi('SO_MANUAL_SUBMIT', { soId: id, ...payload });
    setSaving(false);
    if (res.status !== 'success') { alert(res.message); return; }
    setDone(true);
  };

  const MaterialTable = ({ type, title }) => {
    const items = filtered.filter((m) => (type === 'import' ? m.currency !== 'IDR' : m.currency === 'IDR'));
    const activeItems = materials.filter((m) => !m._deleted && (type === 'import' ? m.currency !== 'IDR' : m.currency === 'IDR'));
    const subBerat = activeItems.reduce((s, m) => s + m.qty * m.beratUnit, 0);
    const subHarga = activeItems.reduce((s, m) => s + m.qty * m.hargaUnit, 0);
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 dark:text-white">{title}</h2>
          <span className="text-xs text-gray-400">{items.length} baris</span>
        </div>
        <div className="overflow-x-auto max-h-[480px] custom-scrollbar">
          <table className="w-full text-sm min-w-[1000px]">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/80 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                {['Article Code', 'Dim 1', 'Dim 2', 'Colour', 'QTY', 'Berat Unit', 'Harga Unit', 'Total Berat', 'Total Harga', 'Description', 'Aksi'].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.length === 0 && (
                <tr><td colSpan="11" className="px-4 py-8 text-center text-gray-400 text-sm">Tidak ada material yang cocok.</td></tr>
              )}
              {items.map((m) => {
                const st = matStatus(m);
                if (!st) return null;
                const strike = st === 'deleted' ? 'line-through text-gray-400' : '';
                return (
                  <tr key={m.id} className={`${rowBg(st)} ${strike}`}>
                    <td className="px-3 py-2.5 font-mono text-xs font-bold text-[#0F3B6C] dark:text-cyan-400 whitespace-nowrap">
                      <span className="flex items-center gap-1.5">{m.articleCode}
                        {st === 'new' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-semibold">Baru</span>}
                        {st === 'deleted' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300 font-semibold">Dihapus</span>}
                        {st === 'changed' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-semibold">Berubah</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{m.dim1 ?? '-'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{m.dim2 ?? '-'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{m.colour ?? '-'}</td>
                    <td className="px-3 py-2.5 font-bold whitespace-nowrap">{fmtNum(m.qty)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{fmtNum(m.beratUnit, 2)} kg</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{m.currency === 'IDR' ? fmtIDR(m.hargaUnit) : fmtRMB(m.hargaUnit)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-medium">{fmtNum(m.qty * m.beratUnit, 2)} kg</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-bold">{m.currency === 'IDR' ? fmtIDR(m.qty * m.hargaUnit) : fmtRMB(m.qty * m.hargaUnit)}</td>
                    <td className="px-3 py-2.5 max-w-[200px] truncate text-gray-500 dark:text-gray-400" title={m.description ?? ''}>{m.description ?? '-'}</td>
                    <td className="px-3 py-2.5">
                      {st === 'deleted' ? (
                        <button onClick={() => setMaterials((p) => p.map((x) => (x.id === m.id ? { ...x, _deleted: false } : x)))}
                          className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline inline-flex items-center gap-1">
                          <RotateCcw size={12} /> Restore
                        </button>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button onClick={() => openModal('edit', m.currency === 'IDR' ? 'lokal' : 'import', m)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"><Pencil size={13} /></button>
                          <button onClick={() => {
                            if (m._new) setMaterials((p) => p.filter((x) => x.id !== m.id));
                            else setMaterials((p) => p.map((x) => (x.id === m.id ? { ...x, _deleted: true } : x)));
                          }} className="w-7 h-7 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 size={13} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 dark:bg-gray-900/60 font-semibold text-xs">
                <td colSpan="5" className="px-3 py-2.5 text-right text-gray-500 dark:text-gray-400 uppercase">Subtotal {type === 'import' ? 'Import' : 'Lokal'}</td>
                <td className="px-3 py-2.5">{fmtNum(subBerat, 2)} kg</td>
                <td colSpan="2"></td>
                <td className="px-3 py-2.5">{type === 'import' ? fmtRMB(subHarga) : fmtIDR(subHarga)}</td>
                <td colSpan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  const ModalEditor = () => modal && (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setModal(null)}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg w-full max-w-lg border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 dark:text-white">
            {modal.mode === 'add' ? 'Tambah Material' : `Edit Material — ${modal.item.articleCode}`}
          </h3>
          <button onClick={() => setModal(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"><X size={16} /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          {[
            ['articleCode', 'Article Code', 'text'], ['description', 'Description', 'text'],
            ['dim1', 'Dim 1', 'text'], ['dim2', 'Dim 2', 'text'],
            ['colour', 'Colour', 'text'], ['ral', 'RAL', 'text'],
            ['qty', 'QTY', 'number'], ['beratUnit', 'Berat Unit (kg)', 'number'],
            ['hargaUnit', `Harga Unit (${modal.item.currency === 'IDR' ? 'IDR' : 'RMB'})`, 'number'],
          ].map(([k, label, type]) => (
            <div key={k} className={k === 'articleCode' || k === 'description' ? 'col-span-2' : ''}>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5 block">{label}</label>
              <input type={type} step={type === 'number' ? '0.01' : undefined} value={modal.item[k] ?? ''}
                onChange={(e) => setModal({ ...modal, item: { ...modal.item, [k]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value } })}
                className={inputCls} />
            </div>
          ))}
          <div className="col-span-2">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5 block">Kategori Sheet</label>
            <select value={modal.item.sheet} onChange={(e) => setModal({ ...modal, item: { ...modal.item, sheet: e.target.value } })} className={inputCls}>
              {SHEETS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400 text-xs uppercase mb-0.5">Total Berat</p>
              <p className="font-semibold">{fmtNum((modal.item.qty || 0) * (modal.item.beratUnit || 0), 2)} kg</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase mb-0.5">Total Harga</p>
              <p className="font-semibold">{modal.item.currency === 'IDR' ? fmtIDR((modal.item.qty || 0) * (modal.item.hargaUnit || 0)) : fmtRMB((modal.item.qty || 0) * (modal.item.hargaUnit || 0))}</p>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">
          <button onClick={() => setModal(null)} className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Batal</button>
          <button onClick={saveModal} className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#0F3B6C] dark:bg-[#0084C9] hover:bg-[#0a2c52] dark:hover:bg-cyan-600">Simpan Baris</button>
        </div>
      </div>
    </div>
  );

  if (done) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center mb-5">
            <CheckCircle2 size={36} className="text-[#0EA5A5]" />
          </div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-1">Perubahan dikirim, menunggu approval Developer</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Anda akan mendapat notifikasi setelah perubahan pada {id} disetujui atau ditolak.</p>
          <button onClick={() => navigate(`/so/detail/${id}`)} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#0F3B6C] dark:bg-[#0084C9] hover:bg-[#0a2c52] dark:hover:bg-cyan-600">Kembali ke Detail SO</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate(`/so/detail/${id}`)}
            className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-[#0F3B6C] dark:text-white truncate">Edit Project {id}</h1>
              <span className="shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full bg-sky-50 dark:bg-sky-900/30 text-[#0084C9] dark:text-sky-400">In Progress</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{form.customerName} · {form.projectName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => navigate(`/so/detail/${id}`)} className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Batal</button>
          <button onClick={() => { setDrawerOpen(true); setTab('material'); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#0F3B6C] dark:bg-[#0084C9] hover:bg-[#0a2c52] dark:hover:bg-cyan-600 shadow-sm">
            <Send size={15} /> Kirim untuk Approval
            {diffs.length > 0 && <span className="ml-0.5 text-xs font-bold bg-white/25 rounded-full px-2 py-0.5">{diffs.length}</span>}
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6">
        {[['info', 'Info Project'], ['material', `Material (${materials.filter((m) => !m._deleted).length})`], ['mpf', `Frame (MPF) (${frames.length})`]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition ${tab === k ? 'text-[#0F3B6C] dark:text-cyan-400 border-b-2 border-[#0084C9] dark:border-cyan-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* TAB INFO */}
      {tab === 'info' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700"><h2 className="font-semibold text-gray-800 dark:text-white">Informasi Utama</h2></div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <FormField label="Nama Customer" value={form.customerName} onChange={(v) => setForm({ ...form, customerName: v })} excel={original.form.customerName !== ''} />
              <FormField label="Nama Project" value={form.projectName} onChange={(v) => setForm({ ...form, projectName: v })} />
              <FormField label="Nama PT" value={form.companyName} onChange={(v) => setForm({ ...form, companyName: v })} />
              <FormField label="Nama Sales" value={form.salesName} onChange={(v) => setForm({ ...form, salesName: v })} />
              <FormField label="Nomor Project" value={form.projectNumber} onChange={(v) => setForm({ ...form, projectNumber: v })} hint="Digenerate engineering saat tender" />
              <FormField label="Nomor SO" value={form.soNumber} onChange={(v) => setForm({ ...form, soNumber: v })} hint="Boleh diganti bila ada koreksi" />
              <div className="sm:col-span-2"><FormField label="Alamat" textarea value={form.address} onChange={(v) => setForm({ ...form, address: v })} /></div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700"><h2 className="font-semibold text-gray-800 dark:text-white">Timeline &amp; Budget</h2></div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <FormField label="Total Pallet Posisi" type="number" excel value={form.palletCount} onChange={(v) => setForm({ ...form, palletCount: v })} />
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5 flex items-center gap-1.5 block">
                  Potential Budget Material <Info size={12} className="text-gray-400" />
                </label>
                <input readOnly value={fmtIDR(totals.lokalIdr + totals.importRmb * soKurs)} className={`${inputCls} bg-gray-100 dark:bg-gray-900/60 cursor-not-allowed`} />
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Material Lokal (IDR) + Import (RMB × kurs saat upload)</p>
              </div>
              <FormField label="Start Produksi" type="date" value={form.startProduction} onChange={(v) => setForm({ ...form, startProduction: v })} />
              <FormField label="Tgl Kiriman Pertama" type="date" value={form.firstDelivery} onChange={(v) => setForm({ ...form, firstDelivery: v })} />
              <FormField label="Tgl Mulai Instalasi" type="date" value={form.startInstallation} onChange={(v) => setForm({ ...form, startInstallation: v })} />
              <FormField label="Target Selesai Instalasi" type="date" value={form.targetInstallation} onChange={(v) => setForm({ ...form, targetInstallation: v })} />
              <div className="sm:col-span-2"><FormField label="Keterangan" textarea value={form.description} onChange={(v) => setForm({ ...form, description: v })} /></div>
            </div>
          </div>
        </div>
      )}

      {/* TAB MATERIAL */}
      {tab === 'material' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-4 flex flex-col lg:flex-row gap-3">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari Article Code atau Description..." className={`${inputCls} flex-1`} />
            <select value={kategori} onChange={(e) => setKategori(e.target.value)} className={inputCls}>
              <option value="all">Semua Kategori Sheet</option>
              {SHEETS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={tipe} onChange={(e) => setTipe(e.target.value)} className={inputCls}>
              <option value="all">Import &amp; Lokal</option>
              <option value="import">Import saja</option>
              <option value="lokal">Lokal saja</option>
            </select>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => openModal('add', tipe === 'lokal' ? 'lokal' : 'import')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#0F3B6C] dark:bg-[#0084C9] hover:bg-[#0a2c52] dark:hover:bg-cyan-600">
                <Plus size={15} /> Tambah Material
              </button>
              <button onClick={() => setDrawerOpen(true)}
                className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                <ListChecks size={15} /> Ringkasan Perubahan
                {diffs.length > 0 && <span className="text-xs font-bold text-white bg-[#0EA5A5] rounded-full px-2 py-0.5">{diffs.length}</span>}
              </button>
            </div>
          </div>

          {(tipe === 'all' || tipe === 'import') && <MaterialTable type="import" title="Material Import (RMB)" />}
          {(tipe === 'all' || tipe === 'lokal') && <MaterialTable type="lokal" title="Material Lokal (IDR)" />}

          <div className="bg-[#0F3B6C] dark:bg-gray-800 dark:border dark:border-gray-700 text-white rounded-2xl shadow-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-white/60 dark:text-gray-400 font-medium">Total Kebutuhan Material (Import + Lokal)</p>
              <p className="text-2xl font-bold">{fmtNum(totals.berat, 2)} kg</p>
            </div>
            <div className="text-sm text-white/80 dark:text-gray-300">
              <p>Nilai Import: <span className="font-semibold">{fmtRMB(totals.importRmb)}</span></p>
              <p>Nilai Lokal: <span className="font-semibold">{fmtIDR(totals.lokalIdr)}</span></p>
            </div>
          </div>
        </div>
      )}

      {/* TAB MPF */}
      {tab === 'mpf' && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 rounded-2xl p-4 text-sm">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p><span className="font-semibold">MPF (frame assembly)</span> bukan material tersendiri — kode frame yang sudah tersusun dari upright, bracing, dan baut. Komponen penyusunnya sudah terekspansi pada tabel Material; mengubah QTY frame di sini tidak mengubah komponen otomatis.</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700"><h2 className="font-semibold text-gray-800 dark:text-white">Daftar Frame (MPF)</h2></div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                <tr>{['Article Code', 'Dim 1 (Tinggi)', 'Dim 2', 'QTY Frame', 'Description'].map((h) => <th key={h} className="text-left px-5 py-3 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {frames.map((f, i) => {
                  const o = original.frames.find((x) => x.articleCode === f.articleCode && x.dim1 === f.dim1 && x.dim2 === f.dim2);
                  const changed = o && String(o.qty) !== String(f.qty);
                  return (
                    <tr key={i} className={changed ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}>
                      <td className="px-5 py-3 font-mono text-xs font-bold text-[#0F3B6C] dark:text-cyan-400">{f.articleCode}</td>
                      <td className="px-5 py-3">{f.dim1 ?? '-'}</td>
                      <td className="px-5 py-3">{f.dim2 ?? '-'}</td>
                      <td className="px-5 py-3">
                        <input type="number" value={f.qty} onChange={(e) => setFrames((prev) => prev.map((x, j) => (j === i ? { ...x, qty: parseFloat(e.target.value) || 0 } : x)))}
                          className="w-24 px-2 py-1.5 rounded-lg text-sm border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0084C9]/30" />
                      </td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{f.description ?? '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ModalEditor />

      {/* DRAWER */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setDrawerOpen(false)}>
          <aside className="absolute top-0 right-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-lg flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-white">Ringkasan Perubahan</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{diffs.length} perubahan</p>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-2 custom-scrollbar">
              {diffs.length === 0 && <div className="text-center text-sm text-gray-400 py-10">Belum ada perubahan yang tercatat.</div>}
              {diffs.map((d, i) => (
                <div key={i} className={`flex items-start gap-2 text-sm p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 ${
                  d.tone === 'new' ? 'text-emerald-600 dark:text-emerald-400' : d.tone === 'deleted' ? 'text-rose-500' : 'text-gray-700 dark:text-gray-200'}`}>
                  {d.tone === 'new' ? <Plus size={14} className="mt-0.5 shrink-0" /> : d.tone === 'deleted' ? <Trash2 size={14} className="mt-0.5 shrink-0" /> : <Pencil size={14} className="mt-0.5 shrink-0 text-amber-500" />}
                  <span>{d.text}</span>
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-700 space-y-3 shrink-0">
              <label className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 w-4 h-4 rounded" />
                Saya sudah memeriksa perubahan ini
              </label>
              <button disabled={!checked || saving} onClick={submit}
                className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition ${checked ? 'bg-[#0F3B6C] dark:bg-[#0084C9] hover:bg-[#0a2c52] dark:hover:bg-cyan-600' : 'bg-[#0F3B6C]/40 dark:bg-[#0084C9]/40 cursor-not-allowed'}`}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Kirim untuk Approval
              </button>
            </div>
          </aside>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg">{toast}</div>
      )}
    </div>
  );
}
