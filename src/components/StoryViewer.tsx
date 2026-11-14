import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Volume2, 
  VolumeX, 
  Pause, 
  Send, 
  Clock, 
  Heart,
  Check,
  BarChart2,
  Archive
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useFirestore } from '../hooks/useFirestore';
import { BurstInstance, TapBurstOverlay } from './ReactionBar';
import { REACTIONS, REACTION_MAP, ReactionType, getTopReactionEntries, normalizeReaction } from '../utils/reactions';
import UserAvatar from './UserAvatar';

export interface StoryPoll {
  question: string;
  optionA: string;
  optionB: string;
  votesA: number;
  votesB: number;
  voters?: Record<string, string>;
}

export interface StoryReactionEntry {
  userId: string;
  username?: string;
  userPhotoURL?: string;
  reaction: ReactionType;
}

export interface StoryItem {
  id: string;
  authorId: string;
  authorUsername: string;
  authorPhotoURL?: string;
  mediaURL: string;
  mediaType?: 'image' | 'video';
  caption?: string;
  likesCount?: number;
  reactionCounts?: Record<string, number>;
  poll?: StoryPoll;
  createdAt: any;
  expiresAt?: string;
}

interface StoryViewerProps {
  stories: StoryItem[];
  initialIndex?: number;
  isArchiveMode?: boolean;
  onClose: () => void;
  onStoryDeleted?: (storyId: string) => void;
  onStoryArchived?: (storyId: string) => void;
}

