import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Paperclip,
  Search,
  ArrowLeft,
  Loader2,
  File as FileIcon,
  Image as ImageIcon,
} from 'lucide-react';
import { callApi } from '../services/api';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');

const formatTime = (iso) =>
  new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const initials = (nama) =>
  (nama || 'U').trim().split(' ').slice(0, 2).map((w) => w[0].toUpperCase()).join('');

const AvatarImg = ({ user, size = 'w-10 h-10' }) =>
  user?.avatar_url ? (
    <img src={user.avatar_url.startsWith('/uploads/') ? API_ORIGIN + user.avatar_url : user.avatar_url} alt=""
      className={`${size} rounded-full object-cover border border-gray-200 dark:border-gray-700`}
      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
  ) : null;

const AvatarFallback = ({ user, size = 'w-10 h-10' }) => (
  <div className={`${size} rounded-full bg-gradient-to-tr from-[#0F3B6C] to-[#0084C9] text-white items-center justify-center font-bold text-xs`}
    style={{ display: user?.avatar_url ? 'none' : 'flex' }}>
    {initials(user?.nama)}
  </div>
);

export default function ChatBubble() {
  const [isOpen, setIsOpen] = useState(false);          // panel keseluruhan
  const [view, setView] = useState('list');             // 'list' | 'chat' | 'new'
  const [conversations, setConversations] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [search, setSearch] = useState('');
  const [activeConv, setActiveConv] = useState(null);   // { id, partner }
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState(null);   // { base64Data, mimeType, fileName }
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMsg, setIsLoadingMsg] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);

  const fileRef = useRef(null);
  const msgEndRef = useRef(null);

  const me = JSON.parse(localStorage.getItem('user') || 'null');

  const loadConversations = useCallback(async () => {
    const res = await callApi('GET_CONVERSATIONS');
    if (res.status === 'success') {
      setConversations(res.data || []);
      setTotalUnread((res.data || []).reduce((a, c) => a + (c.unread || 0), 0));
    }
  }, []);

  // Badge bubble tetap segar walau panel tertutup
  useEffect(() => {
    loadConversations();
    const t = setInterval(loadConversations, 10000);
    return () => clearInterval(t);
  }, [loadConversations]);

  const loadMessages = useCallback(async (convId, afterId = 0, append = false) => {
    if (!append) setIsLoadingMsg(true);
    const res = await callApi('GET_CHAT_MESSAGES', { conversationId: convId, afterId });
    if (res.status === 'success') {
      setMessages((prev) => (append ? [...prev, ...(res.data.items || [])] : res.data.items || []));
    }
    if (!append) setIsLoadingMsg(false);
  }, []);

  // Polling pesan baru saat panel chat terbuka
  useEffect(() => {
    if (!isOpen || view !== 'chat' || !activeConv) return;
    const t = setInterval(() => {
      const lastId = messages.length ? messages[messages.length - 1].id : 0;
      loadMessages(activeConv.id, lastId, true);
      loadConversations(); // refresh unread juga
    }, 5000);
    return () => clearInterval(t);
  }, [isOpen, view, activeConv, messages, loadMessages, loadConversations]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openConversation = async (conv) => {
    setView('chat');
    setActiveConv({ id: conv.conversation_id || conv.id, partner: conv.partner });
    setMessages([]);
    await loadMessages(conv.conversation_id || conv.id);
    loadConversations();
  };

  const startChatWith = async (user) => {
    const res = await callApi('START_CHAT', { userId: user.id });
    if (res.status === 'success') {
      setSearch('');
      setView('chat');
      setActiveConv({ id: res.data.conversation_id, partner: res.data.partner });
      setMessages([]);
      await loadMessages(res.data.conversation_id);
    }
  };

  const handlePickFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    lampirkanFile(file);
    e.target.value = '';
  };

  // Paste gambar langsung dari clipboard (mis. habis screenshot)
  const handlePaste = (e) => {
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.type && item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
          lampirkanFile(new File([file], `paste-${Date.now()}.${ext}`, { type: file.type }));
        }
        return;
      }
    }
  };

  const lampirkanFile = (file) => {
    if (file.size > 10 * 1024 * 1024) {
      alert('Ukuran file maksimal 10MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({ base64Data: reader.result, mimeType: file.type, fileName: file.name });
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!input.trim() && !attachment) || isSending) return;
    setIsSending(true);
    try {
      const res = await callApi('SEND_CHAT_MESSAGE', {
        conversationId: activeConv.id,
        content: input.trim(),
        ...(attachment || {}),
      });
      if (res.status === 'success') {
        setInput('');
        setAttachment(null);
        await loadMessages(activeConv.id);
      }
    } finally {
      setIsSending(false);
    }
  };

  const renderAttachment = (msg) => {
    if (!msg.attachment_path) return null;
    const url = API_ORIGIN + msg.attachment_path;
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.attachment_path);
    return (
      <div className="mt-2">
        {isImage ? (
          <a href={url} target="_blank" rel="noreferrer">
            <img src={url} alt={msg.attachment_name} className="max-w-[220px] rounded-lg border border-black/10" />
          </a>
        ) : (
          <a href={url} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/5 dark:bg-white/10 text-xs font-medium underline">
            <FileIcon size={14} /> {msg.attachment_name || 'lampiran'}
          </a>
        )}
      </div>
    );
  };

  const filteredDirectory = directory.filter((u) =>
    !search ||
    (u.nama || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Tombol bubble pojok kanan bawah */}
      <button
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) { setView('list'); loadConversations(); } }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-tr from-[#0F3B6C] to-[#0084C9] text-white shadow-xl hover:scale-105 transition-transform flex items-center justify-center"
        title="Chat"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
        {!isOpen && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {/* Panel chat */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[92vw] max-w-sm h-[540px] max-h-[75vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-[#0F3B6C] to-[#0084C9] text-white flex items-center gap-3">
            {view !== 'list' ? (
              <button onClick={() => { setView('list'); setActiveConv(null); }} className="p-1 rounded hover:bg-white/20" title="Kembali ke inbox">
                <ArrowLeft size={18} />
              </button>
            ) : (
              <MessageCircle size={18} />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">
                {view === 'chat' ? activeConv?.partner?.nama : view === 'new' ? 'Cari Pengguna' : 'Chat'}
              </p>
              {view === 'chat' && activeConv?.partner?.username && (
                <p className="text-[11px] text-white/70 truncate">@{activeConv.partner.username}</p>
              )}
              {view === 'new' && (
                <p className="text-[11px] text-white/70">Tekan Esc untuk kembali ke inbox</p>
              )}
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 rounded hover:bg-white/20">
              <X size={18} />
            </button>
          </div>

          {/* View: daftar percakapan */}
          {view === 'list' && (
            <>
              <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                <button
                  onClick={async () => {
                    setView('new');
                    const res = await callApi('GET_USER_DIRECTORY');
                    if (res.status === 'success') setDirectory(res.data || []);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0084C9]/10 text-[#0084C9] text-sm font-medium hover:bg-[#0084C9]/20 transition-colors"
                >
                  <Search size={16} /> Mulai Chat Baru
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {conversations.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-500">
                    Belum ada percakapan.<br />Mulai chat lewat tombol di atas.
                  </div>
                ) : (
                  conversations.map((c) => (
                    <button key={c.conversation_id} onClick={() => openConversation(c)}
                      className="w-full text-left p-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-50 dark:border-gray-700/50">
                      <div className="relative">
                        <AvatarImg user={c.partner} />
                        <AvatarFallback user={c.partner} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{c.partner.nama}</p>
                          {c.last_message && (
                            <span className="text-[10px] text-gray-400 flex-shrink-0">{formatTime(c.last_message.date)}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {c.last_message
                            ? `${c.last_message.mine ? 'Anda: ' : ''}${c.last_message.content || `📎 ${c.last_message.attachment_name || 'lampiran'}`}`
                            : 'Belum ada pesan'}
                        </p>
                      </div>
                      {c.unread > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          {c.unread}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          {/* View: cari user baru */}
          {view === 'new' && (
            <div className="flex flex-col h-full">
              <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { e.preventDefault(); setSearch(''); setView('list'); }
                  }}
                  placeholder="Cari nama atau @username... (Esc untuk kembali)"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0084C9]"
                />
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {filteredDirectory.map((u) => (
                  <button key={u.id} onClick={() => startChatWith(u)}
                    className="w-full text-left p-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-50 dark:border-gray-700/50">
                    <div className="relative">
                      <AvatarImg user={u} />
                      <AvatarFallback user={u} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{u.nama}</p>
                      <p className="text-xs text-gray-500 truncate">{u.username ? `@${u.username}` : u.email}</p>
                    </div>
                  </button>
                ))}
                {filteredDirectory.length === 0 && (
                  <div className="p-6 text-center text-sm text-gray-500">Tidak ada pengguna ditemukan.</div>
                )}
              </div>
            </div>
          )}

          {/* View: isi percakapan */}
          {view === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 bg-gray-50 dark:bg-gray-900/40">
                {isLoadingMsg ? (
                  <div className="flex justify-center p-6"><Loader2 className="animate-spin text-[#0084C9]" size={22} /></div>
                ) : messages.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-500">Mulai percakapan dengan menyapa 👋</div>
                ) : (
                  messages.map((m) => {
                    const mine = m.sender_id === me?.id;
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm ${
                          mine
                            ? 'bg-[#0084C9] text-white rounded-br-md'
                            : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-bl-md'
                        }`}>
                          {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                          {renderAttachment(m)}
                          <p className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-gray-400'}`}>
                            {formatTime(m.date)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={msgEndRef} />
              </div>

              {/* Preview lampiran sebelum kirim */}
              {attachment && (
                <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 text-xs bg-gray-50 dark:bg-gray-800">
                  {attachment.mimeType?.startsWith('image/') && attachment.base64Data ? (
                    <img src={attachment.base64Data} alt="" className="w-10 h-10 object-cover rounded-lg border border-gray-200 dark:border-gray-600" />
                  ) : (
                    <ImageIcon size={14} className="text-[#0084C9]" />
                  )}
                  <span className="flex-1 truncate text-gray-600 dark:text-gray-300">{attachment.fileName}</span>
                  <button onClick={() => setAttachment(null)} className="text-red-500 hover:text-red-600"><X size={14} /></button>
                </div>
              )}

              {/* Input pesan */}
              <form onSubmit={handleSend} className="p-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2">
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="p-2 rounded-full text-gray-500 hover:text-[#0084C9] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Lampirkan file atau gambar">
                  <Paperclip size={18} />
                </button>
                <input ref={fileRef} type="file" onChange={handlePickFile} className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip" />
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onPaste={handlePaste}
                  placeholder="Tulis pesan... (bisa paste gambar)"
                  className="flex-1 px-3 py-2 text-sm rounded-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0084C9]"
                />
                <button type="submit" disabled={isSending || (!input.trim() && !attachment)}
                  className="p-2 rounded-full bg-[#0084C9] text-white hover:bg-[#006bb3] disabled:opacity-50 transition-colors">
                  {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
