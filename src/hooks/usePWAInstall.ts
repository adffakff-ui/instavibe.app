import { useEffect, useState } from 'react';
import { APP_VERSION } from '../lib/version';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __instavibeDeferredPrompt?: BeforeInstallPromptEvent | null;
    __instavibeInstalled?: boolean;
    __instavibeUpdateAvailable?: boolean;
    __instavibeApplyUpdate?: () => Promise<void> | void;
    __instavibeSwRegistration?: ServiceWorkerRegistration;
  }
}

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
let globalIsInstalled = false;
let globalUpdateAvailable = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function checkStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.startsWith('android-app://')
  );
}

if (typeof window !== 'undefined') {
  globalIsInstalled = Boolean(window.__instavibeInstalled) || checkStandaloneMode();
  globalDeferredPrompt = window.__instavibeDeferredPrompt || null;
  globalUpdateAvailable = Boolean(window.__instavibeUpdateAvailable);

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    window.__instavibeDeferredPrompt = globalDeferredPrompt;
    notifyListeners();
  });

  window.addEventListener('instavibe:install-available', () => {
    if (window.__instavibeDeferredPrompt) {
      globalDeferredPrompt = window.__instavibeDeferredPrompt;
      notifyListeners();
    }
  });

  window.addEventListener('appinstalled', () => {
    globalIsInstalled = true;
    globalDeferredPrompt = null;
    window.__instavibeInstalled = true;
    window.__instavibeDeferredPrompt = null;
    notifyListeners();
  });

  window.addEventListener('instavibe:app-installed', () => {
    globalIsInstalled = true;
    globalDeferredPrompt = null;
    notifyListeners();
  });

  window.addEventListener('instavibe:sw-update-ready', () => {
    globalUpdateAvailable = true;
    notifyListeners();
  });

  try {
    const standaloneMedia = window.matchMedia('(display-mode: standalone)');
    const onDisplayModeChange = () => {
      globalIsInstalled = checkStandaloneMode();
      notifyListeners();
    };
    if (typeof standaloneMedia.addEventListener === 'function') {
      standaloneMedia.addEventListener('change', onDisplayModeChange);
    }
  } catch {
    // Ignore matchMedia listener errors in older browsers
  }
}

export function getPWAUrls() {
  if (typeof window === 'undefined') {
    return {
      currentOrigin: '',
      publicAppUrl: '',
      browserInstallUrl: '/?install=1',
      pwaBuilderUrl: 'https://www.pwabuilder.com/',
    };
  }
  const currentOrigin = window.location.origin;
  const publicAppUrl = currentOrigin.includes('ais-dev-')
    ? currentOrigin.replace('ais-dev-', 'ais-pre-')
    : currentOrigin;
  const browserInstallUrl = `${currentOrigin}/?install=1`;
  const pwaBuilderUrl = `https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(publicAppUrl)}`;

  return {
    currentOrigin,
    publicAppUrl,
    browserInstallUrl,
    pwaBuilderUrl,
  };
}

export function usePWAInstall() {
  const [, setTick] = useState(0);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [swReady, setSwReady] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    const touchMac = /macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    setIsIOS(/iphone|ipad|ipod/.test(ua) || touchMac);
    setIsAndroid(/android/.test(ua));

    try {
      setIsEmbedded(window.self !== window.top);
    } catch {
      setIsEmbedded(true);
    }

    if (window.__instavibeDeferredPrompt && !globalDeferredPrompt) {
      globalDeferredPrompt = window.__instavibeDeferredPrompt;
      setTick((n) => n + 1);
    }

    const syncSwState = () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((reg) => {
          setSwReady(Boolean(reg || window.__instavibeSwRegistration));
        }).catch(() => {});
      }
    };
    syncSwState();

    const sync = () => {
      setTick((n) => n + 1);
      syncSwState();
    };
    listeners.add(sync);
    window.addEventListener('instavibe:sw-registered', syncSwState);
    return () => {
      listeners.delete(sync);
      window.removeEventListener('instavibe:sw-registered', syncSwState);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    const promptEvent = globalDeferredPrompt || window.__instavibeDeferredPrompt;
    if (!promptEvent) return false;
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      globalDeferredPrompt = null;
      window.__instavibeDeferredPrompt = null;
      if (outcome === 'accepted') {
        globalIsInstalled = true;
        window.__instavibeInstalled = true;
        notifyListeners();
        return true;
      }
      notifyListeners();
      return false;
    } catch (error) {
      console.warn('PWA install prompt error:', error);
      globalDeferredPrompt = null;
      window.__instavibeDeferredPrompt = null;
      notifyListeners();
      return false;
    }
  };

  const applyUpdate = async () => {
    try {
      if (typeof window.__instavibeApplyUpdate === 'function') {
        await window.__instavibeApplyUpdate();
      }
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        await reg?.update().catch(() => {});
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (err) {
      console.warn('SW apply update notice:', err);
    } finally {
      window.location.reload();
    }
  };

  const checkRemoteVersionManifest = async (): Promise<boolean> => {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return false;
      const data = await res.json();
      if (data && typeof data.version === 'string' && data.version !== APP_VERSION) {
        globalUpdateAvailable = true;
        window.__instavibeUpdateAvailable = true;
        window.dispatchEvent(new CustomEvent('instavibe:sw-update-ready'));
        notifyListeners();
        return true;
      }
    } catch {
      // Ignore network/offline version check failures
    }
    return false;
  };

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    checkRemoteVersionManifest();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkRemoteVersionManifest();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const checkForUpdates = async (): Promise<'update-ready' | 'up-to-date'> => {
    setCheckingUpdate(true);
    try {
      if ('serviceWorker' in navigator) {
        const reg = window.__instavibeSwRegistration || (await navigator.serviceWorker.getRegistration());
        if (reg) {
          await reg.update().catch(() => {});
          if (reg.waiting || globalUpdateAvailable || window.__instavibeUpdateAvailable) {
            globalUpdateAvailable = true;
            notifyListeners();
            return 'update-ready';
          }
        }
      }
      const remoteHasNewer = await checkRemoteVersionManifest();
      if (remoteHasNewer) {
        return 'update-ready';
      }
      return globalUpdateAvailable ? 'update-ready' : 'up-to-date';
    } catch {
      return 'up-to-date';
    } finally {
      setCheckingUpdate(false);
    }
  };

  const urls = getPWAUrls();

  return {
    appVersion: APP_VERSION,
    isInstallable: Boolean(globalDeferredPrompt || window.__instavibeDeferredPrompt),
    isInstalled: globalIsInstalled,
    isIOS,
    isAndroid,
    isEmbedded,
    swReady,
    updateAvailable: globalUpdateAvailable,
    checkingUpdate,
    install,
    applyUpdate,
    checkForUpdates,
    ...urls,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
