import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StickyNote, Send, Loader2, AtSign, X } from 'lucide-react';
import { callApi } from '../services/api';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');

const formatTime = (iso) =>
  new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const initials = (nama) => (nama || 'U').trim().split(' ').slice(0, 2).map((w) => w[0].toUpperCase()).join('');

/**
 * Card catatan SO dengan dukungan @mention.
 * Catatan disimpan per soId; user yang di-tag menerima notifikasi lonceng
 * yang mengarahkan ke toLink (default: /so/detail/<soId>).
 */
export default function SoNotesCard({ soId, title = 'Catatan Cepat', toLink }) {
  const [notes, setNotes] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // state autocomplete @mention
  const [mentionQuery, setMentionQuery] = useState(null); // null = tutup, string = sedang mengetik
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef(null);

  const link = toLink || `/so/detail/${soId}`;

  const loadNotes = useCallback(async () => {
    const res = await callApi('GET_SO_NOTES', { soId });
    if (res.status === 'success') setNotes(res.data || []);
    setIsLoading(false);
  }, [soId]);

  useEffect(() => {
    loadNotes();
    callApi('GET_USER_DIRECTORY').then((res) => {
      if (res.status === 'success') setDirectory(res.data || []);
    });
  }, [loadNotes]);

  // Deteksi sedang mengetik @username setelah tiap perubahan teks
  const handleChange = (e) => {
    const val = e.target.value;
    setContent(val);
    const caret = e.target.selectionStart;
    const sebelum = val.slice(0, caret);
    const match = sebelum.match(/@([a-zA-Z0-9._]*)$/);
    setMentionQuery(match ? match[1].toLowerCase() : null);
    setMentionIndex(0);
  };

  const pilihMention = (user) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const caret = textarea.selectionStart;
    const sebelum = textarea.value.slice(0, caret);
    const sesudah = textarea.value.slice(caret);
    const baru = sebelum.replace(/@([a-zA-Z0-9._]*)$/, `@${user.username} `) + sesudah;
    setContent(baru);
    setMentionQuery(null);
    requestAnimationFrame(() => textarea.focus());
  };

  const saranMention = mentionQuery === null
    ? []
    : directory.filter((u) => (u.username || '').toLowerCase().startsWith(mentionQuery)).slice(0, 5);

  const handleKeyDown = (e) => {
    if (mentionQuery !== null && saranMention.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex((i) => (i + 1) % saranMention.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex((i) => (i - 1 + saranMention.length) % saranMention.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pilihMention(saranMention[mentionIndex]); return; }
      if (e.key === 'Escape') { setMentionQuery(null); return; }
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!content.trim() || isSending) return;
    setIsSending(true);
    try {
      const res = await callApi('ADD_SO_NOTE', { soId, content: content.trim() });
      if (res.status === 'success') {
        setContent('');
        setMentionQuery(null);
        await loadNotes();
      }
    } finally {
      setIsSending(false);
    }
  };

  // Render isi catatan dengan @username yang di-highlight
  const renderContent = (text) =>
    text.split(/(@[a-zA-Z0-9._]+)/g).map((bagian, i) =>
      bagian.startsWith('@') && directory.some((u) => u.username === bagian.slice(1)) ? (
        <span key={i} className="font-semibold text-[#0084C9]">{bagian}</span>
      ) : (
        <span key={i}>{bagian}</span>
      )
    );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-yellow-100 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-xl">
          <StickyNote size={18} />
        </div>
        <h3 className="font-bold text-gray-900 dark:text-white">{title}</h3>
        <span className="text-xs text-gray-400 ml-auto">SO {soId}</span>
      </div>

      {/* Form catatan */}
      <form onSubmit={handleSend} className="relative">
        {saranMention.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 shadow-lg overflow-hidden z-20">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 flex items-center gap-1 border-b border-gray-100 dark:border-gray-600">
              <AtSign size={11} /> Tag pengguna (Enter untuk pilih)
            </div>
            {saranMention.map((u, i) => (
              <button key={u.id} type="button" onClick={() => pilihMention(u)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm ${i === mentionIndex ? 'bg-[#0084C9]/10' : 'hover:bg-gray-50 dark:hover:bg-gray-600/50'}`}>
                <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#0F3B6C] to-[#0084C9] text-white text-[10px] font-bold flex items-center justify-center">{initials(u.nama)}</span>
                <span className="flex-1 truncate text-gray-800 dark:text-white">{u.nama}</span>
                <span className="text-xs text-gray-400">@{u.username}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Tulis catatan... tag rekan dengan @username"
            className="flex-1 px-3 py-2 text-sm rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0084C9] resize-none"
          />
          <button type="submit" disabled={isSending || !content.trim()}
            className="p-2.5 rounded-xl bg-[#0084C9] text-white hover:bg-[#006bb3] disabled:opacity-50 transition-colors">
            {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </form>

      {/* Daftar catatan */}
      <div className="mt-4 space-y-3 max-h-72 overflow-y-auto custom-scrollbar pr-1">
        {isLoading ? (
          <div className="flex justify-center p-4"><Loader2 className="animate-spin text-[#0084C9]" size={20} /></div>
        ) : notes.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">Belum ada catatan. Catatan yang men-tag rekan akan muncul di lonceng notifikasi mereka.</p>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="flex items-start gap-3 p-3 bg-yellow-50/60 dark:bg-yellow-500/5 border border-yellow-100 dark:border-yellow-500/10 rounded-xl">
              {n.user_avatar ? (
                <img src={n.user_avatar.startsWith('/uploads/') ? API_ORIGIN + n.user_avatar : n.user_avatar} alt=""
                  className="w-8 h-8 rounded-full object-cover mt-0.5" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0F3B6C] to-[#0084C9] text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {initials(n.user_nama)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-800 dark:text-white truncate">
                    {n.user_nama}
                    {n.user_username && <span className="font-normal text-gray-400 ml-1">@{n.user_username}</span>}
                  </p>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{formatTime(n.date)}</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-200 mt-1 whitespace-pre-wrap break-words leading-relaxed">
                  {renderContent(n.content)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
