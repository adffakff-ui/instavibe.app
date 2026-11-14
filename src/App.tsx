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
import AuthPortal from './components/AuthPortal';
import OnboardingView from './components/OnboardingView';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useEffect, useState } from 'react';
import { useBlockedConversationListener } from './hooks/useBlockedConversationListener';
import { SpeedInsights } from '@vercel/speed-insights/react';

function AppContent() {
  const { user, needsOnboarding, loading, blockedUsers } = useAuth();
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
      <AuthPortal
        isInstalled={isInstalled}
        showInstallModal={showInstallModal}
        setShowInstallModal={setShowInstallModal}
        onInstallTrigger={handleInstallTrigger}
      />
    );
  }

  if (needsOnboarding) {
    return <OnboardingView />;
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
