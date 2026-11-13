import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, ChevronDown, ChevronUp, Volume2, VolumeX, Play } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { collection, query, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useFirestore } from '../hooks/useFirestore';
import CommentItem, { CommentData } from './CommentItem';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Fallback demo comments for mock posts when Firestore comments have not been added yet
const DEMO_COMMENTS_MAP: Record<string, CommentData[]> = {
  'demo-1': [
    {
      id: 'demo-comment-1',
      postId: 'demo-1',
      userId: 'user_chef',
      username: 'chef_mario',
      userPhotoURL: '/src/assets/images/avatar_man_1794501560820.jpg',
      text: 'Stunning sunset colors! Which beach was this taken at? 🏖️',
      likesCount: 3,
      isLikedByMe: false,
      createdAt: { toDate: () => new Date(Date.now() - 3600000 * 2) },
    },
    {
      id: 'demo-comment-2',
      postId: 'demo-1',
      userId: 'creator_sophia',
      username: 'sophia.travels',
      userPhotoURL: '/src/assets/images/avatar_woman_1794501562592.jpg',
      text: 'The lighting here is just magical ✨ Golden hour perfection!',
      likesCount: 5,
      isLikedByMe: false,
      createdAt: { toDate: () => new Date(Date.now() - 3600000 * 1) },
    }
  ],
  'demo-video-1': [
    {
      id: 'demo-comment-video-1',
      postId: 'demo-video-1',
      userId: 'user_traveler',
      username: 'traveler_joy',
      userPhotoURL: '/src/assets/images/avatar_woman_1794501562592.jpg',
      text: 'So soothing to watch! Love the sound of the waves 🌊',
      likesCount: 7,
      isLikedByMe: false,
      createdAt: { toDate: () => new Date(Date.now() - 1800000) },
    }
  ],
  'demo-2': [
    {
      id: 'demo-comment-3',
      postId: 'demo-2',
      userId: 'user_traveler',
      username: 'traveler_joy',
      userPhotoURL: '/src/assets/images/avatar_woman_1794501562592.jpg',
      text: 'That truffle pasta looks unbelievable 🤤 Recipe please!',
      likesCount: 4,
      isLikedByMe: false,
      createdAt: { toDate: () => new Date(Date.now() - 3600000 * 3) },
    }
  ],
  'demo-3': [
    {
      id: 'demo-comment-4',
      postId: 'demo-3',
      userId: 'creator_leo',
      username: 'leo_visuals',
      userPhotoURL: '/src/assets/images/city_night_1794501562076.jpg',
      text: 'Super clean minimalist desk setup. What keyboard is that? 💻',
      likesCount: 2,
      isLikedByMe: false,
      createdAt: { toDate: () => new Date(Date.now() - 3600000 * 4) },
    }
  ]
};

