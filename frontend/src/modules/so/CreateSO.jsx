import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  ArrowLeft,
  Save,
  UploadCloud,
  FileSpreadsheet,
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Building,
  Building2,
  Briefcase,
  Hash,
  MapPin,
  UserRound,
  Boxes,
  Wallet,
  Rocket,
  CalendarDays,
  BadgeCheck,
  StickyNote,
  Loader2,
  Package,
  Layers,
  RefreshCw,
  PlaneTakeoff,
  DollarSign // <-- INI YANG TERLEWAT SEBELUMNYA 🙏
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Custom Global Scrollbar Style (Premium Inset Design for Dark Mode)
// ---------------------------------------------------------------------------
const GlobalScrollbarStyle = () => (
  <style>{`
    .custom-scrollbar::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: #f8fafc;
      border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background-color: #cbd5e1;
      border-radius: 10px;
      border: 2px solid #f8fafc;
    }
    /* Dark mode enhancements */
    .dark .custom-scrollbar::-webkit-scrollbar-track {
      background: #1e293b;
      border-radius: 10px;
    }
    .dark .custom-scrollbar::-webkit-scrollbar-thumb {
      background-color: #475569;
      border: 2px solid #1e293b; /* Creates a nice floating inset effect */
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background-color: #94a3b8;
    }
    .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background-color: #64748b;
    }
  `}</style>
);

// ---------------------------------------------------------------------------
// Accent config
// ---------------------------------------------------------------------------
const ACCENTS = {
  navy: {
    text: 'text-[#0F3B6C] dark:text-blue-400',
    bg: 'bg-[#0F3B6C]/10 dark:bg-blue-400/10',
    bar: 'bg-[#0F3B6C] dark:bg-blue-400',
    solid: 'bg-[#0F3B6C] dark:bg-[#0084C9] hover:bg-[#0a2c52] dark:hover:bg-cyan-600',
  },
  blue: {
    text: 'text-[#0084C9] dark:text-cyan-400',
    bg: 'bg-[#0084C9]/10 dark:bg-cyan-400/10',
    bar: 'bg-[#0084C9] dark:bg-cyan-400',
  },
  teal: {
    text: 'text-[#0EA5A5] dark:text-teal-400',
    bg: 'bg-[#0EA5A5]/10 dark:bg-teal-400/10',
    bar: 'bg-[#0EA5A5] dark:bg-teal-400',
  },
};

// ---------------------------------------------------------------------------
// Field definitions
// ---------------------------------------------------------------------------
const FIELD_GROUPS = [
  {
    key: 'utama',
    title: 'Informasi Utama',
    eyebrow: 'Master Data',
    sectionIcon: Building2,
    accent: ACCENTS.navy,
    cols: 'sm:grid-cols-2 lg:grid-cols-4',
    fields: [
      { key: 'customerName', label: 'Nama Customer', icon: Building, placeholder: 'Hotel Mulia' },
      { key: 'projectName', label: 'Nama Project', icon: Briefcase, placeholder: 'Renovasi Kamar Suite' },
      { key: 'companyName', label: 'Nama PT', icon: Building2, placeholder: 'PT Mulia Graha Perkasa' },
      { key: 'salesName', label: 'Nama Sales', icon: UserRound, placeholder: 'Rendra Wijaya' },
      { key: 'projectNumber', label: 'Nomor Project', icon: Hash, mono: true, placeholder: 'PRJ/2026/07/0142' },
      { key: 'soNumber', label: 'Nomor SO', icon: Hash, mono: true, placeholder: 'SO-2026-0791' },
      { key: 'address', label: 'Alamat', icon: MapPin, placeholder: 'Jl. Asia Afrika No. 8, Senayan, Jakarta Pusat', span: 'sm:col-span-2 lg:col-span-2' },
    ],
  },
  {
    key: 'lainnya',
    title: 'Detail Lainnya',
    eyebrow: 'Timeline & Budget',
    sectionIcon: CalendarDays,
    accent: ACCENTS.teal,
    cols: 'sm:grid-cols-2 lg:grid-cols-3',
    fields: [
      { key: 'palletCount', label: 'Total Pallet Posisi', icon: Boxes, placeholder: '18 Pallet' },
      { key: 'budget', label: 'Potential Budget Material', icon: Wallet, placeholder: 'Rp 842.500.000' },
      { key: 'startProduction', label: 'Start Produksi', icon: Rocket, type: 'date' },
      { key: 'firstDelivery', label: 'Tgl Kiriman Pertama', icon: CalendarDays, type: 'date' },
      { key: 'startInstallation', label: 'Tgl Mulai Instalasi', icon: CalendarDays, type: 'date' },
      { key: 'targetInstallation', label: 'Target Selesai Instalasi', icon: BadgeCheck, type: 'date' },
      { key: 'description', label: 'Keterangan', icon: StickyNote, type: 'textarea', placeholder: 'Catatan tambahan seputar project ini...', span: 'sm:col-span-2 lg:col-span-3' },
    ],
  },
];

