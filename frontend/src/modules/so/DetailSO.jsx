import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MessageSquare,
  Send,
  Settings,
  Factory,
  Truck,
  Wrench,
  FileText,
  CalendarDays,
  Layers,
  ClipboardCheck,
  PackageCheck,
  PackageX,
  AlertTriangle,
  Phone,
  Users,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Inline Notes — shared "chat-like" note thread used at the bottom of every
// block. Keeps its own local history so each block feels self-contained.
// ---------------------------------------------------------------------------
const NoteSection = ({ moduleName, initialNotes, accent }) => {
  const [notes, setNotes] = useState(initialNotes);
  const [draft, setDraft] = useState('');

  const handleSend = () => {
    if (!draft.trim()) return;
    setNotes((prev) => [
      ...prev,
      {
        author: 'Anda',
        role: 'Admin',
        time: 'Baru saja',
        text: draft.trim(),
      },
    ]);
    setDraft('');
  };

  return (
    <div className="mt-5 pt-5 border-t border-gray-100">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-3">
        <MessageSquare size={13} /> Catatan {moduleName}
      </h4>

      <div className="space-y-2.5 mb-3 max-h-44 overflow-y-auto pr-1">
        {notes.map((note, idx) => (
          <div key={idx} className="bg-gray-50 rounded-xl px-3.5 py-2.5">
            <div className="flex justify-between items-baseline mb-0.5">
              <span className="text-xs font-semibold" style={{ color: accent }}>
                {note.author} <span className="font-normal text-gray-400">· {note.role}</span>
              </span>
              <span className="text-[11px] text-gray-400 shrink-0 ml-2">{note.time}</span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{note.text}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ketik catatan baru..."
          className="flex-1 border border-gray-200 rounded-xl px-3.5 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0084C9]/20 focus:border-[#0084C9] transition-all"
        />
        <button
          onClick={handleSend}
          className="bg-[#0084C9] hover:bg-[#0F3B6C] text-white px-4 py-2 rounded-xl flex items-center gap-1.5 text-sm font-medium transition-colors duration-200 active:scale-[0.97]"
        >
          <Send size={14} /> <span className="hidden sm:inline">Kirim</span>
        </button>
      </div>
    </div>
  );
};

// Small stat tile used inside Block 1
const InfoTile = ({ icon: Icon, label, value }) => (
  <div className="bg-gray-50 rounded-xl p-3.5">
    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
      <Icon size={13} /> {label}
    </div>
    <p className="font-semibold text-gray-800 text-sm">{value}</p>
  </div>
);

// Section wrapper shared by all 4 blocks
const Block = ({ accent, icon: Icon, title, action, children }) => (
  <div
    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
    style={{ borderLeft: `3px solid ${accent}` }}
  >
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${accent}1A` }}
        >
          <Icon size={17} style={{ color: accent }} />
        </div>
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
      </div>
      {action}
    </div>
    {children}
  </div>
);

const DetailSO = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="w-full min-h-screen bg-gray-50/50">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-5">
        {/* Back button */}
        <button
          onClick={() => navigate('/so')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0F3B6C] font-medium transition-colors"
        >
          <ArrowLeft size={16} /> Kembali ke Dashboard
        </button>

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#0F3B6C] tracking-tight font-mono">{id}</h1>
            <p className="text-gray-500 mt-1">
              Hotel Mulia <span className="text-gray-300">·</span> Renovasi Kamar Suite
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 bg-sky-50 text-[#0084C9] ring-1 ring-inset ring-sky-100 px-3.5 py-1.5 rounded-full text-sm font-semibold w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0084C9] animate-pulse" /> In Progress
          </span>
        </div>

        {/* Block 1 — Informasi Detail Project */}
        <Block accent="#0F3B6C" icon={FileText} title="Informasi Detail Project">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoTile icon={CalendarDays} label="Tgl Pengiriman" value="10 Agustus 2026" />
            <InfoTile icon={Layers} label="Rencana Tahap" value="3 Fase" />
            <InfoTile icon={ClipboardCheck} label="Tgl Instalasi" value="15 Agustus 2026" />
            <InfoTile icon={CalendarDays} label="Dibuat" value="18 Jul 2026" />
          </div>

          <NoteSection
            moduleName="Administrasi Project"
            accent="#0F3B6C"
            initialNotes={[
              {
                author: 'Budi',
                role: 'Admin',
                time: '21 Jul 2026, 14:30',
                text: 'Jangan diproduksi dulu, nunggu konfirmasi desain dari sales.',
              },
            ]}
          />
        </Block>

        {/* Block 2 — Proses Produksi */}
        <Block
          accent="#0F3B6C"
          icon={Factory}
          title="Proses Produksi"
          action={
            <button className="flex items-center gap-1.5 text-xs font-semibold text-[#0F3B6C] bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors">
              <Settings size={13} /> Atur Produksi
            </button>
          }
        >
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="p-3 font-medium">Nama Barang</th>
                  <th className="p-3 font-medium">Target Qty</th>
                  <th className="p-3 font-medium">Selesai</th>
                  <th className="p-3 font-medium">Progress</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-100 text-sm">
                  <td className="p-3 font-medium text-gray-800">Lemari Custom Tipe A</td>
                  <td className="p-3 text-gray-600">20 Pcs</td>
                  <td className="p-3 text-emerald-600 font-semibold">15 Pcs</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 w-32">
                      <div className="h-1.5 flex-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-1.5 bg-[#0084C9] rounded-full" style={{ width: '75%' }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-600">75%</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <NoteSection
            moduleName="Tim Produksi"
            accent="#0F3B6C"
            initialNotes={[
              {
                author: 'Agus',
                role: 'Kepala Produksi',
                time: '21 Jul 2026, 09:12',
                text: 'Material finishing tahap 2 sudah datang, siap lanjut produksi besok.',
              },
            ]}
          />
        </Block>

        {/* Block 3 — Proses Pengiriman */}
        <Block accent="#0084C9" icon={Truck} title="Proses Pengiriman">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="border border-gray-100 rounded-xl p-4 text-center">
              <PackageCheck className="mx-auto text-emerald-500 mb-1.5" size={20} />
              <p className="text-gray-400 text-xs mb-0.5">Terkirim</p>
              <p className="text-2xl font-bold text-emerald-600">5 Pcs</p>
            </div>
            <div className="border border-gray-100 rounded-xl p-4 text-center">
              <PackageX className="mx-auto text-rose-500 mb-1.5" size={20} />
              <p className="text-gray-400 text-xs mb-0.5">Belum Terkirim</p>
              <p className="text-2xl font-bold text-rose-500">15 Pcs</p>
            </div>
            <div className="border border-amber-100 bg-amber-50/60 rounded-xl p-4 text-center">
              <AlertTriangle className="mx-auto text-amber-500 mb-1.5" size={20} />
              <p className="text-amber-700 text-xs font-semibold mb-0.5">Status Stok</p>
              <p className="text-base font-bold text-amber-800">Need Fulfillment</p>
            </div>
          </div>

          <NoteSection
            moduleName="Tim Logistik"
            accent="#0084C9"
            initialNotes={[
              {
                author: 'Dewi',
                role: 'Logistik',
                time: '20 Jul 2026, 16:45',
                text: 'Menunggu stok 15 pcs dari workshop sebelum jadwal kirim berikutnya.',
              },
            ]}
          />
        </Block>

        {/* Block 4 — Proses Instalasi */}
        <Block accent="#0EA5A5" icon={Wrench} title="Proses Instalasi">
          <div className="flex flex-wrap gap-6 mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                <Phone size={14} className="text-teal-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Leader Lapangan</p>
                <p className="font-semibold text-sm text-gray-800">Bpk. Supriadi (0812-3456-7890)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                <Users size={14} className="text-teal-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Jumlah Tim</p>
                <p className="font-semibold text-sm text-gray-800">4 Orang</p>
              </div>
            </div>
          </div>

          {/* Animated flowing progress bar */}
          <div className="mb-1">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="font-semibold text-gray-700">Progress Instalasi</span>
              <span className="font-bold text-teal-600">65%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden">
              <div
                className="h-3.5 rounded-full relative overflow-hidden transition-all duration-1000 ease-out"
                style={{
                  width: '65%',
                  background: 'linear-gradient(90deg, #0EA5A5 0%, #0084C9 100%)',
                }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage:
                      'linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.35) 35%, transparent 60%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.8s linear infinite',
                  }}
                />
              </div>
            </div>
          </div>
          <style>{`
            @keyframes shimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}</style>

          <NoteSection
            moduleName="Tim Instalasi Lapangan"
            accent="#0EA5A5"
            initialNotes={[
              {
                author: 'Supriadi',
                role: 'Leader Lapangan',
                time: '21 Jul 2026, 11:05',
                text: 'Instalasi kamar 401-410 selesai hari ini, lanjut ke lantai 5 besok pagi.',
              },
            ]}
          />
        </Block>
      </div>
    </div>
  );
};

export default DetailSO;