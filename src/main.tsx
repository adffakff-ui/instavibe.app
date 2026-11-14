import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

if (import.meta.env.PROD) {
  try {
    registerSW({
      immediate: true,
      onRegisterError(err) {
        console.warn('Service worker registration notice:', err);
      },
    });
  } catch (err) {
    console.warn('PWA setup notice:', err);
  }
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
  if ('caches' in window) {
    caches.keys().then((keys) => {
      for (const key of keys) {
        if (key.startsWith('instavibe-cache')) {
          caches.delete(key);
        }
      }
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
