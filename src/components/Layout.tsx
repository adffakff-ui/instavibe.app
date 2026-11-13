import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import Navigation from './Navigation';
import Header from './Header';
import { useAuth } from '../context/AuthContext';
import { usePWAInstall } from '../hooks/usePWAInstall';

export default function Layout({
  children,
  currentView,
  setView,
  onOpenProfile,
  onOpenInstall,
}: {
  children: React.ReactNode;
  currentView: 'feed' | 'messages' | 'explore' | 'profile' | 'notifications' | 'discover' | 'analytics' | 'reels' | 'live';
  setView: (view: 'feed' | 'messages' | 'explore' | 'profile' | 'notifications' | 'discover' | 'analytics' | 'reels' | 'live') => void;
  onOpenProfile: (uid: string) => void;
  onOpenInstall: () => void;
}) {
  const { language } = useAuth();
  const { isInstalled, isInstallable, install } = usePWAInstall();
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('instavibe_install_banner_dismissed') === '1';
    } catch {
      return false;
    }
  });

  const dismissBanner = () => {
    setBannerDismissed(true);
    try {
      sessionStorage.setItem('instavibe_install_banner_dismissed', '1');
    } catch {
      // Ignore storage failures
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 md:pb-0 md:ps-20 lg:ps-64">
      <Header
        currentView={currentView}
        setView={setView}
        onOpenProfile={onOpenProfile}
        onOpenInstall={onOpenInstall}
      />
      <Navigation
        currentView={currentView}
        setView={setView}
        onOpenInstall={onOpenInstall}
      />
      <main className={`${currentView === 'live' ? 'max-w-screen-xl' : 'max-w-screen-md'} mx-auto pt-16 md:pt-20 px-4 md:px-8`}>
        {!isInstalled && !bannerDismissed && currentView === 'feed' && (
          <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-rose-500 text-white shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0">
                <Smartphone size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold truncate">
                  {language === 'ar'
                    ? 'ثبّت تطبيق InstaVibe الفعلي على هاتفك'
                    : 'Install InstaVibe App on Your Phone'}
                </p>
                <p className="text-[11px] text-white/85 truncate">
                  {language === 'ar'
                    ? 'تثبيت فوري أو تحميل حزمة Android APK للمشاركة'
                    : 'Instant mobile install or Android APK package'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  if (isInstallable) {
                    const ok = await install();
                    if (ok) return;
                  }
                  onOpenInstall();
                }}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white text-slate-900 text-xs font-extrabold flex items-center gap-1.5 hover:bg-slate-100 transition-colors whitespace-nowrap shadow-sm"
              >
                <Download size={14} />
                <span>{language === 'ar' ? 'تثبيت / APK' : 'Install / APK'}</span>
              </button>
              <button
                type="button"
                onClick={dismissBanner}
                aria-label={language === 'ar' ? 'إخفاء' : 'Dismiss'}
                className="min-h-[38px] min-w-[34px] flex items-center justify-center rounded-xl text-white/80 hover:text-white hover:bg-white/15 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