const ALL_FIELDS = FIELD_GROUPS.flatMap((g) => g.fields);
const INITIAL_FORM = ALL_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const toISODate = (value) => {
  if (!value) return '';
  if (value instanceof Date && !isNaN(value)) return value.toISOString().split('T')[0];
  const parsed = new Date(value);
  return !isNaN(parsed) ? parsed.toISOString().split('T')[0] : '';
};

const formatIDR = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);
const formatRMB = (amount) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 0 }).format(amount || 0);
const formatNumber = (num) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(num || 0);

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------
const Panel = ({ children, className = '' }) => (
  <section className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors duration-300 p-6 sm:p-7 ${className}`}>
    {children}
  </section>
);

const SectionHeading = ({ icon: Icon, accent, eyebrow, title, action }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
    <div className="flex items-center gap-3 min-w-0">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent.bg}`}>
        <Icon size={18} className={accent.text} />
      </div>
      <div className="min-w-0">
        <p className={`text-[11px] font-semibold uppercase tracking-wider ${accent.text}`}>{eyebrow}</p>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">{title}</h2>
      </div>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

const FormField = ({ field, value, onChange, isMatched }) => {
  const Icon = field.icon;
  const baseInputClass =
    'w-full rounded-xl border bg-white dark:bg-gray-700 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0084C9]/20 focus:border-[#0084C9] transition-all ' +
    (isMatched ? 'border-emerald-300 dark:border-emerald-600 bg-emerald-50/10 dark:bg-emerald-900/10' : 'border-gray-200 dark:border-gray-600');

  const displayValue = field.key === 'budget' && typeof value === 'number' ? formatIDR(value) : value;

  return (
    <div className={field.span || ''}>
      <label className="flex items-center justify-between mb-1.5 gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
          <Icon size={13} className="text-gray-400 dark:text-gray-500" /> {field.label}
        </span>
        {isMatched && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-md shrink-0">
            <Sparkles size={10} /> Dari Excel
          </span>
        )}
      </label>

      {field.type === 'textarea' ? (
        <textarea rows={3} value={displayValue} onChange={(e) => onChange(field.key, e.target.value)} placeholder={field.placeholder} className={`${baseInputClass} resize-none`} />
      ) : (
        <input type={field.type === 'date' ? 'date' : 'text'} value={displayValue} onChange={(e) => onChange(field.key, e.target.value)} placeholder={field.placeholder} className={`${baseInputClass} ${field.mono ? 'font-mono' : ''}`} />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Excel Upload & Extraction Card
// ---------------------------------------------------------------------------
const ExcelUploadCard = ({ onParsed }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);
  const [fileName, setFileName] = useState('');
  
  const [materialsImport, setMaterialsImport] = useState([]);
  const [materialsLocal, setMaterialsLocal] = useState([]);
  const [totals, setTotals] = useState({ weight: 0, priceImportRMB: 0, priceLocalIDR: 0, pallet: 0, budgetIDR: 0 });

  const inputRef = useRef(null);

  const processFile = useCallback((file) => {
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      alert('Format tidak didukung. Unggah file .xlsx atau .xls.');
      return;
    }

    setFileName(file.name);
    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });

        let tempImport = {};
        let tempLocal = {};
        let gPallet = 0;
        let gWeight = 0;
        let gPriceImport = 0;
        let gPriceLocal = 0;
        let gBudget = 0;
        let custName = "";
        let projNum = "";

        wb.SheetNames.forEach(sheetName => {
          const upperSheet = sheetName.toUpperCase();
          
          // --- 1. Ekstrak Total Budget & Pallet ---
          if (upperSheet === 'CONSOLIDATED') {
            const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
            data.forEach(row => {
              if (Array.isArray(row)) {
                const totalIndex = row.findIndex(cell => String(cell).trim().toUpperCase() === 'TOTAL:');
                if (totalIndex !== -1) {
                  if (row[totalIndex + 1]) gPallet = parseFloat(row[totalIndex + 1]) || gPallet;
                  if (row[totalIndex + 9]) gBudget = parseFloat(row[totalIndex + 9]) || gBudget; // Diambil dari Selling Price IDR
                }
              }
            });
          } 
          
          // --- 2. Ekstrak Material BOQ ---
          else if (upperSheet.startsWith('BOQ-')) {
            const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
            let isLocalBlock = false; 

            if (!custName && !projNum && data.length > 0) {
              if (data[0] && data[0][1] === 'Customer Name') custName = data[0][2];
              if (data[0] && data[0][4] === 'Project Number') projNum = data[0][6];
            }

            for (let i = 0; i < data.length; i++) {
              const row = data[i];
              if (!row || row.length === 0) continue;

              const col0 = String(row[0]).trim().toUpperCase();
              const col1 = String(row[1]).trim().toUpperCase();

              // Deteksi pergantian block (Import vs Local) berdasarkan Header
              if (col0 === 'QTY' || col1 === 'ARTICLE CODE') {
                const priceHeaderStr = String(row[10] || '').toUpperCase();
                if (priceHeaderStr.includes('IDR') || priceHeaderStr.includes('RP') || priceHeaderStr.includes('RUPIAH')) {
                  isLocalBlock = true;
                } else if (priceHeaderStr.includes('RMB') || priceHeaderStr.includes('CNY')) {
                  isLocalBlock = false;
                } else {
                  if (i > 15) isLocalBlock = true; // Fallback jika tidak ada tulisan mata uang
                }
                continue;
              }

              // Deteksi switch block manual berdasarkan row TOTAL-1:
              if (col0.startsWith('TOTAL')) {
                if (col0.includes('1')) isLocalBlock = true;
                continue;
              }

              const qtyVal = parseFloat(row[0]);
              if (isNaN(qtyVal)) continue;

              const articleCode = row[1] || '-';
              const dim1 = row[2] || '-';
              const unitWeight = parseFloat(row[9]) || 0;
              const unitPrice = parseFloat(row[10]) || 0;
              const rowTotalWeight = parseFloat(row[11]) || 0;
              const rowTotalPrice = parseFloat(row[12]) || 0;

              const key = `${articleCode}_${dim1}`;
              
              if (isLocalBlock) {
                if (!tempLocal[key]) tempLocal[key] = { articleCode, dim1, qty: 0, unitWeight, unitPrice, totalWeight: 0, totalPrice: 0 };
                tempLocal[key].qty += qtyVal;
                tempLocal[key].totalWeight += rowTotalWeight;
                tempLocal[key].totalPrice += rowTotalPrice;
                gPriceLocal += rowTotalPrice;
              } else {
                if (!tempImport[key]) tempImport[key] = { articleCode, dim1, qty: 0, unitWeight, unitPrice, totalWeight: 0, totalPrice: 0 };
                tempImport[key].qty += qtyVal;
                tempImport[key].totalWeight += rowTotalWeight;
                tempImport[key].totalPrice += rowTotalPrice;
                gPriceImport += rowTotalPrice;
              }
              
              gWeight += rowTotalWeight;
            }
          }
        });

        // Delay buatan 1.5 detik untuk Animasi
        setTimeout(() => {
          setMaterialsImport(Object.values(tempImport));
          setMaterialsLocal(Object.values(tempLocal));
          setTotals({ weight: gWeight, priceImportRMB: gPriceImport, priceLocalIDR: gPriceLocal, pallet: gPallet, budgetIDR: gBudget });
          setIsUploading(false);
          setIsUploaded(true);
          
          // Kirim data ke Form Induk
          const parsedUpdates = {};
          const matchedFields = [];
          if (custName) { parsedUpdates.customerName = custName; matchedFields.push('customerName'); }
          if (projNum) { parsedUpdates.projectNumber = projNum; matchedFields.push('projectNumber'); }
          if (gPallet) { parsedUpdates.palletCount = `${gPallet} Pallet`; matchedFields.push('palletCount'); }
          // Gunakan Grand Total Budget (jika 0, fallback ke akumulasi harga lokal)
          const finalBudget = gBudget || gPriceLocal; 
          if (finalBudget) { parsedUpdates.budget = finalBudget; matchedFields.push('budget'); }

          onParsed(parsedUpdates, matchedFields);
        }, 1500);

      } catch (err) {
        console.error(err);
        setIsUploading(false);
        alert("Gagal membaca file Excel. Pastikan format file tidak rusak.");
      }
    };
    reader.readAsBinaryString(file);
  }, [onParsed]);

  const clearFile = () => {
    setFileName('');
    setMaterialsImport([]);
    setMaterialsLocal([]);
    setTotals({ weight: 0, priceImportRMB: 0, priceLocalIDR: 0, pallet: 0, budgetIDR: 0 });
    setIsUploaded(false);
    if (inputRef.current) inputRef.current.value = '';
    onParsed({ budget: '', palletCount: '' }, []);
  };

  return (
    <Panel>
      <GlobalScrollbarStyle />
      
      <SectionHeading
        icon={FileSpreadsheet} accent={ACCENTS.blue} eyebrow="Import Cepat" title="Isi Otomatis dari Excel"
        action={
          !isUploaded && !isUploading && (
            <a href="https://drive.google.com/file/d/1_d2sHTcCRZjVumS0UKw44h_n0FE8AnK5/view" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/60 hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2 rounded-lg transition-colors border border-gray-200 dark:border-gray-600">
              <Download size={13} /> <span className="hidden sm:inline">Unduh Template</span>
            </a>
          )
        }
      />

      {/* STATE 1: Minta Upload */}
      {!isUploaded && !isUploading && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); processFile(e.dataTransfer.files?.[0]); }}
          onClick={() => inputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
            isDragging ? 'border-[#0084C9] bg-[#0084C9]/5 dark:bg-cyan-400/10' : 'border-gray-200 dark:border-gray-600 hover:border-[#0084C9] bg-gray-50 dark:bg-gray-700/20'
          }`}
        >
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => processFile(e.target.files?.[0])} />
          <UploadCloud size={32} className="mx-auto text-[#0084C9] dark:text-cyan-400 mb-3" />
          <p className="text-base font-bold text-gray-700 dark:text-gray-200">Tarik & Lepas File BOQ Excel di sini</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-4">Mendukung format .xlsx dan .xls</p>
          <span className="inline-block bg-[#0F3B6C] text-white px-5 py-2 rounded-lg text-xs font-semibold shadow-sm">Pilih File</span>
        </div>
      )}

      {/* STATE 2: Loading Extraction */}
      {isUploading && (
        <div className="border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-2xl p-12 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gray-200 dark:bg-gray-700"><div className="h-full bg-[#0084C9] animate-[pulse_1s_ease-in-out_infinite]" style={{width: '60%'}}></div></div>
          <div className="relative mb-5">
            <div className="absolute inset-0 bg-[#0084C9] rounded-full animate-ping opacity-20"></div>
            <div className="bg-[#0F3B6C] text-white p-3 rounded-full relative z-10 shadow-lg"><Loader2 size={28} className="animate-spin" /></div>
          </div>
          <p className="text-gray-800 dark:text-white font-bold text-base">Mengekstrak Data Excel...</p>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1 text-center">Memilah material import & lokal, pallet, dan nilai project</p>
        </div>
      )}

      {/* STATE 3: Berhasil Diekstrak (Tampil Summary & Tabel Terpisah) */}
      {isUploaded && !isUploading && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
          
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 shadow-sm">
              <div className="p-2.5 bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 rounded-lg"><Package size={20} /></div>
              <div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">Total Pallet</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{totals.pallet}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 shadow-sm">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-[#0F3B6C] dark:text-blue-400 rounded-lg"><Layers size={20} /></div>
              <div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">Total Weight</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatNumber(totals.weight)} <span className="text-[10px] font-normal">kg</span></p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3.5 shadow-sm bg-amber-50/20 dark:bg-amber-900/10">
              <div className="p-2.5 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-lg"><PlaneTakeoff size={20} /></div>
              <div>
                <p className="text-[11px] text-amber-600 dark:text-amber-500 font-medium">Nilai Material Import</p>
                <p className="text-lg font-bold text-amber-900 dark:text-amber-400">{formatRMB(totals.priceImportRMB)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3.5 shadow-sm bg-emerald-50/20 dark:bg-emerald-900/10">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg"><DollarSign size={20} /></div>
              <div>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-500 font-medium">Nilai Material Lokal</p>
                <p className="text-lg font-bold text-emerald-900 dark:text-emerald-400">{formatIDR(totals.priceLocalIDR)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {/* Tabel Material IMPORT */}
            {materialsImport.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 border-l-4 border-[#0F3B6C] pl-2">
                  <PlaneTakeoff size={16} className="text-[#0F3B6C] dark:text-blue-400" /> Daftar Material Import (RMB)
                </h3>
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700/80 z-10">
                        <tr className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-600">
                          <th className="px-4 py-3 font-bold">Article Code</th>
                          <th className="px-4 py-3 font-bold">Dim 1</th>
                          <th className="px-4 py-3 font-bold text-center">QTY</th>
                          <th className="px-4 py-3 font-bold text-right">Unit Wght</th>
                          <th className="px-4 py-3 font-bold text-right">Unit Price (RMB)</th>
                          <th className="px-4 py-3 font-bold text-right text-teal-600 dark:text-teal-400">Total Wght</th>
                          <th className="px-4 py-3 font-bold text-right text-[#0F3B6C] dark:text-blue-400">Total Price (RMB)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {materialsImport.map((m, i) => (
                          <tr key={i} className="text-xs bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                            <td className="px-4 py-3 font-bold text-[#0F3B6C] dark:text-blue-400">{m.articleCode}</td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{m.dim1}</td>
                            <td className="px-4 py-3 font-bold text-center text-gray-800 dark:text-gray-200">{m.qty}</td>
                            <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{formatNumber(m.unitWeight)}</td>
                            <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{formatNumber(m.unitPrice)}</td>
                            <td className="px-4 py-3 text-right font-bold text-teal-600 dark:text-teal-400">{formatNumber(m.totalWeight)}</td>
                            <td className="px-4 py-3 text-right font-bold text-[#0F3B6C] dark:text-blue-400">{formatRMB(m.totalPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Tabel Material LOKAL */}
            {materialsLocal.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 border-l-4 border-emerald-500 pl-2">
                  <MapPin size={16} className="text-emerald-600 dark:text-emerald-400" /> Daftar Material Lokal (IDR)
                </h3>
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700/80 z-10">
                        <tr className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-600">
                          <th className="px-4 py-3 font-bold">Article Code</th>
                          <th className="px-4 py-3 font-bold">Dim 1</th>
                          <th className="px-4 py-3 font-bold text-center">QTY</th>
                          <th className="px-4 py-3 font-bold text-right">Unit Wght</th>
                          <th className="px-4 py-3 font-bold text-right">Unit Price (IDR)</th>
                          <th className="px-4 py-3 font-bold text-right text-teal-600 dark:text-teal-400">Total Wght</th>
                          <th className="px-4 py-3 font-bold text-right text-emerald-600 dark:text-emerald-400">Total Price (IDR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {materialsLocal.map((m, i) => (
                          <tr key={i} className="text-xs bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                            <td className="px-4 py-3 font-bold text-emerald-700 dark:text-emerald-500">{m.articleCode}</td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{m.dim1}</td>
                            <td className="px-4 py-3 font-bold text-center text-gray-800 dark:text-gray-200">{m.qty}</td>
                            <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{formatNumber(m.unitWeight)}</td>
                            <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{formatNumber(m.unitPrice)}</td>
                            <td className="px-4 py-3 text-right font-bold text-teal-600 dark:text-teal-400">{formatNumber(m.totalWeight)}</td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatIDR(m.totalPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-4">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
              <CheckCircle2 size={15} /> Mengekstrak {materialsImport.length + materialsLocal.length} total material
            </div>
            <button onClick={clearFile} className="flex items-center gap-1.5 text-gray-500 hover:text-rose-600 dark:text-gray-400 dark:hover:text-rose-400 text-xs font-semibold transition-colors">
              <RefreshCw size={13} /> Ganti File Excel
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
};

// ---------------------------------------------------------------------------
// Page Main Structure
// ---------------------------------------------------------------------------
const CreateSO = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [matchedKeys, setMatchedKeys] = useState(new Set());

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setMatchedKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const handleParsed = (updates, matchedFields) => {
    setForm((prev) => ({ ...prev, ...updates }));
    setMatchedKeys((prev) => {
      const next = new Set(prev);
      matchedFields.forEach((k) => next.add(k));
      return next;
    });
  };

  const handleSave = () => {
    console.log('Menyimpan project baru:', form);
    navigate(`/so/detail/${form.soNumber || 'SO-BARU'}`);
  };

  return (
    <div className="w-full min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Header Hero Block */}
        <Panel className="!p-0 overflow-hidden">
          <div className="px-6 sm:px-7 py-5 sm:py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/so')}
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700/80 border border-gray-200 dark:border-gray-600 transition-all focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Buat Project (SO) Baru</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Isi formulir master data project di bawah ini</p>
              </div>
            </div>
            <button
              onClick={handleSave}
              className={`flex items-center justify-center gap-2 text-white px-6 py-2.5 rounded-xl font-semibold text-sm shadow-sm transition-all duration-200 active:scale-[0.98] shrink-0 ${ACCENTS.navy.solid}`}
            >
              <Save size={16} /> Simpan Project
            </button>
          </div>
        </Panel>

        {/* Excel import & Extract Area */}
        <ExcelUploadCard onParsed={handleParsed} />

        {/* Form groups (Auto filled) */}
        {FIELD_GROUPS.map((group) => (
          <Panel key={group.key}>
            <SectionHeading icon={group.sectionIcon} accent={group.accent} eyebrow={group.eyebrow} title={group.title} />
            <div className={`grid grid-cols-1 ${group.cols} gap-x-6 gap-y-5`}>
              {group.fields.map((field) => (
                <FormField key={field.key} field={field} value={form[field.key]} onChange={handleChange} isMatched={matchedKeys.has(field.key)} />
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
};

export default CreateSO;