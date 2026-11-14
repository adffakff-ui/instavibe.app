import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Feed from './components/Feed';
import MessagesList from './components/MessagesList';
import ChatView from './components/ChatView';
import ExploreView from './components/ExploreView';
import ProfileView from './components/ProfileView';
import NotificationsView from './components/NotificationsView';
import RecommendationView from './components/RecommendationView';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import ReelsView from './components/ReelsView';
import LiveView from './components/LiveView';
import { OfflineIndicator, PWAInstallModal } from './components/PWAInstallModal';
import { usePWAInstall } from './hooks/usePWAInstall';
import { LogIn, Download, Smartphone, AlertCircle, Compass } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useBlockedConversationListener } from './hooks/useBlockedConversationListener';
import { SpeedInsights } from '@vercel/speed-insights/react';

function AppContent() {
  const { user, loading, authError, signIn, signInAsGuest, language, setLanguage, blockedUsers } = useAuth();
  const { isInstalled, isInstallable, install } = usePWAInstall();
  const [view, setView] = useState<'feed' | 'messages' | 'explore' | 'profile' | 'notifications' | 'discover' | 'analytics' | 'reels' | 'live'>('feed');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedHashtag, setSelectedHashtag] = useState<string>('all');
  const [showInstallModal, setShowInstallModal] = useState(false);

  // Automatically clears any active selectedConversationId state if the blocked user is a participant
  useBlockedConversationListener({
    selectedConversationId,
    setSelectedConversationId,
    currentUserId: user?.uid,
    blockedUsers,
  });

  useEffect(() => {
    const handleOpenInstall = () => setShowInstallModal(true);
    window.addEventListener('instavibe:open-install', handleOpenInstall);

    if (typeof window !== 'undefined' && window.location.search.includes('install=1')) {
      setShowInstallModal(true);
    }

    return () => {
      window.removeEventListener('instavibe:open-install', handleOpenInstall);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-slate-950">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-900 dark:border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  const handleInstallTrigger = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) return;
    }
    setShowInstallModal(true);
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
        <div className="w-full max-w-sm bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 text-center space-y-6">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {language === 'ar' ? 'English' : 'عربي'}
            </button>
          </div>
          <div>
            <h1 className="text-4xl font-bold mb-2 tracking-tight text-slate-900 dark:text-white">InstaVibe</h1>
            <p className="text-slate-500 text-sm">
              {language === 'ar' ? 'شارك لحظاتك وقصصك مع العالم.' : 'Share your moments with the world.'}
            </p>
          </div>
          <div className="space-y-3">
            {authError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium text-start flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-500" />
                <span>{authError}</span>
              </div>
            )}
            <button
              type="button"
              onClick={signIn}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 px-4 rounded-xl font-medium hover:opacity-90 transition-all active:scale-[0.98]"
            >
              <LogIn size={20} />
              {language === 'ar' ? 'تسجيل الدخول عبر Google' : 'Sign in with Google'}
            </button>

            <button
              type="button"
              onClick={signInAsGuest}
              className="w-full flex items-center justify-center gap-2 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/60 py-3 px-4 rounded-xl font-medium hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-all active:scale-[0.98]"
            >
              <Compass size={20} className="text-purple-600 dark:text-purple-400" />
              {language === 'ar' ? 'الدخول كضيف (تجربة فورية)' : 'Guest Mode (Instant Trial)'}
            </button>

            {!isInstalled && (
              <button
                type="button"
                onClick={handleInstallTrigger}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-xl text-sm font-bold transition-all active:scale-[0.98] shadow-sm"
              >
                <Download size={18} />
                <span>
                  {language === 'ar' ? 'تثبيت التطبيق على الجوال / APK' : 'Install Mobile App / APK'}
                </span>
              </button>
            )}
          </div>
          {!isInstalled && (
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <Smartphone size={13} className="text-purple-500" />
              <span>
                {language === 'ar'
                  ? 'يعمل على أندرويد وآيفون كحزمة تطبيق مستقلة'
                  : 'Installable on Android & iPhone as a standalone app'}
              </span>
            </div>
          )}
        </div>

        <OfflineIndicator />
        <PWAInstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
      </div>
    );
  }

  const handleOpenChat = (convId: string) => {
    setSelectedConversationId(convId);
    setView('messages');
  };

  const handleOpenProfile = (uid: string) => {
    setSelectedProfileId(uid);
    setView('profile');
  };

  const handleSetView = (nextView: 'feed' | 'messages' | 'explore' | 'profile' | 'notifications' | 'discover' | 'analytics' | 'reels' | 'live') => {
    if (nextView === 'profile') {
      setSelectedProfileId(null);
    }
    setView(nextView);
  };

  const handleSelectTag = (tag: string) => {
    setSelectedHashtag(tag);
    setView('explore');
  };

  return (
    <>
      <Layout
        currentView={view}
        setView={handleSetView}
        onOpenProfile={handleOpenProfile}
        onOpenInstall={() => setShowInstallModal(true)}
      >
        {view === 'feed' ? (
          <Feed
            onOpenChat={handleOpenChat}
            onOpenProfile={handleOpenProfile}
            onSelectTag={handleSelectTag}
            setView={handleSetView}
          />
        ) : view === 'explore' ? (
          <ExploreView
            onOpenProfile={handleOpenProfile}
            onOpenChat={handleOpenChat}
            initialTag={selectedHashtag}
          />
        ) : view === 'reels' ? (
          <ReelsView onOpenProfile={handleOpenProfile} onOpenChat={handleOpenChat} />
        ) : view === 'live' ? (
          <LiveView onOpenProfile={handleOpenProfile} onOpenChat={handleOpenChat} />
        ) : view === 'profile' ? (
          <ProfileView
            userId={selectedProfileId || user.uid}
            onOpenChat={handleOpenChat}
            onOpenProfile={handleOpenProfile}
            onSelectTag={handleSelectTag}
            onNavigateHome={() => setView('feed')}
          />
        ) : view === 'notifications' ? (
          <NotificationsView onOpenProfile={handleOpenProfile} />
        ) : view === 'discover' ? (
          <RecommendationView
            onOpenProfile={handleOpenProfile}
            onOpenChat={handleOpenChat}
            onSelectTag={handleSelectTag}
            setView={handleSetView}
          />
        ) : view === 'analytics' ? (
          <AnalyticsDashboard />
        ) : (
          selectedConversationId ? (
            <ChatView
              conversationId={selectedConversationId}
              onBack={() => setSelectedConversationId(null)}
            />
          ) : (
            <MessagesList onSelectConversation={setSelectedConversationId} />
          )
        )}
      </Layout>
      <OfflineIndicator />
      <PWAInstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
    </>
  );
}

export default function App() {
  const isVercelHost =
    typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app');

  return (
    <AuthProvider>
      <AppContent />
      {isVercelHost && <SpeedInsights />}
    </AuthProvider>
  );
}
