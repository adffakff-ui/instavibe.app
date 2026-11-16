import { useEffect, useState } from 'react';
import { MessageCircle, BarChart3, Globe, Sparkles, Radio, Plus, X, Download } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import UserAvatar from './UserAvatar';
import PostCreation from './PostCreation';

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
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleHeaderInstall = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) return;
    }
    onOpenInstall?.();
  };

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
    <>
      <header className="fixed top-0 inset-x-0 md:ps-20 lg:ps-64 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 pt-safe h-[calc(3.5rem+env(safe-area-inset-top,0px))] md:h-[calc(4rem+env(safe-area-inset-top,0px))]">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between h-14 md:h-16 px-2.5 sm:px-5 gap-2">
          {/* Brand (mobile) + Live Broadcast Button */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink-0">
            <button
              type="button"
              onClick={() => setView('feed')}
              className="text-[15px] sm:text-xl font-extrabold tracking-tight cursor-pointer shrink-0 whitespace-nowrap bg-gradient-to-r from-purple-600 to-rose-500 bg-clip-text text-transparent md:hidden focus:outline-none"
            >
              InstaVibe
            </button>

            <button
              type="button"
              onClick={() => setView('live')}
              aria-label={t('live')}
              title={t('live')}
              className={`h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all active:scale-95 whitespace-nowrap shrink-0 ${
                currentView === 'live'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : activeLiveCount > 0
                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/40'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400'
              }`}
            >
              <Radio size={14} className={`shrink-0 ${currentView === 'live' ? 'text-white' : 'text-rose-600 dark:text-rose-400'}`} />
              <span>{t('live')}</span>
              {activeLiveCount > 0 && (
                <span
                  className={`tabular-nums text-[10px] font-extrabold px-1.5 py-0.5 rounded-full leading-none ${
                    currentView === 'live' ? 'bg-white/25 text-white' : 'bg-rose-600 text-white'
                  }`}
                >
                  {activeLiveCount}
                </span>
              )}
            </button>
          </div>

          {/* Clean Action Bar with Balanced Sizing & No Overlap */}
          <div className="flex items-center gap-1 min-[380px]:gap-1.5 sm:gap-2 ms-auto shrink-0">
            {/* Real In-App Install Button (Elevated to Top Header, suppressed automatically when installed) */}
            {!isInstalled && (
              <button
                type="button"
                onClick={handleHeaderInstall}
                aria-label={language === 'ar' ? 'تثبيت التطبيق' : 'Install App'}
                title={
                  isInstallable
                    ? language === 'ar'
                      ? 'تثبيت التطبيق بنقرة واحدة'
                      : 'Install App (1-Tap)'
                    : language === 'ar'
                    ? 'تثبيت التطبيق على جهازك'
                    : 'Install App on Device'
                }
                className={`h-9 sm:h-10 px-2 sm:px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all active:scale-95 shrink-0 ${
                  isInstallable
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                    : 'bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/70'
                }`}
              >
                <Download size={15} className="shrink-0" />
                <span className="hidden min-[400px]:inline whitespace-nowrap">
                  {language === 'ar' ? 'تثبيت' : 'Install'}
                </span>
              </button>
            )}

            {/* Quick Create Post / Reel (+) Button */}
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              aria-label={language === 'ar' ? 'إنشاء منشور أو ريلز جديد' : 'Create Post or Reel'}
              title={language === 'ar' ? 'إنشاء منشور أو ريلز جديد' : 'Create Post or Reel'}
              className="h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-all active:scale-95 shrink-0"
            >
              <Plus size={19} className="stroke-[2.5]" />
            </button>

            {/* Discover */}
            <button
              type="button"
              onClick={() => setView('discover')}
              aria-label={t('discover')}
              title={t('discover')}
              className={`h-9 w-9 sm:h-10 sm:w-10 md:w-auto md:px-3.5 flex items-center justify-center gap-1.5 rounded-xl transition-all active:scale-95 shrink-0 ${
                currentView === 'discover'
                  ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Sparkles size={18} className="shrink-0" />
              <span className="hidden md:inline text-xs font-semibold">{t('discover')}</span>
            </button>

            {/* Mobile Analytics */}
            <button
              type="button"
              onClick={() => setView('analytics')}
              aria-label={t('analytics')}
              title={t('analytics')}
              className={`h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center rounded-xl transition-all md:hidden active:scale-95 shrink-0 ${
                currentView === 'analytics'
                  ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <BarChart3 size={18} className="shrink-0" />
            </button>

            {/* Mobile Language Toggle */}
            <button
              type="button"
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              aria-label={language === 'ar' ? 'تغيير اللغة' : 'Switch Language'}
              title={language === 'ar' ? 'Switch to English' : 'التحويل إلى العربية'}
              className="h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all md:hidden active:scale-95 shrink-0"
            >
              <Globe size={18} className="shrink-0" />
            </button>

            {/* Mobile Messages Button */}
            <button
              type="button"
              onClick={() => setView('messages')}
              aria-label={t('messages')}
              title={t('messages')}
              className={`h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center rounded-xl transition-all active:scale-95 md:hidden shrink-0 ${
                currentView === 'messages'
                  ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <MessageCircle size={18} className="shrink-0" />
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
              className={`hidden md:flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95 shrink-0 ${
                currentView === 'profile'
                  ? 'bg-slate-100 dark:bg-slate-800'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full overflow-hidden border-2 transition-colors ${
                  currentView === 'profile'
                    ? 'border-slate-900 dark:border-white'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <UserAvatar
                  src={profile?.photoURL}
                  username={profile?.username}
                  alt={t('profile')}
                  iconSize={16}
                />
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Post / Reel Creation Modal triggered by header Plus button */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[90dvh] overflow-y-auto shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 p-2">
            <div className="flex justify-end p-2 pb-0">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
              >
                <X size={18} />
              </button>
            </div>
            <PostCreation onClose={() => setShowCreateModal(false)} />
          </div>
        </div>
      )}
    </>
  );
}
