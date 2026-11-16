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
  if (!('serviceWorker' in navigator)) return;
  try {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        (window as any).__instavibeUpdateAvailable = true;
        (window as any).__instavibeApplyUpdate = () => updateSW(true);
        window.dispatchEvent(new CustomEvent('instavibe:sw-update-ready'));
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        (window as any).__instavibeSwRegistration = registration;
        window.dispatchEvent(new CustomEvent('instavibe:sw-registered'));
        // Clean up any legacy /sw.js worker so only the active VitePWA worker controls scope
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((reg) => {
            const scriptUrl = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
            if (scriptUrl.endsWith('/sw.js') && reg !== registration) {
              reg.unregister().catch(() => {});
            }
          });
        }).catch(() => {});
        // Check for new versions periodically and when returning to the app
        window.setInterval(() => {
          registration.update().catch(() => {});
        }, 30 * 60 * 1000);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        });
      },
      onRegisterError(error) {
        // PWA support is optional; a registration failure must not prevent app startup.
        console.warn('Service worker registration notice:', error);
      },
    });
    (window as any).__instavibeApplyUpdate = () => updateSW(true);
  } catch (error) {
    console.warn('PWA setup notice:', error);
  }
}

// Render the app first. Service worker registration is non-critical and runs after first paint.
const schedule = window.requestIdleCallback ?? ((callback: IdleRequestCallback) => window.setTimeout(callback, 0));
schedule(() => setupServiceWorker());
