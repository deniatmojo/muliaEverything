import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { callApi } from '../../services/api';
import {
  QrCode, CircleCheck, XCircle, Loader2, Lock, LockKeyhole,
  X, UserCheck, UserX, ClipboardCheck, Boxes, Layers,
} from 'lucide-react';

const STATUS_ITEM_BADGE = {
  'Ready to Use': 'bg-green-100 text-green-700',
  'Ready to Send': 'bg-green-100 text-green-700',
  'In Checking': 'bg-blue-100 text-blue-700',
  'InChecking': 'bg-blue-100 text-blue-700',
  'Hold': 'bg-amber-100 text-amber-700',
  'Reject': 'bg-red-100 text-red-700',
  'Stock': 'bg-purple-100 text-purple-700',
};
const STATUS_ACCENT = {
  'Ready to Use': 'bg-green-500',
  'Ready to Send': 'bg-green-500',
  'In Checking': 'bg-blue-500',
  'InChecking': 'bg-blue-500',
  'Hold': 'bg-amber-500',
  'Reject': 'bg-red-500',
  'Stock': 'bg-purple-500',
};
// Status khusus per tipe: FG Bundle berbeda dari Koil
const STATUS_ITEM_OPTIONS = {
  bundle: ['Ready to Send', 'InChecking', 'Hold', 'Stock'],
  coil: ['Ready to Use', 'In Checking', 'Reject', 'Stock'],
};
const statusOptionsFor = (type, currentValue) => {
  const list = STATUS_ITEM_OPTIONS[type] || STATUS_ITEM_OPTIONS.coil;
  return list.includes(currentValue) ? list : [currentValue, ...list];
};

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-aira-cyan';

