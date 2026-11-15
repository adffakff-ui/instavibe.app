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

    const sync = () => setTick((n) => n + 1);
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
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
      }
    } catch (err) {
      console.warn('SW apply update notice:', err);
    } finally {
      window.location.reload();
    }
  };

  const checkForUpdates = async (): Promise<'update-ready' | 'up-to-date'> => {
    setCheckingUpdate(true);
    try {
      if ('serviceWorker' in navigator) {
        const reg = window.__instavibeSwRegistration || (await navigator.serviceWorker.getRegistration());
        if (reg) {
          await reg.update();
          if (reg.waiting || globalUpdateAvailable || window.__instavibeUpdateAvailable) {
            globalUpdateAvailable = true;
            notifyListeners();
            return 'update-ready';
          }
        }
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
