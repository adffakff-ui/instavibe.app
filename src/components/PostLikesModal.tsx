import React, { useEffect, useMemo, useState } from 'react';
import { Heart, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { REACTION_MAP, ReactionType } from '../utils/reactions';

export interface PostLiker {
  userId: string;
  username: string;
  fullName?: string;
  userPhotoURL: string;
  reaction: ReactionType;
  createdAt?: any;
}

function AvatarWithFallback({
  src,
  username,
  className,
}: {
  src?: string;
  username: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = (username || '?').slice(0, 1).toUpperCase();

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs ${className || ''}`}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={username}
      onError={() => setFailed(true)}
      className={`object-cover ${className || ''}`}
      referrerPolicy="no-referrer"
    />
  );
}

export function RecentLikesStrip({
  likers,
  totalLikesCount,
  loading,
  language,
  onOpenProfile,
  onOpenLikesModal,
}: {
  likers: PostLiker[];
  totalLikesCount: number;
  loading?: boolean;
  language: 'en' | 'ar';
  onOpenProfile?: (uid: string) => void;
  onOpenLikesModal: () => void;
}) {
  if (loading && likers.length === 0 && totalLikesCount > 0) {
    return (
      <div className="flex items-center gap-2 pt-0.5">
        <div className="flex items-center -space-x-2 rtl:space-x-reverse">
          <div className="w-7 h-7 rounded-full animate-shimmer ring-2 ring-white dark:ring-slate-900" />
          <div className="w-7 h-7 rounded-full animate-shimmer ring-2 ring-white dark:ring-slate-900" />
          <div className="w-7 h-7 rounded-full animate-shimmer ring-2 ring-white dark:ring-slate-900" />
        </div>
        <div className="h-3.5 w-36 rounded animate-shimmer" />
      </div>
    );
  }

  if (likers.length === 0) return null;

  const previewLikers = likers.slice(0, 5);
  const firstLiker = previewLikers[0];
  const othersCount = Math.max(0, totalLikesCount - 1);

  return (
    <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* Clickable overlapping profile avatars */}
        <div
          className="flex items-center -space-x-2 rtl:space-x-reverse shrink-0"
          role="group"
          aria-label={language === 'ar' ? 'آخر المعجبين بالمنشور' : 'Recent users who liked this post'}
        >
          {previewLikers.map((liker, index) => (
            <button
              key={liker.userId}
              type="button"
              onClick={() => onOpenProfile?.(liker.userId)}
              style={{ zIndex: previewLikers.length - index }}
              title={`${liker.username} (${REACTION_MAP[liker.reaction]?.emoji || '❤️'})`}
              aria-label={
                language === 'ar'
                  ? `عرض ملف ${liker.username}`
                  : `Open ${liker.username}'s profile`
              }
              className="relative w-8 h-8 rounded-full overflow-hidden ring-2 ring-white dark:ring-slate-900 bg-slate-100 dark:bg-slate-800 hover:scale-110 hover:z-20 transition-transform focus-visible:outline-none focus-visible:ring-blue-500 cursor-pointer shrink-0"
            >
              <AvatarWithFallback
                src={liker.userPhotoURL}
                username={liker.username}
                className="w-full h-full"
              />
            </button>
          ))}
        </div>

        {/* Summary text + View full list trigger */}
        <div className="text-xs text-slate-600 dark:text-slate-300 truncate min-w-0">
          <span>{language === 'ar' ? 'أعجب به ' : 'Liked by '}</span>
          <button
            type="button"
            onClick={() => onOpenProfile?.(firstLiker.userId)}
            className="font-bold text-slate-900 dark:text-white hover:underline focus-visible:outline-none"
          >
            @{firstLiker.username}
          </button>
          {othersCount > 0 && (
            <>
              <span>{language === 'ar' ? ' و ' : ' and '}</span>
              <button
                type="button"
                onClick={onOpenLikesModal}
                className="font-bold text-slate-900 dark:text-white hover:underline tabular-nums focus-visible:outline-none"
              >
                {language === 'ar' ? `${othersCount} آخرين` : `${othersCount} others`}
              </button>
            </>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenLikesModal}
        className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0 py-1 px-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        {language === 'ar' ? 'آخر الإعجابات' : 'Recent likes'}
      </button>
    </div>
  );
}