export default function QcScan() {
  const { code } = useParams();
  const [item, setItem] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // loading | ready | error
  const [errorMsg, setErrorMsg] = useState('');

  const [pinModal, setPinModal] = useState(false);
  const [updateModal, setUpdateModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({ inspector: '', status_item: 'In Checking', qc_process: 'Unchecking', note: '' });

  const loadItem = async () => {
    setLoadState('loading');
    try {
      const res = await callApi('QC_SCAN_GET', { code });
      if (res.status === 'success') {
        setItem(res.data);
        setForm({ inspector: res.data.inspector || '', status_item: res.data.status_item, qc_process: res.data.qc_process, note: res.data.note || '' });
        setLoadState('ready');
      } else {
        setErrorMsg(res.message);
        setLoadState('error');
      }
    } catch {
      setErrorMsg('Gagal terhubung ke server.');
      setLoadState('error');
    }
  };

  useEffect(() => { loadItem(); /* eslint-disable-next-line */ }, [code]);

  const verifyPin = async () => {
    setIsSaving(true);
    setPinError('');
    try {
      const res = await callApi('QC_SCAN_VERIFY_PIN', { code, pin });
      if (res.status === 'success') {
        setPinModal(false);
        setUpdateModal(true);
      } else {
        setPinError(res.message);
        setPin('');
      }
    } catch {
      setPinError('Gagal terhubung ke server.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveUpdate = async () => {
    if (!form.inspector.trim()) return setPinError('Nama Inspector wajib diisi!');
    setIsSaving(true);
    setPinError('');
    try {
      const res = await callApi('QC_SCAN_UPDATE', {
        code, pin,
        inspector: form.inspector,
        status_item: form.status_item,
        qc_process: form.qc_process,
        note: form.note || '',
      });
      if (res.status === 'success') {
        setSuccess(true);
        setUpdateModal(false);
        setPin('');
        loadItem();
        setTimeout(() => setSuccess(false), 4000);
      } else {
        // PIN salah kedua kali / item terkunci: tutup form, tampilkan error
        setUpdateModal(false);
        setPinError(res.message);
      }
    } catch {
      setPinError('Gagal terhubung ke server.');
    } finally {
      setIsSaving(false);
    }
  };

  const InfoField = ({ label, value }) => (
    <div>
      <div className="text-[11px] font-bold text-gray-400 uppercase mb-0.5">{label}</div>
      <div className="font-medium text-gray-700 break-all">{value || '-'}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex justify-center transition-colors duration-300">
      <div className="w-full max-w-md flex flex-col relative">

        {/* Header (navy di kedua tema, sesuai desain) */}
        <div className="bg-aira-navy text-white px-5 py-4 shadow-md z-10 sticky top-0">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="font-bold text-lg leading-tight">Mulia 41</h1>
              <p className="text-[10px] text-gray-400 tracking-widest uppercase">QC Traceability System</p>
            </div>
            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
              <QrCode size={16} />
            </div>
          </div>
        </div>

        <div className="p-4 flex-1">

          {success && (
            <div className="mb-4 bg-green-100 border border-green-300 text-green-700 px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-medium">
              <CircleCheck size={20} /> Data QC berhasil diperbarui!
            </div>
          )}

          {pinError && !pinModal && !updateModal && (
            <div className="mb-4 bg-red-50 border border-red-300 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-medium">
              <XCircle size={20} /> <span className="flex-1">{pinError}</span>
              <button onClick={() => setPinError('')}><X size={16} /></button>
            </div>
          )}

          {loadState === 'loading' && (
            <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-aira-cyan" /></div>
          )}

          {loadState === 'error' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center shadow-sm border border-gray-200 dark:border-gray-700">
              <XCircle size={48} className="text-red-500 mx-auto mb-4" />
              <h2 className="font-bold text-gray-800 dark:text-white mb-2">Data Tidak Ditemukan</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{errorMsg}</p>
            </div>
          )}

          {loadState === 'ready' && item && (() => {
            const d = item.data || {};
            const isBundle = item.type === 'bundle';
            const TypeIcon = isBundle ? Boxes : Layers;
            const typeColor = isBundle ? '#DB3A22' : '#F3A230';
            return (
              <>
                {/* Kartu informasi item */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                    <TypeIcon size={18} style={{ color: typeColor }} />
                    <h2 className="font-bold text-gray-800 dark:text-white text-sm">
                      {isBundle ? 'Informasi Bundle (FG)' : 'Informasi Koil'}
                    </h2>
                  </div>
                  <div className="space-y-4">
                    {isBundle ? (
                      <>
                        <div>
                          <div className="text-[11px] font-bold text-gray-400 uppercase mb-0.5">Produk</div>
                          <div className="font-bold text-lg leading-tight" style={{ color: typeColor }}>{d.product_name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1">
                            SO: {d.so_number} <span className="mx-1">•</span> {d.customer}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                          <InfoField label="Quantity" value={`${d.qty || '-'} PCS`} />
                          <InfoField label="Warna" value={d.color} />
                          <InfoField label="Dimensi" value={`${d.dimension ? `${d.dimension} mm` : '-'}`} />
                          <InfoField label="Bundle No." value={`${d.bundle_no || '-'} / ${d.total_bundles || '-'}`} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <div className="text-[11px] font-bold text-gray-400 uppercase mb-0.5">No. Coil</div>
                          <div className="font-bold text-gray-800 dark:text-white text-lg break-all">{d.no_coil}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                          <InfoField label="Tipe" value={d.type_coil} />
                          <InfoField label="Berat" value={`${d.berat || '-'} KG`} />
                          <InfoField label="Supplier" value={d.supplier} />
                          <InfoField label="Tanggal Buat" value={new Date(item.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} />
                        </div>
                      </>
                    )}
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 font-mono pt-2 border-t border-gray-100 dark:border-gray-700">Kode: {item.code}</div>
                  </div>
                </div>

                {/* Kartu status QC */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 relative overflow-hidden mb-4">
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors ${STATUS_ACCENT[item.status_item] || 'bg-blue-500'}`} />
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700 pl-2">
                    <h2 className="font-bold text-gray-800 dark:text-white text-sm flex items-center gap-2">
                      <ClipboardCheck size={16} className="text-blue-500" /> Status QC
                    </h2>
                    {item.locked && (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase bg-gray-800 text-white px-2 py-1 rounded">
                        <Lock size={10} /> Terkunci
                      </span>
                    )}
                  </div>
                  <div className="pl-2 space-y-4">
                    <div>
                      <div className="text-[11px] font-bold text-gray-400 uppercase mb-1">Status Item</div>
                      <div className={`inline-block px-2.5 py-1 rounded text-xs font-bold uppercase ${STATUS_ITEM_BADGE[item.status_item] || 'bg-blue-100 text-blue-700'}`}>
                        {item.status_item}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-gray-400 uppercase mb-1">QC Process</div>
                      <div className={`inline-block px-2.5 py-1 rounded text-xs font-bold uppercase border ${item.qc_process === 'Passes' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'}`}>
                        {item.qc_process}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-3 mt-2 border border-gray-100 dark:border-gray-600">
                      <div className="text-[11px] font-bold text-gray-400 uppercase mb-1">Inspector QC</div>
                      {item.inspector ? (
                        <div>
                          <div className="font-medium text-gray-800 dark:text-gray-200 text-sm flex items-center gap-1">
                            <UserCheck size={14} className="text-green-500" /> {item.inspector}
                          </div>
                          {item.scan_updated_at && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              Dicek: {new Date(item.scan_updated_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}
                            </div>
                          )}
                          {item.note && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300 italic whitespace-pre-wrap">
                              "{item.note}"
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="font-medium text-gray-500 text-sm italic flex items-center gap-1">
                          <UserX size={14} className="text-gray-400" /> Belum diisi
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tombol update / info terkunci */}
                {item.locked ? (
                  <div className="w-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm cursor-not-allowed">
                    <Lock size={16} /> Sudah diupdate — perubahan selanjutnya via Admin
                  </div>
                ) : (
                  <button
                    onClick={() => { setPin(''); setPinError(''); setPinModal(true); }}
                    className="w-full text-white font-bold py-3.5 rounded-xl shadow-sm flex items-center justify-center gap-2 transition active:scale-95"
                    style={{ backgroundColor: typeColor }}
                  >
                    Update Data QC
                  </button>
                )}

                <p className="text-center text-[10px] text-gray-400 dark:text-gray-500 mt-4">
                  <Link to="/login" className="hover:underline">Mulia Everything Portal</Link> · QC Traceability
                </p>
              </>
            );
          })()}
        </div>

        {/* MODAL PIN */}
        {pinModal && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center" onClick={() => setPinModal(false)}>
            <div className="bg-white w-full max-w-md sm:rounded-2xl rounded-t-3xl p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setPinModal(false)} className="absolute top-5 right-5 text-gray-400 hover:text-gray-700"><X size={18} /></button>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <LockKeyhole size={26} />
                </div>
                <h3 className="font-bold text-lg text-gray-800">Verifikasi PIN</h3>
                <p className="text-xs text-gray-500 mt-1">Masukkan PIN dari pembuat barcode untuk mengubah data QC ini. Update hanya bisa dilakukan sekali.</p>
              </div>
              <div className="mb-4">
                <input
                  type="password"
                  autoFocus
                  className="w-full text-center text-2xl tracking-[0.5em] font-bold border-b-2 border-gray-300 py-2 outline-none focus:border-aira-cyan transition bg-transparent"
                  placeholder="••••" maxLength={6} value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), verifyPin())}
                />
                {pinError && <p className="text-red-500 text-xs text-center mt-2 font-medium">{pinError}</p>}
              </div>
              <button onClick={verifyPin} disabled={isSaving || !pin} className="w-full bg-gray-900 hover:bg-black text-white font-bold py-3 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2">
                {isSaving && <Loader2 size={16} className="animate-spin" />} Verifikasi
              </button>
            </div>
          </div>
        )}

        {/* MODAL FORM UPDATE */}
        {updateModal && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center" onClick={() => setUpdateModal(false)}>
            <div className="bg-white w-full max-w-md sm:rounded-2xl rounded-t-3xl shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b flex justify-between items-center">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><ClipboardCheck size={18} className="text-blue-500" /> Form Update QC</h3>
                <button onClick={() => setUpdateModal(false)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
              </div>
              <div className="p-6 overflow-y-auto space-y-4">
                <label className="block">
                  <div className="text-xs font-bold text-gray-500 mb-1">Nama Inspector QC <span className="text-red-500">*</span></div>
                  <input type="text" className={inputCls} placeholder="Contoh: Budi Santoso" value={form.inspector} onChange={(e) => setForm({ ...form, inspector: e.target.value })} />
                </label>
                <label className="block">
                  <div className="text-xs font-bold text-gray-500 mb-1">Status Item <span className="text-red-500">*</span></div>
                  <select className={`${inputCls} font-medium`} value={form.status_item} onChange={(e) => setForm({ ...form, status_item: e.target.value })}>
                    {statusOptionsFor(item.type, form.status_item).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label className="block">
                  <div className="text-xs font-bold text-gray-500 mb-1">QC Process <span className="text-red-500">*</span></div>
                  <select className={`${inputCls} font-medium`} value={form.qc_process} onChange={(e) => setForm({ ...form, qc_process: e.target.value })}>
                    <option value="Unchecking">Unchecking</option>
                    <option value="Passes">Passes</option>
                  </select>
                </label>
                <label className="block">
                  <div className="text-xs font-bold text-gray-500 mb-1">Catatan Inspeksi <span className="text-gray-400 font-normal">(opsional)</span></div>
                  <textarea rows={3} className={inputCls} placeholder="Catatan hasil pengecekan, temuan, atau keterangan lain..." value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                </label>
                {pinError && <p className="text-red-500 text-xs font-medium">{pinError}</p>}
              </div>
              <div className="p-4 border-t bg-gray-50">
                <button onClick={saveUpdate} disabled={isSaving} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl shadow transition flex items-center justify-center gap-2 disabled:opacity-50">
                  {isSaving && <Loader2 size={16} className="animate-spin" />} Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