export default function StoryViewer({
  stories: initialStories,
  initialIndex = 0,
  isArchiveMode = false,
  onClose,
  onStoryDeleted,
  onStoryArchived,
}: StoryViewerProps) {
  const { user, profile, isFirebaseAuthenticated, language } = useAuth();
  const { deleteStory, archiveStory, voteStoryPoll, reactToStory, removeStoryReaction, getOrCreateConversation, sendMessage } = useFirestore();

  const [activeStories, setActiveStories] = useState<StoryItem[]>(initialStories);
  const [currentIndex, setCurrentIndex] = useState(
    Math.min(Math.max(0, initialIndex), Math.max(0, initialStories.length - 1))
  );
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [replySent, setReplySent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Story reaction & burst states
  const [storyReactions, setStoryReactions] = useState<StoryReactionEntry[]>([]);
  const [bursts, setBursts] = useState<BurstInstance[]>([]);
  const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string; offset: number }[]>([]);
  const [heartPopping, setHeartPopping] = useState(false);
  const [showReactionsList, setShowReactionsList] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaCanvasRef = useRef<HTMLDivElement>(null);
  const progressTimerRef = useRef<any>(null);
  const lastTapRef = useRef<number>(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentStory = activeStories[currentIndex];
  const isOwner = user && currentStory && currentStory.authorId === user.uid;

  useEffect(() => {
    setActiveStories(initialStories);
    if (currentIndex >= initialStories.length) {
      setCurrentIndex(Math.max(0, initialStories.length - 1));
    }
  }, [initialStories]);

  useEffect(() => {
    setCurrentIndex(Math.min(Math.max(0, initialIndex), Math.max(0, initialStories.length - 1)));
    setProgress(0);
  }, [initialIndex]);

  const getExpiresRemaining = (expiresAtStr?: string) => {
    if (!expiresAtStr) return null;
    try {
      const expires = new Date(expiresAtStr).getTime();
      const diffHours = Math.max(0, Math.round((expires - Date.now()) / (1000 * 60 * 60)));
      if (diffHours <= 0) return language === 'ar' ? 'تنتهي قريباً' : 'Expiring soon';
      if (diffHours === 1) return language === 'ar' ? 'متبقي ساعة واحدة' : '1h left';
      return language === 'ar' ? `متبقي ${diffHours} ساعة` : `${diffHours}h left`;
    } catch {
      return null;
    }
  };

  const handleNext = () => {
    if (currentIndex < activeStories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setProgress(0);
      setReplySent(false);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setProgress(0);
      setReplySent(false);
    }
  };

  // Cleanup tap timer on unmount
  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    };
  }, []);

  // Real-time story reactions listener
  useEffect(() => {
    setShowReactionsList(false);
    if (!currentStory?.id || !user || !isFirebaseAuthenticated) {
      setStoryReactions([]);
      return;
    }

    const reactionsRef = query(
      collection(db, 'stories', currentStory.id, 'reactions'),
      where('storyId', '==', currentStory.id)
    );
    const unsub = onSnapshot(
      reactionsRef,
      (snap) => {
        const list: StoryReactionEntry[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            userId: d.id,
            username: data.username,
            userPhotoURL: data.userPhotoURL,
            reaction: normalizeReaction(data.reaction, 'heart'),
          };
        });
        setStoryReactions(list);
      },
      (err) => console.warn('Story reactions listener notice:', err)
    );

    return unsub;
  }, [currentStory?.id, user, isFirebaseAuthenticated]);

  // Progress Bar Timer for Images / Fallback
  useEffect(() => {
    setProgress(0);
    setConfirmDelete(false);

    if (!currentStory) return;

    // For video, we handle progress via onTimeUpdate unless it fails to play
    if (currentStory.mediaType === 'video') {
      return;
    }

    const DURATION_MS = 5000;
    const INTERVAL_MS = 50;
    const STEP = (INTERVAL_MS / DURATION_MS) * 100;

    progressTimerRef.current = setInterval(() => {
      if (isPaused || confirmDelete || showReactionsList) return;

      setProgress((prev) => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + STEP;
      });
    }, INTERVAL_MS);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [currentIndex, currentStory, isPaused, confirmDelete, showReactionsList, activeStories.length]);

  // Video Time Update Handler
  const handleVideoTimeUpdate = () => {
    if (!videoRef.current) return;
    const duration = videoRef.current.duration;
    const currentTime = videoRef.current.currentTime;
    if (duration > 0) {
      const pct = (currentTime / duration) * 100;
      setProgress(pct);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') {
        if (language === 'ar') handlePrev();
        else handleNext();
      }
      if (e.key === 'ArrowLeft') {
        if (language === 'ar') handleNext();
        else handlePrev();
      }
      if (e.key === ' ') {
        e.preventDefault();
        setIsPaused((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, activeStories.length]);

  // Pause / Resume Video
  useEffect(() => {
    if (videoRef.current && currentStory?.mediaType === 'video') {
      if (isPaused || confirmDelete) {
        videoRef.current.pause();
        setIsVideoPlaying(false);
      } else {
        videoRef.current.play().catch(() => {});
        setIsVideoPlaying(true);
      }
    }
  }, [isPaused, confirmDelete, currentStory]);

  const handleArchiveCurrentStory = async () => {
    if (!currentStory || !isOwner || archiving) return;
    const storyIdToArchive = currentStory.id;
    setArchiving(true);
    try {
      await archiveStory(storyIdToArchive);
      if (onStoryArchived) {
        onStoryArchived(storyIdToArchive);
      }
      const updated = activeStories.filter((s) => s.id !== storyIdToArchive);
      if (updated.length === 0) {
        onClose();
      } else {
        setActiveStories(updated);
        setCurrentIndex((prev) => Math.min(prev, updated.length - 1));
        setProgress(0);
      }
    } catch (err) {
      console.error('Failed to archive story:', err);
    } finally {
      setArchiving(false);
    }
  };

  const handleDeleteCurrentStory = async () => {
    if (!currentStory || !isOwner) return;
    const storyIdToDelete = currentStory.id;

    try {
      await deleteStory(storyIdToDelete);
      if (onStoryDeleted) {
        onStoryDeleted(storyIdToDelete);
      }

      const updated = activeStories.filter((s) => s.id !== storyIdToDelete);
      if (updated.length === 0) {
        onClose();
      } else {
        setActiveStories(updated);
        setCurrentIndex((prev) => Math.min(prev, updated.length - 1));
        setProgress(0);
      }
    } catch (err) {
      console.error('Failed to delete story:', err);
    }
  };

  const handleVotePoll = async (choice: 'A' | 'B') => {
    if (!user || !currentStory || !currentStory.poll) return;

    try {
      await voteStoryPoll(currentStory.id, user.uid, choice, currentStory.poll);
      
      // Optimistic / Local update
      const updatedPoll = { ...currentStory.poll };
      const voters = updatedPoll.voters || {};
      const prevChoice = voters[user.uid];

      if (prevChoice !== choice) {
        if (prevChoice === 'A') updatedPoll.votesA = Math.max(0, updatedPoll.votesA - 1);
        if (prevChoice === 'B') updatedPoll.votesB = Math.max(0, updatedPoll.votesB - 1);

        if (choice === 'A') updatedPoll.votesA += 1;
        if (choice === 'B') updatedPoll.votesB += 1;

        voters[user.uid] = choice;
        updatedPoll.voters = voters;

        const updatedStories = [...activeStories];
        updatedStories[currentIndex] = {
          ...currentStory,
          poll: updatedPoll,
        };
        setActiveStories(updatedStories);
      }
    } catch (err) {
      console.error('Failed to vote on poll:', err);
    }
  };

  const spawnBurst = (emoji: string, x?: number, y?: number) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setBursts((prev) => [...prev, { id, emoji, x, y }]);
    setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b.id !== id));
    }, 820);
  };

  const spawnFloatingReaction = (emoji: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const offset = Math.floor(Math.random() * 64) - 32;
    setFloatingReactions((prev) => [...prev, { id, emoji, offset }]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((item) => item.id !== id));
    }, 1150);
  };

  const currentUserReaction: ReactionType | null =
    storyReactions.find((r) => r.userId === user?.uid)?.reaction ?? null;

  const derivedReactionCounts: Record<string, number> = (() => {
    if (storyReactions.length > 0) {
      return storyReactions.reduce((acc, item) => {
        acc[item.reaction] = (acc[item.reaction] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    }
    return currentStory?.reactionCounts || {};
  })();

  const totalStoryReactionsCount =
    storyReactions.length > 0 ? storyReactions.length : currentStory?.likesCount || 0;

  const applyStoryReaction = async (
    reaction: ReactionType,
    options?: { keepExisting?: boolean; burstCoords?: { x: number; y: number } }
  ) => {
    if (!user || !currentStory) return;
    const prev = currentUserReaction;

    if (options?.keepExisting && prev) {
      if (options.burstCoords) {
        spawnBurst(REACTION_MAP[prev].emoji, options.burstCoords.x, options.burstCoords.y);
      }
      return;
    }

    if (prev === reaction) {
      // Toggle off
      setStoryReactions((list) => list.filter((item) => item.userId !== user.uid));
      await removeStoryReaction(currentStory.id, user.uid);
      return;
    }

    // Record / switch reaction
    const emoji = REACTION_MAP[reaction].emoji;
    if (options?.burstCoords) {
      spawnBurst(emoji, options.burstCoords.x, options.burstCoords.y);
    } else {
      spawnFloatingReaction(emoji);
    }

    if (reaction === 'heart') {
      setHeartPopping(true);
      setTimeout(() => setHeartPopping(false), 360);
    }

    setStoryReactions((list) => {
      const filtered = list.filter((item) => item.userId !== user.uid);
      return [
        ...filtered,
        {
          userId: user.uid,
          username: profile?.username || 'user',
          userPhotoURL: profile?.photoURL || '',
          reaction,
        },
      ];
    });

    await reactToStory(
      currentStory.id,
      user.uid,
      currentStory.authorId,
      profile || { uid: user.uid, username: language === 'ar' ? 'مستخدم' : 'User', photoURL: '' },
      reaction
    );
  };

  const handleZoneTap = (direction: 'prev' | 'next', e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const now = Date.now();
    const rect = mediaCanvasRef.current?.getBoundingClientRect();
    const x = rect ? ((e.clientX - rect.left) / rect.width) * 100 : 50;
    const y = rect ? ((e.clientY - rect.top) / rect.height) * 100 : 50;

    if (now - lastTapRef.current < 280) {
      lastTapRef.current = 0;
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      applyStoryReaction('heart', { keepExisting: true, burstCoords: { x, y } });
      return;
    }

    lastTapRef.current = now;
    if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    singleTapTimerRef.current = setTimeout(() => {
      singleTapTimerRef.current = null;
      if (direction === 'prev') {
        handlePrev();
      } else {
        handleNext();
      }
    }, 220);
  };

  const handleSendReply = async (textToSend?: string) => {
    const content = textToSend || replyText;
    if (!content.trim() || !user || !currentStory) return;

    try {
      const convId = await getOrCreateConversation(user.uid, currentStory.authorId);
      if (convId) {
        await sendMessage(
          convId,
          user.uid,
          language === 'ar' ? `رد على القصة: "${content}"` : `Replied to story: "${content}"`,
          currentStory.authorId,
          profile || { uid: user.uid, username: language === 'ar' ? 'مستخدم' : 'Anonymous' }
        );
        setReplyText('');
        setReplySent(true);
        setTimeout(() => setReplySent(false), 2500);
      }
    } catch (err) {
      console.error('Failed to reply to story:', err);
    }
  };

  if (!currentStory) return null;

  const expiresRemaining = getExpiresRemaining(currentStory.expiresAt);
  const userVote = user && currentStory.poll?.voters ? currentStory.poll.voters[user.uid] : null;
  const totalVotes = (currentStory.poll?.votesA || 0) + (currentStory.poll?.votesB || 0);
  const pctA = totalVotes > 0 ? Math.round(((currentStory.poll?.votesA || 0) / totalVotes) * 100) : 50;
  const pctB = totalVotes > 0 ? 100 - pctA : 50;
  const topStoryReactions = getTopReactionEntries(derivedReactionCounts, totalStoryReactionsCount, 3);

  return (
    <div className="fixed inset-0 z-[130] bg-black/95 sm:bg-black/90 backdrop-blur-md flex items-center justify-center sm:p-4 select-none">
      {/* Blurred background image */}
      {currentStory.mediaType !== 'video' && (
        <div className="absolute inset-0 opacity-40 blur-3xl overflow-hidden pointer-events-none scale-125">
          <img src={currentStory.mediaURL} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Main Story Container (Instagram-like 9:16 aspect ratio) */}
      <div 
        className="relative w-full max-w-[420px] h-full sm:h-[92vh] sm:max-h-[820px] aspect-[9/16] bg-slate-950 rounded-none sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-white/10"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Top Segmented Progress Bars */}
        <div className="absolute top-2.5 inset-x-3 flex flex-col gap-1 z-30">
          <div className="flex items-center justify-between text-[10px] font-semibold text-white/80 px-0.5">
            <span className="drop-shadow-sm">
              {language === 'ar'
                ? `المقطع ${currentIndex + 1} من ${activeStories.length}`
                : `Segment ${currentIndex + 1} of ${activeStories.length}`}
            </span>
            <span className="drop-shadow-sm font-mono tabular-nums">
              {language === 'ar'
                ? `متبقي ${Math.max(0, Math.round(5 - (progress / 100) * 5))} ث`
                : `${Math.max(0, Math.round(5 - (progress / 100) * 5))}s left`}
            </span>
          </div>

          <div className="flex gap-1.5" dir="ltr">
            {activeStories.map((_, idx) => {
              const isCurrent = idx === currentIndex;
              const isPast = idx < currentIndex;
              return (
                <div 
                  key={idx} 
                  className={`h-1.5 flex-1 rounded-full overflow-hidden backdrop-blur-md transition-all ${
                    isCurrent ? 'bg-white/40 ring-1 ring-white/50' : 'bg-white/20'
                  }`}
                >
                  <div 
                    className="h-full bg-gradient-to-r from-white via-slate-100 to-white transition-all ease-linear shadow-sm"
                    style={{ 
                      width: isCurrent ? `${progress}%` : isPast ? '100%' : '0%' 
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Story Header */}
        <div className="absolute top-12 inset-x-3 flex items-center justify-between z-30 pointer-events-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full ring-2 ring-purple-500/80 overflow-hidden bg-slate-800 shrink-0">
              <UserAvatar
                src={currentStory.authorPhotoURL}
                username={currentStory.authorUsername}
                iconSize={16}
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-white text-xs font-bold drop-shadow-sm truncate max-w-[130px]">
                  {currentStory.authorUsername}
                </span>
                <span className="text-white/60 text-[10px]">
                  {currentStory.createdAt?.toDate 
                    ? formatDistanceToNow(currentStory.createdAt.toDate(), { addSuffix: false, locale: language === 'ar' ? ar : undefined }) 
                    : (language === 'ar' ? 'الآن' : 'just now')}
                </span>
              </div>
              {isArchiveMode ? (
                <div className="flex items-center gap-1 text-[10px] text-purple-300 font-semibold">
                  <Archive size={10} />
                  <span>
                    {currentStory.createdAt?.toDate
                      ? format(currentStory.createdAt.toDate(), 'd MMM yyyy', {
                          locale: language === 'ar' ? ar : undefined,
                        })
                      : language === 'ar'
                      ? 'قصة مؤرشفة'
                      : 'Archived'}
                  </span>
                </div>
              ) : (
                expiresRemaining && (
                  <div className="flex items-center gap-1 text-[10px] text-amber-300 font-medium">
                    <Clock size={10} />
                    <span>{expiresRemaining}</span>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Action buttons in header */}
          <div className="flex items-center gap-1">
            {currentStory.mediaType === 'video' && (
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted(!isMuted);
                }} 
                className="p-2 text-white/90 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                title={isMuted ? (language === 'ar' ? 'إلغاء الكتم' : 'Unmute') : (language === 'ar' ? 'كتم الصوت' : 'Mute')}
              >
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            )}

            {isOwner && !isArchiveMode && (
              <button
                type="button"
                disabled={archiving}
                onClick={(e) => {
                  e.stopPropagation();
                  handleArchiveCurrentStory();
                }}
                className="p-2 text-white/80 hover:text-purple-300 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
                title={language === 'ar' ? 'نقل إلى الأرشيف الآن' : 'Move to Archive now'}
              >
                <Archive size={17} />
              </button>
            )}

            {isOwner && (
              <div className="relative">
                {confirmDelete ? (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 bg-red-600/90 text-white rounded-full px-2 py-1 text-[11px] font-semibold"
                  >
                    <span>{language === 'ar' ? 'حذف؟' : 'Delete?'}</span>
                    <button 
                      onClick={handleDeleteCurrentStory} 
                      className="p-1 hover:bg-black/30 rounded-full"
                      title={language === 'ar' ? 'تأكيد الحذف' : 'Confirm delete'}
                    >
                      <Check size={14} />
                    </button>
                    <button 
                      onClick={() => setConfirmDelete(false)} 
                      className="p-1 hover:bg-black/30 rounded-full"
                      title={language === 'ar' ? 'إلغاء' : 'Cancel'}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(true);
                    }}
                    className="p-2 text-white/80 hover:text-red-400 hover:bg-white/10 rounded-full transition-colors"
                    title={language === 'ar' ? 'حذف القصة' : 'Delete story'}
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            )}

            {/* Close Story */}
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }} 
              className="p-2 text-white hover:bg-white/15 rounded-full transition-colors"
              aria-label="Close stories"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Media Canvas Area */}
        <div
          ref={mediaCanvasRef}
          className="flex-1 relative bg-black flex items-center justify-center overflow-hidden"
        >
          <TapBurstOverlay bursts={bursts} />

          {/* Floating Story Reactions */}
          {floatingReactions.length > 0 && (
            <div className="absolute bottom-8 inset-x-0 flex justify-center pointer-events-none z-30">
              {floatingReactions.map((item) => (
                <span
                  key={item.id}
                  style={{ transform: `translate3d(${item.offset}px, 0, 0)` }}
                  className="absolute bottom-0 text-3xl sm:text-4xl drop-shadow-lg animate-story-reaction-rise"
                  aria-hidden="true"
                >
                  {item.emoji}
                </span>
              ))}
            </div>
          )}

          {currentStory.mediaType === 'video' ? (
            <video
              ref={videoRef}
              src={currentStory.mediaURL}
              autoPlay
              playsInline
              muted={isMuted}
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={handleNext}
              className="w-full h-full object-cover"
            />
          ) : (
            <img 
              src={currentStory.mediaURL} 
              alt="Story" 
              className="w-full h-full object-cover" 
              draggable={false}
            />
          )}

          {/* INTERACTIVE POLL STICKER OVERLAY */}
          {currentStory.poll && (
            <div 
              className="absolute top-1/3 inset-x-4 z-20 pointer-events-auto bg-slate-900/85 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-white/20 text-white space-y-3"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
                <BarChart2 size={14} />
                <span>{language === 'ar' ? 'استطلاع القصة' : 'Story Poll'}</span>
                <span className="text-[10px] text-white/50 ms-auto font-normal font-mono tabular-nums">
                  {totalVotes}{' '}
                  {language === 'ar'
                    ? (totalVotes === 1 ? 'صوت' : 'أصوات')
                    : (totalVotes === 1 ? 'vote' : 'votes')}
                </span>
              </div>

              <h4 className="font-bold text-sm text-white leading-snug">
                {currentStory.poll.question}
              </h4>

              <div className="space-y-2 pt-1">
                {/* Option A */}
                <button
                  type="button"
                  onClick={() => handleVotePoll('A')}
                  className={`relative w-full overflow-hidden rounded-xl p-3 text-start transition-all border ${
                    userVote === 'A'
                      ? 'bg-purple-600/40 border-purple-400 text-white font-bold'
                      : 'bg-white/10 hover:bg-white/20 border-white/15 text-white'
                  }`}
                >
                  <div 
                    className="absolute inset-0 bg-purple-500/30 transition-all ease-out" 
                    style={{ width: `${pctA}%` }} 
                  />
                  <div className="relative flex items-center justify-between text-xs font-semibold z-10">
                    <span className="flex items-center gap-1.5">
                      {userVote === 'A' && <Check size={14} className="text-purple-300" />}
                      {currentStory.poll.optionA}
                    </span>
                    <span className="font-mono text-xs font-bold tabular-nums">{pctA}%</span>
                  </div>
                </button>

                {/* Option B */}
                <button
                  type="button"
                  onClick={() => handleVotePoll('B')}
                  className={`relative w-full overflow-hidden rounded-xl p-3 text-start transition-all border ${
                    userVote === 'B'
                      ? 'bg-purple-600/40 border-purple-400 text-white font-bold'
                      : 'bg-white/10 hover:bg-white/20 border-white/15 text-white'
                  }`}
                >
                  <div 
                    className="absolute inset-0 bg-purple-500/30 transition-all ease-out" 
                    style={{ width: `${pctB}%` }} 
                  />
                  <div className="relative flex items-center justify-between text-xs font-semibold z-10">
                    <span className="flex items-center gap-1.5">
                      {userVote === 'B' && <Check size={14} className="text-purple-300" />}
                      {currentStory.poll.optionB}
                    </span>
                    <span className="font-mono text-xs font-bold">{pctB}%</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Pause Indicator overlay when holding */}
          {isPaused && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-3 bg-black/60 backdrop-blur-md rounded-full text-white pointer-events-none z-20">
              <Pause size={24} />
            </div>
          )}

          {/* Previous / Next Interactive Tap Zones (single-tap nav, double-tap like) */}
          <div className="absolute inset-0 flex z-10">
            <div 
              className="w-1/3 h-full cursor-pointer" 
              onClick={(e) => handleZoneTap('prev', e)} 
              title={language === 'ar' ? 'القصة السابقة (نقر مزدوج للإعجاب)' : 'Previous story (double-tap to like)'}
            />
            <div 
              className="w-2/3 h-full cursor-pointer" 
              onClick={(e) => handleZoneTap('next', e)} 
              title={language === 'ar' ? 'القصة التالية (نقر مزدوج للإعجاب)' : 'Next story (double-tap to like)'}
            />
          </div>

          {/* Desktop Navigation Chevrons */}
          {currentIndex > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="hidden sm:flex absolute start-3 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/70 text-white rounded-full transition-all z-20 backdrop-blur-sm"
              title={language === 'ar' ? 'السابق' : 'Previous'}
            >
              {language === 'ar' ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="hidden sm:flex absolute end-3 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/70 text-white rounded-full transition-all z-20 backdrop-blur-sm"
            title={language === 'ar' ? 'التالي' : 'Next'}
          >
            {language === 'ar' ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>

        {/* Bottom Area: Caption + Persistent Like/Reactions + Direct Message reply */}
        <div 
          className="relative z-30 p-4 bg-gradient-to-t from-black/90 via-black/65 to-transparent space-y-3 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {/* Caption Overlay */}
          {currentStory.caption && (
            <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl p-2.5 text-center">
              <p className="text-white text-xs font-medium leading-relaxed drop-shadow">
                {currentStory.caption}
              </p>
            </div>
          )}

          {/* Owner Story Reactions Breakdown */}
          {isOwner && (
            <div className="space-y-2">
              {showReactionsList && (
                <div className="bg-slate-900/95 backdrop-blur-xl border border-white/15 rounded-2xl p-3 max-h-44 overflow-y-auto no-scrollbar space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-white/80">
                    <span>
                      {language === 'ar' ? 'تفاعلات المشاهدين' : 'Story Reactions'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowReactionsList(false)}
                      className="text-white/60 hover:text-white p-1"
                      aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  {storyReactions.length === 0 ? (
                    <p className="text-xs text-white/50 text-center py-2">
                      {language === 'ar' ? 'لا توجد تفاعلات بعد' : 'No reactions yet'}
                    </p>
                  ) : (
                    storyReactions.map((entry) => (
                      <div key={entry.userId} className="flex items-center justify-between text-xs text-white py-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full overflow-hidden border border-white/20 shrink-0">
                            <UserAvatar
                              src={entry.userPhotoURL}
                              username={entry.username}
                              iconSize={12}
                            />
                          </div>
                          <span className="font-semibold truncate">{entry.username || 'user'}</span>
                        </div>
                        <span className="text-base">{REACTION_MAP[entry.reaction].emoji}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowReactionsList((prev) => !prev)}
                  className="min-h-[40px] px-3.5 py-2 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold flex items-center gap-2 transition-all active:scale-95"
                >
                  {topStoryReactions.length > 0 ? (
                    <span className="flex items-center -space-x-1 rtl:space-x-reverse">
                      {topStoryReactions.map((item) => (
                        <span key={item.meta.type} className="text-sm">{item.meta.emoji}</span>
                      ))}
                    </span>
                  ) : (
                    <Heart size={15} className="text-rose-400" />
                  )}
                  <span className="tabular-nums">
                    {totalStoryReactionsCount}{' '}
                    {language === 'ar' ? 'تفاعل' : totalStoryReactionsCount === 1 ? 'reaction' : 'reactions'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Reply & Reactions Bar (for viewers) */}
          {!isOwner && user && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onFocus={() => setIsPaused(true)}
                  onBlur={() => setIsPaused(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendReply();
                  }}
                  placeholder={
                    language === 'ar'
                      ? `أرسل رسالة إلى ${currentStory.authorUsername}...`
                      : `Send message to ${currentStory.authorUsername}...`
                  }
                  className="flex-1 bg-white/15 border border-white/20 rounded-full py-2.5 px-4 text-xs text-white placeholder-white/60 focus:outline-none focus:ring-1 focus:ring-white focus:bg-white/25 transition-all"
                />
                {replyText.trim() && (
                  <button
                    type="button"
                    onClick={() => handleSendReply()}
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center bg-white text-slate-900 rounded-full hover:bg-slate-100 transition-all active:scale-95 shrink-0"
                    title={language === 'ar' ? 'إرسال الرد' : 'Send reply'}
                    aria-label={language === 'ar' ? 'إرسال الرد' : 'Send reply'}
                  >
                    <Send size={16} />
                  </button>
                )}

                {/* Dedicated Persistent Story Like Button */}
                <button
                  type="button"
                  onClick={() =>
                    applyStoryReaction(currentUserReaction || 'heart')
                  }
                  aria-label={language === 'ar' ? 'إعجاب بالقصة' : 'Like story'}
                  aria-pressed={Boolean(currentUserReaction)}
                  className={`min-h-[40px] px-3 rounded-full border flex items-center gap-1.5 transition-all active:scale-90 shrink-0 ${
                    currentUserReaction
                      ? 'bg-rose-500/25 border-rose-400/70 text-rose-300'
                      : 'bg-white/15 hover:bg-white/25 border-white/20 text-white'
                  }`}
                >
                  {currentUserReaction && currentUserReaction !== 'heart' ? (
                    <span className={`text-lg leading-none ${heartPopping ? 'animate-emoji-tap' : ''}`}>
                      {REACTION_MAP[currentUserReaction].emoji}
                    </span>
                  ) : (
                    <Heart
                      size={18}
                      className={`${heartPopping ? 'animate-heart-pop' : ''} ${
                        currentUserReaction ? 'text-rose-500 fill-rose-500' : 'text-white'
                      }`}
                    />
                  )}
                  {totalStoryReactionsCount > 0 && (
                    <span className="text-[11px] font-bold tabular-nums text-white">
                      {totalStoryReactionsCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Persistent Clickable Quick Reactions */}
              <div className="flex items-center justify-between gap-1 px-1">
                {REACTIONS.map((item) => {
                  const isSelected = currentUserReaction === item.type;
                  const count = derivedReactionCounts[item.type] || 0;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => applyStoryReaction(item.type)}
                      aria-label={language === 'ar' ? item.labelAr : item.labelEn}
                      aria-pressed={isSelected}
                      title={language === 'ar' ? item.labelAr : item.labelEn}
                      className={`min-h-[40px] flex-1 flex items-center justify-center gap-1 rounded-full transition-all active:scale-90 ${
                        isSelected
                          ? 'bg-white/25 ring-1 ring-white/60 scale-105'
                          : 'hover:bg-white/15'
                      }`}
                    >
                      <span className="text-lg leading-none">{item.emoji}</span>
                      {count > 0 && (
                        <span className="text-[10px] font-bold text-white/90 tabular-nums">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {replySent && (
                <div className="text-center text-[11px] text-green-400 font-medium animate-in fade-in">
                  {language === 'ar'
                    ? `✓ تم إرسال الرد إلى ${currentStory.authorUsername}`
                    : `✓ Reply sent to ${currentStory.authorUsername}`}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
