// Lokasi: src/App.jsx

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';

// Import Cangkang Layout
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './layouts/AdminLayout';
import AuthLayout from './layouts/AuthLayout';

// Import Modul Halaman Auth
import Login from './modules/auth/Login'; 
import Register from './modules/auth/Register';
import Verify from './modules/auth/Verify';

// Import Modul Inti Mulia Everything
import Developer from './modules/developer/Developer';
import Pengaturan from './modules/settings/Pengaturan';
import Profile from './modules/profile/Profile'; 

import DashboardSO from './modules/so/DashboardSO';
import CreateSO from './modules/so/CreateSO';
import DetailSO from './modules/so/DetailSO';

// Dummy Components Sementara
const Dashboard = () => (
  <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
    <h2 className="text-2xl font-bold text-aira-navy dark:text-aira-cyan mb-2">Dashboard Utama</h2>
    <p className="text-gray-500 dark:text-gray-400">Selamat datang di Enterprise Portal Mulia Everything.</p>
  </div>
);

const NotFound = () => (
  <div className="flex flex-col items-center justify-center h-[60vh] text-center">
    <h1 className="text-6xl font-bold text-aira-navy dark:text-aira-cyan mb-4">404</h1>
    <p className="text-gray-500 dark:text-gray-400 text-lg">Wah, halaman ini masih dalam tahap pembangunan atau tidak ditemukan.</p>
  </div>
);

export default function App() {
  return (
    <ThemeProvider>
      <Routes>
        
        {/* =========================================
            ROUTE AUTENTIKASI (Area Publik, Tanpa Sidebar)
            ========================================= */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify" element={<Verify />} />
        </Route>

        {/* =========================================
            ROUTE SISTEM ADMIN (Area Privat, Dilindungi Satpam)
            ========================================= */}
        <Route element={<ProtectedRoute />}>
          
          {/* Semua yang ada di dalam AdminLayout otomatis terlindungi */}
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="profil" element={<Profile />} />
            <Route path="developer" element={<Developer />} />
            <Route path="pengaturan" element={<Pengaturan />} />
            <Route path="*" element={<NotFound />} />
            <Route path="/so" element={<DashboardSO />} />
            <Route path="/so/create" element={<CreateSO />} />
            <Route path="/so/detail/:id" element={<DetailSO />} />
          </Route>

        </Route>

      </Routes>
    </ThemeProvider>
  );
}