import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  MessageSquare,
  Send,
  Building2,
  UserRound,
  Hash,
  Boxes,
  Wallet,
  CalendarDays,
  Rocket,
  Truck,
  Wrench,
  Factory,
  MapPin,
  Phone,
  Users,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  StickyNote,
  ClipboardList,
  Paintbrush,
  Cog,
  ShieldAlert,
  BadgeCheck,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Accent config — mirrors the color system used in DashboardSO.jsx so every
// module (Produksi / Pengiriman / Instalasi) stays visually consistent
// across light & dark mode.
// ---------------------------------------------------------------------------
const ACCENTS = {
  navy: {
    text: 'text-[#0F3B6C] dark:text-blue-400',
    bg: 'bg-[#0F3B6C]/10 dark:bg-blue-400/10',
    bar: 'bg-[#0F3B6C] dark:bg-blue-400',
    stroke: 'stroke-[#0F3B6C] dark:stroke-blue-400',
    solid: 'bg-[#0F3B6C] dark:bg-[#0084C9] hover:bg-[#0a2c52] dark:hover:bg-cyan-600',
  },
  blue: {
    text: 'text-[#0084C9] dark:text-cyan-400',
    bg: 'bg-[#0084C9]/10 dark:bg-cyan-400/10',
    bar: 'bg-[#0084C9] dark:bg-cyan-400',
    stroke: 'stroke-[#0084C9] dark:stroke-cyan-400',
  },
  teal: {
    text: 'text-[#0EA5A5] dark:text-teal-400',
    bg: 'bg-[#0EA5A5]/10 dark:bg-teal-400/10',
    bar: 'bg-[#0EA5A5] dark:bg-teal-400',
    stroke: 'stroke-[#0EA5A5] dark:stroke-teal-400',
  },
};

const STATUS_STYLES = {
  'In Progress':
    'bg-sky-50 dark:bg-sky-900/30 text-[#0084C9] dark:text-sky-400 ring-1 ring-inset ring-sky-100 dark:ring-sky-800',
};

const DONE_STYLES = (done) => {
  if (done >= 80) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30';
  if (done >= 40) return 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30';
  return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30';
};

const LEVEL_STYLES = {
  Tinggi: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30',
  Sedang: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30',
  Rendah: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30',
};

const STATUS_PILL = {
  diterima: {
    label: 'Diterima',
    Icon: CheckCircle2,
    className: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  },
  perjalanan: {
    label: 'Dalam Perjalanan',
    Icon: Truck,
    className: 'bg-sky-50 dark:bg-sky-900/30 text-[#0084C9] dark:text-sky-400',
  },
  dimuat: {
    label: 'Sedang Dimuat',
    Icon: Clock3,
    className: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  },
};

// ---------------------------------------------------------------------------
// Small primitives
// ---------------------------------------------------------------------------

// Renders note text, highlighting @mentions the way a tagged person would
// eventually be rendered once the tagging feature is wired up.
const NoteText = ({ text }) => {
  const parts = text.split(/(@[A-Za-z0-9_]+)/g);
  return (
    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} className="text-blue-500 dark:text-blue-400 font-semibold">
            {part}
          </span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </p>
  );
};

const SectionHeading = ({ icon: Icon, accent, eyebrow, title, action }) => (
  <div className="flex items-center justify-between mb-6 gap-3">
    <div className="flex items-center gap-3 min-w-0">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent.bg}`}>
        <Icon size={18} className={accent.text} />
      </div>
      <div className="min-w-0">
        <p className={`text-[11px] font-semibold uppercase tracking-wider ${accent.text}`}>{eyebrow}</p>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">{title}</h2>
      </div>
    </div>
    {action}
  </div>
);

const Panel = ({ children, className = '', innerRef }) => (
  <section
    ref={innerRef}
    className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors duration-300 p-6 sm:p-7 scroll-mt-6 ${className}`}
  >
    {children}
  </section>
);

