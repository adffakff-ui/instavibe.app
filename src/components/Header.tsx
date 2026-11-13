import { useEffect, useState } from 'react';
import { MessageCircle, User, BarChart3, Globe, Sparkles, Radio, Download } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import GlobalSearch from './GlobalSearch';

type AppView = 'feed' | 'messages' | 'explore' | 'profile' | 'notifications' | 'discover' | 'analytics' | 'reels' | 'live';

export default function Header({
  currentView,
  setView,
  onOpenProfile,
  onOpenInstall,
}: {
  currentView: AppView;
  setView: (view: AppView) => void;
  onOpenProfile: (uid: string) => void;
  onOpenInstall?: () => void;
}) {
  const { user, profile, language, setLanguage, t } = useAuth();
  const { isInstalled, isInstallable, install } = usePWAInstall();
  const [activeLiveCount, setActiveLiveCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setActiveLiveCount(0);
      return;
    }
    const qLive = query(collection(db, 'liveStreams'), where('status', '==', 'live'));
    const unsubscribe = onSnapshot(
      qLive,
      (snap) => {
        setActiveLiveCount(snap.size);
      },
      (err) => console.warn('Header live stream count listener notice:', err)
    );
    return unsubscribe;
  }, [user]);

  return (
    <header className="fixed top-0 inset-x-0 md:ps-20 lg:ps-64 z-40 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 h-14 md:h-16">
      <div className="max-w-screen-xl mx-auto flex items-center justify-between h-full px-2 sm:px-4 gap-1.5 sm:gap-3">
        {/* Brand (mobile) + Live Broadcast Button (always right beside InstaVibe) */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <h1
            className="text-base sm:text-xl md:text-2xl font-bold tracking-tight cursor-pointer shrink-0 whitespace-nowrap bg-gradient-to-r from-purple-600 to-rose-500 bg-clip-text text-transparent md:hidden"
            onClick={() => setView('feed')}
          >
            InstaVibe
          </h1>

          <button
            type="button"
            onClick={() => setView('live')}
            aria-label={t('live')}
            title={t('live')}
            className={`min-h-[38px] sm:min-h-[44px] px-2 sm:px-3.5 rounded-xl flex items-center gap-1 text-[11px] sm:text-xs font-bold transition-colors active:scale-95 whitespace-nowrap shrink-0 ${
              currentView === 'live'
                ? 'bg-rose-600 text-white shadow-sm'
                : activeLiveCount > 0
                ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-950/70'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400'
            }`}
          >
            <Radio size={15} className={currentView === 'live' ? 'text-white' : 'text-rose-600 dark:text-rose-400'} />
            <span>{t('live')}</span>
            {activeLiveCount > 0 && (
              <span
                className={`tabular-nums text-[10px] font-extrabold px-1.5 py-0.5 rounded leading-none ${
                  currentView === 'live' ? 'bg-white/25 text-white' : 'bg-rose-600 text-white'
                }`}
              >
                {activeLiveCount}
              </span>
            )}
          </button>
        </div>

        {/* Desktop Instant User Search */}
        <div className="flex-1 max-w-sm hidden md:block">
          <GlobalSearch onSelectProfile={onOpenProfile} />
        </div>

        {/* Actions (non-duplicated with bottom nav / desktop sidebar) */}
        <div className="flex items-center gap-0.5 sm:gap-1.5 ms-auto shrink-0">
          {/* Install App Button — clearly visible on mobile, tablet, and desktop */}
          {!isInstalled && onOpenInstall && (
            <button
              type="button"
              onClick={async () => {
                if (isInstallable) {
                  const ok = await install();
                  if (ok) return;
                }
                onOpenInstall();
              }}
              aria-label={language === 'ar' ? 'تثبيت التطبيق' : 'Install App'}
              title={language === 'ar' ? 'تثبيت التطبيق أو تحميل حزمة APK' : 'Install App / Get APK'}
              className="min-h-[38px] sm:min-h-[42px] px-2.5 sm:px-3.5 flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[11px] sm:text-xs font-bold transition-colors active:scale-95 whitespace-nowrap shadow-sm shrink-0"
            >
              <Download size={14} className="shrink-0" />
              <span className="sm:hidden">{language === 'ar' ? 'تثبيت' : 'Install'}</span>
              <span className="hidden sm:inline">{language === 'ar' ? 'تثبيت التطبيق' : 'Install App'}</span>
            </button>
          )}

          {/* Discover button (moved from bottom nav/sidebar to top bar) */}
          <button
            type="button"
            onClick={() => setView('discover')}
            aria-label={t('discover')}
            title={t('discover')}
            className={`min-h-[42px] min-w-[34px] sm:min-w-[42px] md:px-3 flex items-center justify-center gap-1.5 rounded-xl transition-colors active:scale-95 whitespace-nowrap ${
              currentView === 'discover'
                ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 font-bold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Sparkles size={18} />
            <span className="hidden md:inline text-xs font-semibold">{t('discover')}</span>
          </button>

          {/* Mobile Analytics trigger */}
          <button
            type="button"
            onClick={() => setView('analytics')}
            aria-label={t('analytics')}
            title={t('analytics')}
            className={`min-h-[42px] min-w-[34px] sm:min-w-[42px] flex items-center justify-center rounded-xl transition-colors md:hidden ${
              currentView === 'analytics'
                ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <BarChart3 size={18} />
          </button>

          {/* Mobile Language Toggle */}
          <button
            type="button"
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            aria-label={language === 'ar' ? 'تغيير اللغة' : 'Switch Language'}
            title={language === 'ar' ? 'تغيير اللغة' : 'Switch Language'}
            className="min-h-[42px] min-w-[34px] sm:min-w-[42px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors md:hidden"
          >
            <Globe size={18} />
          </button>

          {/* Mobile Messages Button (Messages is not in the 5-tab mobile bottom nav) */}
          <button
            type="button"
            onClick={() => setView('messages')}
            aria-label={t('messages')}
            title={t('messages')}
            className={`min-h-[42px] min-w-[34px] sm:min-w-[42px] flex items-center justify-center rounded-xl transition-colors active:scale-95 md:hidden ${
              currentView === 'messages'
                ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <MessageCircle size={18} />
          </button>

          {/* Desktop Profile Avatar Shortcut */}
          <button
            type="button"
            onClick={() => {
              if (user) {
                onOpenProfile(user.uid);
              } else {
                setView('profile');
              }
            }}
            aria-label={t('profile')}
            title={t('profile')}
            className={`hidden md:flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition-colors active:scale-95 ${
              currentView === 'profile'
                ? 'bg-slate-100 dark:bg-slate-800'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {profile?.photoURL ? (
              <div
                className={`w-7 h-7 rounded-full overflow-hidden border-2 transition-colors ${
                  currentView === 'profile'
                    ? 'border-slate-900 dark:border-white'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <img
                  src={profile.photoURL}
                  alt={profile.username || t('profile')}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <User size={22} className="text-slate-700 dark:text-slate-300" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
