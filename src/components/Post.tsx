import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Bookmark, MoreHorizontal, ChevronDown, ChevronUp, Volume2, VolumeX, Play, Trash2, Share2, Ban, User as UserIcon, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { collection, query, orderBy, onSnapshot, doc, getDoc, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useFirestore } from '../hooks/useFirestore';
import CommentItem, { CommentData } from './CommentItem';
import {
  BurstInstance,
  ReactionControl,
  ReactionSummaryRow,
  TapBurstOverlay,
} from './ReactionBar';
import PostLikesModal, { PostLiker, RecentLikesStrip } from './PostLikesModal';
import ActionConfirmationModal from './ActionConfirmationModal';
import UserAvatar from './UserAvatar';
import FollowButton from './FollowButton';
import { REACTION_MAP, ReactionType, normalizeReaction } from '../utils/reactions';
import { sharePostContent } from '../utils/savedPosts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

const likerProfileCache = new Map<string, { username: string; fullName?: string; photoURL: string }>();

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Post({
  post,
  onOpenChat,
  onOpenProfile,
  onSelectTag,
  onPostDeleted,
}: {
  post: any;
  onOpenChat?: (convId: string) => void;
  onOpenProfile?: (uid: string) => void;
  onSelectTag?: (tag: string) => void;
  onPostDeleted?: (postId: string) => void;
}) {
  const { user, profile, followers, following, blockedUsers, language, t } = useAuth();
  const {
    reactToPost,
    unlikePost,
    addComment,
    getOrCreateConversation,
    deletePost,
    blockUser,
    savePost,
    unsavePost,
  } = useFirestore();

  const [activeReaction, setActiveReaction] = useState<ReactionType | null>(null);
  const [postLikesCount, setPostLikesCount] = useState<number>(post.likesCount || 0);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>(post.reactionCounts || {});
  const [recentLikes, setRecentLikes] = useState<PostLiker[]>([]);
  const [loadingRecentLikes, setLoadingRecentLikes] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [bursts, setBursts] = useState<BurstInstance[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  // Bookmark, share & options state
  const [isSaved, setIsSaved] = useState(false);
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'block' | 'delete' | null>(null);
  const [actionProcessing, setActionProcessing] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Video auto-play & audio state
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  const commentInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaContainerRef = useRef<HTMLDivElement>(null);
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const followsMe = followers.includes(post.authorId) && !following.includes(post.authorId);
  const isOwnPost = user?.uid === post.authorId;
  const isVideo =
    post?.mediaType === 'video' ||
    /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(post?.mediaURL || '');

  useEffect(() => {
    if (typeof post.likesCount === 'number') {
      setPostLikesCount(post.likesCount);
    }
    if (post.reactionCounts && typeof post.reactionCounts === 'object') {
      setReactionCounts(post.reactionCounts);
    }
  }, [post.likesCount, post.reactionCounts]);

  // Cleanup tap timer on unmount
  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    };
  }, []);

  // Real-time post like/reaction listener for current user
  useEffect(() => {
    if (!user || !post?.id) return;
    const likeRef = doc(db, 'posts', post.id, 'likes', user.uid);
    const unsubscribe = onSnapshot(
      likeRef,
      (snap) => {
        if (snap.exists()) {
          setActiveReaction(normalizeReaction(snap.data().reaction, 'heart'));
        } else {
          setActiveReaction(null);
        }
      },
      (err) => console.warn('Post like listener notice:', err)
    );
    return unsubscribe;
  }, [post?.id, user]);

  // Real-time bookmark state listener
  useEffect(() => {
    if (!user || !post?.id) return;
    const savedRef = doc(db, 'users', user.uid, 'savedPosts', post.id);
    const unsubscribe = onSnapshot(
      savedRef,
      (snap) => setIsSaved(snap.exists()),
      (err) => console.warn('Saved post listener notice:', err)
    );
    return unsubscribe;
  }, [post?.id, user]);

  // Close options dropdown when clicking outside
  useEffect(() => {
    if (!showOptionsMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target as Node)) {
        setShowOptionsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOptionsMenu]);

  // Real-time recent likes list listener
  useEffect(() => {
    if (!post?.id || !user) return;
    let isCancelled = false;
    setLoadingRecentLikes(true);

    const likesQuery = query(
      collection(db, 'posts', post.id, 'likes'),
      orderBy('createdAt', 'desc'),
      limit(25)
    );

    const unsubscribe = onSnapshot(
      likesQuery,
      async (snapshot) => {
        const rawDocs = snapshot.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((item) => !blockedUsers.includes(item.userId || item.id));

        const resolved = await Promise.all(
          rawDocs.map(async (item): Promise<PostLiker> => {
            const uid = item.userId || item.id;
            const reaction = normalizeReaction(item.reaction, 'heart');

            if (uid === user.uid && profile) {
              return {
                userId: uid,
                username: profile.username || item.username || 'user',
                fullName: profile.fullName || '',
                userPhotoURL: profile.photoURL || item.userPhotoURL || '',
                reaction,
                createdAt: item.createdAt,
              };
            }

            if (item.username) {
              likerProfileCache.set(uid, {
                username: item.username,
                photoURL: item.userPhotoURL || '',
              });
              return {
                userId: uid,
                username: item.username,
                userPhotoURL: item.userPhotoURL || '',
                reaction,
                createdAt: item.createdAt,
              };
            }

            const cached = likerProfileCache.get(uid);
            if (cached) {
              return {
                userId: uid,
                username: cached.username,
                fullName: cached.fullName,
                userPhotoURL: cached.photoURL,
                reaction,
                createdAt: item.createdAt,
              };
            }

            try {
              const userSnap = await getDoc(doc(db, 'users', uid));
              if (userSnap.exists()) {
                const uData = userSnap.data();
                const entry = {
                  username: uData.username || 'user',
                  fullName: uData.fullName || '',
                  photoURL: uData.photoURL || '',
                };
                likerProfileCache.set(uid, entry);
                return {
                  userId: uid,
                  username: entry.username,
                  fullName: entry.fullName,
                  userPhotoURL: entry.photoURL,
                  reaction,
                  createdAt: item.createdAt,
                };
              }
            } catch {
              // Ignore blocked/missing user profile lookup
            }

            return {
              userId: uid,
              username: uid.slice(0, 8),
              userPhotoURL: '',
              reaction,
              createdAt: item.createdAt,
            };
          })
        );

        if (!isCancelled) {
          setRecentLikes(resolved);
          setLoadingRecentLikes(false);
        }
      },
      (err) => {
        console.warn('Recent likes listener notice:', err);
        if (!isCancelled) setLoadingRecentLikes(false);
      }
    );

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [post?.id, user, profile, blockedUsers]);

  // Real-time comments listener for this post
  useEffect(() => {
    if (!post?.id) return;

    setLoadingComments(true);
    const q = query(
      collection(db, 'posts', post.id, 'comments'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: CommentData[] = snapshot.docs.map((d) => ({
          id: d.id,
          postId: post.id,
          ...(d.data() as any),
        }));
        setComments(list);
        setLoadingComments(false);
      },
      (error) => {
        console.warn('Comments fetch notice:', error);
        setLoadingComments(false);
      }
    );

    return unsubscribe;
  }, [post?.id]);

  // Sync muted state on video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Viewport auto-play / pause using IntersectionObserver
  useEffect(() => {
    if (!isVideo) return;
    const container = mediaContainerRef.current;
    const videoEl = videoRef.current;
    if (!container || !videoEl) return;

    let isCurrentlyVisible = false;

    const tryPlay = async () => {
      if (userPaused || document.hidden || !isCurrentlyVisible) return;
      try {
        await videoEl.play();
        setIsVideoPlaying(true);
      } catch {
        // Fallback: browsers block unmuted autoplay; force mute and retry
        if (!videoEl.muted) {
          videoEl.muted = true;
          setIsMuted(true);
          try {
            await videoEl.play();
            setIsVideoPlaying(true);
          } catch {
            setIsVideoPlaying(false);
          }
        } else {
          setIsVideoPlaying(false);
        }
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        isCurrentlyVisible = entry.isIntersecting && entry.intersectionRatio >= 0.55;
        if (isCurrentlyVisible) {
          tryPlay();
        } else {
          videoEl.pause();
          setIsVideoPlaying(false);
        }
      },
      { threshold: [0, 0.55, 0.85] }
    );

    const handleVisibilityChange = () => {
      if (document.hidden) {
        videoEl.pause();
        setIsVideoPlaying(false);
      } else if (isCurrentlyVisible) {
        tryPlay();
      }
    };

    observer.observe(container);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      videoEl.pause();
    };
  }, [isVideo, userPaused, post?.mediaURL]);

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
      if (!nextMuted && videoRef.current.paused && !userPaused) {
        videoRef.current.play().catch(() => {});
      }
    }
  };

  const handleToggleVideoPlay = () => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    if (videoEl.paused) {
      setUserPaused(false);
      videoEl.play()
        .then(() => setIsVideoPlaying(true))
        .catch(() => {});
    } else {
      setUserPaused(true);
      videoEl.pause();
      setIsVideoPlaying(false);
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
      // Toggle off
      setActiveReaction(null);
      setPostLikesCount((prev) => Math.max(0, prev - 1));
      setReactionCounts((prev) => {
        const next = { ...prev };
        if (next[prevReaction] && next[prevReaction] > 0) {
          next[prevReaction] -= 1;
          if (next[prevReaction] <= 0) delete next[prevReaction];
        }
        return next;
      });
      unlikePost(post.id, user.uid);
      return;
    }

    setActiveReaction(reaction);
    if (!prevReaction) {
      setPostLikesCount((prev) => prev + 1);
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

    reactToPost(post.id, user.uid, post.authorId, profile, reaction, post.tags || []);
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

  const handleMediaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const rect = mediaContainerRef.current?.getBoundingClientRect();
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
    if (isVideo) {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = setTimeout(() => {
        singleTapTimerRef.current = null;
        handleToggleVideoPlay();
      }, 240);
    }
  };

  const handleMessage = async () => {
    if (!user || isOwnPost || !onOpenChat || !profile) return;
    const convId = await getOrCreateConversation(user.uid, post.authorId);
    if (convId) {
      onOpenChat(convId);
    }
  };

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !commentText.trim() || !profile) return;

    addComment(post.id, user.uid, profile.username, profile.photoURL || '', commentText.trim(), post.authorId, profile);
    setCommentText('');
    setShowComments(true);
  };

  const handleReplyToUser = (username: string) => {
    setCommentText(`@${username} `);
    setShowComments(true);
    setTimeout(() => {
      commentInputRef.current?.focus();
    }, 50);
  };

  const triggerToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 2600);
  };

  const handleToggleBookmark = async () => {
    if (!user || !post?.id || savingBookmark) return;
    setShowOptionsMenu(false);

    setSavingBookmark(true);
    const nextState = !isSaved;
    setIsSaved(nextState);
    try {
      if (nextState) {
        await savePost(user.uid, post);
        triggerToast(language === 'ar' ? 'تم حفظ المنشور في المحفوظات' : 'Saved to bookmarks');
      } else {
        await unsavePost(user.uid, post.id);
        triggerToast(language === 'ar' ? 'تمت إزالة المنشور من المحفوظات' : 'Removed from saved');
      }
    } catch {
      setIsSaved(!nextState);
    } finally {
      setSavingBookmark(false);
    }
  };

  const handleShare = async () => {
    setShowOptionsMenu(false);
    const status = await sharePostContent(
      { id: post.id, authorUsername: post.authorUsername, caption: post.caption },
      language
    );
    if (status === 'copied') {
      triggerToast(language === 'ar' ? 'تم نسخ رابط المنشور للمشاركة' : 'Post link copied to clipboard');
    } else if (status === 'shared') {
      triggerToast(language === 'ar' ? 'تمت مشاركة المنشور' : 'Post shared');
    }
  };

  const handleConfirmModalAction = async () => {
    if (!user || !confirmAction) return;
    setActionProcessing(true);
    try {
      if (confirmAction === 'delete' && isOwnPost) {
        await deletePost(post.id);
        setConfirmAction(null);
        onPostDeleted?.(post.id);
      } else if (confirmAction === 'block' && !isOwnPost) {
        await blockUser(user.uid, post.authorId);
        setConfirmAction(null);
      }
    } catch (err) {
      console.error('Post action failed:', err);
    } finally {
      setActionProcessing(false);
    }
  };

  const formattedDate = post.createdAt?.toDate
    ? formatDistanceToNow(post.createdAt.toDate(), {
        addSuffix: true,
        locale: language === 'ar' ? ar : undefined,
      })
    : language === 'ar'
    ? 'الآن'
    : 'just now';

  const totalCommentsCount = comments.length > 0 ? comments.length : post.commentsCount || 0;
  const visibleComments = showComments ? comments : comments.slice(-2);

  return (
    <article className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-shadow hover:shadow-md">
      {/* Post Header */}
      <div className="flex items-center justify-between p-3.5">
        <div className="flex items-center gap-3">
          <div
            onClick={() => onOpenProfile?.(post.authorId)}
            className="w-8 h-8 rounded-full overflow-hidden border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 cursor-pointer hover:opacity-90 transition-opacity shrink-0"
          >
            <UserAvatar
              src={post.authorPhotoURL}
              username={post.authorUsername}
              iconSize={15}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              onClick={() => onOpenProfile?.(post.authorId)}
              className="font-semibold text-sm cursor-pointer hover:underline text-slate-900 dark:text-white"
            >
              {post.authorUsername}
            </span>
            {followsMe && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                {t('followsYou')}
              </span>
            )}
            {!isOwnPost && (
              <>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <FollowButton targetUserId={post.authorId} variant="inline" />
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  type="button"
                  onClick={handleMessage}
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  {t('message')}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="relative" ref={optionsMenuRef}>
          <button
            type="button"
            onClick={() => setShowOptionsMenu((prev) => !prev)}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            aria-label={language === 'ar' ? 'المزيد من الخيارات' : 'More options'}
            aria-expanded={showOptionsMenu}
          >
            <MoreHorizontal size={20} />
          </button>

          {showOptionsMenu && (
            <div className="absolute end-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl py-1.5 z-30 animate-in fade-in">
              <button
                type="button"
                onClick={handleShare}
                className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 text-start transition-colors"
              >
                <Share2 size={15} className="text-slate-400 shrink-0" />
                <span>{language === 'ar' ? 'مشاركة ونسخ الرابط' : 'Share / Copy Link'}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleBookmark}
                className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 text-start transition-colors"
              >
                <Bookmark size={15} className={cn('shrink-0', isSaved ? 'text-purple-600 fill-purple-600' : 'text-slate-400')} />
                <span>
                  {isSaved
                    ? (language === 'ar' ? 'إزالة من المحفوظات' : 'Remove Bookmark')
                    : (language === 'ar' ? 'حفظ المنشور' : 'Save Post')}
                </span>
              </button>

              {!isOwnPost && (
                <button
                  type="button"
                  onClick={() => {
                    setShowOptionsMenu(false);
                    onOpenProfile?.(post.authorId);
                  }}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 text-start transition-colors"
                >
                  <UserIcon size={15} className="text-slate-400 shrink-0" />
                  <span>{language === 'ar' ? 'عرض الملف الشخصي' : 'View Profile'}</span>
                </button>
              )}

              {isOwnPost && (
                <button
                  type="button"
                  onClick={() => {
                    setShowOptionsMenu(false);
                    setConfirmAction('delete');
                  }}
                  className="w-full px-3.5 py-2.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2.5 text-start transition-colors"
                >
                  <Trash2 size={15} className="shrink-0" />
                  <span>{language === 'ar' ? 'حذف المنشور' : 'Delete Post'}</span>
                </button>
              )}

              {!isOwnPost && (
                <button
                  type="button"
                  onClick={() => {
                    setShowOptionsMenu(false);
                    setConfirmAction('block');
                  }}
                  className="w-full px-3.5 py-2.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2.5 text-start transition-colors"
                >
                  <Ban size={15} className="shrink-0" />
                  <span>{language === 'ar' ? 'حظر المستخدم' : 'Block User'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Post Media */}
      <div
        ref={mediaContainerRef}
        onClick={handleMediaClick}
        className="aspect-square bg-slate-100 dark:bg-slate-800 overflow-hidden relative cursor-pointer select-none"
      >
        <TapBurstOverlay bursts={bursts} />

        {isVideo ? (
          <div className="w-full h-full relative bg-black">
            <video
              ref={videoRef}
              src={post.mediaURL}
              muted={isMuted}
              playsInline
              loop
              preload="metadata"
              onPlay={() => setIsVideoPlaying(true)}
              onPause={() => setIsVideoPlaying(false)}
              className="w-full h-full object-cover"
            />

            {/* Paused Play Indicator */}
            {!isVideoPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-none transition-opacity">
                <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center border border-white/20 shadow-lg">
                  <Play size={26} className="fill-white ms-0.5" />
                </div>
              </div>
            )}

            {/* Mute / Unmute Toggle Button */}
            <button
              type="button"
              onClick={handleToggleMute}
              aria-label={
                isMuted
                  ? (language === 'ar' ? 'إلغاء كتم الصوت' : 'Unmute video')
                  : (language === 'ar' ? 'كتم الصوت' : 'Mute video')
              }
              aria-pressed={!isMuted}
              title={
                isMuted
                  ? (language === 'ar' ? 'تشغيل الصوت' : 'Unmute')
                  : (language === 'ar' ? 'كتم الصوت' : 'Mute')
              }
              className="absolute bottom-3 end-3 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-black/65 hover:bg-black/85 text-white backdrop-blur-md border border-white/15 shadow-lg transition-all active:scale-95 z-10"
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>
        ) : (
          <img
            src={post.mediaURL}
            alt={post.caption}
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
            referrerPolicy="no-referrer"
            draggable={false}
          />
        )}
      </div>

      {/* Post Actions */}
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ReactionControl
              activeReaction={activeReaction}
              likesCount={postLikesCount}
              reactionCounts={reactionCounts}
              language={language}
              onToggleLike={handleToggleLike}
              onSelectReaction={handleSelectReaction}
              variant="post"
            />
            <button
              type="button"
              onClick={() => setShowComments(!showComments)}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-slate-700 dark:text-slate-300 hover:text-slate-500 transition-colors"
              aria-label="View comments"
            >
              <MessageCircle size={24} />
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-slate-700 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-90"
              aria-label={language === 'ar' ? 'مشاركة المنشور' : 'Share post'}
              title={language === 'ar' ? 'مشاركة' : 'Share'}
            >
              <Send size={22} />
            </button>
          </div>
          <button
            type="button"
            onClick={handleToggleBookmark}
            disabled={savingBookmark}
            aria-pressed={isSaved}
            className={cn(
              'min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full transition-all active:scale-90',
              isSaved
                ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
            aria-label={isSaved ? (language === 'ar' ? 'إزالة من المحفوظات' : 'Remove bookmark') : (language === 'ar' ? 'حفظ المنشور' : 'Bookmark post')}
            title={isSaved ? (language === 'ar' ? 'تم الحفظ' : 'Saved') : (language === 'ar' ? 'حفظ' : 'Save')}
          >
            <Bookmark size={22} className={isSaved ? 'fill-current' : ''} />
          </button>
        </div>

        {actionToast && (
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold inline-flex items-center gap-1.5 animate-in fade-in">
            <Check size={14} className="text-emerald-400 dark:text-emerald-600 shrink-0" />
            <span>{actionToast}</span>
          </div>
        )}

        {/* Likes & Reactions Summary */}
        <ReactionSummaryRow
          likesCount={postLikesCount}
          reactionCounts={reactionCounts}
          likesLabel={t('likes')}
          language={language}
        />

        {/* Recent Likes Avatar Strip (clickable profile pictures + list trigger) */}
        <RecentLikesStrip
          likers={recentLikes}
          totalLikesCount={postLikesCount}
          loading={loadingRecentLikes}
          language={language}
          onOpenProfile={onOpenProfile}
          onOpenLikesModal={() => setShowLikesModal(true)}
        />

        <PostLikesModal
          isOpen={showLikesModal}
          onClose={() => setShowLikesModal(false)}
          likers={recentLikes}
          totalLikesCount={postLikesCount}
          loading={loadingRecentLikes}
          language={language}
          onOpenProfile={onOpenProfile}
        />

        {/* Caption */}
        <div className="text-sm leading-relaxed">
          <span
            onClick={() => onOpenProfile?.(post.authorId)}
            className="font-bold me-2 text-slate-900 dark:text-white cursor-pointer hover:underline"
          >
            {post.authorUsername}
          </span>
          <span className="text-slate-800 dark:text-slate-200">
            {post.caption?.split(' ').map((word: string, i: number) => {
              if (word.startsWith('#') && word.length > 1) {
                const cleanTag = word.slice(1).replace(/[.,!?،؛]+$/, '').toLowerCase();
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onSelectTag?.(cleanTag)}
                    className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer me-1 font-medium inline"
                  >
                    {word}
                  </button>
                );
              }
              return word + ' ';
            })}
          </span>
        </div>

        {/* Comment Toggle Header Link */}
        {comments.length > 2 && (
          <button
            type="button"
            onClick={() => setShowComments(!showComments)}
            className="text-slate-500 dark:text-slate-400 text-xs font-medium hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 transition-colors pt-0.5"
          >
            {showComments ? (
              <>
                <span>{language === 'ar' ? 'إخفاء التعليقات' : 'Hide comments'}</span>
                <ChevronUp size={14} />
              </>
            ) : (
              <>
                <span>
                  {language === 'ar'
                    ? `عرض كل التعليقات (${totalCommentsCount})`
                    : `View all ${totalCommentsCount} comments`}
                </span>
                <ChevronDown size={14} />
              </>
            )}
          </button>
        )}

        {/* COMMENTS THREAD (Shows latest 2 inline in Feed, or all when expanded) */}
        {(visibleComments.length > 0 || showComments) && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
            {showComments && (
              <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 px-1 pb-1 flex items-center justify-between">
                <span>
                  {language === 'ar' ? `التعليقات (${comments.length})` : `Comments (${comments.length})`}
                </span>
              </div>
            )}

            {loadingComments && comments.length === 0 ? (
              <div className="py-3 text-center text-xs text-slate-400 animate-pulse">
                {language === 'ar' ? 'جاري تحميل التعليقات...' : 'Loading comments...'}
              </div>
            ) : visibleComments.length === 0 ? (
              <div className="py-3 text-center text-xs text-slate-400 italic">
                {language === 'ar'
                  ? 'لا توجد تعليقات بعد. كن أول من يعلق!'
                  : 'No comments yet. Be the first to start the conversation!'}
              </div>
            ) : (
              <div
                className={cn(
                  'space-y-0.5 divide-y divide-slate-100/60 dark:divide-slate-800/60',
                  showComments && 'max-h-72 overflow-y-auto pe-1 no-scrollbar'
                )}
              >
                {visibleComments.map((c) => (
                  <CommentItem
                    key={c.id}
                    postId={post.id}
                    comment={c}
                    onOpenProfile={onOpenProfile}
                    onReply={handleReplyToUser}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        <div className="text-[10px] uppercase text-slate-400 dark:text-slate-500 tracking-wider font-semibold">
          {formattedDate}
        </div>
      </div>

      {/* Comment Input Bar */}
      <form
        onSubmit={handleComment}
        className="border-t border-slate-100 dark:border-slate-800 p-3 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-900/50"
      >
        <input
          ref={commentInputRef}
          type="text"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder={language === 'ar' ? 'أضف تعليقاً...' : 'Add a comment... (use @ to reply)'}
          className="flex-1 bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!commentText.trim()}
          className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-bold text-xs disabled:opacity-40 transition-opacity active:scale-95 px-2 py-1"
        >
          {t('post')}
        </button>
      </form>

      <ActionConfirmationModal
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmModalAction}
        type={confirmAction === 'delete' ? 'destructive' : 'block'}
        targetUsername={confirmAction === 'block' ? post.authorUsername : undefined}
        targetPhotoURL={confirmAction === 'block' ? post.authorPhotoURL : undefined}
        title={
          confirmAction === 'delete'
            ? (language === 'ar' ? 'حذف المنشور؟' : 'Delete this post?')
            : undefined
        }
        description={
          confirmAction === 'delete'
            ? (language === 'ar'
                ? 'سيتم حذف هذا المنشور نهائياً مع تعليقاته وإعجاباته ولا يمكن التراجع عن ذلك.'
                : 'This post and its interactions will be permanently deleted. This cannot be undone.')
            : undefined
        }
        confirmLabel={
          confirmAction === 'delete'
            ? (language === 'ar' ? 'حذف المنشور' : 'Delete')
            : undefined
        }
        isProcessing={actionProcessing}
      />
    </article>
  );
}
