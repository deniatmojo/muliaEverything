// Halaman operator mesin (tanpa login, kode akses): melihat antrean WO mesin dan
// mengupdate progress produksi. Hanya itu — tidak ada reorder/pause/aksi lain.
// Pola halaman publik seperti /qc/scan/:code — di luar ProtectedRoute.
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Factory, ScanLine, Layers, Flame, Paintbrush, Loader2, CheckCircle2, AlertTriangle,
  KeyRound, User, Plus, RefreshCw, Lock,
} from 'lucide-react';
import { callApi } from '../../services/api';
import { MACHINES, MACHINE_LABEL, woItemPct, woStatusLabel, woStatusStyle } from './productionData';

const fmtNum = (n) => new Intl.NumberFormat('id-ID').format(n || 0);
const machineIcon = { factory: Factory, 'scan-line': ScanLine, layers: Layers, flame: Flame, paintbrush: Paintbrush };

export default function MachineProduction() {
  const { machine } = useParams();
  const meta = MACHINES.find((m) => m.key === machine);

  const [code, setCode] = useState(sessionStorage.getItem(`prod_code_${machine}`) || '');
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Form update
  const [sel, setSel] = useState(null);
  const [qty, setQty] = useState('');
  const [operator, setOperator] = useState(localStorage.getItem('prod_operator_nama') || '');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sukses, setSukses] = useState(null);

  const load = (kode) => {
    setLoading(true); setError(null);
    callApi('PRODUCTION_MACHINE_QUEUE', { machine, code: kode }).then((res) => {
      if (res.status === 'success') setItems(res.data.items || []);
      else { setItems(null); setError(res.message); }
      setLoading(false);
    });
  };

  const masuk = () => {
    setLoading(true); setError(null);
    callApi('PRODUCTION_MACHINE_VERIFY', { machine, code }).then((res) => {
      if (res.status === 'success') {
        sessionStorage.setItem(`prod_code_${machine}`, code);
        setItems(res.data.items || []);
      } else setError(res.message);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (code) masuk(); // eslint-disable-line
  }, [machine]); // eslint-disable-line

  const submit = async () => {
    const q = parseFloat(qty);
    if (!(q > 0) || !operator.trim()) return;
    setSubmitting(true);
    const res = await callApi('PRODUCTION_MACHINE_OUTPUT', { machine, code, itemId: sel.id, qty: q, note, operatorNama: operator });
    setSubmitting(false);
    if (res.status !== 'success') { alert(res.message); return; }
    localStorage.setItem('prod_operator_nama', operator.trim());
    setSukses({ msg: res.message, item: sel });
    setSel(null); setQty(''); setNote('');
    load(code);
  };

  if (!meta) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="text-center">
          <AlertTriangle size={26} className="text-rose-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Mesin tidak dikenal</p>
        </div>
      </div>
    );
  }
  const Icon = machineIcon[meta.icon];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-aira-navy dark:bg-aira-cyan flex items-center justify-center text-white dark:text-gray-900 shrink-0">
            <Icon size={19} />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-aira-navy dark:text-white leading-tight">{meta.name}</h1>
            <p className="text-xs text-gray-400">Halaman operator — antrean WO & update progress</p>
          </div>
        </div>

        {sukses && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40 rounded-2xl p-4 flex items-start gap-3">
            <CheckCircle2 size={20} className="text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{sukses.msg}</p>
              <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">{sukses.item.item} · {fmtNum(sukses.item.qtyDone)} pcs tercatat</p>
            </div>
          </div>
        )}

        {/* Gerbang kode akses */}
        {!items && !loading && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <div className="text-center mb-4">
              <KeyRound size={24} className="text-aira-navy dark:text-aira-cyan mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-900 dark:text-white">Masukkan Kode Akses Mesin</p>
              <p className="text-xs text-gray-400 mt-0.5">Kode diberikan admin produksi</p>
            </div>
            {error && <p className="text-xs text-rose-500 text-center mb-3">{error}</p>}
            <input type="password" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && masuk()} placeholder="Kode akses" autoFocus
              className="w-full text-base font-semibold tracking-widest text-center border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 rounded-xl px-3 py-3 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#0084C9]/30" />
            <button onClick={masuk} disabled={!code.trim()}
              className="w-full mt-3 px-3 py-3 rounded-xl bg-gradient-to-r from-[#0084C9] to-[#0EA5A5] text-white text-sm font-semibold disabled:opacity-50">
              Masuk
            </button>
          </div>
        )}

        {loading && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-10 text-center text-gray-400">
            <Loader2 className="animate-spin inline mb-2" size={22} /><p className="text-sm">Memuat antrean…</p>
          </div>
        )}

        {/* Antrean WO */}
        {items && !loading && (<>
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-gray-400">Antrean WO — pilih item untuk update progress</p>
            <button onClick={() => load(code)} className="text-[11px] font-semibold text-gray-400 hover:text-gray-700 dark:hover:text-white flex items-center gap-1">
              <RefreshCw size={11} /> Muat ulang
            </button>
          </div>

          {items.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8 text-center text-gray-400 text-sm">
              Antrean kosong. Belum ada WO untuk mesin ini.
            </div>
          )}

          {/* Hanya WO TERATAS (urutan admin) yang bisa diupdate — sisanya menunggu giliran */}
          {items.map((it, idx) => {
            const teratas = idx === 0;
            const bisa = teratas && it.status !== 'done';
            return (
            <div key={it.id}
              onClick={() => { if (bisa) { setSel(it); setQty(''); setNote(''); setSukses(null); } }}
              className={`bg-white dark:bg-gray-800 rounded-2xl border shadow-sm p-4 transition-colors ${
                bisa ? 'border-[#0084C9]/50 cursor-pointer hover:border-[#0084C9]'
                : 'border-gray-100 dark:border-gray-700 opacity-70'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {it.item} <span className="font-normal text-gray-400 text-xs">· {it.lengthMm ?? '-'} mm · {it.unit}</span>
                  {teratas && <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-[#0084C9]/10 text-[#0084C9] dark:text-sky-400 text-[9px] font-bold uppercase tracking-wide">WO Aktif</span>}
                </p>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${woStatusStyle[it.status]}`}>{woStatusLabel[it.status]}</span>
              </div>
              <p className="text-[11px] text-gray-400 mb-2">{it.woId} · SO {it.soId} · <span className="font-semibold text-gray-500 dark:text-gray-300">{it.customer || '-'}</span>{it.rawMaterial ? ` · ${it.rawMaterial}` : ''}{it.reqGalva ? ' · GALVA' : ''}</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#0084C9] to-[#0EA5A5]" style={{ width: `${woItemPct(it)}%` }} />
                </div>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap font-semibold">{fmtNum(it.qtyDone)}/{fmtNum(it.qtyTarget)} {it.unit}</span>
              </div>
              {bisa
                ? <p className="text-[11px] font-semibold text-[#0084C9] dark:text-sky-400 mt-2 flex items-center gap-1"><Plus size={11} /> Update progress</p>
                : !teratas && <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1"><Lock size={11} /> Menunggu giliran — aturan admin</p>}
            </div>
            );
          })}

          {/* Form update */}
          {sel && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSel(null)} />
              <div className="relative bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xl w-full max-w-sm p-5">
                <h3 className="font-bold text-gray-900 dark:text-white mb-1">Update Progress</h3>
                <p className="text-xs text-gray-400 mb-4">{sel.item} · {sel.lengthMm ?? '-'} mm · {MACHINE_LABEL[sel.machine]}</p>
                <div className="bg-gray-50 dark:bg-gray-900/40 rounded-xl p-3 text-xs text-gray-500 dark:text-gray-400 mb-4 flex justify-between">
                  <span>Sudah: <b className="text-gray-800 dark:text-gray-100">{fmtNum(sel.qtyDone)}</b> / {fmtNum(sel.qtyTarget)} {sel.unit}</span>
                  <span>Sisa: {fmtNum(Math.max(0, sel.qtyTarget - sel.qtyDone))}</span>
                </div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1"><User size={11} /> Nama operator</label>
                <input value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="Nama Anda"
                  className="w-full mt-1 mb-3 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 rounded-xl px-3 py-2.5 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#0084C9]/30" />
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Qty hasil produksi ({sel.unit})</label>
                <input type="number" min="1" inputMode="numeric" autoFocus value={qty} onChange={(e) => setQty(e.target.value)}
                  className="w-full mt-1 mb-3 text-base font-semibold border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 rounded-xl px-3 py-2.5 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#0084C9]/30" />
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Catatan (opsional)</label>
                <input value={note} onChange={(e) => setNote(e.target.value)}
                  className="w-full mt-1 mb-4 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 rounded-xl px-3 py-2.5 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#0084C9]/30" />
                <div className="flex gap-2">
                  <button onClick={() => setSel(null)} className="flex-1 px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-600 dark:text-gray-300">Batal</button>
                  <button onClick={submit} disabled={submitting || !(parseFloat(qty) > 0) || !operator.trim()}
                    className="flex-[2] px-3 py-3 rounded-xl bg-gradient-to-r from-[#0084C9] to-[#0EA5A5] text-white text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5">
                    {submitting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Simpan Output
                  </button>
                </div>
              </div>
            </div>
          )}
        </>)}
      </div>
    </div>
  );
}
