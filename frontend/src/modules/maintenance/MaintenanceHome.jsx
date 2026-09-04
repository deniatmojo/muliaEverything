// Modul Maintenance — navigasi internal 3 tab (Dashboard, Monitoring Listrik, Tim Maintenance).
// Monitoring Listrik dikonversi dari mockup HTML ke React + Tailwind + recharts (data masih dummy).
// Tema mengikuti app utama (light/dark, palet aira).

import React, { useEffect, useRef, useState } from 'react';
import {
  Activity, Wrench, LayoutDashboard, Zap, Gauge, BatteryCharging, Sun,
  Camera, Coins, TrendingUp, TrendingDown, ChevronDown, Check,
  Factory, Bell, Loader2, Users, Calculator
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { callApi } from '../../services/api';

// ===== Data dummy (masih frontend-only, menunggu sumber data sensor listrik) =====
const MACHINES = [
  'Semua Mesin',
  'Roll Forming Upright',
  'Punching Upright',
  'Bracing',
  'Roll Forming Beam',
  'Welding Beam',
  'Painting Line',
];

const STATS = [
  { label: 'FREKUENSI', value: '49.99', unit: 'Hz', delta: 0.01, up: true, color: '#a78bfa', spark: [49.9, 49.95, 49.92, 49.98, 49.94, 49.99], icon: Zap },
  { label: 'FAKTOR DAYA', value: '0.91', unit: '', delta: 0.4, up: false, color: '#a78bfa', spark: [0.93, 0.92, 0.94, 0.90, 0.92, 0.91], icon: Gauge },
  { label: 'DAYA AKTIF', value: '18.01', unit: 'kW', delta: 2.5, up: true, color: '#22d3b6', spark: [16, 17, 16.5, 18, 17.6, 18.01], icon: BatteryCharging },
  { label: 'ENERGI HARI INI', value: '1,246.7', unit: 'kWh', delta: 12.4, up: true, color: '#f5a524', spark: [1000, 1080, 1150, 1190, 1220, 1246.7], icon: Sun },
  { label: 'kVARh', value: '124.32', unit: 'kVARh', delta: 1.12, up: true, color: '#5b8def', spark: [110, 115, 118, 120, 122, 124.32], icon: Camera },
];

const ENERGY_HOURLY = [
  { jam: '00:00', kwh: 166.7 }, { jam: '02:00', kwh: 207.6 }, { jam: '04:00', kwh: 191.2 },
  { jam: '06:00', kwh: 187.4 }, { jam: '08:00', kwh: 206.6 }, { jam: '10:00', kwh: 203.1, highlight: true },
  { jam: '12:00', kwh: 142.3 }, { jam: '14:00', kwh: 81.1 }, { jam: '16:00', kwh: 50.2 },
  { jam: '18:00', kwh: 23.2 }, { jam: '20:00', kwh: 15.6 }, { jam: '22:00', kwh: 9.8 },
];

const POWER_TREND = [
  { jam: '00:00', aktif: 45, reaktif: 10, semu: 47 },
  { jam: '02:00', aktif: 52, reaktif: 12, semu: 54 },
  { jam: '04:00', aktif: 58, reaktif: 14, semu: 60 },
  { jam: '06:00', aktif: 55, reaktif: 13, semu: 57 },
  { jam: '08:00', aktif: 50, reaktif: 12, semu: 52 },
  { jam: '10:00', aktif: 48, reaktif: 11, semu: 50 },
  { jam: '12:00', aktif: 44, reaktif: 10, semu: 46 },
  { jam: '14:00', aktif: 40, reaktif: 9, semu: 42 },
  { jam: '16:00', aktif: 32, reaktif: 8, semu: 34 },
  { jam: '18:00', aktif: 26, reaktif: 7, semu: 28 },
  { jam: '20:00', aktif: 20, reaktif: 6, semu: 22 },
  { jam: '22:00', aktif: 18, reaktif: 5, semu: 20 },
];

const TOTAL_KWH = 157.6;
const TOTAL_KVARH = 124.32;

// ===== Komponen kecil =====

function Sparkline({ data, color }) {
  return (
    <div className="w-[78px] h-[26px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.map((v, i) => ({ i, v }))}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
          <XAxis dataKey="i" hide />
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Tooltip content={() => null} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-800 dark:text-white mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color || p.stroke }} />
          {p.name}: <span className="font-semibold">{p.value} {unit}</span>
        </p>
      ))}
    </div>
  );
}

