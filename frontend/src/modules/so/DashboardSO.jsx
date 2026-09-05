import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { callApi } from '../../services/api';
import {
  Plus,
  Search,
  ClipboardList,
  Factory,
  Truck,
  Wrench,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Package,
  CalendarClock,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  BarChart3,
  Wallet,
  Clock
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ---------------------------------------------------------------------------
// Mock data 
// ---------------------------------------------------------------------------
const mockSOs = [
  {
    id: 'SO-2026-0789',
    customer: 'Hotel Mulia',
    project: 'Renovasi Kamar Suite',
    item: 'Lemari Custom Tipe A',
    status: 'In Progress',
    stage: 'produksi',
    progress: 65,
    deliveryDate: '10 Agustus 2026',
    createdAt: '18 Jul 2026',
    totalItems: 45,
    shipped: 12,
    value: 850,
  },
  {
    id: 'SO-2026-0790',
    customer: 'Grand Hyatt Jakarta',
    project: 'Furniture Lobby & Restaurant',
    item: 'Meja & Kursi Restaurant',
    status: 'Production',
    stage: 'produksi',
    progress: 40,
    deliveryDate: '25 Agustus 2026',
    createdAt: '20 Jul 2026',
    totalItems: 120,
    shipped: 0,
    value: 1420,
  },
  {
    id: 'SO-2026-0785',
    customer: 'Aston Hotel Surabaya',
    project: 'Renovasi 120 Kamar',
    item: 'Set Kamar Tidur Standard',
    status: 'Completed',
    stage: 'instalasi',
    progress: 100,
    deliveryDate: '05 Juli 2026',
    createdAt: '10 Jul 2026',
    totalItems: 85,
    shipped: 85,
    value: 980,
  },
  {
    id: 'SO-2026-0781',
    customer: 'Fairmont Jakarta',
    project: 'Executive Lounge Furniture',
    item: 'Sofa Custom & Coffee Table',
    status: 'Shipping',
    stage: 'pengiriman',
    progress: 80,
    deliveryDate: '02 Agustus 2026',
    createdAt: '05 Jul 2026',
    totalItems: 32,
    shipped: 24,
    value: 610,
  },
  {
    id: 'SO-2026-0777',
    customer: 'The Ritz-Carlton Bali',
    project: 'Villa Outdoor Furniture',
    item: 'Daybed & Gazebo Set',
    status: 'Shipping',
    stage: 'pengiriman',
    progress: 55,
    deliveryDate: '14 Agustus 2026',
    createdAt: '28 Jun 2026',
    totalItems: 18,
    shipped: 6,
    value: 740,
  },
  {
    id: 'SO-2026-0770',
    customer: 'Pullman Bandung',
    project: 'Ballroom Chair Replacement',
    item: 'Kursi Ballroom Stackable',
    status: 'Installing',
    stage: 'instalasi',
    progress: 90,
    deliveryDate: '22 Juli 2026',
    createdAt: '15 Jun 2026',
    totalItems: 300,
    shipped: 300,
    value: 1150,
  },
];

// ---------------------------------------------------------------------------
// Monthly trend data
// ---------------------------------------------------------------------------
const monthlyTrend = [
  { month: 'Jan', label: 'Jan 2026', soCount: 3, value: 620 },
  { month: 'Feb', label: 'Feb 2026', soCount: 4, value: 780 },
  { month: 'Mar', label: 'Mar 2026', soCount: 2, value: 410 },
  { month: 'Apr', label: 'Apr 2026', soCount: 5, value: 950 },
  { month: 'Mei', label: 'Mei 2026', soCount: 6, value: 1120 },
  { month: 'Jun', label: 'Jun 2026', soCount: 4, value: 890 },
  { month: 'Jul', label: 'Jul 2026 (s.d. hari ini)', soCount: 6, value: 1250 },
];

const TREND_RANGES = [
  { key: '3m', label: '3 Bulan Terakhir', months: 3 },
  { key: '6m', label: '6 Bulan Terakhir', months: 6 },
  { key: 'ytd', label: 'Year to Date', months: monthlyTrend.length },
];

// ---------------------------------------------------------------------------
// Styling Configurations for Dark Mode Support
// ---------------------------------------------------------------------------
const projectCompletion = [
  {
    key: 'produksi',
    label: 'Project Selesai Produksi',
    description: 'Sudah menuntaskan seluruh tahap produksi.',
    count: 24,
    total: 30,
    icon: Factory,
    colorClass: 'text-[#0F3B6C] dark:text-blue-400',
    bgClass: 'bg-[#0F3B6C]/10 dark:bg-blue-400/10',
    progressClass: 'bg-[#0F3B6C] dark:bg-blue-400',
  },
  {
    key: 'pengiriman',
    label: 'Project Selesai Pengiriman',
    description: 'Seluruh barang sudah terkirim ke lokasi.',
    count: 18,
    total: 30,
    icon: Truck,
    colorClass: 'text-[#0084C9] dark:text-cyan-400',
    bgClass: 'bg-[#0084C9]/10 dark:bg-cyan-400/10',
    progressClass: 'bg-[#0084C9] dark:bg-cyan-400',
  },
  {
    key: 'instalasi',
    label: 'Project Selesai Instalasi',
    description: 'Sudah selesai dipasang & siap serah terima.',
    count: 15,
    total: 30,
    icon: Wrench,
    colorClass: 'text-[#0EA5A5] dark:text-teal-400',
    bgClass: 'bg-[#0EA5A5]/10 dark:bg-teal-400/10',
    progressClass: 'bg-[#0EA5A5] dark:bg-teal-400',
  },
];

const STATUS_STYLES = {
  'In Progress': 'bg-sky-50 dark:bg-sky-900/30 text-[#0084C9] dark:text-sky-400 ring-1 ring-inset ring-sky-100 dark:ring-sky-800',
  Production: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-100 dark:ring-amber-800',
  Shipping: 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 ring-1 ring-inset ring-cyan-100 dark:ring-cyan-800',
  Installing: 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 ring-1 ring-inset ring-teal-100 dark:ring-teal-800',
  Completed: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-100 dark:ring-emerald-800',
};

const KANBAN_COLUMNS = [
  {
    key: 'produksi',
    title: 'Produksi',
    subtitle: 'Sedang dikerjakan tim workshop',
    icon: Factory,
    colorClass: 'text-[#0F3B6C] dark:text-blue-400',
    bgClass: 'bg-[#0F3B6C]/10 dark:bg-blue-400/10',
    barClass: 'bg-[#0F3B6C] dark:bg-blue-400',
    borderHoverClass: 'hover:border-[#0F3B6C]/40 dark:hover:border-blue-400/50'
  },
  {
    key: 'pengiriman',
    title: 'Pengiriman',
    subtitle: 'Dalam proses kirim ke lokasi',
    icon: Truck,
    colorClass: 'text-[#0084C9] dark:text-cyan-400',
    bgClass: 'bg-[#0084C9]/10 dark:bg-cyan-400/10',
    barClass: 'bg-[#0084C9] dark:bg-cyan-400',
    borderHoverClass: 'hover:border-[#0084C9]/40 dark:hover:border-cyan-400/50'
  },
  {
    key: 'instalasi',
    title: 'Instalasi',
    subtitle: 'Pemasangan di lapangan',
    icon: Wrench,
    colorClass: 'text-[#0EA5A5] dark:text-teal-400',
    bgClass: 'bg-[#0EA5A5]/10 dark:bg-teal-400/10',
    barClass: 'bg-[#0EA5A5] dark:bg-teal-400',
    borderHoverClass: 'hover:border-[#0EA5A5]/40 dark:hover:border-teal-400/50'
  },
];

const formatValue = (juta) => `Rp ${(juta / 1000).toFixed(2)}M`;

const ChartTooltip = ({ active, payload, metric }) => {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0].payload;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 px-4 py-3 min-w-[150px]">
      <div className="text-[11px] text-gray-400 dark:text-gray-400 mb-1">{point.label}</div>
      <div className="text-base font-bold text-gray-900 dark:text-white">
        {metric === 'count' ? `${point.soCount} SO Masuk` : formatValue(point.value)}
      </div>
    </div>
  );
};

