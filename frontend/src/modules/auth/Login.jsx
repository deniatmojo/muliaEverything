import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { callApi } from '../../services/api'; // Jembatan GAS kita
import { Lock, Mail, RefreshCw, AlertCircle, Clock } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sesiBerakhir = searchParams.get('expired') === '1';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [isCaptchaValid, setIsCaptchaValid] = useState(false);

  const generateCaptcha = () => {
    setNum1(Math.floor(Math.random() * 10) + 1);
    setNum2(Math.floor(Math.random() * 10) + 1);
    setCaptchaAnswer('');
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  useEffect(() => {
    if (captchaAnswer !== '' && parseInt(captchaAnswer) === num1 + num2) {
      setIsCaptchaValid(true);
    } else {
      setIsCaptchaValid(false);
    }
  }, [captchaAnswer, num1, num2]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!isCaptchaValid) return;

    setIsLoading(true);
    setError('');

    try {
      // Menembak GAS menggunakan callApi
      const response = await callApi('LOGIN', { email, password });

      if (response.status === 'success') {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        navigate('/');
      } else {
        setError(response.message);
        generateCaptcha();
      }
    } catch (err) {
      setError('Terjadi kesalahan saat menghubungi server.');
      generateCaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden transform transition-all">
      
      <div className="bg-aira-navy p-8 text-center relative">
        <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl font-black text-aira-cyan">M</span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-wide">
          MULIA <span className="text-aira-cyan">EVERYTHING</span>
        </h1>
        <p className="text-gray-300 mt-2 text-sm font-medium">Enterprise Portal</p>
      </div>

      <div className="p-8">
        <form onSubmit={handleLogin} className="space-y-6">

          {sesiBerakhir && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
              <Clock size={18} className="flex-shrink-0" />
              <p>Sesi Anda telah berakhir. Silakan login kembali.</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              <AlertCircle size={18} className="flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Username / Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                autoCapitalize="none"
                required
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-aira-cyan focus:border-transparent transition-all"
                placeholder="username atau email@mulia.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Kata Sandi</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                required
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-aira-cyan focus:border-transparent transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Verifikasi Keamanan
            </label>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-aira-navy dark:text-aira-cyan bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 whitespace-nowrap">
                {num1} + {num2} = ?
              </span>
              <input
                type="number"
                required
                className="block w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-aira-cyan"
                placeholder="Jawaban"
                value={captchaAnswer}
                onChange={(e) => setCaptchaAnswer(e.target.value)}
                disabled={isLoading}
              />
              <button 
                type="button" 
                onClick={generateCaptcha}
                disabled={isLoading}
                className="p-2.5 text-gray-400 hover:text-aira-cyan bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 transition-colors"
                title="Ganti Angka"
              >
                <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={!isCaptchaValid || isLoading}
            className={`w-full py-3 px-4 rounded-xl text-white font-semibold shadow-md transition-all duration-300
              ${(isCaptchaValid && !isLoading) 
                ? 'bg-aira-navy hover:bg-aira-cyan transform hover:-translate-y-0.5' 
                : 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'}
            `}
          >
            {isLoading ? 'Memproses...' : (isCaptchaValid ? 'Masuk ke Sistem' : 'Selesaikan Captcha')}
          </button>
          
          <p className="text-center mt-4 text-sm text-gray-600 dark:text-gray-400">
            Belum punya akun?{' '}
            <Link to="/register" className="text-aira-cyan font-semibold hover:underline">
              Daftar di sini
            </Link>
          </p>

        </form>
      </div>
    </div>
  );
}