import React, { useState, useEffect } from 'react';
import { callApi } from '../../services/api'; // Jembatan GAS kita
import { 
  ShieldAlert, ToggleLeft, ToggleRight, CheckCircle, XCircle, 
  Users, Loader2, X, Copy, KeyRound, Plus, LayoutGrid, 
  Edit, Save, CheckCircle2, AlertCircle 
} from 'lucide-react';

// 🌟 KAMUS ALL_MENUS UNTUK RBAC MULIA EVERYTHING
// Catatan: Menu yang sudah tidak dipakai bisa Anda hapus nanti
const ALL_MENUS = [
  { path: '/', label: 'Dashboard Utama' },
  { path: '/profil', label: 'Profil Karyawan' },
  { path: '/so', label: 'Project / SO' },
  { path: '/developer', label: 'Developer (Ruang Kendali)' },
  { path: '/pengaturan', label: 'Pengaturan Sistem' },
];

export default function Developer() {
  const [notice, setNotice] = useState({ show: false, message: '', type: 'success' });

  const showNotice = (message, type = 'success') => {
    setNotice({ show: true, message, type });
    setTimeout(() => setNotice({ show: false, message: '', type: 'success' }), 4000);
  };

  const [isDevMode, setIsDevMode] = useState(false);
  
  const [pendingUsers, setPendingUsers] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [roleForm, setRoleForm] = useState({ nama_role: '', akses_menu: ['/'] });
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);

  const [userRolesEdit, setUserRolesEdit] = useState({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRoleForApproval, setSelectedRoleForApproval] = useState('');
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);
  const [approvalResult, setApprovalResult] = useState(null);

  useEffect(() => {
    setIsDevMode(localStorage.getItem('isDevMode') === 'true');
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      // Menembak GAS secara paralel
      const [resPending, resRoles, resActive] = await Promise.all([
        callApi('GET_PENDING_USERS'),
        callApi('GET_ROLES'),
        callApi('GET_ACTIVE_USERS')
      ]);

      if (resPending.status === 'success') setPendingUsers(resPending.data || []);
      if (resRoles.status === 'success') {
        setRoles(resRoles.data || []);
        if (resRoles.data && resRoles.data.length > 0) setSelectedRoleForApproval(resRoles.data[0].nama_role);
      }
      if (resActive.status === 'success') setActiveUsers(resActive.data || []);
      
    } catch (error) {
      showNotice('Gagal mengambil data dari server GAS.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleDevMode = () => {
    const newStatus = !isDevMode;
    setIsDevMode(newStatus);
    localStorage.setItem('isDevMode', newStatus);
    showNotice(`Mode Pengembangan ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}!`);
  };

  const handleMenuCheckbox = (path) => {
    setRoleForm(prev => {
      const isSelected = prev.akses_menu.includes(path);
      return {
        ...prev,
        akses_menu: isSelected 
          ? prev.akses_menu.filter(p => p !== path) 
          : [...prev.akses_menu, path]
      };
    });
  };

  const handleEditRoleClick = (role) => {
    setEditingRoleId(role.id);
    let parsedAkses = [];
    if (typeof role.akses_menu === 'string') {
      try { parsedAkses = JSON.parse(role.akses_menu); } catch (e) { parsedAkses = ['/']; }
    } else if (Array.isArray(role.akses_menu)) {
      parsedAkses = role.akses_menu;
    }
    setRoleForm({ nama_role: role.nama_role, akses_menu: parsedAkses });
    showNotice(`Mode Edit aktif untuk role: ${role.nama_role}`, 'success');
  };

  const handleCancelEditRole = () => {
    setEditingRoleId(null);
    setRoleForm({ nama_role: '', akses_menu: ['/'] });
  };

  const handleSubmitRole = async (e) => {
    e.preventDefault();
    if (roleForm.akses_menu.length === 0) return showNotice("Pilih minimal 1 hak akses menu!", "error");

    setIsSubmittingRole(true);
    try {
      const payload = {
        id: editingRoleId, // Akan null jika buat baru
        nama_role: roleForm.nama_role,
        akses_menu: roleForm.akses_menu
      };
      
      const response = await callApi('SAVE_ROLE', payload);
      
      if (response.status === 'success') {
        showNotice(editingRoleId ? 'Role berhasil diperbarui!' : 'Role baru berhasil ditambahkan!');
        handleCancelEditRole();
        fetchAllData();
      } else {
        showNotice(response.message, 'error');
      }
    } catch (error) {
      showNotice('Gagal menyimpan role ke server', 'error');
    } finally {
      setIsSubmittingRole(false);
    }
  };

  const handleUserRoleChange = (userId, newRole) => {
    setUserRolesEdit(prev => ({ ...prev, [userId]: newRole }));
  };

  const handleSaveUserRole = async (userId) => {
    const roleToSave = userRolesEdit[userId];
    if (!roleToSave) return;
    
    try {
      const response = await callApi('UPDATE_USER_ROLE', { userId, role: roleToSave });
      
      if (response.status === 'success') {
        showNotice('Hak akses pengguna berhasil diubah!');
        const newEditState = { ...userRolesEdit };
        delete newEditState[userId];
        setUserRolesEdit(newEditState);
        fetchAllData();
      } else {
        showNotice(response.message, 'error');
      }
    } catch (error) {
      showNotice('Gagal mengubah role pengguna.', 'error');
    }
  };

  const handleOpenApproveModal = (user) => {
    setSelectedUser(user);
    setApprovalResult(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
    if (approvalResult) fetchAllData();
  };

  const handleApproveSubmit = async () => {
    setIsProcessingApproval(true);
    try {
      const response = await callApi('APPROVE_USER', {
        userId: selectedUser.id,
        role: selectedRoleForApproval
      });
      
      if (response.status === 'success') {
        setApprovalResult(response.data);
        showNotice('Pendaftaran berhasil disetujui!');
      } else {
        showNotice(response.message, 'error');
      }
    } catch (error) {
      showNotice('Terjadi kesalahan sistem.', 'error');
    } finally {
      setIsProcessingApproval(false);
    }
  };

  return (
    <div className="space-y-6 relative">

      <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-500 ease-in-out ${notice.show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10 pointer-events-none'}`}>
        <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl shadow-xl border ${notice.type === 'error' ? 'bg-red-50 dark:bg-red-900/90 border-red-200 text-red-600 dark:text-red-100' : 'bg-green-50 dark:bg-green-900/90 border-green-200 text-green-600 dark:text-green-100'}`}>
          {notice.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span className="font-medium text-sm">{notice.message}</span>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-aira-navy dark:text-aira-cyan flex items-center gap-3">
          <ShieldAlert size={28} /> Ruang Kendali Developer
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Pusat kendali pengaturan sistem, manajemen role, dan pengguna Mulia Everything.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-1 space-y-6">
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Pengaturan Sistem</h3>
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
              <div>
                <p className="font-semibold text-gray-800 dark:text-white">Mode Pengembangan</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Nonaktifkan wajib login</p>
              </div>
              <button onClick={handleToggleDevMode} className={`transition-colors duration-300 ${isDevMode ? 'text-aira-cyan' : 'text-gray-400'}`}>
                {isDevMode ? <ToggleRight size={40} /> : <ToggleLeft size={40} />}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <KeyRound size={20} className="text-aira-cyan" /> 
                {editingRoleId ? 'Edit Role' : 'Buat Role Baru'}
              </h3>
              {editingRoleId && (
                <button onClick={handleCancelEditRole} className="text-xs text-red-500 hover:underline">Batal Edit</button>
              )}
            </div>
            
            <form onSubmit={handleSubmitRole} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nama Role</label>
                <input 
                  type="text" required placeholder="Misal: Manager"
                  value={roleForm.nama_role} onChange={(e) => setRoleForm({...roleForm, nama_role: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-aira-cyan outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <LayoutGrid size={16} /> Konfigurasi Akses Menu
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg custom-scrollbar">
                  {ALL_MENUS.map((menu, idx) => (
                    <label key={idx} className="flex items-center gap-3 p-1 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={roleForm.akses_menu.includes(menu.path)}
                        onChange={() => handleMenuCheckbox(menu.path)}
                        className="w-4 h-4 text-aira-cyan rounded border-gray-300 focus:ring-aira-cyan"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{menu.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button 
                type="submit" disabled={isSubmittingRole}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-aira-navy hover:bg-aira-cyan text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {isSubmittingRole ? <Loader2 size={18} className="animate-spin" /> : (editingRoleId ? <Save size={18} /> : <Plus size={18} />)}
                {editingRoleId ? 'Simpan Perubahan' : 'Simpan Role'}
              </button>
            </form>
          </div>

        </div>

        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Daftar Role Aktif</h3>
            <div className="flex flex-wrap gap-3">
              {roles.map(r => (
                <div key={r.id} className="group relative flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-semibold transition-all hover:border-aira-cyan">
                  <KeyRound size={14} className="text-aira-cyan" /> {r.nama_role}
                  {r.nama_role !== 'Developer' && (
                    <button onClick={() => handleEditRoleClick(r)} className="ml-2 text-gray-400 hover:text-aira-cyan transition-colors" title="Edit Role">
                      <Edit size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Users size={20} className="text-green-500" /> Pengguna Terdaftar
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-700/50 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">Nama Pengguna</th>
                    <th className="px-4 py-3">Ubah Hak Akses (Role)</th>
                    <th className="px-4 py-3 text-right rounded-r-lg">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan="3" className="p-4 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-aira-cyan" /></td></tr>
                  ) : activeUsers.length === 0 ? (
                    <tr><td colSpan="3" className="p-4 text-center text-gray-500">Belum ada pengguna aktif.</td></tr>
                  ) : (
                    activeUsers.map((user) => (
                      <tr key={user.id} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-800 dark:text-white">{user.nama}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <select 
                            value={userRolesEdit[user.id] || user.role}
                            onChange={(e) => handleUserRoleChange(user.id, e.target.value)}
                            disabled={user.role === 'Developer'}
                            className="p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-xs focus:ring-aira-cyan outline-none"
                          >
                            {roles.map(r => <option key={r.id} value={r.nama_role}>{r.nama_role}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {userRolesEdit[user.id] && userRolesEdit[user.id] !== user.role && (
                            <button 
                              onClick={() => handleSaveUserRole(user.id)}
                              className="px-3 py-1.5 bg-aira-cyan text-white text-xs font-semibold rounded-lg hover:bg-teal-400 transition-colors"
                            >
                              Simpan
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Users size={20} className="text-orange-500" /> Antrean Pendaftar Baru
              </h3>
              <span className="bg-orange-100 text-orange-600 text-xs font-bold px-3 py-1 rounded-full">{pendingUsers.length} Pending</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-700/50 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">Nama & Email</th>
                    <th className="px-4 py-3 text-right rounded-r-lg">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan="2" className="p-4 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-aira-cyan" /></td></tr>
                  ) : pendingUsers.length === 0 ? (
                    <tr><td colSpan="2" className="p-4 text-center text-gray-500">Tidak ada pendaftar baru.</td></tr>
                  ) : (
                    pendingUsers.map((user) => (
                      <tr key={user.id} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-800 dark:text-white">{user.nama}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </td>
                        <td className="px-4 py-3 text-right flex justify-end gap-2">
                          <button onClick={() => handleOpenApproveModal(user)} className="p-2 bg-green-50 text-green-600 hover:bg-green-500 hover:text-white rounded-lg transition-colors"><CheckCircle size={18} /></button>
                          <button className="p-2 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-lg transition-colors"><XCircle size={18} /></button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">Persetujuan Akun</h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6">
              {approvalResult ? (
                <div className="space-y-4 text-center">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2"><CheckCircle size={32} /></div>
                  <h4 className="font-bold text-gray-800 dark:text-white text-lg">Akun Disetujui!</h4>
                  <div className="relative text-left p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-mono">{approvalResult.body_text}</p>
                    <button onClick={() => { navigator.clipboard.writeText(approvalResult.body_text); showNotice('Teks disalin ke clipboard!'); }} className="absolute top-2 right-2 p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-gray-500 hover:text-aira-cyan"><Copy size={16} /></button>
                  </div>
                  <button onClick={handleCloseModal} className="w-full mt-4 py-2 bg-aira-navy hover:bg-aira-cyan text-white font-semibold rounded-xl">Selesai</button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <p className="font-bold text-gray-800 dark:text-white">{selectedUser.nama}</p>
                    <p className="text-sm text-gray-500">{selectedUser.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tetapkan Hak Akses (Role)</label>
                    <select value={selectedRoleForApproval} onChange={(e) => setSelectedRoleForApproval(e.target.value)} className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-aira-cyan outline-none">
                      {roles.map((role) => <option key={role.id} value={role.nama_role}>{role.nama_role}</option>)}
                    </select>
                  </div>
                  <div className="pt-4 flex gap-3">
                    <button onClick={handleCloseModal} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700">Batal</button>
                    <button onClick={handleApproveSubmit} disabled={isProcessingApproval || !selectedRoleForApproval} className="flex-1 py-2.5 bg-aira-cyan hover:bg-teal-400 text-white font-semibold rounded-xl disabled:opacity-50">{isProcessingApproval ? 'Memproses...' : 'Setujui Akun'}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}