// Dashboard Utama — konversi dari mockup HTML "Command Center" ke React + Tailwind + recharts.
// Data masih dummy (front-end only), menunggu integrasi backend.
// Tema mengikuti app utama: Tailwind dark: variant, palet aira.

import React, { useEffect, useState } from 'react';
import {
  Package, Target, Cog, Hourglass, XCircle, BarChart3, TrendingDown,
  Truck, AlertTriangle, ClipboardList, FolderOpen, CheckCircle2,
  Timer, FileStack, Clock, Bell,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

// ===== Data dummy =====
const TOP_STATS = [
  { title: 'PRODUKSI HARI INI', value: '8.756', unit: 'unit', delta: '▲ 12,1% vs kemarin', trend: 'up', icon: Package, color: '#5b8def', bg: 'bg-blue-500/15', text: 'text-blue-500 dark:text-blue-400' },
  { title: 'PLAN vs ACTUAL', value: '98,6%', unit: '', delta: '▲ 4,8%', trend: 'up', icon: Target, color: '#22c55e', bg: 'bg-green-500/15', text: 'text-green-500 dark:text-green-400' },
  { title: 'MACHINE RUNNING', value: '76,3%', unit: '', delta: '▲ 3,2%', trend: 'up', icon: Cog, color: '#5b8def', bg: 'bg-blue-500/15', text: 'text-blue-500 dark:text-blue-400' },
  { title: 'IDLE', value: '15,4%', unit: '', delta: '▼ 1,1%', trend: 'down', icon: Hourglass, color: '#f59e0b', bg: 'bg-amber-500/15', text: 'text-amber-500 dark:text-amber-400' },
  { title: 'BREAKDOWN', value: '8,3%', unit: '', delta: '▼ 2,1%', trend: 'down', icon: XCircle, color: '#ef4444', bg: 'bg-red-500/15', text: 'text-red-500 dark:text-red-400' },
  { title: 'OEE', value: '64,7%', unit: '', delta: '▲ 5,3%', trend: 'up', icon: BarChart3, color: '#22c55e', bg: 'bg-green-500/15', text: 'text-green-500 dark:text-green-400' },
];

const SUB_STATS = [
  { title: 'REJECT RATE', value: '2,18%', unit: '', delta: '▼ 0,35%', trend: 'down', accent: 'text-purple-500 dark:text-purple-400', icon: TrendingDown, color: '#8b5cf6', bg: 'bg-purple-500/15', text: 'text-purple-500 dark:text-purple-400' },
  { title: 'OTIF DELIVERY', value: '96,1%', unit: '', delta: '▲ 2,4%', trend: 'up', icon: Truck, color: '#5b8def', bg: 'bg-blue-500/15', text: 'text-blue-500 dark:text-blue-400' },
  { title: 'MATERIAL SHORTAGE', value: '5', unit: '', delta: 'item kritis', trend: 'neutral', icon: Package, color: '#f59e0b', bg: 'bg-amber-500/15', text: 'text-amber-500 dark:text-amber-400' },
  { title: 'SO AT RISK', value: '12', unit: '', delta: 'order', trend: 'neutral', icon: AlertTriangle, color: '#ef4444', bg: 'bg-red-500/15', text: 'text-red-500 dark:text-red-400' },
];

const TREND_OUTPUT = [
  { tgl: '29 Agu', unit: 4800 }, { tgl: '30 Agu', unit: 6500 }, { tgl: '31 Agu', unit: 4500 },
  { tgl: '1 Sep', unit: 6000 }, { tgl: '2 Sep', unit: 7200 }, { tgl: '3 Sep', unit: 7000 }, { tgl: '4 Sep', unit: 8756 },
];

const PLAN_ACTUAL = [
  { line: 'Line 1', plan: 6200, actual: 6120 }, { line: 'Line 2', plan: 5300, actual: 5210 },
  { line: 'Line 3', plan: 4100, actual: 3980 }, { line: 'Line 4', plan: 3600, actual: 3510 },
  { line: 'Line 5', plan: 2800, actual: 2760 },
];

const MACHINE_STATUS = [
  { name: 'Running', value: 76.3, color: '#22c55e' },
  { name: 'Idle', value: 15.4, color: '#f59e0b' },
  { name: 'Breakdown', value: 8.3, color: '#ef4444' },
];

const SO_PROGRESS = [
  { code: 'SO-2505-001', name: 'Gear Housing', pct: 96, bar: 'bg-green-500' },
  { code: 'SO-2505-002', name: 'Bracket Assy', pct: 78, bar: 'bg-green-500' },
  { code: 'SO-2505-003', name: 'Conveyor Frame', pct: 65, bar: 'bg-amber-500' },
  { code: 'SO-2505-004', name: 'Pump Skid', pct: 40, bar: 'bg-amber-500' },
  { code: 'SO-2505-005', name: 'Control Panel', pct: 30, bar: 'bg-red-500' },
];

const ALERTS = [
  { tone: 'red', title: 'Breakdown Mesin - Line 3', desc: 'CNC Milling-03 berhenti sejak 09:52', time: '09:52', icon: AlertTriangle },
  { tone: 'amber', title: 'Material Shortage - Bearing 6205', desc: 'Stok tersisa untuk 1 hari produksi', time: '09:41', icon: AlertTriangle },
  { tone: 'amber', title: 'OEE di bawah target - Line 2', desc: 'OEE saat ini 58,2% (target 65%)', time: '09:28', icon: AlertTriangle },
  { tone: 'green', title: 'OTIF Delivery On Track', desc: 'Semua pengiriman hari ini sesuai jadwal', time: '09:10', icon: CheckCircle2 },
];

const TONES = {
  red: { bg: 'bg-red-500/15', text: 'text-red-500 dark:text-red-400' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-500 dark:text-amber-400' },
  green: { bg: 'bg-green-500/15', text: 'text-green-500 dark:text-green-400' },
};

const SUMMARY = [
  { icon: FolderOpen, label: 'Total Order Aktif', val: '156' },
  { icon: CheckCircle2, label: 'Order Selesai Hari Ini', val: '28' },
  { icon: Timer, label: 'Lead Time Rata-rata', val: '4,2 hari' },
  { icon: FileStack, label: 'Backlog', val: '34 order' },
];

// ===== Komponen kecil =====

function ChartTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-1 font-medium text-gray-500 dark:text-gray-400">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey ?? p.name} className="flex items-center gap-2 text-aira-navy dark:text-gray-100">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.payload?.color }} />
          <span className="capitalize">{p.name}: </span>
          <span className="font-semibold">{p.value.toLocaleString('id-ID')}{unit}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ stat }) {
  const Icon = stat.icon;
  const deltaCls =
    stat.trend === 'up' ? 'text-green-600 dark:text-green-400'
    : stat.trend === 'down' ? 'text-red-600 dark:text-red-400'
    : 'text-gray-500 dark:text-gray-400';
  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <span className={`flex h-6 w-6 items-center justify-center rounded-md ${stat.bg} ${stat.text}`}>
          <Icon size={14} />
        </span>
        {stat.title}
      </div>
      <div className="mb-2 flex items-baseline gap-1 text-[26px] font-bold leading-none text-aira-navy dark:text-gray-100">
        {stat.value}
        {stat.unit && <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{stat.unit}</span>}
      </div>
      <div className={`text-[11px] font-semibold ${stat.accent ?? deltaCls}`}>{stat.delta}</div>
    </div>
  );
}