// Radial progress ring — used for the three global KPIs, clickable to jump
// straight to the relevant block.
const RingProgress = ({ percent, accent, label, icon: Icon, onClick }) => {
  const size = 100;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2.5 group focus:outline-none"
      aria-label={`Lihat detail ${label}`}
    >
      <div
        className="relative rounded-full transition-transform duration-200 group-hover:scale-[1.04] group-active:scale-95"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" className="stroke-gray-100 dark:stroke-gray-700" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={accent.stroke}
            style={{ transition: 'stroke-dashoffset 700ms ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon size={14} className={`${accent.text} mb-0.5`} />
          <span className="text-base font-bold text-gray-900 dark:text-white leading-none">{percent}%</span>
        </div>
      </div>
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 text-center leading-tight group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
        {label}
      </span>
    </button>
  );
};

// Slim horizontal bar used inside table cells
const MiniBar = ({ percent, accent }) => (
  <div className="flex items-center gap-2 min-w-[112px]">
    <div className="h-1.5 flex-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
      <div className={`h-1.5 rounded-full ${accent.bar}`} style={{ width: `${percent}%` }} />
    </div>
    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 tabular-nums w-9 text-right">{percent}%</span>
  </div>
);

const StatusPill = ({ status }) => {
  const s = STATUS_PILL[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${s.className}`}>
      <s.Icon size={12} /> {s.label}
    </span>
  );
};

const InfoField = ({ icon: Icon, label, value, mono = false, className = '' }) => (
  <div className={`flex items-start gap-2.5 ${className}`}>
    <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-700/60 flex items-center justify-center shrink-0 mt-0.5">
      <Icon size={14} className="text-gray-400 dark:text-gray-400" />
    </div>
    <div className="min-w-0">
      <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-0.5">{label}</p>
      <p className={`font-semibold text-sm text-gray-800 dark:text-gray-100 leading-snug break-words ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Block 1 — Detail SO (header info / detail lain / progress global)
// ---------------------------------------------------------------------------
const HeroBlock = ({ id, onNavigateBack, onJump, refs }) => (
  <Panel className="!p-0 overflow-hidden">
    {/* --- Bagian Atas: Header Card --- */}
    <div className="px-6 sm:px-7 pt-5 pb-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <button
          onClick={onNavigateBack}
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 border border-gray-100 dark:border-gray-700 transition-colors"
          aria-label="Kembali ke Dashboard"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${STATUS_STYLES['In Progress']}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#0084C9] dark:bg-sky-400 animate-pulse" /> In Progress
          </span>
          <button
            className={`flex items-center gap-1.5 text-white px-3.5 py-2 rounded-xl font-medium text-sm shadow-sm transition-all duration-200 active:scale-[0.98] ${ACCENTS.navy.solid}`}
          >
            <Pencil size={13} /> Edit
          </button>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Hotel Mulia</h1>
      <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Renovasi Kamar Suite</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 mt-5">
        <InfoField icon={Building2} label="Nama PT" value="PT Mulia Graha Perkasa" />
        <InfoField icon={Hash} label="Nomor Project" value="PRJ/2026/07/0142" mono />
        <InfoField icon={Hash} label="Nomor SO" value={id} mono />
        <InfoField icon={UserRound} label="Nama Sales" value="Rendra Wijaya" />
        <InfoField icon={MapPin} label="Alamat" value="Jl. Asia Afrika No. 8, Senayan, Jakarta Pusat" className="sm:col-span-2 lg:col-span-4" />
      </div>
    </div>

    {/* --- Bagian Tengah: Detail Lainnya --- */}
    <div className="px-6 sm:px-7 py-6 border-t border-gray-100 dark:border-gray-700">
      <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Detail Lainnya</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        <InfoField icon={Boxes} label="Total Pallet Posisi" value="18 Pallet" />
        <InfoField icon={Wallet} label="Potential Budget Material" value="Rp 842.500.000" />
        <InfoField icon={Rocket} label="Start Produksi" value="18 Juli 2026" />
        <InfoField icon={CalendarDays} label="Tgl Kiriman Pertama" value="10 Agustus 2026" />
        <InfoField icon={CalendarDays} label="Tgl Mulai Instalasi" value="15 Agustus 2026" />
        <InfoField icon={BadgeCheck} label="Target Selesai Instalasi" value="30 Agustus 2026" />
      </div>

      <div className="mt-5 flex items-start gap-2.5">
        <StickyNote size={15} className="text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          <span className="font-semibold text-gray-700 dark:text-gray-200">Keterangan: </span>
          Klien meminta sample warna finishing dikonfirmasi ulang sebelum tahap produksi lantai 5 dimulai. Koordinasi dengan tim sales diperlukan sebelum tanggal 5 Agustus.
        </p>
      </div>
    </div>

    {/* --- Bagian Bawah: Progress Global --- */}
    <div className="px-6 sm:px-7 py-6 border-t border-gray-100 dark:border-gray-700">
      <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
        Progress Keseluruhan <span className="normal-case text-gray-300 dark:text-gray-600">· klik untuk lompat ke detail</span>
      </h3>
      <div className="flex items-center justify-around sm:justify-start sm:gap-10">
        <RingProgress percent={75} accent={ACCENTS.navy} label="Produksi" icon={Factory} onClick={() => onJump(refs.produksi)} />
        <RingProgress percent={25} accent={ACCENTS.blue} label="Pengiriman" icon={Truck} onClick={() => onJump(refs.pengiriman)} />
        <RingProgress percent={65} accent={ACCENTS.teal} label="Instalasi" icon={Wrench} onClick={() => onJump(refs.instalasi)} />
      </div>
    </div>
  </Panel>
);

// ---------------------------------------------------------------------------
// Block 2 — Proses Produksi
// ---------------------------------------------------------------------------
const productionRows = [
  { code: 'MPU 22', dim: '10000', colour: 'S+ Blue', manufacture: 100, painting: 90, done: 95 },
  { code: 'MPD 2015', dim: '1068', colour: 'Galva', manufacture: 60, painting: 40, done: 50 },
  { code: 'MPD 2015', dim: '1022', colour: 'Galva', manufacture: 30, painting: 10, done: 20 },
  { code: 'MPD 2015', dim: '1050', colour: 'Galva', manufacture: 85, painting: 70, done: 78 },
];

const ProductionBlock = ({ innerRef }) => (
  <Panel innerRef={innerRef}>
    <SectionHeading
      icon={Factory}
      accent={ACCENTS.navy}
      eyebrow="Manufaktur"
      title="Proses Produksi"
      action={
        <button
          className={`flex items-center gap-1.5 text-xs font-semibold text-white px-3.5 py-2 rounded-lg transition-colors shrink-0 ${ACCENTS.navy.solid}`}
        >
          <Cog size={13} /> Atur Produksi
        </button>
      }
    />

    <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
      <table className="w-full text-left border-collapse min-w-[640px]">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-700/40 text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            <th className="p-3.5 font-semibold">Article Code</th>
            <th className="p-3.5 font-semibold">Dim 1</th>
            <th className="p-3.5 font-semibold">Colour</th>
            <th className="p-3.5 font-semibold">Progress Manufacture</th>
            <th className="p-3.5 font-semibold">Progress Painting</th>
            <th className="p-3.5 font-semibold">Persen Selesai</th>
          </tr>
        </thead>
        <tbody>
          {productionRows.map((row, i) => (
            <tr
              key={i}
              className="border-t border-gray-100 dark:border-gray-700/60 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
            >
              <td className="p-3.5 font-semibold text-gray-800 dark:text-gray-100 font-mono text-[13px]">{row.code}</td>
              <td className="p-3.5 text-gray-600 dark:text-gray-300 tabular-nums">{row.dim}</td>
              <td className="p-3.5">
                <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                  <Paintbrush size={12} className="text-gray-400 dark:text-gray-500" /> {row.colour}
                </span>
              </td>
              <td className="p-3.5"><MiniBar percent={row.manufacture} accent={ACCENTS.navy} /></td>
              <td className="p-3.5"><MiniBar percent={row.painting} accent={ACCENTS.blue} /></td>
              <td className="p-3.5">
                <span className={`text-xs font-bold px-2 py-1 rounded-md ${DONE_STYLES(row.done)}`}>{row.done}%</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Panel>
);

// ---------------------------------------------------------------------------
// Block 3 — Proses Pengiriman (tracking / delivery timeline)
// ---------------------------------------------------------------------------
const deliveryBatches = [
  { batch: 'Batch 1', qty: '5 Pcs', status: 'diterima', plate: 'B 9021 KLM', driver: 'Yanto Saputra', eta: 'Diterima 18 Jul 2026, 14:20' },
  { batch: 'Batch 2', qty: '8 Pcs', status: 'perjalanan', plate: 'B 7734 XYZ', driver: 'Hendra Kusuma', eta: 'Estimasi tiba 29 Jul 2026, 16:00' },
  { batch: 'Batch 3', qty: '7 Pcs', status: 'dimuat', plate: 'B 5510 ABC', driver: 'Rudi Hartono', eta: 'Estimasi berangkat 31 Jul 2026, 08:00' },
];

const DeliveryBlock = ({ innerRef }) => (
  <Panel innerRef={innerRef}>
    <SectionHeading icon={Truck} accent={ACCENTS.blue} eyebrow="Logistik" title="Proses Pengiriman" />

    <div className="grid grid-cols-3 gap-3 mb-6">
      <div className="border border-gray-100 dark:border-gray-700 rounded-xl p-4 text-center">
        <p className="text-gray-400 dark:text-gray-500 text-xs mb-1">Total Terkirim</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
          5 <span className="text-sm font-medium text-gray-400 dark:text-gray-500">Pcs</span>
        </p>
      </div>
      <div className="border border-gray-100 dark:border-gray-700 rounded-xl p-4 text-center">
        <p className="text-gray-400 dark:text-gray-500 text-xs mb-1">Belum Terkirim</p>
        <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
          15 <span className="text-sm font-medium text-gray-400 dark:text-gray-500">Pcs</span>
        </p>
      </div>
      <div className="border border-amber-100 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-900/20 rounded-xl p-4 text-center">
        <p className="text-amber-700 dark:text-amber-400 text-xs font-semibold mb-1">Status Stok</p>
        <p className="text-sm font-bold text-amber-800 dark:text-amber-300 leading-tight pt-1">Need Fulfillment</p>
      </div>
    </div>

    <div className="relative pl-6">
      <div className="absolute left-[9px] top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-700" />
      <div className="space-y-5">
        {deliveryBatches.map((b, i) => (
          <div key={i} className="relative">
            <span
              className={`absolute -left-6 top-1 w-[19px] h-[19px] rounded-full border-2 border-white dark:border-gray-800 ring-1 ring-inset ring-white dark:ring-gray-800 ${STATUS_PILL[b.status].className}`}
            />
            <div className="border border-gray-100 dark:border-gray-700 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
              <div className="sm:w-32 shrink-0">
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{b.batch}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{b.qty}</p>
              </div>
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                  <Truck size={13} className="text-gray-400 dark:text-gray-500" />
                  <span className="font-mono text-xs">{b.plate}</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                  <UserRound size={13} className="text-gray-400 dark:text-gray-500" />
                  <span className="text-xs">{b.driver}</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 col-span-2 sm:col-span-1">
                  <Clock3 size={13} className="text-gray-400 dark:text-gray-500 shrink-0" />
                  <span className="text-xs">{b.eta}</span>
                </div>
              </div>
              <StatusPill status={b.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  </Panel>
);

// ---------------------------------------------------------------------------
// Block 4 — Proses Instalasi
// ---------------------------------------------------------------------------
const zones = [
  { name: 'Zona A · Lantai 3', percent: 100 },
  { name: 'Zona B · Lantai 4', percent: 90 },
  { name: 'Zona C · Lantai 5', percent: 20 },
];

const qcIssues = [
  { title: 'Panel finishing tergores saat bongkar muat', zone: 'Zona B', level: 'Sedang', status: 'open' },
  { title: 'Ukuran engsel pintu tidak sesuai spek', zone: 'Zona C', level: 'Tinggi', status: 'open' },
  { title: 'Warna cat sedikit berbeda dari sample', zone: 'Zona A', level: 'Rendah', status: 'resolved' },
];

const pic = [
  { name: 'Bpk. Supriadi', role: 'Leader Lapangan', phone: '0812-3456-7890' },
  { name: 'Bpk. Yusuf', role: 'QC Lapangan', phone: '0813-2211-0098' },
];

const InstallationBlock = ({ innerRef }) => (
  <Panel innerRef={innerRef}>
    <SectionHeading icon={Wrench} accent={ACCENTS.teal} eyebrow="Lapangan" title="Proses Instalasi" />

    <div className="flex flex-wrap gap-6 mb-6">
      {pic.map((p, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-400/10 flex items-center justify-center shrink-0">
            <Phone size={14} className="text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">{p.role}</p>
            <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">
              {p.name} <span className="text-gray-400 dark:text-gray-500 font-normal">({p.phone})</span>
            </p>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-400/10 flex items-center justify-center shrink-0">
          <Users size={14} className="text-teal-600 dark:text-teal-400" />
        </div>
        <div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">Jumlah Tim</p>
          <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">4 Orang</p>
        </div>
      </div>
    </div>

    {/* Per-zone progress */}
    <div className="space-y-4 mb-7">
      {zones.map((z, i) => (
        <div key={i}>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="font-semibold text-gray-700 dark:text-gray-200">{z.name}</span>
            <span className={`font-bold ${z.percent === 100 ? 'text-emerald-600 dark:text-emerald-400' : ACCENTS.teal.text}`}>
              {z.percent}%
            </span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-700 ease-out ${
                z.percent === 100 ? 'bg-emerald-500 dark:bg-emerald-400' : ACCENTS.teal.bar
              }`}
              style={{ width: `${z.percent}%` }}
            />
          </div>
        </div>
      ))}
    </div>

    {/* QC / Issue tracker */}
    <div className="pt-5 border-t border-gray-100 dark:border-gray-700">
      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5 mb-3">
        <ShieldAlert size={13} /> Issue &amp; QC Tracker
      </h4>
      <div className="space-y-2">
        {qcIssues.map((issue, i) => (
          <div key={i} className="flex items-start gap-3 border border-gray-100 dark:border-gray-700 rounded-xl p-3.5">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                issue.status === 'resolved' ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-rose-50 dark:bg-rose-900/30'
              }`}
            >
              {issue.status === 'resolved' ? (
                <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle size={14} className="text-rose-500 dark:text-rose-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100 leading-snug">{issue.title}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{issue.zone}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${LEVEL_STYLES[issue.level]}`}>{issue.level}</span>
              <span className="text-[11px] text-gray-400 dark:text-gray-500">{issue.status === 'resolved' ? 'Selesai' : 'Terbuka'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </Panel>
);

// ---------------------------------------------------------------------------
// Right sidebar — Catatan (tabbed, live-chat style)
// ---------------------------------------------------------------------------
const TABS = [
  { key: 'so', label: 'SO', icon: ClipboardList, accent: ACCENTS.navy },
  { key: 'produksi', label: 'Produksi', icon: Factory, accent: ACCENTS.navy },
  { key: 'pengiriman', label: 'Pengiriman', icon: Truck, accent: ACCENTS.blue },
  { key: 'instalasi', label: 'Instalasi', icon: Wrench, accent: ACCENTS.teal },
];

const initialNotes = {
  so: [
    {
      author: 'Budi',
      role: 'Admin',
      time: '21 Jul, 14:30',
      text: 'Jangan diproduksi dulu, nunggu konfirmasi desain dari sales @Rendra ya.',
    },
  ],
  produksi: [
    {
      author: 'Agus',
      role: 'Kepala Produksi',
      time: '21 Jul, 09:12',
      text: 'Material finishing tahap 2 sudah datang, siap lanjut produksi besok.',
    },
  ],
  pengiriman: [
    {
      author: 'Dewi',
      role: 'Logistik',
      time: '20 Jul, 16:45',
      text: 'Menunggu stok 15 pcs dari workshop sebelum jadwal kirim berikutnya.',
    },
  ],
  instalasi: [
    {
      author: 'Supriadi',
      role: 'Leader Lapangan',
      time: '21 Jul, 11:05',
      text: 'Instalasi kamar 401-410 selesai hari ini, lanjut ke lantai 5 besok pagi. @Supriadi tolong siapkan tim untuk QC ulang Zona C.',
    },
  ],
};

const NotesSidebar = () => {
  const [active, setActive] = useState('so');
  const [notes, setNotes] = useState(initialNotes);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef(null);

  const activeTab = TABS.find((t) => t.key === active);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [notes, active]);

  const handleSend = () => {
    if (!draft.trim()) return;
    setNotes((prev) => ({
      ...prev,
      [active]: [...prev[active], { author: 'Anda', role: 'Admin', time: 'Baru saja', text: draft.trim() }],
    }));
    setDraft('');
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors duration-300 flex flex-col h-[calc(100vh-3rem)] overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5 mb-3">
          <MessageSquare size={15} className={ACCENTS.navy.text} /> Catatan
        </h3>
        <div className="grid grid-cols-2 gap-1.5">
          {TABS.map((t) => {
            const isActive = t.key === active;
            return (
              <button
                key={t.key}
                onClick={() => setActive(t.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? `text-white ${t.accent.bar}`
                    : 'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <t.icon size={12} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Feed — min-h-0 is required so this flex child actually scrolls
          instead of stretching the whole card and clipping the composer. */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
        {notes[active].length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-300 dark:text-gray-600 py-10">
            <MessageSquare size={22} className="mb-2" />
            <p className="text-xs">Belum ada catatan di modul ini.</p>
          </div>
        )}
        {notes[active].map((note, idx) => (
          <div key={idx} className="bg-gray-50 dark:bg-gray-700/40 rounded-xl px-3.5 py-2.5">
            <div className="flex justify-between items-baseline mb-0.5 gap-2">
              <span className={`text-xs font-semibold truncate ${activeTab.accent.text}`}>
                {note.author} <span className="font-normal text-gray-400 dark:text-gray-500">· {note.role}</span>
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">{note.time}</span>
            </div>
            <NoteText text={note.text} />
          </div>
        ))}
      </div>

      {/* Composer — always pinned to the bottom of the card */}
      <div className="px-3.5 py-3 border-t border-gray-100 dark:border-gray-700 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Catatan untuk SO..."
            className="flex-1 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-xl px-3.5 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0084C9]/20 focus:border-[#0084C9] transition-all min-w-0"
          />
          <button
            onClick={handleSend}
            className={`text-white w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform active:scale-95 ${activeTab.accent.bar}`}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const DetailSO = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const soId = id || 'SO-2026-0789';

  const produksiRef = useRef(null);
  const pengirimanRef = useRef(null);
  const instalasiRef = useRef(null);

  const jumpTo = (ref) => {
    ref?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="w-full min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* Main content column */}
          <div className="w-full lg:flex-1 space-y-5 min-w-0">
            <HeroBlock
              id={soId}
              onNavigateBack={() => navigate('/so')}
              onJump={jumpTo}
              refs={{ produksi: produksiRef, pengiriman: pengirimanRef, instalasi: instalasiRef }}
            />
            <ProductionBlock innerRef={produksiRef} />
            <DeliveryBlock innerRef={pengirimanRef} />
            <InstallationBlock innerRef={instalasiRef} />
          </div>

          {/* Sticky notes sidebar */}
          <div className="w-full lg:w-[340px] xl:w-[380px] shrink-0 lg:sticky lg:top-6">
            <NotesSidebar />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailSO;