import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

function getRootElement(): HTMLElement {
  const existingRoot = document.getElementById('root');
  if (existingRoot) return existingRoot;

  // Recover from a malformed or outdated HTML shell instead of failing before React starts.
  const root = document.createElement('div');
  root.id = 'root';
  document.body.appendChild(root);
  console.error('InstaVibe startup: #root was missing; created a fallback mount point.');
  return root;
}

const root = createRoot(getRootElement());
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

function setupServiceWorker() {
  if (import.meta.env.PROD) {
    try {
      registerSW({
        immediate: true,
        onRegisterError(error) {
          // PWA support is optional; a registration failure must not prevent app startup.
          console.warn('Service worker registration notice:', error);
        },
      });
    } catch (error) {
      console.warn('PWA setup notice:', error);
    }
  }
}

// Render the app first. Service worker registration is non-critical and runs after first paint.
if (import.meta.env.PROD) {
  const schedule = window.requestIdleCallback ?? ((callback: IdleRequestCallback) => window.setTimeout(callback, 0));
  schedule(() => setupServiceWorker());
}
