// Modul Production — navigasi internal 3 tab (Dashboard, On Going Production, Detail Production).
// Data bersumber dari backend (production_jobs + production_output_logs); tidak ada angka mock.
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Activity, ClipboardList, Factory, ScanLine, Layers, Flame, Paintbrush,
  TrendingUp, Gauge, Boxes, Loader2,
} from 'lucide-react';
import { callApi } from '../../services/api';
import { MACHINES } from './productionData';

const TABS = [
  { key: 'dashboard', label: 'Dashboard', short: 'Dash', icon: LayoutDashboard },
  { key: 'ongoing', label: 'On Going Production', short: 'Ongoing', icon: Activity },
  { key: 'detail', label: 'Detail Production', short: 'Detail', icon: ClipboardList },
];

const machineIcon = { factory: Factory, 'scan-line': ScanLine, layers: Layers, flame: Flame, paintbrush: Paintbrush };
const statusMap = {
  running: { label: 'Running', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-400/10' },
  idle: { label: 'Idle', dot: 'bg-gray-400', text: 'text-gray-600 dark:text-gray-300', bg: 'bg-gray-100 dark:bg-gray-700' },
};

const fmtNum = (n) => new Intl.NumberFormat('id-ID').format(n || 0);

// Grafik SVG sederhana output aktual 14 hari (log operator) dengan tooltip
const LineChart = ({ data, labels, height = 200 }) => {
  const [hover, setHover] = useState(null);
  const W = 800, H = height, padL = 42, padR = 12, padT = 12, padB = 26;
  const max = Math.max(1, ...data) * 1.1;
  const xStep = (W - padL - padR) / (labels.length - 1);
  const x = (i) => padL + i * xStep;
  const y = (v) => H - padB - (v / max) * (H - padT - padB);
  const toPath = (arr) => arr.map((v, i) => (i === 0 ? 'M' : 'L') + x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
        {Array.from({ length: 5 }, (_, i) => {
          const gy = padT + (i * (H - padT - padB)) / 4;
          return <line key={i} x1={padL} y1={gy} x2={W - padR} y2={gy} className="stroke-gray-300 dark:stroke-gray-600" strokeOpacity="0.25" />;
        })}
        <path d={toPath(data)} fill="none" stroke="#0084C9" strokeWidth="2.5" />
        {labels.map((d, i) => (i % 2 === 0 || labels.length <= 7) && (
          <text key={i} x={x(i)} y={H - 6} fontSize="10" textAnchor="middle" className="fill-gray-400 dark:fill-gray-500">{d}</text>
        ))}
        {data.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 3.5} fill={hover === i ? '#0EA5A5' : '#0084C9'}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }} />
        ))}
      </svg>
      {hover !== null && (
        <div className="absolute bg-gray-900 dark:bg-black text-white text-xs rounded-lg px-2.5 py-1.5 shadow-lg pointer-events-none"
          style={{ left: `${(x(hover) / W) * 100}%`, top: 0, transform: 'translateX(-50%)`' }}>
          <div className="font-semibold">{labels[hover]}</div>
          Output: {fmtNum(data[hover])} pcs
        </div>
      )}
    </div>
  );
};