// Tab: Monitoring Listrik
function MonitoringListrik() {
  const [machineOpen, setMachineOpen] = useState(false);
  const [machine, setMachine] = useState('Semua Mesin');
  const ddRef = useRef(null);

  const [tarif, setTarif] = useState('1.467,28');
  const [kvarh, setKvarh] = useState('1.352,00');
  const [biaya, setBiaya] = useState('231.231,7');

  useEffect(() => {
    const onClick = (e) => {
      if (ddRef.current && !ddRef.current.contains(e.target)) setMachineOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const parseId = (v) => parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;

  const hitungBiaya = () => {
    const total = (parseId(tarif) * TOTAL_KWH) + (parseId(kvarh) * (TOTAL_KVARH > 0 ? 1 : 0));
    setBiaya(total.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  };

  return (
    <div className="space-y-5">

      {/* Filter row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-3.5 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-300">
            📅 18 Apr 2025
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-3.5 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-300">Hari Ini</div>

          {/* Dropdown mesin */}
          <div className="relative" ref={ddRef}>
            <button
              onClick={() => setMachineOpen(o => !o)}
              className="flex items-center justify-between gap-2 min-w-[210px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:border-aira-cyan/60 px-3.5 py-2 rounded-xl text-sm font-semibold text-gray-800 dark:text-white transition-colors"
            >
              <span className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-blue-500/15 text-blue-500 flex items-center justify-center"><Factory size={13} /></span>
                {machine}
              </span>
              <ChevronDown size={14} className={`text-gray-400 transition-transform ${machineOpen ? 'rotate-180' : ''}`} />
            </button>
            {machineOpen && (
              <div className="absolute top-full mt-2 left-0 min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-2xl p-1.5 z-40 max-h-[280px] overflow-y-auto custom-scrollbar">
                {MACHINES.map(m => (
                  <button
                    key={m}
                    onClick={() => { setMachine(m); setMachineOpen(false); }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                      m === machine
                        ? 'bg-blue-500/10 text-gray-800 dark:text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-blue-500/10 hover:text-gray-800 dark:hover:text-white'
                    }`}
                  >
                    <span className="whitespace-nowrap">{m}</span>
                    {m === machine && <Check size={13} className="text-blue-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative w-10 h-10 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <Bell size={17} />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_#f5a524]" />
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5">
        {STATS.map(s => (
          <div key={s.label} className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 pb-3.5">
            <div className="absolute inset-0 pointer-events-none opacity-10" style={{ background: `linear-gradient(135deg, ${s.color} 0%, transparent 55%)` }} />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3.5">
                <span className="w-[26px] h-[26px] rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${s.color}38`, color: s.color }}>
                  <s.icon size={14} />
                </span>
                <span className="text-[11.5px] font-semibold tracking-wide text-gray-500 dark:text-gray-400">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">
                {s.value} {s.unit && <span className="text-sm font-medium text-gray-400 dark:text-gray-500">{s.unit}</span>}
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[11.5px] font-semibold flex items-center gap-1 ${s.up ? 'text-green-500' : 'text-red-400'}`}>
                  {s.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {s.up ? '▲' : '▼'} {s.delta}{s.label === 'FAKTOR DAYA' || s.label === 'FREKUENSI' ? '' : '%'}
                </span>
                <Sparkline data={s.spark} color={s.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[2.15fr_1fr] gap-4">

        {/* Kolom kiri: grafik */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 pb-3">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-bold text-gray-900 dark:text-white text-[15px]">GRAFIK PEMAKAIAN ENERGI (kWh)</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Update setiap 1 menit</p>
              </div>
              <button className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap hover:border-aira-cyan/50 transition-colors">
                Detail ⌃
              </button>
            </div>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ENERGY_HOURLY} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="rgba(128,128,128,0.15)" />
                  <XAxis dataKey="jam" tick={{ fontSize: 10.5, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10.5, fill: '#9ca3af' }} axisLine={false} tickLine={false} domain={[0, 250]} tickCount={6} />
                  <Tooltip content={<ChartTooltip unit="kWh" />} cursor={{ fill: 'rgba(128,128,128,0.08)' }} />
                  <Bar dataKey="kwh" name="Energi" radius={6} maxBarSize={34}>
                    {ENERGY_HOURLY.map((entry, i) => (
                      <Cell key={i} fill={entry.highlight ? '#f5a524' : 'rgba(34,211,182,0.65)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 pb-3">
            <div className="mb-1">
              <p className="font-bold text-gray-900 dark:text-white text-[15px]">TREN DAYA (kW)</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Perbandingan Daya Aktif, Reaktif, dan Semu</p>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400 my-1.5">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />Daya Aktif (kW)</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" />Daya Reaktif (kVAR)</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" />Daya Semu (kVA)</span>
            </div>
            <div className="h-[210px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={POWER_TREND} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="rgba(128,128,128,0.15)" />
                  <XAxis dataKey="jam" tick={{ fontSize: 10.5, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10.5, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip unit="" />} />
                  <Line type="monotone" dataKey="aktif" name="Daya Aktif (kW)" stroke="#34d399" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="reaktif" name="Daya Reaktif (kVAR)" stroke="#f76e6e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="semu" name="Daya Semu (kVA)" stroke="#5b8def" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Kolom kanan: kartu biaya + simulasi */}
        <div className="space-y-3.5">
          {[
            { label: 'ESTIMASI BIAYA HARIAN', value: 'Rp 231.231,7', delta: '▲ 12.4% dari kemarin', icon: Coins, color: '#f5a524' },
            { label: 'WBP (PEAK)', value: 'Rp 231.231,7', icon: Zap, color: '#34d399' },
            { label: 'LWBP (OFF-PEAK)', value: 'Rp 0', icon: Sun, color: '#f5a524' },
            { label: 'TOTAL kVARh', value: '124.32 kVARh', icon: Activity, color: '#a78bfa' },
          ].map(c => (
            <div key={c.label} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 px-4 py-3.5">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${c.color}26`, color: c.color }}>
                  <c.icon size={16} />
                </span>
                <div>
                  <p className="text-[11px] font-semibold tracking-wide text-gray-400 dark:text-gray-500 mb-0.5">{c.label}</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{c.value}</p>
                  {c.delta && <p className="text-[11px] font-semibold text-green-500 mt-0.5">{c.delta}</p>}
                </div>
              </div>
            </div>
          ))}

          {/* Simulasi biaya */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white mb-3">
              <Calculator size={16} className="text-aira-cyan" /> SIMULASI BIAYA LISTRIK
            </p>
            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 dark:text-gray-500 mb-1.5">Tarif per kWh (Rp)</label>
                <input type="text" value={tarif} onChange={e => setTarif(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-aira-cyan" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 dark:text-gray-500 mb-1.5">kVARh (Rp)</label>
                <input type="text" value={kvarh} onChange={e => setKvarh(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-aira-cyan" />
              </div>
              <button onClick={hitungBiaya}
                className="w-full bg-aira-cyan hover:bg-teal-400 text-white text-sm font-bold rounded-lg py-2.5 transition-colors">
                Hitung Ulang
              </button>
            </div>
            <div className="mt-3 pt-2.5 text-center border-t border-gray-100 dark:border-gray-700">
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">Estimasi Biaya</p>
              <p className="text-lg font-bold text-aira-cyan">Rp {biaya} / hari</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tab: Tim Maintenance (dari backend — RBAC role yang punya akses /maintenance)
function TimMaintenance() {
  const [team, setTeam] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      const res = await callApi('GET_MAINTENANCE_TEAM');
      if (res.status === 'success') setTeam(res.data || []);
      else setError(res.message || 'Gagal memuat data tim.');
      setIsLoading(false);
    };
    load();
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Users size={20} className="text-aira-cyan" /> Tim Maintenance
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Pengguna aktif yang role-nya memiliki akses menu Maintenance (selain Developer).
          </p>
        </div>
        <span className="bg-aira-cyan/10 text-aira-cyan text-xs font-bold px-3 py-1 rounded-full">
          {isLoading ? '...' : `${team.length} Anggota`}
        </span>
      </div>

      {isLoading ? (
        <div className="p-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-aira-cyan" /></div>
      ) : error ? (
        <p className="p-4 text-center text-red-500 text-sm">{error}</p>
      ) : team.length === 0 ? (
        <div className="p-8 text-center">
          <Wrench size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Belum ada anggota tim. Berikan akses menu <strong>Maintenance</strong> pada suatu role di halaman Developer,
            lalu tetapkan role itu kepada pengguna.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-700/50 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">Nama</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Kontak</th>
                <th className="px-4 py-3 rounded-r-lg">Foto</th>
              </tr>
            </thead>
            <tbody>
              {team.map(u => (
                <tr key={u.id} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="px-4 py-3 font-semibold text-gray-800 dark:text-white">{u.nama}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="bg-aira-cyan/10 text-aira-cyan text-xs font-semibold px-2.5 py-1 rounded-full">{u.role}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{u.phone || '-'}</td>
                  <td className="px-4 py-3">
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt={u.nama} className="w-8 h-8 rounded-full object-cover" />
                      : <div className="w-8 h-8 rounded-full bg-aira-navy dark:bg-aira-cyan text-white dark:text-gray-900 flex items-center justify-center text-xs font-bold">
                          {u.nama?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                        </div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ===== Halaman induk modul =====
const TABS = [
  { key: 'dashboard', label: 'Dashboard', short: 'Dash', icon: LayoutDashboard },
  { key: 'monitoring', label: 'Monitoring Listrik', short: 'Listrik', icon: Zap },
  { key: 'team', label: 'Tim Maintenance', short: 'Tim', icon: Wrench },
];

export default function MaintenanceHome() {
  const [tab, setTab] = useState('monitoring');

  return (
    <div className="space-y-6">

      {/* Nav pill internal 3 tab — sticky tanpa pita latar, hanya pill-nya yang mengambang.
          z-index sengaja di bawah sidebar (z-30) agar tidak menutupi sidebar mobile saat terbuka. */}
      <div className="sticky top-0 z-10 -mx-4 lg:-mx-8 -mt-4 lg:-mt-8 px-4 lg:px-8 py-1.5">
        <div className="flex justify-center">
          <div className="inline-flex gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full p-1.5 shadow-sm max-w-full">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 rounded-full text-[13px] sm:text-sm font-semibold transition-colors ${
                tab === t.key
                  ? 'bg-aira-navy dark:bg-aira-cyan text-white dark:text-gray-900 shadow-md'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-white'
              }`}
            >
              <t.icon size={14} className="flex-shrink-0" />
              {/* Label mobile disingkat, layar ke ke atas memakai label penuh */}
              <span className="sm:hidden">{t.short}</span>
              <span className="hidden sm:inline whitespace-nowrap">{t.label}</span>
            </button>
          ))}
          </div>
        </div>
      </div>

      {/* Konten tab */}
      {tab === 'dashboard' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 min-h-[360px] flex flex-col items-center justify-center text-center gap-2 p-6 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-aira-cyan/10 text-aira-cyan flex items-center justify-center mb-3">
            <LayoutDashboard size={24} />
          </div>
          <h3 className="font-bold text-gray-800 dark:text-white">Halaman Dashboard belum tersedia</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 max-w-sm">
            Ringkasan lintas divisi akan tampil di sini. Sementara ini silakan buka menu Monitoring Listrik.
          </p>
        </div>
      )}

      {tab === 'monitoring' && <MonitoringListrik />}
      {tab === 'team' && <TimMaintenance />}
    </div>
  );
}
