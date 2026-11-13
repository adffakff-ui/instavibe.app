import React, { useState } from 'react';
import { Loader2, UserCheck, UserMinus, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFirestore } from '../hooks/useFirestore';

interface FollowButtonProps {
  targetUserId: string;
  variant?: 'primary' | 'compact' | 'overlay' | 'inline';
  className?: string;
  onFollowChange?: (isNowFollowing: boolean) => void;
}

export default function FollowButton({
  targetUserId,
  variant = 'compact',
  className = '',
  onFollowChange,
}: FollowButtonProps) {
  const { user, profile, following, followers, blockedUsers, language, t } = useAuth();
  const { followUser, unfollowUser } = useFirestore();
  const [pending, setPending] = useState(false);
  const [hovered, setHovered] = useState(false);

  if (!user || !targetUserId || user.uid === targetUserId || blockedUsers.includes(targetUserId)) {
    return null;
  }

  const isFollowing = following.includes(targetUserId);
  const followsMe = followers.includes(targetUserId);
  const isMutual = isFollowing && followsMe;

  const label = isFollowing
    ? hovered
      ? t('unfollow')
      : isMutual
      ? language === 'ar'
        ? 'متابعة متبادلة'
        : 'Mutual'
      : t('following')
    : followsMe
    ? t('followBack')
    : t('follow');

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pending || !user || !profile) return;

    setPending(true);
    try {
      if (isFollowing) {
        const ok = await unfollowUser(user.uid, targetUserId);
        if (ok) onFollowChange?.(false);
      } else {
        const ok = await followUser(user.uid, targetUserId, profile);
        if (ok) onFollowChange?.(true);
      }
    } catch {
      // Handled safely in useFirestore
    } finally {
      setPending(false);
    }
  };

  if (variant === 'inline') {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-pressed={isFollowing}
        className={`text-xs font-bold transition-colors inline-flex items-center gap-1 disabled:opacity-50 ${
          isFollowing
            ? hovered
              ? 'text-rose-500'
              : 'text-slate-500 dark:text-slate-400'
            : followsMe
            ? 'text-purple-600 dark:text-purple-400 hover:text-purple-700'
            : 'text-blue-500 hover:text-blue-600'
        } ${className}`}
      >
        {pending && <Loader2 size={12} className="animate-spin" />}
        <span>{label}</span>
      </button>
    );
  }

  if (variant === 'overlay') {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-pressed={isFollowing}
        className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-60 active:scale-95 ${
          isFollowing
            ? hovered
              ? 'bg-rose-600/80 text-white border border-rose-400/50'
              : 'bg-white/20 text-white border border-white/25 backdrop-blur-sm'
            : 'bg-white text-slate-900 hover:bg-slate-100 shadow-sm'
        } ${className}`}
      >
        {pending ? (
          <Loader2 size={13} className="animate-spin" />
        ) : isFollowing ? (
          hovered ? (
            <UserMinus size={13} />
          ) : (
            <UserCheck size={13} />
          )
        ) : (
          <UserPlus size={13} />
        )}
        <span>{label}</span>
      </button>
    );
  }

  if (variant === 'primary') {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-pressed={isFollowing}
        className={`min-h-[40px] px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-60 active:scale-95 ${
          isFollowing
            ? hovered
              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
            : followsMe
            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm hover:opacity-95'
            : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 shadow-sm'
        } ${className}`}
      >
        {pending ? (
          <Loader2 size={15} className="animate-spin" />
        ) : isFollowing ? (
          hovered ? (
            <UserMinus size={15} />
          ) : (
            <UserCheck size={15} />
          )
        ) : (
          <UserPlus size={15} />
        )}
        <span>{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-pressed={isFollowing}
      className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-60 active:scale-95 ${
        isFollowing
          ? hovered
            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700'
          : followsMe
          ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
          : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 shadow-sm'
      } ${className}`}
    >
      {pending ? (
        <Loader2 size={13} className="animate-spin" />
      ) : isFollowing ? (
        hovered ? (
          <UserMinus size={13} />
        ) : (
          <UserCheck size={13} />
        )
      ) : (
        <UserPlus size={13} />
      )}
      <span>{label}</span>
    </button>
  );
}
