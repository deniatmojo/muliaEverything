import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { callApi } from '../../services/api';
import {
  Search, Filter, Plus, Pen, Printer, X, QrCode, LayoutGrid,
  Boxes, Layers, Package, PieChart, Users, Loader2, Lock, Download,
  CircleCheck, UserCheck, UserX, PackageOpen, Mail, AtSign, Phone,
} from 'lucide-react';

// ============ KONFIGURASI TIPE LABEL ============
const TYPE_META = {
  bundle: { label: 'FG Bundle', longLabel: 'Bundle Info – FG', color: '#DB3A22', icon: Boxes },
  coil: { label: 'QC Koil', longLabel: 'QC Koil', color: '#F3A230', icon: Layers },
  packaging: { label: 'Packaging', longLabel: 'Packaging Upright', color: '#1C8A5C', icon: Package },
};

const STATUS_ITEM_BADGE = {
  'Ready to Use': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  'Ready to Send': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  'In Checking': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'InChecking': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'Hold': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'Reject': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'Stock': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
};

// Opsi Status Item: FG Bundle punya daftar sendiri, tipe lain memakai daftar umum
const STATUS_ITEM_OPTIONS = {
  bundle: ['Ready to Send', 'InChecking', 'Hold', 'Stock'],
  coil: ['Ready to Use', 'In Checking', 'Reject', 'Stock'],
  packaging: ['Ready to Use', 'In Checking', 'Reject', 'Stock'],
};
const statusOptionsFor = (type, currentValue) => {
  const list = STATUS_ITEM_OPTIONS[type] || STATUS_ITEM_OPTIONS.coil;
  // nilai lama yang tak ada di daftar baru tetap tampil agar data tak "hilang" dari form
  return list.includes(currentValue) ? list : [currentValue, ...list];
};

// FG lama masih memakai istilah lama; dinormalisasi ke padanan barunya supaya tidak dobel di dropdown
const normalizeFgStatus = (type, status) => {
  if (type !== 'bundle') return status;
  if (status === 'In Checking') return 'InChecking';
  if (status === 'Ready to Use') return 'Ready to Send';
  return status;
};

// Field dinamis per tipe (mengikuti desain mockup)
const BUNDLE_FIELDS = [
  { k: 'customer', label: 'Customer', req: true, ph: 'PT PRATAMA EKA...' },
  { k: 'so_number', label: 'SO Number', req: true, ph: '26-0306B', half: true },
  { k: 'product_name', label: 'Product Name', req: true, ph: 'UPRIGHT MPU 22', half: true },
  { k: 'qty', label: 'QTY (PCS)', req: true, type: 'number', ph: '40', half: true },
  { k: 'dimension', label: 'Dimension (mm)', ph: '11500', half: true },
  { k: 'color', label: 'Color', ph: 'BLUE', half: true },
  { k: 'bundle_no', label: 'Bundle No.', req: true, type: 'number', ph: '1', half: true },
  { k: 'total_bundles', label: 'Total Bundles', req: true, type: 'number', ph: '10', half: true },
  { k: 'description', label: 'Product Description', type: 'textarea', ph: 'Tambahkan deskripsi (opsional)...' },
];
const COIL_FIELDS = [
  { k: 'type_coil', label: 'Type Coil', req: true, ph: 'MPB 5010' },
  { k: 'berat', label: 'Berat Timbang (KG)', type: 'number', ph: '0', half: true },
  { k: 'no_coil', label: 'No. Coil', req: true, ph: 'PP260709A044A2', half: true },
  { k: 'supplier', label: 'Supplier', ph: 'NAI' },
];
const FIELDS_PER_TYPE = { bundle: BUNDLE_FIELDS, coil: COIL_FIELDS, packaging: [] };

const PAPER_OPTIONS = [58, 70, 80, 100];
const PAPER_LS_KEY = 'qc_paper_mm';