const cardCls = 'rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800';
const cardTitleCls = 'text-xs font-semibold uppercase tracking-wide text-aira-navy dark:text-gray-100';
const mutedCls = 'text-gray-500 dark:text-gray-400';
const axisTick = { fontSize: 11, fill: 'currentColor' };

// ===== Halaman =====

export default function Dashboard() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const tanggal = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const jam = now.toLocaleTimeString('id-ID');

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
        <h1 className="text-xl font-bold tracking-wide text-aira-navy dark:text-aira-cyan">COMMAND CENTER</h1>
        <div className={`flex items-center gap-2 text-sm ${mutedCls}`}>
          <Clock size={16} />
          {tanggal} | {jam}
        </div>
      </div>

      {/* Row 1: 6 kartu utama */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {TOP_STATS.map((s) => <StatCard key={s.title} stat={s} />)}
      </div>

      {/* Row 2: 4 kartu sub */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SUB_STATS.map((s) => <StatCard key={s.title} stat={s} />)}
      </div>

      {/* Row 3: charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[1fr_1fr_300px]">
        {/* Trend Output */}
        <div className={cardCls}>
          <div className="mb-4 flex items-center justify-between">
            <div className={cardTitleCls}>Trend Output (Unit)</div>
            <select
              className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-500 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-gray-400"
              defaultValue="7"
            >
              <option value="7">7 Hari Terakhir</option>
              <option value="30">30 Hari Terakhir</option>
            </select>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={TREND_OUTPUT} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
                <XAxis dataKey="tgl" tick={axisTick} className={mutedCls} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} className={mutedCls} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${v / 1000}K`} />
                <Tooltip content={<ChartTooltip unit=" unit" />} />
                <Line type="monotone" dataKey="unit" name="Output" stroke="#5b8def" strokeWidth={2}
                  dot={{ r: 4, fill: '#5b8def', strokeWidth: 0 }} fill="rgba(91,141,239,0.1)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plan vs Actual */}
        <div className={cardCls}>
          <div className="mb-4 flex items-center justify-between">
            <div className={cardTitleCls}>Plan vs Actual by Line (unit)</div>
            <div className={`flex gap-3 text-[11px] ${mutedCls}`}>
              <span><span className="text-blue-500">■</span> Plan</span>
              <span><span className="text-green-500">■</span> Actual</span>
            </div>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={PLAN_ACTUAL} barGap={4} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
                <XAxis dataKey="line" tick={axisTick} className={mutedCls} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} className={mutedCls} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${v / 1000}K`} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(128,128,128,0.08)' }} />
                <Bar dataKey="plan" name="Plan" fill="#5b8def" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="Actual" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Mesin */}
        <div className={cardCls}>
          <div className="mb-4 flex items-center justify-between">
            <div className={cardTitleCls}>Status Mesin</div>
          </div>
          <div className="relative h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={MACHINE_STATUS} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="88%"
                  paddingAngle={2} strokeWidth={0}>
                  {MACHINE_STATUS.map((m) => <Cell key={m.name} fill={m.color} />)}
                </Pie>
                <Tooltip content={<ChartTooltip unit="%" />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 text-center">
              <div className={`text-[10px] ${mutedCls}`}>Total Mesin</div>
              <div className="text-xl font-bold text-aira-navy dark:text-gray-100">124</div>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {MACHINE_STATUS.map((m) => (
              <div key={m.name} className={`flex items-center gap-2 text-[11px] ${mutedCls}`}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
                {m.name}
                <span className="ml-auto font-semibold text-aira-navy dark:text-gray-100">
                  {String(m.value).replace('.', ',')}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: lists */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Progres SO */}
        <div className={cardCls}>
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList size={14} className="text-aira-cyan" />
            <div className={cardTitleCls}>Progres Penyelesaian Project / SO</div>
          </div>
          <div className="flex flex-col gap-3">
            {SO_PROGRESS.map((p) => (
              <div key={p.code} className="flex items-center gap-3 text-[11px]">
                <div className={`w-20 shrink-0 ${mutedCls}`}>{p.code}</div>
                <div className="w-24 shrink-0 truncate text-aira-navy dark:text-gray-200">{p.name}</div>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700">
                  <div className={`h-full rounded-full ${p.bar}`} style={{ width: `${p.pct}%` }} />
                </div>
                <div className="w-9 text-right font-semibold text-aira-navy dark:text-gray-200">{p.pct}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Alert & Notifikasi */}
        <div className={cardCls}>
          <div className="mb-4 flex items-center gap-2">
            <Bell size={14} className="text-aira-cyan" />
            <div className={cardTitleCls}>Alert &amp; Notifikasi</div>
          </div>
          <div className="flex flex-col">
            {ALERTS.map((a, i) => {
              const Icon = a.icon;
              const tone = TONES[a.tone];
              return (
                <div key={a.time + a.title}
                  className={`flex items-start gap-3 ${i < ALERTS.length - 1 ? 'mb-2.5 border-b border-gray-100 pb-2.5 dark:border-slate-700' : ''}`}>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${tone.bg} ${tone.text}`}>
                    <Icon size={14} />
                  </span>
                  <div className="flex-1">
                    <div className={`mb-1 text-xs font-semibold ${tone.text}`}>{a.title}</div>
                    <div className={`text-[11px] ${mutedCls}`}>{a.desc}</div>
                  </div>
                  <div className={`text-[11px] ${mutedCls}`}>{a.time}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Performance Summary */}
        <div className={cardCls}>
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 size={14} className="text-aira-cyan" />
            <div className={cardTitleCls}>Performance Summary</div>
          </div>
          <div className="flex flex-col">
            {SUMMARY.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.label}
                  className={`flex items-center justify-between ${i < SUMMARY.length - 1 ? 'mb-3 border-b border-gray-100 pb-3 dark:border-slate-700' : ''}`}>
                  <div className={`flex items-center gap-3 text-xs text-aira-navy dark:text-gray-200`}>
                    <Icon size={16} className={mutedCls} />
                    {s.label}
                  </div>
                  <div className="text-base font-semibold text-aira-navy dark:text-gray-100">{s.val}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
