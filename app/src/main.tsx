import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import { applyBrand } from './lib/brand';
import { initOta } from './lib/ota';
import './theme.css';

// Applica il colore dell'app salvato prima del primo render (evita flash).
applyBrand();

// Aggiornamenti OTA (solo app nativa; no-op su web). Non blocca il render.
void initOta();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
