import React, { useState, useEffect, useRef } from 'react';
import { callApi } from '../../services/api';
import { Loader2 } from 'lucide-react';

const Profile = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [isLoading, setIsLoading] = useState(true);
  
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    position: '',
    phone: '',
    email: '',
    username: '',
    avatar_url: '',
  });

  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
  });

  // State untuk menyimpan riwayat asli dari database
  const [activityLogs, setActivityLogs] = useState([]);

  const [toast, setToast] = useState({
    show: false,
    message: '',
    type: 'success',
  });

  const fileInputRef = useRef(null);

  const getUserData = () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  };

  const triggerToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3500);
  };

  const getDirectImageUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('/uploads/')) {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      return apiBase.replace(/\/api$/, '') + url;
    }
    if (url.includes('drive.google.com')) {
      const match = url.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w500`;
      }
    }
    return url;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const currentUser = getUserData();
        if (!currentUser) {
          triggerToast('Data sesi pengguna tidak ditemukan', 'error');
          return;
        }

        // Panggil Profil dan Aktivitas secara bersamaan
        const [resProfile, resLogs] = await Promise.all([
          callApi('GET_PROFILE', { userId: currentUser.id }),
          callApi('GET_MY_ACTIVITIES', { userId: currentUser.id })
        ]);

        if (resProfile.status === 'success') {
          setFormData({
            name: resProfile.data.name || '',
            position: resProfile.data.position || 'Karyawan Mulia Everything',
            phone: resProfile.data.phone_number || '',
            email: resProfile.data.email || '',
            username: resProfile.data.username || '',
            avatar_url: resProfile.data.avatar_url || '',
          });
        }

        if (resLogs.status === 'success') {
          setActivityLogs(resLogs.data);
        }

      } catch (error) {
        triggerToast('Koneksi ke server terputus.', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsSavingGeneral(true);

    try {
      const currentUser = getUserData();
      const response = await callApi('UPDATE_PROFILE', {
        userId: currentUser.id,
        name: formData.name,
        username: formData.username,
        phone_number: formData.phone,
        position: formData.position
      });

      if (response.status === 'success') {
        const updatedUser = { ...currentUser, nama: formData.name, username: formData.username };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        // Pancing Topbar agar ikut memperbarui tulisan namanya
        window.dispatchEvent(new Event('userUpdated'));
        
        triggerToast('Profil Anda berhasil diperbarui!', 'success');
        
        // Refresh tabel log secara instan (opsional)
        const resLogs = await callApi('GET_MY_ACTIVITIES', { userId: currentUser.id });
        if(resLogs.status === 'success') setActivityLogs(resLogs.data);
      } else {
        triggerToast(response.message || 'Gagal memperbarui profil.', 'error');
      }
    } catch (error) {
      triggerToast('Terjadi kesalahan koneksi server.', 'error');
    } finally {
      setIsSavingGeneral(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setIsSavingSecurity(true);

    try {
      const currentUser = getUserData();
      const response = await callApi('UPDATE_PASSWORD', {
        userId: currentUser.id,
        oldPassword: passwordData.oldPassword,
        newPassword: passwordData.newPassword
      });

      if (response.status === 'success') {
        triggerToast('Kata sandi Anda berhasil diperbarui!', 'success');
        setPasswordData({ oldPassword: '', newPassword: '' });
        
        const resLogs = await callApi('GET_MY_ACTIVITIES', { userId: currentUser.id });
        if(resLogs.status === 'success') setActivityLogs(resLogs.data);
      } else {
        triggerToast(response.message || 'Kata sandi lama salah.', 'error');
      }
    } catch (error) {
      triggerToast('Terjadi kesalahan koneksi server.', 'error');
    } finally {
      setIsSavingSecurity(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      triggerToast('Ukuran berkas terlalu besar. Maksimal 2MB.', 'error');
      return;
    }

    triggerToast('Sedang memproses dan mengunggah foto...', 'success');
    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result;
      const currentUser = getUserData();

      try {
        const response = await callApi('UPLOAD_AVATAR', {
          userId: currentUser.id,
          base64Data: base64Data,
          mimeType: file.type,
          fileName: file.name
        });

        if (response.status === 'success') {
          triggerToast('Foto profil berhasil diperbarui!', 'success');
          setFormData((prev) => ({ ...prev, avatar_url: response.data.avatar_url }));
          
          const updatedUser = { ...currentUser, avatar_url: response.data.avatar_url };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          
          // === INI KUNCI AGAR TOPBAR LANGSUNG BERUBAH FOTONYA ===
          window.dispatchEvent(new Event('userUpdated'));

          const resLogs = await callApi('GET_MY_ACTIVITIES', { userId: currentUser.id });
          if(resLogs.status === 'success') setActivityLogs(resLogs.data);
          
        } else {
          triggerToast(response.message || 'Gagal mengunggah gambar.', 'error');
        }
      } catch (error) {
        triggerToast('Terjadi gangguan jaringan saat mengunggah.', 'error');
      } finally {
        setIsUploading(false);
      }
    };
    
    reader.onerror = () => {
      triggerToast('Gagal membaca berkas gambar.', 'error');
      setIsUploading(false);
    };

    reader.readAsDataURL(file);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh]">
        <div className="w-10 h-10 border-4 border-[#0084C9] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500 dark:text-gray-400 text-sm font-medium">Memuat data profil Mulia Everything...</p>
      </div>
    );
  }

  const displayAvatarUrl = formData.avatar_url 
    ? getDirectImageUrl(formData.avatar_url) 
    : `https://ui-avatars.com/api/?name=${formData.name.replace(' ', '+')}&background=0084C9&color=fff&size=256`;

  return (
    <div className="min-h-screen p-6 bg-gray-50 dark:bg-[#0a0f1c] transition-colors duration-300 relative">
      
      {toast.show && (
        <div className={`fixed top-5 right-5 z-50 flex items-center p-4 rounded-xl shadow-xl border text-white transition-all duration-300 transform translate-y-0 ${
          toast.type === 'success' ? 'bg-green-600 border-green-500' : 'bg-red-600 border-red-500'
        }`}>
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#0F3B6C] dark:text-white">Profil Saya</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Kelola informasi personal, keamanan, dan aktivitas akun Anda.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-[#111827] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 text-center transition-colors duration-300">
            <div className="relative inline-block">
              
              <input 
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />

              <div className="relative w-32 h-32 mx-auto">
                <img
                  className={`w-32 h-32 rounded-full object-cover border-4 border-gray-50 dark:border-gray-700 transition-opacity ${isUploading ? 'opacity-50' : 'opacity-100'}`}
                  src={displayAvatarUrl}
                  alt="Profile Avatar"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = `https://ui-avatars.com/api/?name=${formData.name.replace(' ', '+')}&background=0084C9&color=fff&size=256`;
                  }}
                />
                
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="animate-spin text-[#0084C9]" size={32} />
                  </div>
                )}
              </div>
                              
              <button 
                type="button"
                onClick={handleAvatarClick}
                disabled={isUploading}
                className="absolute bottom-0 right-0 bg-[#0084C9] hover:bg-[#006bb3] text-white p-2 rounded-full shadow-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
              </button>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">{formData.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{formData.position}</p>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-[#111827] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors duration-300">
            
            <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
              {['general', 'security', 'history'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-4 px-4 whitespace-nowrap text-sm font-medium transition-colors ${
                    activeTab === tab ? 'text-[#0084C9] border-b-2 border-[#0084C9]' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  {tab === 'general' ? 'Informasi Dasar' : tab === 'security' ? 'Keamanan Akun' : 'Riwayat Aktivitas'}
                </button>
              ))}
            </div>

            <div className="p-6">
              
              {activeTab === 'general' && (
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nama Lengkap</label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0084C9]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nomor Telepon</label>
                      <input
                        type="text"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0084C9]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Username <span className="text-xs text-gray-400">(untuk login &amp; di-tag @)</span></label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
                        <input
                          type="text"
                          name="username"
                          value={formData.username}
                          onChange={handleInputChange}
                          autoCapitalize="none"
                          placeholder="mis. deni.atmojo"
                          className="w-full pl-8 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0084C9]"
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">3-50 karakter; huruf, angka, titik, underscore.</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Jabatan / Departemen</label>
                      <input
                        type="text"
                        name="position"
                        value={formData.position}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0084C9]"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end mt-6">
                    <button type="submit" disabled={isSavingGeneral} className="flex items-center gap-2 px-6 py-2 bg-[#0F3B6C] hover:bg-[#0a2a4d] text-white rounded-lg transition-colors font-medium disabled:opacity-70 disabled:cursor-not-allowed">
                      {isSavingGeneral && <Loader2 className="animate-spin" size={18} />}
                      {isSavingGeneral ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                  </div>
                </form>
              )}

              {activeTab === 'security' && (
                <form onSubmit={handleUpdatePassword} className="space-y-8">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Pengaturan Email</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email Operasional</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        disabled
                        className="w-full md:w-1/2 px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-400 cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <hr className="border-gray-200 dark:border-gray-700" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Ubah Kata Sandi</h3>
                    <div className="space-y-4 md:w-1/2">
                      <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Kata Sandi Lama</label>
                        <input
                          type="password"
                          name="oldPassword"
                          value={passwordData.oldPassword}
                          onChange={handlePasswordChange}
                          required
                          className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0084C9]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Kata Sandi Baru</label>
                        <input
                          type="password"
                          name="newPassword"
                          value={passwordData.newPassword}
                          onChange={handlePasswordChange}
                          required
                          className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0084C9]"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end mt-6">
                    <button type="submit" disabled={isSavingSecurity} className="flex items-center gap-2 px-6 py-2 bg-[#0084C9] hover:bg-[#006bb3] text-white rounded-lg transition-colors font-medium disabled:opacity-70 disabled:cursor-not-allowed">
                      {isSavingSecurity && <Loader2 className="animate-spin" size={18} />}
                      {isSavingSecurity ? 'Memperbarui...' : 'Perbarui Keamanan'}
                    </button>
                  </div>
                </form>
              )}

              {activeTab === 'history' && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Catatan Aktivitas Akun</h3>
                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                      <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        <tr>
                          <th className="px-4 py-3 font-medium">Waktu Akses</th>
                          <th className="px-4 py-3 font-medium">Modul/Aksi</th>
                          <th className="px-4 py-3 font-medium">Deskripsi</th>
                          <th className="px-4 py-3 font-medium text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {activityLogs.length > 0 ? activityLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                            <td className="px-4 py-3 text-gray-900 dark:text-white text-xs">{log.date}</td>
                            <td className="px-4 py-3 font-semibold text-aira-cyan text-xs">{log.action}</td>
                            <td className="px-4 py-3 text-xs">{log.description}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                log.status === 'Sukses' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {log.status}
                              </span>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                              Belum ada data aktivitas tercatat.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Profile;