export default function Post({
  post,
  onOpenChat,
  onOpenProfile,
}: {
  post: any;
  onOpenChat?: (convId: string) => void;
  onOpenProfile?: (uid: string) => void;
}) {
  const { user, profile, following, language, t } = useAuth();
  const { likePost, unlikePost, addComment, followUser, unfollowUser, getOrCreateConversation } = useFirestore();

  const [liked, setLiked] = useState(false);
  const [postLikesCount, setPostLikesCount] = useState<number>(post.likesCount || 0);
  const [postLikeAnimating, setPostLikeAnimating] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  // Video auto-play & audio state
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  const commentInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaContainerRef = useRef<HTMLDivElement>(null);

  const isFollowing = following.includes(post.authorId);
  const isOwnPost = user?.uid === post.authorId;
  const isDemoPost = post?.id?.startsWith('demo-');
  const isVideo =
    post?.mediaType === 'video' ||
    /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(post?.mediaURL || '');

  useEffect(() => {
    if (typeof post.likesCount === 'number' && !isDemoPost) {
      setPostLikesCount(post.likesCount);
    }
  }, [post.likesCount, isDemoPost]);

  // Real-time post like listener for current user
  useEffect(() => {
    if (!user || !post?.id || isDemoPost) return;
    const likeRef = doc(db, 'posts', post.id, 'likes', user.uid);
    const unsubscribe = onSnapshot(
      likeRef,
      (snap) => {
        setLiked(snap.exists());
      },
      (err) => console.warn('Post like listener notice:', err)
    );
    return unsubscribe;
  }, [post?.id, user, isDemoPost]);

  // Real-time comments listener for this post
  useEffect(() => {
    if (!post?.id) return;

    if (isDemoPost) {
      const demoList = DEMO_COMMENTS_MAP[post.id] || [];
      setComments(demoList);
      return;
    }

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
  }, [post?.id, isDemoPost]);

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

  const handleLike = () => {
    if (!user || !profile) return;
    const nextLiked = !liked;
    setLiked(nextLiked);
    setPostLikesCount((prev) => (nextLiked ? prev + 1 : Math.max(0, prev - 1)));

    if (nextLiked) {
      setPostLikeAnimating(true);
      setTimeout(() => setPostLikeAnimating(false), 400);
    }

    if (isDemoPost) return;

    if (nextLiked) {
      likePost(post.id, user.uid, post.authorId, profile, post.tags || []);
    } else {
      unlikePost(post.id, user.uid);
    }
  };

  const handleDemoCommentLike = (commentId: string) => {
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c;
        const nextLiked = !c.isLikedByMe;
        const nextCount = nextLiked ? (c.likesCount || 0) + 1 : Math.max(0, (c.likesCount || 0) - 1);
        return {
          ...c,
          isLikedByMe: nextLiked,
          likesCount: nextCount,
        };
      })
    );
  };

  const handleFollow = async () => {
    if (!user || isOwnPost || !profile) return;
    if (isFollowing) {
      await unfollowUser(user.uid, post.authorId);
    } else {
      await followUser(user.uid, post.authorId, profile);
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

    if (isDemoPost) {
      const newDemoComment: CommentData = {
        id: `demo-comment-${Date.now()}`,
        postId: post.id,
        userId: user.uid,
        username: profile.username || 'You',
        userPhotoURL: profile.photoURL || '',
        text: commentText.trim(),
        likesCount: 0,
        isLikedByMe: false,
        createdAt: { toDate: () => new Date() },
      };
      setComments((prev) => [...prev, newDemoComment]);
      setCommentText('');
      setShowComments(true);
      return;
    }

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
            className="w-8 h-8 rounded-full overflow-hidden border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 cursor-pointer hover:opacity-90 transition-opacity"
          >
            <img
              src={post.authorPhotoURL || '/placeholder-avatar.jpg'}
              alt={post.authorUsername}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              onClick={() => onOpenProfile?.(post.authorId)}
              className="font-semibold text-sm cursor-pointer hover:underline text-slate-900 dark:text-white"
            >
              {post.authorUsername}
            </span>
            {!isOwnPost && (
              <>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  type="button"
                  onClick={handleFollow}
                  className={cn(
                    'text-xs font-semibold transition-colors',
                    isFollowing ? 'text-slate-400' : 'text-blue-500 hover:text-blue-600'
                  )}
                >
                  {isFollowing ? t('following') : t('follow')}
                </button>
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
        <button
          type="button"
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors"
          aria-label="More options"
        >
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* Post Media */}
      <div
        ref={mediaContainerRef}
        className="aspect-square bg-slate-100 dark:bg-slate-800 overflow-hidden relative"
      >
        {isVideo ? (
          <div
            onClick={handleToggleVideoPlay}
            className="w-full h-full relative cursor-pointer bg-black"
          >
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
          />
        )}
      </div>

      {/* Post Actions */}
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleLike}
              className={cn(
                'min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full transition-colors active:scale-90',
                liked ? 'text-rose-500' : 'hover:text-slate-500 text-slate-700 dark:text-slate-300'
              )}
              aria-label="Like post"
              aria-pressed={liked}
            >
              <Heart
                size={24}
                className={cn(
                  postLikeAnimating && 'animate-heart-pop',
                  liked ? 'text-rose-500 fill-rose-500' : ''
                )}
              />
            </button>
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
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-slate-700 dark:text-slate-300 hover:text-slate-500 transition-colors"
              aria-label="Share post"
            >
              <Send size={24} />
            </button>
          </div>
          <button
            type="button"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-slate-700 dark:text-slate-300 hover:text-slate-500 transition-colors"
            aria-label="Bookmark post"
          >
            <Bookmark size={24} />
          </button>
        </div>

        {/* Likes Count */}
        <div className="font-bold text-sm text-slate-900 dark:text-white tabular-nums">
          {postLikesCount} {t('likes')}
        </div>

        {/* Caption */}
        <div className="text-sm">
          <span className="font-bold me-2 text-slate-900 dark:text-white">{post.authorUsername}</span>
          <span className="text-slate-800 dark:text-slate-200">
            {post.caption?.split(' ').map((word: string, i: number) => {
              if (word.startsWith('#')) {
                return (
                  <span key={i} className="text-blue-500 hover:underline cursor-pointer me-1">
                    {word}
                  </span>
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
                    onDemoToggleLike={isDemoPost ? handleDemoCommentLike : undefined}
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
    </article>
  );
}
