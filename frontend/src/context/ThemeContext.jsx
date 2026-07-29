import { createContext, useState, useEffect } from 'react';

// Membuat Context (Sinyal Radio)
export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Cek apakah user sebelumnya sudah memilih tema (disimpan di Local Storage browser)
  // Jika belum, default ke 'light'
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  // Efek yang dijalankan setiap kali 'theme' berubah
  useEffect(() => {
    const root = window.document.documentElement; // Mengambil tag <html> utama
    root.classList.remove('light', 'dark'); // Hapus class lama
    root.classList.add(theme); // Pasang class baru ('light' atau 'dark')
    localStorage.setItem('theme', theme); // Simpan pilihan ke memori browser
  }, [theme]);

  // Fungsi sakelar untuk mengubah tema
  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};