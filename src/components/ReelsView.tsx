import React, { useEffect, useRef, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import {
  Clapperboard,
  MessageCircle,
  Send,
  Volume2,
  VolumeX,
  Play,
  Plus,
  X,
  Loader2,
  ChevronUp,
  ChevronDown,
  Bookmark,
  Share2,
  Check,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useFirestore } from '../hooks/useFirestore';
import CommentItem, { CommentData } from './CommentItem';
import PostCreation from './PostCreation';
import UserAvatar from './UserAvatar';
import FollowButton from './FollowButton';
import {
  BurstInstance,
  ReactionControl,
  TapBurstOverlay,
} from './ReactionBar';
import { REACTION_MAP, ReactionType, normalizeReaction } from '../utils/reactions';
import { sharePostContent } from '../utils/savedPosts';

interface ReelCardProps {
  reel: any;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenProfile: (uid: string) => void;
  onOpenChat: (convId: string) => void;
  onOpenComments: (reel: any) => void;
}

function ReelCard({
  reel,
  isMuted,
  onToggleMute,
  onOpenProfile,
  onOpenChat,
  onOpenComments,
}: ReelCardProps) {
  const { user, profile, language, t } = useAuth();
  const {
    reactToPost,
    unlikePost,
    getOrCreateConversation,
    savePost,
    unsavePost,
  } = useFirestore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [activeReaction, setActiveReaction] = useState<ReactionType | null>(null);
  const [likesCount, setLikesCount] = useState<number>(reel.likesCount || 0);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>(reel.reactionCounts || {});
  const [bursts, setBursts] = useState<BurstInstance[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [reelToast, setReelToast] = useState<string | null>(null);

  const isOwn = user?.uid === reel.authorId;

  const showReelToast = (msg: string) => {
    setReelToast(msg);
    setTimeout(() => setReelToast(null), 2400);
  };

  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!user || !reel?.id) {
      setIsSaved(false);
      return;
    }
    const savedRef = doc(db, 'users', user.uid, 'savedPosts', reel.id);
    const unsub = onSnapshot(
      savedRef,
      (snap) => setIsSaved(snap.exists()),
      (err) => console.warn('Reel saved listener notice:', err)
    );
    return unsub;
  }, [user, reel?.id]);

  useEffect(() => {
    if (typeof reel.likesCount === 'number') {
      setLikesCount(reel.likesCount);
    }
    if (reel.reactionCounts && typeof reel.reactionCounts === 'object') {
      setReactionCounts(reel.reactionCounts);
    }
  }, [reel.likesCount, reel.reactionCounts]);

  useEffect(() => {
    if (!user || !reel?.id) return;
    const likeRef = doc(db, 'posts', reel.id, 'likes', user.uid);
    const unsub = onSnapshot(
      likeRef,
      (snap) => {
        if (snap.exists()) {
          setActiveReaction(normalizeReaction(snap.data().reaction, 'heart'));
        } else {
          setActiveReaction(null);
        }
      },
      (err) => console.warn('Reel like listener notice:', err)
    );
    return unsub;
  }, [user, reel?.id]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    const container = cardRef.current;
    const videoEl = videoRef.current;
    if (!container || !videoEl) return;

    let visible = false;

    const tryPlay = async () => {
      if (!visible || userPaused || document.hidden) return;
      try {
        await videoEl.play();
        setIsPlaying(true);
      } catch {
        videoEl.muted = true;
        try {
          await videoEl.play();
          setIsPlaying(true);
        } catch {
          setIsPlaying(false);
        }
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        visible = entry.isIntersecting && entry.intersectionRatio >= 0.65;
        if (visible) {
          tryPlay();
        } else {
          videoEl.pause();
          setIsPlaying(false);
        }
      },
      { threshold: [0, 0.65, 0.9] }
    );

    const onVisibility = () => {
      if (document.hidden) {
        videoEl.pause();
        setIsPlaying(false);
      } else if (visible) {
        tryPlay();
      }
    };

    observer.observe(container);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      videoEl.pause();
    };
  }, [userPaused, reel.mediaURL]);

  const handleTogglePlay = () => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    if (videoEl.paused) {
      setUserPaused(false);
      videoEl.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      setUserPaused(true);
      videoEl.pause();
      setIsPlaying(false);
    }
  };

  const spawnBurst = (emoji: string, x?: number, y?: number) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setBursts((prev) => [...prev, { id, emoji, x, y }]);
    setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b.id !== id));
    }, 820);
  };

  const applyReaction = (reaction: ReactionType, options?: { keepExisting?: boolean }) => {
    if (!user || !profile) return;
    const prevReaction = activeReaction;

    if (options?.keepExisting && prevReaction) {
      return;
    }

    if (prevReaction === reaction) {
      setActiveReaction(null);
      setLikesCount((prev) => Math.max(0, prev - 1));
      setReactionCounts((prev) => {
        const next = { ...prev };
        if (next[prevReaction] && next[prevReaction] > 0) {
          next[prevReaction] -= 1;
          if (next[prevReaction] <= 0) delete next[prevReaction];
        }
        return next;
      });
      unlikePost(reel.id, user.uid);
      return;
    }

    setActiveReaction(reaction);
    if (!prevReaction) {
      setLikesCount((prev) => prev + 1);
    }
    setReactionCounts((prev) => {
      const next = { ...prev };
      if (prevReaction && next[prevReaction] && next[prevReaction] > 0) {
        next[prevReaction] -= 1;
        if (next[prevReaction] <= 0) delete next[prevReaction];
      }
      next[reaction] = (next[reaction] || 0) + 1;
      return next;
    });

    reactToPost(reel.id, user.uid, reel.authorId, profile, reaction, reel.tags || []);
  };

  const handleToggleLike = () => {
    if (activeReaction) {
      applyReaction(activeReaction);
    } else {
      applyReaction('heart');
    }
  };

  const handleSelectReaction = (reaction: ReactionType) => {
    if (activeReaction !== reaction) {
      spawnBurst(REACTION_MAP[reaction].emoji);
    }
    applyReaction(reaction);
  };

  const handleCardTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const rect = cardRef.current?.getBoundingClientRect();
    const x = rect ? ((e.clientX - rect.left) / rect.width) * 100 : 50;
    const y = rect ? ((e.clientY - rect.top) / rect.height) * 100 : 50;

    if (now - lastTapRef.current < 280) {
      lastTapRef.current = 0;
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      const targetReaction = activeReaction || 'heart';
      spawnBurst(REACTION_MAP[targetReaction].emoji, x, y);
      applyReaction('heart', { keepExisting: true });
      return;
    }

    lastTapRef.current = now;
    if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    singleTapTimerRef.current = setTimeout(() => {
      singleTapTimerRef.current = null;
      handleTogglePlay();
    }, 240);
  };

  const handleMessage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || isOwn) return;
    const convId = await getOrCreateConversation(user.uid, reel.authorId);
    if (convId) onOpenChat(convId);
  };

  const handleToggleSave = async () => {
    if (!user || !reel?.id) return;
    const nextSaved = !isSaved;
    setIsSaved(nextSaved);
    if (nextSaved) {
      await savePost(user.uid, { ...reel, likesCount });
      showReelToast(language === 'ar' ? 'تم حفظ الريلز في محفوظاتك' : 'Saved to your bookmarks');
    } else {
      await unsavePost(user.uid, reel.id);
      showReelToast(language === 'ar' ? 'تمت إزالة الريلز من المحفوظات' : 'Removed from bookmarks');
    }
  };

  const handleShareReel = async () => {
    const result = await sharePostContent(reel, language);
    if (result === 'copied') {
      showReelToast(language === 'ar' ? 'تم نسخ رابط الريلز!' : 'Reel link copied!');
    }
  };

  const captionText = reel.caption;

  return (
    <div
      ref={cardRef}
      onClick={handleCardTap}
      className="relative w-full h-full snap-start shrink-0 bg-black rounded-2xl overflow-hidden cursor-pointer select-none"
    >
      <TapBurstOverlay bursts={bursts} />
      <video
        ref={videoRef}
        src={reel.mediaURL}
        muted={isMuted}
        playsInline
        loop
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="w-full h-full object-cover"
      />

      {/* Toast Feedback */}
      {reelToast && (
        <div className="absolute top-16 inset-x-4 flex justify-center pointer-events-none z-30">
          <div className="px-3.5 py-2 rounded-full bg-black/75 backdrop-blur-md text-white text-xs font-semibold flex items-center gap-1.5 border border-white/15 shadow-lg">
            <Check size={14} className="text-emerald-400" />
            <span>{reelToast}</span>
          </div>
        </div>
      )}

      {/* Play indicator when paused */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center border border-white/20 shadow-xl">
            <Play size={30} className="fill-white ms-0.5" />
          </div>
        </div>
      )}

      {/* Top Mute Toggle */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleMute();
        }}
        aria-label={isMuted ? (language === 'ar' ? 'إلغاء كتم الصوت' : 'Unmute') : (language === 'ar' ? 'كتم الصوت' : 'Mute')}
        className="absolute top-4 end-4 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-black/55 hover:bg-black/80 text-white backdrop-blur-md border border-white/15 shadow-lg z-20 transition-all active:scale-95"
      >
        {isMuted ? <VolumeX size={19} /> : <Volume2 size={19} />}
      </button>

      {/* Bottom Contrast Scrim + Info & Action Rail */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent pt-20 pb-5 px-4 flex items-end justify-between gap-3 pointer-events-none">
        {/* Author & Caption */}
        <div className="flex-1 min-w-0 space-y-2.5 text-white pointer-events-auto">
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenProfile(reel.authorId);
              }}
              className="flex items-center gap-2 hover:opacity-90"
            >
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/80 bg-slate-800 shrink-0">
                <UserAvatar
                  src={reel.authorPhotoURL}
                  username={reel.authorUsername}
                  iconSize={16}
                />
              </div>
              <span className="font-bold text-sm drop-shadow">@{reel.authorUsername}</span>
            </button>

            {!isOwn && (
              <FollowButton targetUserId={reel.authorId} variant="overlay" />
            )}
          </div>

          {captionText && (
            <p className="text-xs sm:text-sm text-white/90 leading-relaxed line-clamp-2 drop-shadow">
              {captionText}
            </p>
          )}
        </div>

        {/* Vertical Action Rail */}
        <div
          className="flex flex-col items-center gap-3 text-white shrink-0 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <ReactionControl
            activeReaction={activeReaction}
            likesCount={likesCount}
            reactionCounts={reactionCounts}
            language={language}
            onToggleLike={handleToggleLike}
            onSelectReaction={handleSelectReaction}
            variant="reel"
          />

          <button
            type="button"
            onClick={() => onOpenComments(reel)}
            className="flex flex-col items-center gap-1 min-w-[44px]"
            aria-label={t('comments')}
          >
            <div className="w-11 h-11 rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-md flex items-center justify-center border border-white/10 active:scale-90 transition-transform">
              <MessageCircle size={22} />
            </div>
            <span className="text-[11px] font-bold tabular-nums drop-shadow">{reel.commentsCount || 0}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleSave}
            className="flex flex-col items-center gap-1 min-w-[44px]"
            aria-label={isSaved ? (language === 'ar' ? 'إزالة من المحفوظات' : 'Remove bookmark') : (language === 'ar' ? 'حفظ' : 'Save')}
            title={isSaved ? (language === 'ar' ? 'إزالة من المحفوظات' : 'Remove bookmark') : (language === 'ar' ? 'حفظ' : 'Save')}
          >
            <div
              className={`w-11 h-11 rounded-full backdrop-blur-md flex items-center justify-center border active:scale-90 transition-all ${
                isSaved
                  ? 'bg-amber-500/90 border-amber-300 text-white'
                  : 'bg-black/45 hover:bg-black/65 border-white/10 text-white'
              }`}
            >
              <Bookmark size={20} className={isSaved ? 'fill-white' : ''} />
            </div>
          </button>

          <button
            type="button"
            onClick={handleShareReel}
            className="flex flex-col items-center gap-1 min-w-[44px]"
            aria-label={language === 'ar' ? 'مشاركة' : 'Share'}
            title={language === 'ar' ? 'مشاركة' : 'Share'}
          >
            <div className="w-11 h-11 rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-md flex items-center justify-center border border-white/10 active:scale-90 transition-transform">
              <Share2 size={20} />
            </div>
          </button>

          {!isOwn && (
            <button
              type="button"
              onClick={handleMessage}
              className="flex flex-col items-center gap-1 min-w-[44px]"
              aria-label={t('message')}
              title={t('message')}
            >
              <div className="w-11 h-11 rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-md flex items-center justify-center border border-white/10 active:scale-90 transition-transform">
                <Send size={20} />
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReelsView({
  onOpenProfile,
  onOpenChat,
}: {
  onOpenProfile: (uid: string) => void;
  onOpenChat: (convId: string) => void;
}) {
  const { user, profile, blockedUsers, language, t } = useAuth();
  const { addComment } = useFirestore();

  const [reels, setReels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Active reel comments drawer state
  const [activeCommentsReel, setActiveCommentsReel] = useState<any | null>(null);
  const [reelComments, setReelComments] = useState<CommentData[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');

  const feedContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'posts'), where('mediaType', '==', 'video'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((p: any) => !blockedUsers.includes(p.authorId))
          .sort((a: any, b: any) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

        setReels(list);
        setLoading(false);
      },
      (error) => {
        console.warn('Reels listener notice:', error);
        setReels([]);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [blockedUsers]);

  useEffect(() => {
    if (!activeCommentsReel?.id) {
      setReelComments([]);
      return;
    }

    setLoadingComments(true);
    const q = query(
      collection(db, 'posts', activeCommentsReel.id, 'comments'),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setReelComments(
          snap.docs.map((d) => ({
            id: d.id,
            postId: activeCommentsReel.id,
            ...(d.data() as any),
          }))
        );
        setLoadingComments(false);
      },
      () => setLoadingComments(false)
    );
    return unsubscribe;
  }, [activeCommentsReel, language]);

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !activeCommentsReel || !commentText.trim()) return;

    addComment(
      activeCommentsReel.id,
      user.uid,
      profile.username,
      profile.photoURL || '',
      commentText.trim(),
      activeCommentsReel.authorId,
      profile
    );
    setCommentText('');
  };

  const scrollReel = (direction: 'up' | 'down') => {
    const container = feedContainerRef.current;
    if (!container) return;
    const delta = direction === 'down' ? container.clientHeight : -container.clientHeight;
    container.scrollBy({ top: delta, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <Clapperboard size={22} className="text-rose-500" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('reels')}</h2>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="min-h-[40px] px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          <Plus size={16} />
          <span>{language === 'ar' ? 'نشر ريلز' : 'Post Reel'}</span>
        </button>
      </div>

      {/* Vertical Reels Player Frame */}
      <div className="relative max-w-md mx-auto">
        <div
          ref={feedContainerRef}
          className="h-[calc(100vh-210px)] md:h-[calc(100vh-175px)] min-h-[460px] w-full overflow-y-auto snap-y snap-mandatory no-scrollbar rounded-3xl space-y-4 shadow-xl bg-black"
        >
          {reels.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-center px-6 space-y-4 bg-gradient-to-b from-slate-900 to-black text-white">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Clapperboard size={32} />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold">
                  {language === 'ar' ? 'لا توجد مقاطع ريلز بعد' : 'No Reels Yet'}
                </h3>
                <p className="text-xs text-slate-300 max-w-xs leading-relaxed">
                  {language === 'ar'
                    ? 'كن أول من يشارك مقطع فيديو قصير ومميز مع المجتمع.'
                    : 'Be the first to share a short video reel with the community.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-white text-slate-900 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-100 transition-colors"
              >
                <Plus size={16} />
                <span>{language === 'ar' ? 'نشر أول ريلز' : 'Post First Reel'}</span>
              </button>
            </div>
          ) : (
            reels.map((reel) => (
              <ReelCard
                key={reel.id}
                reel={reel}
                isMuted={isMuted}
                onToggleMute={() => setIsMuted((prev) => !prev)}
                onOpenProfile={onOpenProfile}
                onOpenChat={onOpenChat}
                onOpenComments={(r) => setActiveCommentsReel(r)}
              />
            ))
          )}
        </div>

        {/* Desktop Prev / Next Reel Controls */}
        {reels.length > 1 && (
          <div className="hidden md:flex flex-col gap-2 absolute top-1/2 -translate-y-1/2 -end-14">
            <button
              type="button"
              onClick={() => scrollReel('up')}
              aria-label={language === 'ar' ? 'السابق' : 'Previous reel'}
              className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <ChevronUp size={18} />
            </button>
            <button
              type="button"
              onClick={() => scrollReel('down')}
              aria-label={language === 'ar' ? 'التالي' : 'Next reel'}
              className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <ChevronDown size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Comments Drawer Modal */}
      {activeCommentsReel && (
        <div
          className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
          onClick={() => setActiveCommentsReel(null)}
        >
          <div
            className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[75vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {language === 'ar' ? `التعليقات (${reelComments.length})` : `Comments (${reelComments.length})`}
              </h3>
              <button
                type="button"
                onClick={() => setActiveCommentsReel(null)}
                aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2 divide-y divide-slate-100 dark:divide-slate-800">
              {loadingComments ? (
                <div className="py-10 flex justify-center">
                  <Loader2 size={22} className="animate-spin text-slate-400" />
                </div>
              ) : reelComments.length === 0 ? (
                <p className="py-10 text-center text-xs text-slate-400">
                  {language === 'ar' ? 'لا توجد تعليقات بعد. كن أول من يعلق!' : 'No comments yet. Be the first!'}
                </p>
              ) : (
                reelComments.map((c) => (
                  <CommentItem
                    key={c.id}
                    postId={activeCommentsReel.id}
                    comment={c}
                    onOpenProfile={(uid) => {
                      setActiveCommentsReel(null);
                      onOpenProfile(uid);
                    }}
                  />
                ))
              )}
            </div>

            <form
              onSubmit={handleSubmitComment}
              className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-slate-50 dark:bg-slate-900"
            >
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={language === 'ar' ? 'أضف تعليقاً...' : 'Add a comment...'}
                className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs focus:outline-none"
              />
              <button
                type="submit"
                disabled={!commentText.trim()}
                className="min-h-[38px] px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold disabled:opacity-40 whitespace-nowrap"
              >
                {t('post')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Create Reel Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in"
          onClick={() => setShowCreateModal(false)}
        >
          <div className="w-full max-w-lg my-auto" onClick={(e) => e.stopPropagation()}>
            <PostCreation
              defaultMediaType="video"
              mode="reel"
              onClose={() => setShowCreateModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
