import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { RefreshCw, Users } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import FollowButton from './FollowButton';
import UserAvatar from './UserAvatar';
import { SkeletonBox } from './SkeletonLoaders';

interface SuggestedUsersCardProps {
  layout?: 'horizontal' | 'list';
  maxItems?: number;
  onOpenProfile?: (uid: string) => void;
  title?: string;
}

export default function SuggestedUsersCard({
  layout = 'horizontal',
  maxItems = 12,
  onOpenProfile,
  title,
}: SuggestedUsersCardProps) {
  const { user, isFirebaseAuthenticated, following, followers, blockedUsers, language } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!user || !isFirebaseAuthenticated) {
      setUsers([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db, 'users'), limit(40)));
        if (cancelled) return;
        const list = snap.docs.map((d) => ({
          uid: d.id,
          ...d.data(),
        }));
        setUsers(list);
      } catch (error) {
        console.warn('Suggested users fetch notice:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchUsers();
    return () => {
      cancelled = true;
    };
  }, [user, isFirebaseAuthenticated, refreshTick]);

  const suggestions = useMemo(() => {
    if (!user) return [];
    return users
      .filter(
        (u) =>
          u.uid &&
          u.uid !== user.uid &&
          !blockedUsers.includes(u.uid) &&
          !following.includes(u.uid)
      )
      .sort((a, b) => {
        const aFollowsMe = followers.includes(a.uid) ? 1 : 0;
        const bFollowsMe = followers.includes(b.uid) ? 1 : 0;
        if (aFollowsMe !== bFollowsMe) return bFollowsMe - aFollowsMe;
        const ta = a.createdAt?.toMillis?.() ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      })
      .slice(0, maxItems);
  }, [users, user, blockedUsers, following, followers, maxItems]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <SkeletonBox className="h-4 w-32" />
          <SkeletonBox className="h-4 w-12" />
        </div>
        <div className={layout === 'horizontal' ? 'flex gap-3 overflow-hidden' : 'space-y-3'}>
          {[1, 2, 3].map((i) => (
            <SkeletonBox
              key={i}
              className={layout === 'horizontal' ? 'h-40 w-36 shrink-0 rounded-2xl' : 'h-14 w-full rounded-xl'}
            />
          ))}
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  const heading =
    title || (language === 'ar' ? 'أشخاص قد تعرفهم' : 'Suggested for you');

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-purple-600 dark:text-purple-400 shrink-0" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{heading}</h3>
        </div>
        <button
          type="button"
          onClick={() => setRefreshTick((t) => t + 1)}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          title={language === 'ar' ? 'تحديث الاقتراحات' : 'Refresh suggestions'}
        >
          <RefreshCw size={12} />
          <span>{language === 'ar' ? 'تحديث' : 'Refresh'}</span>
        </button>
      </div>

      {layout === 'horizontal' ? (
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {suggestions.map((u) => {
            const followsMe = followers.includes(u.uid);
            return (
              <div
                key={u.uid}
                className="w-40 shrink-0 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 flex flex-col items-center text-center gap-2.5 transition-colors hover:border-purple-300 dark:hover:border-purple-700"
              >
                <button
                  type="button"
                  onClick={() => onOpenProfile?.(u.uid)}
                  className="w-14 h-14 rounded-full overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm shrink-0 hover:opacity-90 transition-opacity"
                >
                  <UserAvatar src={u.photoURL} username={u.username} iconSize={22} />
                </button>
                <div className="w-full min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpenProfile?.(u.uid)}
                    className="font-bold text-xs text-slate-900 dark:text-white truncate block w-full hover:underline"
                  >
                    {u.username}
                  </button>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {followsMe
                      ? language === 'ar'
                        ? 'يتابعك'
                        : 'Follows you'
                      : u.fullName || (language === 'ar' ? 'عضو جديد' : 'Member')}
                  </p>
                </div>
                <FollowButton targetUserId={u.uid} variant="compact" className="w-full" />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {suggestions.map((u) => {
            const followsMe = followers.includes(u.uid);
            return (
              <div
                key={u.uid}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-1 last:pb-1"
              >
                <button
                  type="button"
                  onClick={() => onOpenProfile?.(u.uid)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-start"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                    <UserAvatar src={u.photoURL} username={u.username} iconSize={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {u.username}
                      </p>
                      {followsMe && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 shrink-0">
                          {language === 'ar' ? 'يتابعك' : 'Follows you'}
                        </span>
                      )}
                    </div>
                    {u.fullName && (
                      <p className="text-xs text-slate-500 truncate">{u.fullName}</p>
                    )}
                  </div>
                </button>
                <FollowButton targetUserId={u.uid} variant="compact" />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