// Tanggal pengecekan otomatis: terisi saat checker gudang update via halaman scan
const fmtCheckDate = (item) => item?.scan_updated_at
  ? new Date(item.scan_updated_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
  : '-';

// SEMENTARA: baris DATE QC CHECK di label tercetak memakai tanggal pembuatan QR,
// bukan tanggal pengecekan inspector (permintaan revisi, menyimpang dari aturan sementara)
const fmtLabelDate = (item) => item?.created_at
  ? new Date(item.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })
  : '-';

// Logo segitiga MULIA 41 untuk label cetak
const MuliaLogo = ({ size = 30 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" style={{ marginRight: 6, flexShrink: 0 }}>
    <polygon points="20,3 36,34 4,34" fill="#000" />
    <polygon points="20,13 30,34 10,34" fill="#000" />
  </svg>
);

const inputCls = 'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-aira-cyan bg-white dark:bg-gray-700 text-gray-900 dark:text-white';

// ============ LABEL CETAK (selalu hitam-putih utk printer thermal) ============
function BundleLabel({ item, qrValue }) {
  const d = item.data || {};
  const rows = [
    ['CUSTOMER', d.customer], ['SO NUMBER', d.so_number], ['PRODUCT NAME', d.product_name],
    ['QTY (PCS)', d.qty], ['DIMENSION (mm)', d.dimension], ['COLOR', d.color],
    ['BUNDLE NO.', d.bundle_no], ['TOTAL BUNDLES', d.total_bundles],
    ['DATE QC CHECK', fmtLabelDate(item)],
  ];
  const td = { border: '1px solid #000', padding: '5px', textTransform: 'uppercase', fontSize: 10 };
  return (
    <div style={{ background: '#fff', padding: 14, color: '#000', fontFamily: "'Times New Roman', serif", display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: 10, marginBottom: 8 }}>
        <MuliaLogo size={26} />
        <div style={{ lineHeight: 1 }}>
          <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 900, fontSize: 20, letterSpacing: '-0.02em' }}>MULIA 41</div>
          <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: 6.5, letterSpacing: '0.1em' }}>INTEGRATED WAREHOUSE SOLUTIONS</div>
        </div>
      </div>
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 16, marginBottom: 10, textTransform: 'uppercase' }}>BUNDLE INFORMATION</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', textTransform: 'uppercase', fontSize: 10 }}>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}><td style={{ ...td, width: '40%' }}>{k}</td><td style={td}>{v || '-'}</td></tr>
          ))}
          <tr>
            <td colSpan={2} style={{ ...td, minHeight: 40, verticalAlign: 'top' }}>
              <div>PRODUCT DESCRIPTION:</div>
              <div style={{ textTransform: 'none', fontSize: 9, marginTop: 3 }}>{d.description || ''}</div>
            </td>
          </tr>
        </tbody>
      </table>
      {/* QR di blok sendiri di bawah tabel: rapi, tidak menabrak objek lain */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 12, paddingBottom: 2 }}>
        <QRCodeCanvas value={qrValue} size={92} level="M" style={{ width: 92, height: 92 }} />
        <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: 8, letterSpacing: '0.08em', marginTop: 5 }}>{item.code}</div>
      </div>
    </div>
  );
}

