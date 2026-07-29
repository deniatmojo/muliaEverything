import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { callApi } from '../../services/api'; // Jembatan GAS kita
import { User, Mail, Lock, ArrowLeft, CheckCircle } from 'lucide-react';

export default function Register() {
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      // Menembak GAS menggunakan callApi
      const response = await callApi('REGISTER', { nama, email, password });

      if (response.status === 'success') {
        setIsSuccess(true);
        setMessage(response.message);
      } else {
        setIsSuccess(false);
        setMessage(response.message);
      }
    } catch (error) {
      setIsSuccess(false);
      setMessage('Terjadi kesalahan saat menghubungi server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden transform transition-all">
      
      <div className="bg-aira-navy p-8 text-center relative">
        <Link to="/login" className="absolute top-6 left-6 text-white/70 hover:text-white transition-colors" title="Kembali ke Login">
          <ArrowLeft size={24} />
        </Link>
        <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl font-black text-aira-cyan">M</span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-wide">
          BUAT <span className="text-aira-cyan">AKUN</span>
        </h1>
        <p className="text-gray-300 mt-2 text-sm font-medium">Portal Mulia Everything</p>
      </div>

      <div className="p-8">
        {isSuccess ? (
          <div className="text-center py-6">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Pendaftaran Berhasil!</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">{message}</p>
            <Link to="/login" className="inline-block w-full py-3 px-4 rounded-xl bg-aira-navy text-white font-semibold hover:bg-aira-cyan transition-colors">
              Kembali ke Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-5">
            
            {!isSuccess && message && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm text-center">
                {message}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nama Lengkap</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-aira-cyan focus:border-transparent transition-all"
                  placeholder="Deni Atmojo"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email Akun</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-aira-cyan focus:border-transparent transition-all"
                  placeholder="email@mulia.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Kata Sandi</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  required
                  minLength="6"
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-aira-cyan focus:border-transparent transition-all"
                  placeholder="Minimal 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-xl text-white font-semibold shadow-md transition-all duration-300 mt-2
                ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-aira-navy hover:bg-aira-cyan transform hover:-translate-y-0.5'}
              `}
            >
              {isLoading ? 'Memproses...' : 'Daftar Akun'}
            </button>
            
          </form>
        )}
      </div>
    </div>
  );
}