/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Ini wajib untuk mengaktifkan sistem Dark Mode nanti
  theme: {
    extend: {
      colors: {
        aira: {
          navy: '#0A192F',       // Biru Dongker utama
          cyan: '#64FFDA',       // Biru Muda untuk aksen/tombol
          light: '#F3F4F6',      // Abu-abu terang untuk background Light Mode
          dark: '#112240',       // Background alternatif untuk Dark Mode
        }
      }
    },
  },
  plugins: [],
}