function CoilLabel({ item, qrValue }) {
  const d = item.data || {};
  const rows = [['TYPE COIL', d.type_coil], ['BERAT', `${d.berat || '-'} KG`], ['NO. COIL', d.no_coil], ['SUPPLIER', d.supplier], ['DATE QC CHECK', fmtLabelDate(item)]];
  return (
    <div style={{ background: '#fff', padding: 14, color: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', borderBottom: '3px solid #000', paddingBottom: 10, marginBottom: 16 }}>
        <MuliaLogo size={32} />
        <div style={{ lineHeight: 1, textAlign: 'left' }}>
          <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 900, fontSize: 22, letterSpacing: '-0.02em' }}>MULIA 41</div>
          <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: 7.5, letterSpacing: '0.15em' }}>INTEGRATED WAREHOUSE SOLUTIONS</div>
        </div>
      </div>
      <div style={{ marginBottom: 18 }}>
        <QRCodeCanvas value={qrValue} size={150} level="M" style={{ width: 150, height: 150 }} />
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Times New Roman', serif", fontStyle: 'italic', fontWeight: 700, fontSize: 13 }}>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} style={{ borderTop: '1px dashed #888' }}>
              <td style={{ padding: '9px 0', width: '42%', verticalAlign: 'top' }}>{k}</td>
              <td style={{ padding: '9px 2px', verticalAlign: 'top' }}>:</td>
              <td style={{ padding: '9px 0', verticalAlign: 'top', wordBreak: 'break-all', textTransform: 'uppercase' }}>{v || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============ KOMPONEN UTAMA ============
export default function QCHome() {
  const [tab, setTab] = useState('barcode');
  const [notice, setNotice] = useState({ show: false, message: '', type: 'success' });
  const showNotice = (message, type = 'success') => {
    setNotice({ show: true, message, type });
    setTimeout(() => setNotice({ show: false, message: '', type: 'success' }), 4000);
  };

  // Data
  const [items, setItems] = useState([]);
  const [team, setTeam] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Form modal
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState(null); // null = buat baru
  const [formType, setFormType] = useState('bundle');
  const [formValues, setFormValues] = useState({});
  const [formPin, setFormPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preview modal
  const [previewItem, setPreviewItem] = useState(null);
  const [paperMm, setPaperMm] = useState(() => Number(localStorage.getItem(PAPER_LS_KEY)) || 80);
  const [isDownloading, setIsDownloading] = useState(false);
  const labelRef = useRef(null);

  // cloneNode pada <canvas> menghasilkan canvas kosong; salin isi pixelnya secara manual
  const cloneWithCanvases = (node) => {
    const clone = node.cloneNode(true);
    const src = node.querySelectorAll('canvas');
    const dst = clone.querySelectorAll('canvas');
    src.forEach((c, i) => {
      if (dst[i]) {
        dst[i].width = c.width;
        dst[i].height = c.height;
        dst[i].getContext('2d').drawImage(c, 0, 0);
      }
    });
    return clone;
  };

  useEffect(() => { fetchItems(); }, []);
  useEffect(() => {
    if (tab === 'team' && team.length === 0) fetchTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await callApi('QC_LIST_ITEMS', { search, type: typeFilter });
      if (res.status === 'success') setItems(res.data || []);
    } catch { showNotice('Gagal memuat data QC dari server.', 'error'); }
    finally { setIsLoading(false); }
  }, [search, typeFilter]);

  useEffect(() => {
    const t = setTimeout(fetchItems, 350);
    return () => clearTimeout(t);
  }, [search, typeFilter, fetchItems]);

  const fetchTeam = async () => {
    const res = await callApi('QC_TEAM');
    if (res.status === 'success') setTeam(res.data || []);
  };

  // ====== Form create/edit ======
  const openCreate = (type) => {
    if (type === 'packaging') return showNotice('Tipe Packaging Upright akan tersedia segera.', 'error');
    setEditItem(null);
    setFormType(type);
    setFormValues({ status_item: type === 'bundle' ? 'InChecking' : 'In Checking', qc_process: 'Unchecking', shift: '1' });
    setFormPin('');
    setFormOpen(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setFormType(item.type);
    setFormValues({ ...(item.data || {}), status_item: normalizeFgStatus(item.type, item.status_item), qc_process: item.qc_process, inspector: item.inspector || '', note: item.note || '' });
    setFormPin('');
    setFormOpen(true);
  };

  const setVal = (k, v) => setFormValues((p) => ({ ...p, [k]: v }));

  const submitForm = async (e) => {
    e.preventDefault();
    const fields = FIELDS_PER_TYPE[formType];
    for (const f of fields) {
      if (f.req && !String(formValues[f.k] ?? '').trim())
        return showNotice(`Field "${f.label}" wajib diisi!`, 'error');
    }
    if (!editItem && !/^\d{4,6}$/.test(formPin))
      return showNotice('PIN akses harus angka 4-6 digit!', 'error');
    if (editItem && formPin && !/^\d{4,6}$/.test(formPin))
      return showNotice('PIN baru harus angka 4-6 digit!', 'error');

    setIsSubmitting(true);
    try {
      // Pisahkan field umum dari data dinamis per tipe
      const { status_item, qc_process, inspector, note, ...dataFields } = formValues;
      const payload = {
        type: formType,
        data: dataFields,
        status_item: status_item || 'In Checking',
        qc_process: qc_process || 'Unchecking',
        inspector: inspector || '',
        note: note || '',
        ...(formPin ? { pin: formPin } : {}),
      };
      const res = editItem
        ? await callApi('QC_UPDATE_ITEM', { id: editItem.id, ...payload })
        : await callApi('QC_CREATE_ITEM', payload);

      if (res.status === 'success') {
        showNotice(editItem ? 'Item QC berhasil diperbarui!' : `Barcode QC berhasil dibuat: ${res.data.code}`);
        setFormOpen(false);
        setPreviewItem(res.data); // langsung tampilkan label untuk dicetak
        fetchItems();
      } else {
        showNotice(res.message, 'error');
      }
    } catch { showNotice('Gagal menyimpan ke server.', 'error'); }
    finally { setIsSubmitting(false); }
  };

  // ====== Cetak ======
  const applyPaper = (mm) => {
    const v = Number(mm) || 80;
    setPaperMm(v);
    localStorage.setItem(PAPER_LS_KEY, String(v));
  };

  const doPrint = () => {
    if (!labelRef.current) return;
    const root = document.getElementById('qc-print-root');
    // Container harus tidak display:none saat print, kalau tidak kertas keluar kosong
    root.classList.remove('hidden');
    root.innerHTML = '';
    const clone = cloneWithCanvases(labelRef.current);
    clone.style.width = `${paperMm}mm`;
    root.appendChild(clone);
    document.documentElement.style.setProperty('--qc-paper', `${paperMm}mm`);
    const sembunyikanLagi = () => {
      root.classList.add('hidden');
      window.removeEventListener('afterprint', sembunyikanLagi);
    };
    window.addEventListener('afterprint', sembunyikanLagi);
    window.print();
  };

  // Download label sebagai PDF dengan lebar halaman persis ukuran kertas yang diatur
  const doDownloadPdf = async () => {
    if (!labelRef.current || !previewItem) return;
    setIsDownloading(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      // Render kloningan di container off-screen agar bebas pengaruh tema/modal
      const off = document.createElement('div');
      off.style.cssText = `position:fixed;left:-9999px;top:0;background:#ffffff;width:${paperMm}mm;`;
      const clone = cloneWithCanvases(labelRef.current);
      clone.style.width = '100%';
      off.appendChild(clone);
      document.body.appendChild(off);

      const canvas = await html2canvas(off, { scale: 3, backgroundColor: '#ffffff' });
      document.body.removeChild(off);

      const tinggiMm = (canvas.height / canvas.width) * paperMm;
      const pdf = new jsPDF({ unit: 'mm', format: [paperMm, tinggiMm], orientation: 'portrait' });
      // JPEG 92% jauh lebih ringan dari PNG (label dominan putih/hitam), tetap tajam untuk QR & teks
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, paperMm, tinggiMm);
      pdf.save(`Label-${previewItem.code}.pdf`);
    } catch (err) {
      showNotice('Gagal membuat PDF: ' + err.message, 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const qrValueFor = (item) => `${window.location.origin}/qc/scan/${item.code}`;

  const itemTitle = (item) => {
    const d = item.data || {};
    if (item.type === 'bundle') return d.product_name || item.code;
    if (item.type === 'coil') return d.no_coil || item.code;
    return item.code;
  };
  const itemSubtitle = (item) => {
    const d = item.data || {};
    if (item.type === 'bundle') return `SO ${d.so_number || '-'} · Bndl ${d.bundle_no || '-'}/${d.total_bundles || '-'}`;
    if (item.type === 'coil') return `Supplier: ${d.supplier || '-'}${d.type_coil ? ` · ${d.type_coil}` : ''}`;
    return '';
  };

  // ====== Render ======
  return (
    <div className="relative">

      {/* Toast notifikasi */}
      <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[70] transition-all duration-300 ${notice.show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10 pointer-events-none'}`}>
        <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl shadow-xl border text-sm font-medium ${notice.type === 'error' ? 'bg-red-50 dark:bg-red-900/90 border-red-200 text-red-600 dark:text-red-100' : 'bg-green-50 dark:bg-green-900/90 border-green-200 text-green-600 dark:text-green-100'}`}>
          {notice.type === 'error' ? <X size={18} /> : <CircleCheck size={18} />}
          <span>{notice.message}</span>
        </div>
      </div>

      {/* ==== NAVIGASI PILL OVAL TRANSPARAN ====
           z-10 (di bawah overlay z-20 & sidebar z-30) agar TERTUTUP sidebar saat burger menu mobile dibuka */}
      <div className="sticky top-0 z-10 -mx-4 lg:-mx-8 px-4 lg:px-8 pt-1 pb-3 print:hidden">
        <nav className="w-full max-w-md mx-auto rounded-full px-2 py-1.5 flex items-center justify-center shadow-sm bg-white/50 dark:bg-gray-800/50 backdrop-blur-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1 sm:gap-2 text-sm font-medium tracking-wide">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: PieChart },
              { id: 'barcode', label: 'QC Barcode', icon: QrCode },
              { id: 'team', label: 'QC Team', icon: Users },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 sm:px-5 py-1.5 rounded-full transition-all duration-200 flex items-center gap-1.5 ${
                  tab === t.id
                    ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm border border-gray-200/50 dark:border-gray-600'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* ==== TAB: DASHBOARD (placeholder) ==== */}
      {tab === 'dashboard' && (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 max-w-sm w-full">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <PieChart size={28} />
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Dashboard Analytics</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Statistik dan performa QC akan ditampilkan di sini.</p>
          </div>
        </div>
      )}

      {/* ==== TAB: QC BARCODE ==== */}
      {tab === 'barcode' && (
        <div className="pb-24">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4 mt-2">
            <div className="flex-1 flex items-center gap-2 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-sm">
              <Search size={16} className="text-gray-400" />
              <input
                type="text"
                placeholder="Cari kode, produk, no coil..."
                className="w-full outline-none text-sm bg-transparent text-gray-900 dark:text-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-sm">
              <Filter size={16} className="text-gray-400" />
              <select
                className="outline-none text-sm bg-transparent text-gray-900 dark:text-white"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">Semua tipe label</option>
                <option value="bundle">Bundle Info</option>
                <option value="coil">QC Koil</option>
              </select>
            </div>
          </div>

          {/* Tabel daftar item */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
            <div className="hidden md:grid grid-cols-[1.2fr_2fr_1.5fr_1fr_auto] p-3 text-xs font-bold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 uppercase">
              <div>Tipe</div><div>Informasi Item</div><div>Status QC</div><div>Tanggal</div><div className="text-right">Aksi</div>
            </div>

            {isLoading ? (
              <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-aira-cyan" /></div>
            ) : items.length === 0 ? (
              <div className="p-10 text-center text-gray-500 dark:text-gray-400">
                <PackageOpen size={36} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">Belum ada barcode QC. Buat lewat tombol + di kiri bawah.</p>
              </div>
            ) : items.map((item) => {
              const meta = TYPE_META[item.type];
              return (
                <div key={item.id} className="grid grid-cols-1 md:grid-cols-[1.2fr_2fr_1.5fr_1fr_auto] p-4 border-b border-gray-100 dark:border-gray-700 items-center hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors gap-2">
                  <div className="flex items-center gap-2">
                    <meta.icon size={16} style={{ color: meta.color }} />
                    <span className="text-xs font-bold uppercase" style={{ color: meta.color }}>{meta.label}</span>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-800 dark:text-white break-all">{itemTitle(item)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{itemSubtitle(item)} · {item.code}</div>
                  </div>
                  <div className="flex flex-col gap-1 items-start">
                    <div className="flex gap-1 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${STATUS_ITEM_BADGE[item.status_item] || ''}`}>{item.status_item}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${item.qc_process === 'Passes' ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800' : 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'}`}>{item.qc_process}</span>
                      {item.locked && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-800 text-white dark:bg-gray-600 flex items-center gap-1"><Lock size={9} /> Terkunci</span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-700 dark:text-gray-300 font-medium flex items-center gap-1">
                      {item.inspector ? <><UserCheck size={12} className="text-green-500" /> Insp: {item.inspector}</> : <><UserX size={12} className="text-gray-400" /> <span className="italic text-gray-400">Belum diisi</span></>}
                    </div>
                    {item.scan_updated_at && (
                      <div className="text-[10px] text-gray-400 dark:text-gray-500">Dicek: {fmtCheckDate(item)}</div>
                    )}
                    {item.note && (
                      <div className="text-[10px] text-gray-400 dark:text-gray-500 max-w-[220px] truncate" title={item.note}>📝 {item.note}</div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(item.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                  <div className="flex justify-start md:justify-end gap-1">
                    <button onClick={() => openEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded border border-transparent hover:border-blue-200 dark:hover:border-blue-800" title="Edit Data"><Pen size={14} /></button>
                    <button onClick={() => setPreviewItem(item)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded" title="Print"><Printer size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==== TAB: QC TEAM ==== */}
      {tab === 'team' && (
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
            <Users size={22} className="text-indigo-500" /> Direktori QC Team
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 -mt-4 mb-6">Pengguna yang memiliki akses modul QC (diatur lewat RBAC).</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {team.length === 0 ? (
              <div className="col-span-full text-center text-gray-500 dark:text-gray-400 text-sm py-8">Belum ada anggota tim QC selain Developer.</div>
            ) : team.map((m) => (
              <div key={m.id} className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition">
                <div className="flex items-center gap-4">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt={m.nama} className="w-12 h-12 rounded-full object-cover border border-indigo-100 dark:border-indigo-800" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold text-lg border border-indigo-100 dark:border-indigo-800">
                      {(m.nama || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-gray-800 dark:text-white truncate">{m.nama}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">{m.role}</div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <AtSign size={13} className="text-indigo-400 flex-shrink-0" />
                    <span className="truncate">{m.username ? `@${m.username}` : '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Mail size={13} className="text-indigo-400 flex-shrink-0" />
                    <span className="truncate">{m.email || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Phone size={13} className="text-indigo-400 flex-shrink-0" />
                    <span className="truncate">{m.phone || '-'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==== FAB TOMBOL BUAT BARCODE ==== */}
      {tab === 'barcode' && (
        <div className="fixed bottom-6 left-6 lg:left-[19.5rem] group z-10 print:hidden">
          <div className="absolute bottom-12 left-0 pb-4 flex flex-col-reverse gap-3 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all duration-300 delay-100 group-hover:delay-0 transform translate-y-4 group-hover:translate-y-0 w-max">
            {Object.entries(TYPE_META).map(([key, meta]) => (
              <button
                key={key}
                onClick={() => openCreate(key)}
                disabled={key === 'packaging'}
                className={`flex items-center gap-3 bg-white dark:bg-gray-800 shadow-xl rounded-full py-2 px-4 text-sm font-bold transition border-2 ${
                  key === 'packaging'
                    ? 'border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-60'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                style={key === 'packaging' ? undefined : { borderColor: meta.color }}
              >
                <meta.icon size={16} style={{ color: key === 'packaging' ? undefined : meta.color }} />
                {meta.longLabel}{key === 'packaging' && ' (Segera)'}
              </button>
            ))}
          </div>
          <button
            className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl text-white text-2xl transition-transform group-hover:rotate-45"
            style={{ background: 'linear-gradient(135deg, #DB3A22, #F3A230)' }}
            title="Buat barcode baru"
          >
            <Plus size={24} />
          </button>
        </div>
      )}

      {/* ==== MODAL FORM CREATE/EDIT ==== */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 print:hidden">
          <div className="bg-white dark:bg-gray-800 w-full max-w-lg max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-2xl">
            <div className="border-t-4 rounded-t-2xl px-5 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shrink-0" style={{ borderColor: TYPE_META[formType].color }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center"><QrCode size={16} className="text-gray-600 dark:text-gray-300" /></div>
                <div>
                  <div className="font-bold text-sm text-gray-800 dark:text-white">{editItem ? `Edit: ${editItem.code}` : 'Barcode baru'}</div>
                  <div className="text-[11.5px] text-gray-500 dark:text-gray-400 font-medium">{TYPE_META[formType].longLabel}</div>
                </div>
              </div>
              <button onClick={() => setFormOpen(false)} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
            </div>

            <form onSubmit={submitForm} className="p-5 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-3">
                {FIELDS_PER_TYPE[formType].map((f) => (
                  <label key={f.k} className={`block mb-3 ${f.half ? '' : 'col-span-2'}`}>
                    <div className="text-xs font-bold text-gray-500 dark:text-gray-300 mb-1">
                      {f.label} {f.req && <span className="text-red-500">*</span>}
                    </div>
                    {f.type === 'select' ? (
                      <select className={inputCls} value={formValues[f.k] || ''} onChange={(e) => setVal(f.k, e.target.value)}>
                        {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : f.type === 'textarea' ? (
                      <textarea rows={2} className={inputCls} placeholder={f.ph} value={formValues[f.k] || ''} onChange={(e) => setVal(f.k, e.target.value)} />
                    ) : (
                      <input type={f.type || 'text'} className={inputCls} placeholder={f.ph} value={formValues[f.k] || ''} onChange={(e) => setVal(f.k, e.target.value)} />
                    )}
                  </label>
                ))}

                {/* Status awal / status item */}
                <label className="block mb-3">
                  <div className="text-xs font-bold text-gray-500 dark:text-gray-300 mb-1">Status Item <span className="text-red-500">*</span></div>
                  <select className={`${inputCls} font-medium`} value={formValues.status_item || (formType === 'bundle' ? 'InChecking' : 'In Checking')} onChange={(e) => setVal('status_item', e.target.value)}>
                    {statusOptionsFor(formType, formValues.status_item).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label className="block mb-3">
                  <div className="text-xs font-bold text-gray-500 dark:text-gray-300 mb-1">QC Process <span className="text-red-500">*</span></div>
                  <select className={`${inputCls} font-medium`} value={formValues.qc_process || 'Unchecking'} onChange={(e) => setVal('qc_process', e.target.value)}>
                    <option value="Unchecking">Unchecking</option>
                    <option value="Passes">Passes</option>
                  </select>
                </label>
                <label className="block mb-3">
                  <div className="text-xs font-bold text-gray-500 dark:text-gray-300 mb-1">Inspector QC</div>
                  <input type="text" className={inputCls} placeholder="Kosongkan jika belum" value={formValues.inspector || ''} onChange={(e) => setVal('inspector', e.target.value)} />
                </label>
                <label className="block mb-3 col-span-2">
                  <div className="text-xs font-bold text-gray-500 dark:text-gray-300 mb-1">Catatan Inspeksi</div>
                  <textarea rows={2} className={inputCls} placeholder="Catatan dari inspector saat pengecekan (opsional)" value={formValues.note || ''} onChange={(e) => setVal('note', e.target.value)} />
                </label>
                <label className="block mb-3 col-span-2">
                  <div className="text-xs font-bold text-gray-500 dark:text-gray-300 mb-1">
                    {editItem ? 'Ganti PIN Akses (kosongkan jika tetap)' : 'Set PIN Akses (Untuk Scanner)'} <span className="text-red-500">*</span>
                  </div>
                  <input type="password" className={`${inputCls} bg-orange-50 dark:bg-orange-900/20`} placeholder="Angka 4-6 digit" maxLength={6} value={formPin} onChange={(e) => setFormPin(e.target.value)} autoComplete="new-password" />
                </label>
              </div>
            </form>

            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 shrink-0 flex gap-2 rounded-b-2xl">
              <button onClick={() => setFormOpen(false)} className="flex-1 rounded-lg py-2.5 text-sm font-bold border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Batal</button>
              <button
                onClick={submitForm}
                disabled={isSubmitting}
                className="flex-1 rounded-lg py-2.5 text-sm font-bold text-white flex justify-center items-center gap-2 shadow hover:opacity-90 transition disabled:opacity-50"
                style={{ backgroundColor: TYPE_META[formType].color }}
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
                {editItem ? 'Simpan Perubahan' : 'Generate Barcode'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==== MODAL PREVIEW & CETAK LABEL ==== */}
      {previewItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 print:hidden">
          <div className="bg-gray-100 dark:bg-gray-900 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <div className="text-[12.5px] font-bold text-green-600 dark:text-green-400 flex items-center gap-1.5">
                <CircleCheck size={14} /> Label Siap Dicetak ({paperMm}mm)
              </div>
              <button onClick={() => setPreviewItem(null)} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto flex justify-center py-6 px-2 custom-scrollbar">
              <div ref={labelRef} className="bg-white shadow-md border border-gray-300" style={{ width: `${paperMm}mm` }}>
                {previewItem.type === 'coil'
                  ? <CoilLabel item={previewItem} qrValue={qrValueFor(previewItem)} />
                  : <BundleLabel item={previewItem} qrValue={qrValueFor(previewItem)} />}
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 shrink-0 space-y-3">
              {/* Pengaturan lebar kertas */}
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-gray-500 dark:text-gray-400 uppercase">Lebar kertas:</span>
                {PAPER_OPTIONS.map((mm) => (
                  <button
                    key={mm}
                    onClick={() => applyPaper(mm)}
                    className={`px-2.5 py-1 rounded-full font-bold border transition ${paperMm === mm ? 'bg-aira-navy dark:bg-aira-cyan text-white dark:text-gray-900 border-transparent' : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-300 hover:border-aira-cyan'}`}
                  >{mm}mm</button>
                ))}
                <input
                  type="number"
                  min={30}
                  max={210}
                  className="w-16 px-2 py-1 rounded-full border border-gray-300 dark:border-gray-600 bg-transparent text-gray-700 dark:text-gray-200 font-bold"
                  value={paperMm}
                  onChange={(e) => applyPaper(e.target.value)}
                  title="Ukuran custom (mm)"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPreviewItem(null)} className="flex-1 rounded-lg py-2.5 text-sm font-bold border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-300">Kembali</button>
                <button
                  onClick={doDownloadPdf}
                  disabled={isDownloading}
                  className="flex-1 rounded-lg py-2.5 text-sm font-bold text-white bg-gray-900 dark:bg-gray-600 hover:bg-black dark:hover:bg-gray-500 flex items-center justify-center gap-2 shadow disabled:opacity-50"
                >
                  {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Download PDF
                </button>
                <button onClick={doPrint} className="flex-1 rounded-lg py-2.5 text-sm font-bold text-white bg-aira-navy dark:bg-aira-cyan dark:text-gray-900 hover:bg-black flex items-center justify-center gap-2 shadow">
                  <Printer size={16} /> Cetak Label
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Root khusus cetak (di luar modal, disembunyikan) */}
      <div id="qc-print-root" className="hidden"></div>
    </div>
  );
}
