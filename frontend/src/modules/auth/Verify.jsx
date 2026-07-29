import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { callApi } from '../../services/api'; // Jembatan GAS kita
import { CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';

export default function Verify() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  // Status: 'loading', 'success', 'error'
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Sedang memverifikasi akun Anda...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Link verifikasi tidak valid. Token tidak ditemukan.');
      return;
    }

    const verifyToken = async () => {
      try {
        // Menembak GAS menggunakan callApi
        const response = await callApi('VERIFY_TOKEN', { token });
        
        if (response.status === 'success') {
          setStatus('success');
          setMessage(response.message);
        } else {
          setStatus('error');
          setMessage(response.message);
        }
      } catch (error) {
        setStatus('error');
        setMessage('Gagal memverifikasi akun. Kesalahan koneksi ke server.');
      }
    };

    verifyToken();
  }, [token]);

  return (
    <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden transform transition-all text-center p-8">
      
      {/* Icon Status */}
      <div className="flex justify-center mb-6">
        {status === 'loading' && <Loader2 size={64} className="text-aira-cyan animate-spin" />}
        {status === 'success' && <CheckCircle size={64} className="text-green-500" />}
        {status === 'error' && <XCircle size={64} className="text-red-500" />}
      </div>

      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
        {status === 'loading' && 'Memproses...'}
        {status === 'success' && 'Verifikasi Berhasil!'}
        {status === 'error' && 'Verifikasi Gagal'}
      </h1>
      
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        {message}
      </p>

      {/* Tombol Aksi */}
      {status !== 'loading' && (
        <Link 
          to="/login"
          className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 bg-aira-navy hover:bg-aira-cyan text-white font-semibold rounded-xl transition-all duration-300"
        >
          Menuju Halaman Login <ArrowRight size={18} />
        </Link>
      )}

    </div>
  );
}