export default function PostLikesModal({
  isOpen,
  onClose,
  likers,
  totalLikesCount,
  loading,
  language,
  onOpenProfile,
}: {
  isOpen: boolean;
  onClose: () => void;
  likers: PostLiker[];
  totalLikesCount: number;
  loading?: boolean;
  language: 'en' | 'ar';
  onOpenProfile?: (uid: string) => void;
}) {
  const [filterReaction, setFilterReaction] = useState<ReactionType | 'all'>('all');

  useEffect(() => {
    if (!isOpen) {
      setFilterReaction('all');
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const availableReactions = useMemo(() => {
    const counts: Partial<Record<ReactionType, number>> = {};
    likers.forEach((l) => {
      counts[l.reaction] = (counts[l.reaction] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({
        type: type as ReactionType,
        count,
        meta: REACTION_MAP[type as ReactionType],
      }));
  }, [likers]);

  const filteredLikers = useMemo(() => {
    if (filterReaction === 'all') return likers;
    return likers.filter((l) => l.reaction === filterReaction);
  }, [likers, filterReaction]);

  if (!isOpen) return null;

  const handleSelectUser = (uid: string) => {
    onClose();
    onOpenProfile?.(uid);
  };

  return (
    <div
      className="fixed inset-0 z-[130] bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={language === 'ar' ? 'قائمة آخر الإعجابات' : 'Recent Likes'}
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Heart size={18} className="text-rose-500 fill-rose-500" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              {language === 'ar' ? 'آخر الإعجابات' : 'Recent Likes'}
            </h3>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 tabular-nums">
              ({Math.max(totalLikesCount, likers.length)})
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Reaction Filter Tabs */}
        {availableReactions.length > 1 && (
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setFilterReaction('all')}
              className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                filterReaction === 'all'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {language === 'ar' ? 'الكل' : 'All'}{' '}
              <span className="tabular-nums opacity-75">{likers.length}</span>
            </button>
            {availableReactions.map((entry) => (
              <button
                key={entry.type}
                type="button"
                onClick={() => setFilterReaction(entry.type)}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                  filterReaction === entry.type
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{entry.meta.emoji}</span>
                <span className="tabular-nums">{entry.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Likers List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 no-scrollbar">
          {loading && likers.length === 0 ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map((row) => (
                <div key={row} className="flex items-center gap-3 py-1">
                  <div className="w-11 h-11 rounded-full animate-shimmer shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-28 rounded animate-shimmer" />
                    <div className="h-3 w-20 rounded animate-shimmer" />
                  </div>
                  <div className="w-7 h-7 rounded-full animate-shimmer" />
                </div>
              ))}
            </div>
          ) : filteredLikers.length === 0 ? (
            <div className="py-16 px-6 text-center space-y-2">
              <Heart size={36} className="mx-auto text-slate-200 dark:text-slate-800" />
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                {language === 'ar' ? 'لا توجد إعجابات بعد' : 'No likes yet'}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {language === 'ar'
                  ? 'كن أول من يتفاعل مع هذا المنشور.'
                  : 'Be the first to react to this post.'}
              </p>
            </div>
          ) : (
            filteredLikers.map((liker) => {
              const reactionMeta = REACTION_MAP[liker.reaction] || REACTION_MAP.heart;
              const timeAgo = liker.createdAt?.toDate
                ? formatDistanceToNow(liker.createdAt.toDate(), {
                    addSuffix: true,
                    locale: language === 'ar' ? ar : undefined,
                  })
                : language === 'ar'
                ? 'مؤخراً'
                : 'recently';

              return (
                <div
                  key={liker.userId}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Clickable Profile Avatar */}
                    <button
                      type="button"
                      onClick={() => handleSelectUser(liker.userId)}
                      aria-label={
                        language === 'ar'
                          ? `الانتقال إلى ملف ${liker.username}`
                          : `Go to ${liker.username}'s profile`
                      }
                      className="relative w-11 h-11 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:scale-105 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer shrink-0"
                    >
                      <AvatarWithFallback
                        src={liker.userPhotoURL}
                        username={liker.username}
                        className="w-full h-full"
                      />
                    </button>

                    {/* Clickable Username & Metadata */}
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => handleSelectUser(liker.userId)}
                        className="font-bold text-sm text-slate-900 dark:text-white hover:underline truncate block max-w-full text-start cursor-pointer"
                      >
                        {liker.username}
                      </button>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                        {liker.fullName && (
                          <>
                            <span className="truncate">{liker.fullName}</span>
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                        <span className="shrink-0">{timeAgo}</span>
                      </div>
                    </div>
                  </div>

                  {/* Reaction Badge + Profile Shortcut */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span
                      className="text-xl leading-none"
                      title={language === 'ar' ? reactionMeta.labelAr : reactionMeta.labelEn}
                    >
                      {reactionMeta.emoji}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectUser(liker.userId)}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
                    >
                      {language === 'ar' ? 'الملف' : 'Profile'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