const DashboardSO = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [chartMetric, setChartMetric] = useState('count');
  const [chartRange, setChartRange] = useState('6m');
  const [sos, setSos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    callApi('SO_LIST').then((res) => {
      if (res.status === 'success') {
        setSos((res.data || []).map((s) => ({
          id: s.id,
          customer: s.customer || '-',
          project: s.project_name || '-',
          item: s.project_number ? `Project ${s.project_number}` : '-',
          status: s.stage === 'completed' ? 'Completed' : s.stage === 'pengiriman' ? 'Shipping' : s.stage === 'instalasi' ? 'Installing' : 'Production',
          stage: s.stage || 'produksi',
          progress: s.progress || 0,
          deliveryDate: s.active_version ? `V.${s.active_version}` : '-',
          createdAt: new Date(s.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
          totalItems: s.material_count || 0,
          shipped: 0,
          value: Math.round((s.budget_idr || 0) / 1e6),
          hasPending: !!s.has_pending_change,
        })));
      }
      setLoading(false);
    });
  }, []);

  const chartData = useMemo(() => {
    const range = TREND_RANGES.find((r) => r.key === chartRange) || TREND_RANGES[1];
    return monthlyTrend.slice(-range.months);
  }, [chartRange]);

  const chartTotal = useMemo(
    () =>
      chartMetric === 'count'
        ? chartData.reduce((sum, m) => sum + m.soCount, 0)
        : chartData.reduce((sum, m) => sum + m.value, 0),
    [chartData, chartMetric]
  );

  const chartDelta = useMemo(() => {
    if (chartData.length < 2) return 0;
    const first = chartMetric === 'count' ? chartData[0].soCount : chartData[0].value;
    const last = chartMetric === 'count' ? chartData[chartData.length - 1].soCount : chartData[chartData.length - 1].value;
    if (!first) return 0;
    return ((last - first) / first) * 100;
  }, [chartData, chartMetric]);

  const filteredSOs = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return sos;
    return sos.filter(
      (so) =>
        so.id.toLowerCase().includes(q) ||
        so.customer.toLowerCase().includes(q) ||
        so.project.toLowerCase().includes(q) ||
        so.item.toLowerCase().includes(q)
    );
  }, [search, sos]);

  // Kalkulasi Metrik
  const totalSO = sos.length;
  const pendingProduksi = sos.filter((s) => s.stage === 'produksi' && s.progress === 0).length;
  const inProduction = sos.filter((s) => s.stage === 'produksi').length;
  const inDelivery = sos.filter((s) => s.stage === 'pengiriman').length;
  const inInstallation = sos.filter((s) => s.stage === 'instalasi').length;
  const completed = sos.filter((s) => s.stage === 'completed').length;

  const summaryCards = [
    {
      label: 'Pending Produksi',
      value: pendingProduksi,
      icon: Clock,
      iconColor: 'text-slate-500 dark:text-slate-400',
      iconBg: 'bg-slate-200/50 dark:bg-slate-700/50',
      trend: '+1 dari minggu lalu',
    },
    {
      label: 'Dalam Produksi',
      value: inProduction,
      icon: Factory,
      iconColor: 'text-[#0F3B6C] dark:text-blue-400',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      trend: 'On schedule',
    },
    {
      label: 'Dalam Pengiriman',
      value: inDelivery,
      icon: Truck,
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      trend: '2 butuh perhatian',
    },
    {
      label: 'Selesai Instalasi',
      value: completed,
      icon: CheckCircle2,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      trend: '100% terselesaikan',
    },
  ];

  // Konfigurasi Project Summary (Style Pills) - disesuaikan class warnanya
  const projectSummaryPills = [
    { label: 'Total Project', value: totalSO, colorClass: 'text-[#0F3B6C] dark:text-blue-400', bgClass: 'bg-[#0F3B6C]/10 dark:bg-blue-400/10' },
    { label: 'Dlm Produksi', value: inProduction, colorClass: 'text-[#0084C9] dark:text-cyan-400', bgClass: 'bg-[#0084C9]/10 dark:bg-cyan-400/10' },
    { label: 'Prog Instalasi', value: inInstallation, colorClass: 'text-amber-600 dark:text-amber-400', bgClass: 'bg-amber-100 dark:bg-amber-900/30' },
  ];

  return (
    <div className="space-y-8 relative transition-colors duration-300">
        
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F3B6C] dark:text-white tracking-tight">Sales Order Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Kelola siklus project &amp; produksi di satu tempat</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={17} />
            <input
              type="text"
              placeholder="Cari SO, customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0084C9]/20 focus:border-[#0084C9] dark:focus:border-[#0084C9] transition-all"
            />
          </div>
          <button
            onClick={() => navigate('/so/create')}
            className="flex items-center gap-2 bg-[#0F3B6C] dark:bg-[#0084C9] hover:bg-[#0a2c52] dark:hover:bg-cyan-600 text-white pl-4 pr-5 py-2.5 rounded-xl font-medium text-sm shadow-sm transition-all duration-200 active:scale-[0.98] whitespace-nowrap"
          >
            <Plus size={18} /> Buat SO Baru
          </button>
        </div>
      </div>

      {/* =========================================
          SECTION 1: CHART & DATA ACTIVITY
          ========================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">

        {/* Left: SO trend chart */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 flex flex-col transition-colors">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white leading-tight">SO Activity</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Your project list for this week</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={chartRange}
                  onChange={(e) => setChartRange(e.target.value)}
                  className="appearance-none bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl pl-3.5 pr-8 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0084C9]/20 cursor-pointer transition-colors"
                >
                  {TREND_RANGES.map((r) => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              </div>

              <div className="flex items-center bg-gray-100 dark:bg-gray-700/50 rounded-xl p-1">
                <button
                  onClick={() => setChartMetric('count')}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 ${
                    chartMetric === 'count' ? 'bg-white dark:bg-gray-600 text-[#0F3B6C] dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                  }`}
                >
                  <BarChart3 size={15} />
                </button>
                <button
                  onClick={() => setChartMetric('value')}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 ${
                    chartMetric === 'value' ? 'bg-white dark:bg-gray-600 text-[#0F3B6C] dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                  }`}
                >
                  <Wallet size={15} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-6 mb-1">
            <div className="w-11 h-11 rounded-full bg-[#0F3B6C] dark:bg-[#0084C9] flex items-center justify-center shrink-0 shadow-md">
              {chartMetric === 'count' ? <ClipboardList size={19} className="text-white" /> : <Wallet size={19} className="text-white" />}
            </div>
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <span className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                {chartMetric === 'count' ? `${chartTotal} SO` : formatValue(chartTotal)}
              </span>
              <span
                className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  chartDelta >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                }`}
              >
                {chartDelta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {Math.abs(chartDelta).toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="h-56 mt-4 -ml-2 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    {/* Menggunakan Aira Cyan untuk grafik supaya kontras di dark/light mode */}
                    <stop offset="0%" stopColor="#0084C9" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#0084C9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#4B5563" strokeOpacity={0.3} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} dy={8} />
                <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip cursor={{ stroke: '#0084C9', strokeDasharray: '4 4', strokeWidth: 1 }} content={<ChartTooltip metric={chartMetric} />} />
                <Area type="monotone" dataKey={chartMetric === 'count' ? 'soCount' : 'value'} stroke="#0084C9" strokeWidth={2.5} fill="url(#trendFill)" dot={false} activeDot={{ r: 6, fill: '#ffffff', stroke: '#0084C9', strokeWidth: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Data Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 flex flex-col transition-colors">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">Data Activity</h2>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Your project list for this week</p>
            </div>
            <button className="text-gray-300 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors mt-1">
              <MoreHorizontal size={20} />
            </button>
          </div>

          {/* Top Box Activity (Pills Style - Dark Mode Compatible) */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {projectSummaryPills.map((c) => (
              <div key={c.label} className={`rounded-2xl p-3 ${c.bgClass}`}>
                <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1.5 leading-tight">{c.label}</div>
                <div className={`text-xl font-bold leading-tight ${c.colorClass}`}>
                  {c.value}
                </div>
                <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Project</div>
              </div>
            ))}
          </div>

          {/* Project completion list */}
          <div className="space-y-6 flex-1">
            {projectCompletion.map((p) => (
              <div key={p.key} className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${p.bgClass}`}>
                  <p.icon size={18} className={p.colorClass} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-bold text-gray-800 dark:text-white leading-tight">{p.label}</span>
                    <span className="text-base font-bold text-gray-900 dark:text-white shrink-0">{p.count}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug mb-2">{p.description}</p>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-700 ${p.progressClass}`}
                      style={{ width: `${(p.count / p.total) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* =========================================
          SECTION 2: SUMMARY CARDS
          ========================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
        {summaryCards.map((card, idx) => (
          <div
            key={idx}
            className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 group"
          >
            <card.icon 
              className={`absolute -right-4 -bottom-4 w-24 h-24 ${card.iconColor} opacity-[0.03] dark:opacity-[0.05] group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500`} 
            />
            
            <div className="flex items-start justify-between relative z-10">
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{card.label}</div>
                <div className={`text-4xl font-bold ${card.iconColor} tracking-tight`}>{card.value}</div>
              </div>
              <div className={`w-10 h-10 rounded-xl ${card.iconBg} flex items-center justify-center shrink-0`}>
                <card.icon size={20} className={card.iconColor} />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-700/50 relative z-10">
              <span className="text-[11px] font-medium text-gray-400 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-md">
                {card.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* =========================================
          SECTION 3: KANBAN BOARD 
          ========================================= */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Papan Progres Project</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-200/50 dark:bg-gray-800 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700">
            {filteredSOs.length} project aktif
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {KANBAN_COLUMNS.map((col) => {
            const items = filteredSOs.filter((so) => so.stage === col.key);
            return (
              <div key={col.key} className="bg-gray-50 dark:bg-gray-800/40 rounded-2xl p-4 flex flex-col border border-gray-100 dark:border-gray-700 transition-colors">
                {/* Column header */}
                <div className="flex items-center justify-between px-1 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${col.bgClass}`}>
                      <col.icon size={18} className={col.colorClass} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-800 dark:text-white leading-tight">{col.title}</div>
                      <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">{col.subtitle}</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 rounded-lg w-7 h-7 flex items-center justify-center border border-gray-200 dark:border-gray-600 shadow-sm">
                    {items.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="space-y-3 min-h-[150px]">
                  {items.length === 0 && (
                    <div className="text-center text-xs text-gray-400 dark:text-gray-500 py-10 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-white/40 dark:bg-gray-800/40">
                      Tidak ada project di tahap ini
                    </div>
                  )}

                  {items.map((so) => (
                    <div
                      key={so.id}
                      onClick={() => navigate(`/so/detail/${so.id}`)}
                      className={`group bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer ${col.borderHoverClass}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="font-mono text-xs font-bold bg-blue-50 dark:bg-gray-700 text-[#0F3B6C] dark:text-aira-cyan px-2 py-1 rounded-md">
                          {so.id}
                        </span>
                        <span className={`px-2 py-1 text-[10px] font-bold rounded-full whitespace-nowrap ${STATUS_STYLES[so.status] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                          {so.status}
                        </span>
                      </div>

                      <div className="text-sm font-bold text-gray-800 dark:text-white leading-snug mb-1 group-hover:text-[#0084C9] dark:group-hover:text-cyan-400 transition-colors">
                        {so.customer}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-4">
                        <Package size={13} className="shrink-0 text-gray-400 dark:text-gray-500" />
                        <span className="truncate">{so.item}</span>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-[11px] font-medium mb-1.5">
                          <span className="text-gray-400 dark:text-gray-500">Progress</span>
                          <span className="text-gray-700 dark:text-gray-300">{so.progress}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${col.barClass}`}
                            style={{ width: `${so.progress}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-gray-700/50">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 dark:text-gray-500">
                          <CalendarClock size={13} />
                          {so.deliveryDate}
                        </div>
                        <ChevronRight
                          size={16}
                          className="text-gray-300 dark:text-gray-600 group-hover:text-[#0084C9] dark:group-hover:text-cyan-400 group-hover:translate-x-1 transition-all"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DashboardSO;