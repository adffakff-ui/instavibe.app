import { useEffect, useState } from 'react';
import { Home, Search, Heart, User, LogOut, MessageSquare, Clapperboard, BarChart3, Globe, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { query, collection, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import UserAvatar from './UserAvatar';

export default function Navigation({
  currentView,
  setView,
  onOpenInstall,
}: {
  currentView: 'feed' | 'messages' | 'explore' | 'profile' | 'notifications' | 'discover' | 'analytics' | 'reels' | 'live';
  setView: (view: 'feed' | 'messages' | 'explore' | 'profile' | 'notifications' | 'discover' | 'analytics' | 'reels' | 'live') => void;
  onOpenInstall?: () => void;
}) {
  const { user, profile, isFirebaseAuthenticated, logOut, language, setLanguage, t } = useAuth();
  const { isInstalled } = usePWAInstall();
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!user || !isFirebaseAuthenticated) {
      setHasUnread(false);
      return;
    }
    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      where('read', '==', false)
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setHasUnread(!snapshot.empty);
      },
      (error) => {
        console.warn('Unread notifications listener error:', error);
      }
    );
    return unsubscribe;
  }, [user, isFirebaseAuthenticated]);

  const desktopNavItems = [
    { icon: Home, labelKey: 'home', view: 'feed' as const },
    { icon: Search, labelKey: 'search', view: 'explore' as const },
    { icon: Clapperboard, labelKey: 'reels', view: 'reels' as const },
    { icon: BarChart3, labelKey: 'analytics', view: 'analytics' as const },
    { icon: MessageSquare, labelKey: 'messages', view: 'messages' as const },
    { icon: Heart, labelKey: 'notifications', view: 'notifications' as const, unread: hasUnread },
    { icon: User, labelKey: 'profile', view: 'profile' as const },
  ];

  // Mobile bottom navigation prioritizes the 5 primary social tabs so Likes/Notifications and Profile are never hidden
  const mobileNavItems = [
    { icon: Home, labelKey: 'home', view: 'feed' as const },
    { icon: Search, labelKey: 'search', view: 'explore' as const },
    { icon: Clapperboard, labelKey: 'reels', view: 'reels' as const },
    { icon: Heart, labelKey: 'notifications', view: 'notifications' as const, unread: hasUnread },
    { icon: User, labelKey: 'profile', view: 'profile' as const, isProfile: true },
  ];

  return (
    <>
      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 md:hidden">
        <div className="grid grid-cols-5 items-center h-16 pb-safe">
          {mobileNavItems.map((item) => {
            const isActive = currentView === item.view;
            return (
              <button
                key={item.labelKey}
                type="button"
                onClick={() => setView(item.view)}
                aria-label={t(item.labelKey)}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors relative px-1 ${
                  isActive
                    ? 'text-slate-900 dark:text-white'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {item.isProfile && profile?.photoURL ? (
                  <div
                    className={`w-6 h-6 rounded-full overflow-hidden border-2 transition-transform ${
                      isActive
                        ? 'border-slate-900 dark:border-white scale-105'
                        : 'border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <img
                      src={profile.photoURL}
                      alt={t(item.labelKey)}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <item.icon
                    size={22}
                    className={
                      isActive && item.view === 'notifications'
                        ? 'text-rose-500 fill-rose-500'
                        : isActive
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-400 dark:text-slate-500'
                    }
                  />
                )}
                <span className="text-[10px] font-medium leading-none truncate max-w-full">
                  {t(item.labelKey)}
                </span>
                {item.unread && (
                  <span className="absolute top-1.5 end-4 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop Sidebar */}
      <nav className="hidden md:flex fixed top-0 start-0 bottom-0 z-50 w-20 lg:w-64 flex-col bg-white dark:bg-slate-900 border-e border-slate-200 dark:border-slate-800 p-4">
        <div className="flex items-center justify-between mb-8 px-4">
          <div
            className="hidden lg:block text-2xl font-bold cursor-pointer bg-gradient-to-r from-purple-600 to-rose-500 bg-clip-text text-transparent whitespace-nowrap"
            onClick={() => setView('feed')}
          >
            InstaVibe
          </div>
          <div
            className="lg:hidden text-xl font-bold cursor-pointer"
            onClick={() => setView('feed')}
          >
            IV
          </div>

          {/* Language Toggle */}
          <button
            type="button"
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            title="Switch Language / تغيير اللغة"
          >
            <Globe size={15} />
            <span className="hidden lg:inline">{language === 'ar' ? 'English' : 'عربي'}</span>
          </button>
        </div>

        <div className="flex-1 flex flex-col gap-1.5">
          {desktopNavItems.map((item) => {
            const isActive = currentView === item.view;
            return (
              <button
                key={item.labelKey}
                type="button"
                onClick={() => setView(item.view)}
                className={`flex items-center gap-4 p-3.5 rounded-xl transition-colors group relative whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium'
                }`}
              >
                <item.icon
                  size={24}
                  className={`group-hover:scale-110 transition-transform shrink-0 ${
                    isActive && item.view === 'notifications' ? 'text-rose-500 fill-rose-500' : ''
                  }`}
                />
                <span className="hidden lg:block text-sm">{t(item.labelKey)}</span>
                {item.unread && (
                  <div className="absolute top-3.5 start-8 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
                )}
              </button>
            );
          })}

          {!isInstalled && onOpenInstall && (
            <button
              type="button"
              onClick={onOpenInstall}
              className="flex items-center gap-4 p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 transition-colors group mt-auto font-bold whitespace-nowrap border border-purple-200/70 dark:border-purple-800/60"
            >
              <Smartphone size={22} className="shrink-0 text-purple-600 dark:text-purple-400" />
              <span className="hidden lg:block text-sm">
                {language === 'ar' ? 'تثبيت التطبيق / APK' : 'Install App / APK'}
              </span>
            </button>
          )}

          <button
            type="button"
            className={`flex items-center gap-4 p-3.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap ${
              !isInstalled && onOpenInstall ? '' : 'mt-auto'
            }`}
            onClick={logOut}
          >
            <LogOut size={24} className="shrink-0" />
            <span className="hidden lg:block text-sm">{t('logOut')}</span>
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 px-2">
          <button
            type="button"
            onClick={() => setView('profile')}
            className={`flex items-center gap-3 rounded-xl p-1.5 transition-colors group w-full text-start ${
              currentView === 'profile' ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
              <UserAvatar
                src={profile?.photoURL}
                username={profile?.username}
                alt="Profile"
                iconSize={16}
              />
            </div>
            <div className="hidden lg:flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {profile?.username || 'User'}
              </span>
              <span className="text-[10px] text-slate-400 truncate">
                {profile?.email || ''}
              </span>
            </div>
          </button>
        </div>
      </nav>
    </>
  );
}
