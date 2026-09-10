// Data & helper modul Production.
// Progres kini bersumber dari backend (tabel production_jobs / production_output_logs);
// tidak ada lagi angka mock di file ini.
export const MACHINES = [
  { key: 'upright', name: 'Mesin Roll Forming Upright', short: 'Roll Upright', icon: 'factory' },
  { key: 'bracing', name: 'Mesin Roll Forming Bracing', short: 'Roll Bracing', icon: 'scan-line' },
  { key: 'beam', name: 'Mesin Roll Forming Beam', short: 'Roll Beam', icon: 'layers' },
  { key: 'welding', name: 'Mesin Welding Beam', short: 'Welding', icon: 'flame' },
  { key: 'painting', name: 'Painting Machine', short: 'Painting', icon: 'paintbrush' },
];

export const STAGES = [
  { key: 'upright', label: 'Roll Upright' },
  { key: 'bracing', label: 'Roll Bracing' },
  { key: 'beam', label: 'Roll Beam' },
  { key: 'welding', label: 'Welding' },
  { key: 'painting', label: 'Painting' },
];

export const MACHINE_LABEL = {
  upright: 'Roll Upright', bracing: 'Roll Bracing', beam: 'Roll Beam',
  welding: 'Welding Beam', painting: 'Painting',
};

// Pemetaan material -> mesin sesuai aturan produksi:
// MPU -> roll upright | MPD -> roll bracing | MPB -> roll beam lalu welding.
// GALVA = galvanis, tidak lewat painting. Return null = bukan material produksi.
export function mapMaterialToMachine(articleCode) {
  const code = String(articleCode || '').trim().toUpperCase();
  if (/^MPU\s/.test(code)) return 'upright';
  if (/^MPD\s/.test(code)) return 'bracing';
  if (/^MPB\s/.test(code)) return 'beam';
  return null;
}

// Material produksi = lokal, bukan frame (MPF), bukan stock (SAFETY/MSP)
export function isProductionMaterial(m) {
  const code = String(m.articleCode || m.article_code || '').trim().toUpperCase();
  if ((m.currency || '').toUpperCase() !== 'IDR') return false;
  if (/^MPF(\s|$)/.test(code)) return false;
  if (/SAFETY/.test(code) || /^MSP\s/.test(code)) return false;
  return mapMaterialToMachine(code) !== null;
}

export function isStockMaterial(m) {
  const code = String(m.articleCode || m.article_code || '').trim().toUpperCase();
  return /SAFETY/.test(code) || /^MSP\s/.test(code);
}

// Tahapan pipeline sebuah material produksi
export function pipelineFor(articleCode, colour) {
  const machine = mapMaterialToMachine(articleCode);
  const isGalva = String(colour || '').trim().toUpperCase() === 'GALVA';
  const stages = [];
  if (machine === 'upright') stages.push('upright');
  if (machine === 'bracing') stages.push('bracing');
  if (machine === 'beam') { stages.push('beam', 'welding'); }
  if (!isGalva) stages.push('painting');
  return stages;
}

// ==== Helper job (bentuk data dari backend routes/production.js) ====

export const jobPct = (j) => (j.qtyTarget > 0 ? Math.min(100, Math.round((j.qtyDone / j.qtyTarget) * 100)) : 0);

export const jobStatusLabel = { queued: 'Queued', running: 'Running', paused: 'Paused', done: 'Done', buffered: 'Buffer Stock', cancelled: 'Cancelled' };
export const jobStatusStyle = {
  running: 'bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300',
  queued: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300',
  paused: 'bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300',
  done: 'bg-teal-50 dark:bg-teal-400/10 text-teal-700 dark:text-teal-300',
  buffered: 'bg-sky-50 dark:bg-sky-900/30 text-[#0084C9] dark:text-sky-400',
  cancelled: 'bg-gray-100 dark:bg-gray-700 text-gray-400',
};

// Progres kumulatif sekumpulan job (dipakai stepper & widget)
export function jobsPct(jobs) {
  const total = jobs.reduce((a, j) => a + j.qtyTarget, 0);
  const done = jobs.reduce((a, j) => a + Math.min(j.qtyDone, j.qtyTarget), 0);
  return total > 0 ? Math.round((done / total) * 100) : 0;
}
