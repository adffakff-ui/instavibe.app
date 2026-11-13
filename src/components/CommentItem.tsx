import { useState, useEffect, useRef } from 'react';
import { Heart } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useFirestore } from '../hooks/useFirestore';
import UserAvatar from './UserAvatar';

export interface CommentData {
  id: string;
  postId: string;
  userId: string;
  username: string;
  userPhotoURL?: string;
  text: string;
  likesCount?: number;
  createdAt: any;
}

interface CommentItemProps {
  postId: string;
  comment: CommentData;
  onOpenProfile?: (uid: string) => void;
  onReply?: (username: string) => void;
}

export default function CommentItem({
  postId,
  comment,
  onOpenProfile,
  onReply,
}: CommentItemProps) {
  const { user, profile, language } = useAuth();
  const { likeComment, unlikeComment } = useFirestore();

  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [likesCount, setLikesCount] = useState<number>(comment.likesCount || 0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const pendingRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof comment.likesCount === 'number') {
      setLikesCount(comment.likesCount);
    }
  }, [comment.likesCount]);

  // Real-time listener for whether the current user liked this comment in Firestore
  useEffect(() => {
    if (!user || !comment.id || !postId) return;

    const likeRef = doc(db, 'posts', postId, 'comments', comment.id, 'likes', user.uid);
    const unsubscribe = onSnapshot(
      likeRef,
      (snapshot) => {
        if (!pendingRef.current) {
          setIsLiked(snapshot.exists());
        }
      },
      (error) => {
        console.warn('Comment like listener notice:', error);
      }
    );

    return unsubscribe;
  }, [postId, comment.id, user]);

  const handleToggleLike = async () => {
    if (!user || pendingRef.current) return;

    const newLikedState = !isLiked;

    if (newLikedState) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 450);
    }

    pendingRef.current = true;
    setIsLiked(newLikedState);
    setLikesCount((prev) => (newLikedState ? prev + 1 : Math.max(0, prev - 1)));

    try {
      if (newLikedState) {
        await likeComment(
          postId,
          comment.id,
          user.uid,
          comment.userId,
          profile || { uid: user.uid, username: user.email?.split('@')[0] || 'User', photoURL: '' }
        );
      } else {
        await unlikeComment(postId, comment.id, user.uid);
      }
    } catch (err) {
      console.error('Error toggling comment like:', err);
      setIsLiked(!newLikedState);
      setLikesCount((prev) => (!newLikedState ? prev + 1 : Math.max(0, prev - 1)));
    } finally {
      pendingRef.current = false;
    }
  };

  const formattedTime = comment.createdAt?.toDate
    ? formatDistanceToNow(comment.createdAt.toDate(), {
        addSuffix: false,
        locale: language === 'ar' ? ar : undefined,
      })
    : language === 'ar'
    ? 'الآن'
    : 'just now';

  return (
    <div className="flex items-start justify-between gap-2 py-1.5 group/comment hover:bg-slate-50/70 dark:hover:bg-slate-800/30 px-1.5 rounded-xl transition-colors">
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        <div
          onClick={() => onOpenProfile?.(comment.userId)}
          className="w-7 h-7 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 cursor-pointer border border-slate-200/60 dark:border-slate-700/60 hover:opacity-85 transition-opacity mt-0.5"
        >
          <UserAvatar
            src={comment.userPhotoURL}
            username={comment.username}
            iconSize={13}
          />
        </div>

        <div className="flex-1 min-w-0 text-xs leading-relaxed">
          <p className="text-slate-900 dark:text-slate-100 break-words">
            <span
              onClick={() => onOpenProfile?.(comment.userId)}
              className="font-bold me-1.5 cursor-pointer hover:underline text-slate-900 dark:text-white"
            >
              {comment.username}
            </span>
            <span>{comment.text}</span>
          </p>

          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400 font-medium">
            <span>{formattedTime}</span>

            {likesCount > 0 && (
              <span
                className={`font-semibold tabular-nums transition-colors ${
                  isLiked ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {likesCount}{' '}
                {language === 'ar'
                  ? likesCount === 1
                    ? 'إعجاب'
                    : 'إعجابات'
                  : likesCount === 1
                  ? 'like'
                  : 'likes'}
              </span>
            )}

            <button
              type="button"
              onClick={() => onReply?.(comment.username)}
              className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold transition-colors"
            >
              {language === 'ar' ? 'رد' : 'Reply'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 -me-1">
        <button
          type="button"
          onClick={handleToggleLike}
          aria-label={isLiked ? 'Unlike comment' : 'Like comment'}
          aria-pressed={isLiked}
          className="relative min-w-[40px] min-h-[40px] flex items-center justify-center gap-1 rounded-full hover:bg-rose-50/70 dark:hover:bg-rose-950/30 transition-colors active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          title={isLiked ? (language === 'ar' ? 'إزالة الإعجاب' : 'Unlike') : language === 'ar' ? 'أعجبني' : 'Like comment'}
        >
          {isAnimating && (
            <span
              aria-hidden="true"
              className="absolute inset-1.5 rounded-full border-2 border-rose-400 pointer-events-none animate-heart-ring"
            />
          )}
          <Heart
            size={15}
            className={`transition-colors duration-150 ${
              isAnimating ? 'animate-heart-pop' : ''
            } ${
              isLiked
                ? 'text-rose-500 fill-rose-500'
                : 'text-slate-400 hover:text-rose-500 dark:hover:text-rose-400'
            }`}
          />
          {likesCount > 0 && (
            <span
              className={`text-[11px] font-semibold tabular-nums leading-none ${
                isLiked ? 'text-rose-500' : 'text-slate-400'
              }`}
            >
              {likesCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
