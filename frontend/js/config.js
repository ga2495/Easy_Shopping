// frontend/js/config.js — Centralized API Configuration
// Automatically adapts between Local Development (Live Server/file) and Production Deployments (Railway/Render/Vercel)

(function () {
  // If an explicit API URL is set in window.API_BASE_URL, use it
  if (typeof window.API_BASE_URL === 'string' && window.API_BASE_URL.trim() !== '') {
    window.API = window.API_BASE_URL.replace(/\/+$/, '');
    return;
  }

  const isLocalStatic = 
    window.location.protocol === 'file:' ||
    window.location.port === '5500' ||
    window.location.port === '5173' ||
    window.location.port === '8080' ||
    window.location.port === '3001';

  if (isLocalStatic) {
    // Frontend is running on a standalone dev server while backend is on port 3000
    window.API = 'http://localhost:3000';
  } else {
    // When served directly by the Express backend on Railway or any cloud host,
    // relative paths ('/auth', '/products', etc.) are used for zero-CORS requests.
    window.API = '';
  }
})();

// Global alias
var API = window.API;