export default function ProductionHome() {
  const [tab, setTab] = useState('dashboard');
  const navigate = useNavigate();
  const [ov, setOv] = useState(null);
  const [buffer, setBuffer] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    callApi('PRODUCTION_OVERVIEW').then((res) => {
      if (res.status === 'success') setOv(res.data);
      setLoading(false);
    });
    callApi('PRODUCTION_BUFFER').then((res) => {
      if (res.status === 'success') setBuffer(res.data || []);
    });
  }, []);

  const delta = ov && ov.cards.outputYesterday > 0
    ? Math.round(((ov.cards.outputToday - ov.cards.outputYesterday) / ov.cards.outputYesterday) * 1000) / 10
    : null;

  return (
    <div className="space-y-6">

      {/* Nav pill internal 3 tab (pola sama dengan modul Maintenance) */}
      <div className="sticky top-0 z-10 -mx-4 lg:-mx-8 -mt-4 lg:-mt-8 px-4 lg:px-8 py-1.5">
        <div className="flex justify-center">
          <div className="inline-flex gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full p-1.5 shadow-sm max-w-full">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 rounded-full text-[13px] sm:text-sm font-semibold transition-colors ${
                  tab === t.key ? 'bg-aira-navy dark:bg-aira-cyan text-white dark:text-gray-900 shadow-md' : 'text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-white'}`}>
                <t.icon size={14} className="flex-shrink-0" />
                <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline whitespace-nowrap">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ============ TAB DASHBOARD ============ */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Project Aktif', value: fmtNum(ov?.cards.activeProjects ?? 0), unit: 'project', sub: 'sedang berjalan produksi', icon: Factory, tone: 'navy' },
              { label: 'Total Material Dikerjakan', value: fmtNum(ov?.cards.totalMaterialDone ?? 0), unit: `dari ${fmtNum(ov?.cards.totalMaterialTarget ?? 0)} pcs`, sub: 'di 5 mesin produksi', icon: Layers, tone: 'cyan' },
              { label: 'Output Hari Ini', value: fmtNum(ov?.cards.outputToday ?? 0), unit: 'pcs', sub: delta !== null ? `${delta >= 0 ? '+' : ''}${String(delta).replace('.', ',')}% dari kemarin` : `kemarin ${fmtNum(ov?.cards.outputYesterday ?? 0)} pcs`, icon: TrendingUp, tone: 'teal' },
              { label: 'Progress Keseluruhan', value: `${ov?.machines.length ? Math.round(ov.machines.reduce((a, m) => a + (m.target ? (m.done / m.target) : 0), 0) / ov.machines.filter((m) => m.target > 0).length) || 0 : 0}%`, unit: '', sub: 'rata-rata 5 mesin', icon: Gauge, tone: 'amber' },
            ].map((c) => (
              <div key={c.label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{c.label}</span>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    c.tone === 'navy' ? 'bg-aira-navy/10 text-aira-navy dark:text-blue-400'
                    : c.tone === 'cyan' ? 'bg-sky-50 dark:bg-sky-900/30 text-[#0084C9] dark:text-sky-400'
                    : c.tone === 'teal' ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400'
                    : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}>
                    <c.icon size={17} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{c.value} <span className="text-sm font-normal text-gray-400">{c.unit}</span></p>
                <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* Grafik output aktual */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <h2 className="font-bold text-gray-900 dark:text-white">Output Produksi 14 Hari Terakhir</h2>
                <p className="text-xs text-gray-400">Aktual pcs/hari — dari pencatatan output operator</p>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0084C9]" /> Aktual
              </span>
            </div>
            <LineChart data={ov?.output14d?.actual || []} labels={ov?.output14d?.days || []} height={220} />
          </div>

          {/* Grid 5 mesin */}
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white mb-3">Status 5 Mesin Produksi</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {MACHINES.map((m) => {
                const st = statusMap[(ov?.machines || []).find((x) => x.key === m.key)?.status || 'idle'];
                const Icon = machineIcon[m.icon];
                const stat = (ov?.machines || []).find((x) => x.key === m.key);
                const prog = stat && stat.target > 0 ? Math.round((stat.done / stat.target) * 100) : 0;
                return (
                  <div key={m.key} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-9 h-9 rounded-xl bg-aira-navy/10 dark:bg-aira-cyan/20 flex items-center justify-center text-aira-navy dark:text-aira-cyan">
                        <Icon size={17} />
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold ${st.bg} ${st.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot} ${st?.label === 'Running' ? 'animate-pulse' : ''}`} />{st.label}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white leading-snug">{m.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{stat?.runningJobs ?? 0} job berjalan · {stat?.totalJobs ?? 0} job</p>
                    <div className="mt-3">
                      <div className="flex justify-between text-[11px] text-gray-400 mb-1"><span>Progress mesin</span><span>{prog}%</span></div>
                      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#0084C9] to-[#0EA5A5]" style={{ width: `${prog}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Buffer stock global */}
          {buffer.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
              <h2 className="font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2"><Boxes size={16} className="text-[#0084C9]" /> Buffer Stock</h2>
              <p className="text-xs text-gray-400 mb-3">Hasil produksi yang tak terpakai karena perubahan BOQ — kelak dapat dialokasikan ke project lain yang sama tipe & panjang.</p>
              <div className="flex flex-wrap gap-2">
                {buffer.map((b, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-full bg-sky-50 dark:bg-sky-900/30 text-[#0084C9] dark:text-sky-400 text-xs font-semibold">
                    {b.originSoId} · {b.articleCode} {b.dim1 ? `(${b.dim1})` : ''} · {fmtNum(b.qtyBuffer)} pcs
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tabel project */}
          <ProjectTable projects={ov?.projects || []} loading={loading} onOpen={(id) => navigate(`/production/${id}`)} />
        </div>
      )}

      {/* ============ TAB ON GOING ============ */}
      {tab === 'ongoing' && (
        <div className="space-y-8">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white mb-1">Status Mesin Hari Ini — {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
            <p className="text-xs text-gray-400 mb-4">Job yang sedang dikerjakan (dari pencatatan output operator)</p>
            <div className="space-y-3">
              {loading && <p className="text-sm text-gray-400 py-4 text-center"><Loader2 size={18} className="animate-spin inline mr-2" />Memuat…</p>}
              {!loading && (ov?.ongoing || []).length === 0 && (
                <p className="text-sm text-gray-400 py-6 text-center">Belum ada job yang berjalan. Job mulai berjalan saat output pertama dicatat.</p>
              )}
              {(ov?.ongoing || []).map((j) => {
                const meta = MACHINES.find((m) => m.key === j.machine);
                const Icon = machineIcon[meta.icon];
                const st = statusMap.running;
                const pct = j.qtyTarget > 0 ? Math.round((Math.min(j.qtyDone, j.qtyTarget) / j.qtyTarget) * 100) : 0;
                return (
                  <div key={j.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-3 w-56 shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-aira-navy/10 dark:bg-aira-cyan/20 flex items-center justify-center text-aira-navy dark:text-aira-cyan">
                          <Icon size={19} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{meta.name}</p>
                          <p className="text-xs text-gray-400 truncate">{j.customer}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${st.bg} ${st.text}`}>
                        <span className="w-1.5 h-1.5 rounded-full ${st.dot} animate-pulse" />{st.label}
                      </span>
                      <div className="flex flex-wrap gap-3 flex-1">
                        <div className="flex-1 min-w-[220px] bg-gray-50 dark:bg-gray-900/40 rounded-xl p-3">
                          <p className="text-xs font-bold text-aira-navy dark:text-aira-cyan">{j.soId}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{j.articleCode} · {j.dim1 ?? '-'} · {j.colour ?? '-'}</p>
                          <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mb-1">
                            <div className="h-full rounded-full bg-gradient-to-r from-[#0084C9] to-[#0EA5A5]" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex justify-between text-[11px] text-gray-400">
                            <span>{fmtNum(j.qtyDone)}/{fmtNum(j.qtyTarget)} pcs</span><span>{pct}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Kartu project */}
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white mb-3">Project Sedang Produksi</h2>
            <ProjectCards projects={ov?.projects || []} loading={loading} onOpen={(id) => navigate(`/production/${id}`)} />
          </div>
        </div>
      )}

      {/* ============ TAB DETAIL (picker) ============ */}
      {tab === 'detail' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
            <h2 className="font-bold text-gray-900 dark:text-white mb-1">Detail Production</h2>
            <p className="text-sm text-gray-400">Pilih project untuk membuka detail produksinya. Dari halaman Detail SO, tombol <span className="font-semibold text-aira-navy dark:text-aira-cyan">Atur Produksi</span> juga mengarah ke sini.</p>
          </div>
          <ProjectTable projects={ov?.projects || []} loading={loading} onOpen={(id) => navigate(`/production/${id}`)} />
          {(ov?.projects || []).length === 0 && !loading && (
            <ProjectTable projects={[]} loading={false} hint onOpen={() => {}} />
          )}
        </div>
      )}
    </div>
  );
}

const ProjectTable = ({ projects, loading, onOpen, hint }) => (
  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
    <div className="p-5 pb-3 flex items-center justify-between">
      <h2 className="font-bold text-gray-900 dark:text-white">Project dalam Produksi</h2>
      <span className="text-xs text-gray-400">Klik baris untuk lihat detail</span>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400 text-xs uppercase">
          <tr>
            {['No. SO', 'Project', 'Customer', 'Total Material', 'Progress', ''].map((h, i) => (
              <th key={i} className={`font-semibold px-5 py-3 ${i === 3 ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {loading && (
            <tr><td colSpan="6" className="px-5 py-10 text-center text-gray-400"><Loader2 size={20} className="animate-spin inline mr-2" />Memuat project…</td></tr>
          )}
          {!loading && projects.length === 0 && (
            <tr><td colSpan="6" className="px-5 py-10 text-center text-gray-400 text-sm">
              {hint ? 'Belum ada SO yang produksinya berjalan. Buka salah satu SO di halaman Detail Production untuk memulai.' : 'Belum ada SO yang produksinya berjalan.'}
            </td></tr>
          )}
          {projects.map((s) => (
            <tr key={s.id} onClick={() => onOpen(s.id)} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer">
              <td className="px-5 py-3 font-bold text-aira-navy dark:text-aira-cyan whitespace-nowrap">{s.id}</td>
              <td className="px-5 py-3 whitespace-nowrap">{s.project_name || '-'}</td>
              <td className="px-5 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{s.customer || '-'}</td>
              <td className="px-5 py-3 text-right whitespace-nowrap">{fmtNum(s.totalDone)}/{fmtNum(s.totalTarget)} pcs</td>
              <td className="px-5 py-3 w-52">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#0084C9] to-[#0EA5A5]" style={{ width: `${s.progress}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 w-9">{s.progress}%</span>
                </div>
              </td>
              <td className="px-5 py-3 text-right">
                <button onClick={(e) => { e.stopPropagation(); onOpen(s.id); }}
                  className="px-3 py-1.5 rounded-lg bg-aira-navy dark:bg-aira-cyan text-white dark:text-gray-900 text-xs font-semibold hover:opacity-90 transition">
                  Atur Produksi
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const ProjectCards = ({ projects, loading, onOpen }) => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
    {projects.map((s) => {
      // Estimasi progress per tahap dari job yang tersedia di overview tidak dibawa per SO;
      // kartu menampilkan progress keseluruhan per project.
      return (
        <div key={s.id} onClick={() => onOpen(s.id)}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 cursor-pointer hover:border-[#0084C9]/40 transition-colors">
          <p className="text-xs font-bold text-aira-navy dark:text-aira-cyan">{s.id}</p>
          <p className="text-sm font-bold text-gray-900 dark:text-white">{s.project_name || '-'}</p>
          <p className="text-xs text-gray-400 mb-3">{s.customer || '-'}</p>
          <div className="flex justify-between text-[11px] text-gray-400 mb-1">
            <span>{fmtNum(s.totalDone)}/{fmtNum(s.totalTarget)} pcs</span>
            <span className="font-bold text-aira-navy dark:text-aira-cyan">{s.progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-[#0084C9] to-[#0EA5A5]" style={{ width: `${s.progress}%` }} />
          </div>
        </div>
      );
    })}
    {loading && <div className="text-center text-gray-400 text-sm py-8"><Loader2 size={20} className="animate-spin inline mr-2" />Memuat…</div>}
  </div>
);
