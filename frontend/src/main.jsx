import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import App from './App.jsx';
import './index.css'; // File di mana Tailwind diimpor

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Bungkus dengan Router untuk navigasi halaman */}
    <BrowserRouter>
      {/* Bungkus dengan ThemeProvider agar seluruh web mengenali Dark Mode */}
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);