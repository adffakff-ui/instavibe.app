import React from 'react';
import Navigation from './Navigation';
import Header from './Header';

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
      <main className={`${currentView === 'live' ? 'max-w-screen-xl' : 'max-w-screen-md'} mx-auto pt-16 md:pt-20 px-3 sm:px-4 md:px-8`}>
        {children}
      </main>
    </div>
  );
}
