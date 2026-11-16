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
  const isImmersiveMobile = currentView === 'reels' || currentView === 'live';

  return (
    <div className="min-h-[100dvh] flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0 md:ps-20 lg:ps-64">
      <Header
        currentView={currentView}
        setView={setView}
        onOpenProfile={onOpenProfile}
      />
      <Navigation
        currentView={currentView}
        setView={setView}
        onOpenInstall={onOpenInstall}
      />
      <main
        className={`flex-1 w-full mx-auto pt-[calc(3.5rem+env(safe-area-inset-top,0px))] md:pt-[calc(4.5rem+env(safe-area-inset-top,0px))] ${
          currentView === 'live'
            ? 'max-w-screen-xl px-0 sm:px-4 md:px-8'
            : currentView === 'feed'
            ? 'max-w-md px-0 sm:px-4'
            : isImmersiveMobile
            ? 'max-w-screen-md px-0 sm:px-4 md:px-8'
            : 'max-w-screen-md px-0 sm:px-4 md:px-8'
        }`}
      >
        {children}
      </main>
    </div>
  );
}
