import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, where, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Post from './Post';
import StoryBar from './StoryBar';
import PostCreation from './PostCreation';
import SuggestedUsersCard from './SuggestedUsersCard';
import { PostSkeleton } from './SkeletonLoaders';
import { Sparkles, ChevronRight, Users, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Feed({
  onOpenChat,
  onOpenProfile,
  onSelectTag,
  setView,
}: {
  onOpenChat: (convId: string) => void;
  onOpenProfile: (uid: string) => void;
  onSelectTag?: (tag: string) => void;
  setView: (view: any) => void;
}) {
  const { user, isFirebaseAuthenticated, signIn, following, blockedUsers, language } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'following'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseAuthenticated) {
      setPosts([]);
      setLoading(false);
      return;
    }

    const isFollowingFilter = filter === 'following' && Boolean(user);

    if (isFollowingFilter && following.length === 0) {
      setPosts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let q;
    if (isFollowingFilter && following.length <= 30) {
      q = query(
        collection(db, 'posts'),
        where('authorId', 'in', following)
      );
    } else if (isFollowingFilter) {
      q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(100));
    } else {
      q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50));
    }

    const followingSet = new Set(following);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let postsData = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((p: any) => !blockedUsers.includes(p.authorId));

        if (isFollowingFilter) {
          postsData = postsData
            .filter((p: any) => followingSet.has(p.authorId))
            .sort((a: any, b: any) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
        }

        setPosts(postsData);
        setLoading(false);
      },
      (err) => {
        console.warn('Posts feed listener error:', err);
        setPosts([]);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [filter, following, user, isFirebaseAuthenticated, blockedUsers]);

  return (
    <div className="space-y-6">
      <StoryBar />

      <div className="flex items-center justify-center gap-8 border-b border-slate-100 dark:border-slate-800 mb-4">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={cn(
            'pb-3 text-sm font-semibold transition-colors relative',
            filter === 'all' ? 'text-slate-900 dark:text-white' : 'text-slate-400 hover:text-slate-600'
          )}
        >
          {language === 'ar' ? 'لك' : 'For You'}
          {filter === 'all' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 dark:bg-white" />}
        </button>
        <button
          type="button"
          onClick={() => setFilter('following')}
          className={cn(
            'pb-3 text-sm font-semibold transition-colors relative flex items-center gap-1.5',
            filter === 'following' ? 'text-slate-900 dark:text-white' : 'text-slate-400 hover:text-slate-600'
          )}
        >
          <span>{language === 'ar' ? 'المتابَعون' : 'Following'}</span>
          {following.length > 0 && (
            <span className="text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {following.length}
            </span>
          )}
          {filter === 'following' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 dark:bg-white" />}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setView('discover')}
        className="w-full text-start bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity mb-2 shadow-lg shadow-slate-900/10"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="text-yellow-400 shrink-0" size={20} />
          <span className="text-sm font-bold">
            {language === 'ar' ? 'اكتشف محتوى مخصصاً لك' : 'Discover content tailored for you'}
          </span>
        </div>
        <ChevronRight size={18} className={language === 'ar' ? 'rotate-180 shrink-0' : 'shrink-0'} />
      </button>

      <PostCreation />

      {filter === 'all' && (
        <SuggestedUsersCard layout="horizontal" onOpenProfile={onOpenProfile} />
      )}

      <div className="flex flex-col gap-8 pb-10">
        {loading ? (
          <>
            <PostSkeleton />
            <PostSkeleton />
          </>
        ) : posts.length > 0 ? (
          posts.map((post) => (
            <Post
              key={post.id}
              post={post}
              onOpenChat={onOpenChat}
              onOpenProfile={onOpenProfile}
              onSelectTag={onSelectTag}
              onPostDeleted={(deletedId) => setPosts((prev) => prev.filter((p) => p.id !== deletedId))}
            />
          ))
        ) : !isFirebaseAuthenticated ? (
          <div className="text-center py-14 px-6 bg-white dark:bg-slate-900 rounded-2xl border border-purple-200 dark:border-purple-900/60 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
              <ImageIcon size={22} />
            </div>
            <p className="text-slate-900 dark:text-white font-bold text-sm">
              {language === 'ar' ? 'وضع المعاينة كضيف' : 'Guest Preview Mode'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {language === 'ar'
                ? 'سجّل الدخول بحساب Google لعرض المنشورات الحية، التفاعل معها، وحفظها في مجموعتك الخاصة.'
                : 'Sign in with Google to view live posts, interact with creators, and save bookmarks.'}
            </p>
            <button
              type="button"
              onClick={signIn}
              className="mt-2 min-h-[40px] px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors shadow-sm"
            >
              {language === 'ar' ? 'تسجيل الدخول عبر Google' : 'Sign in with Google'}
            </button>
          </div>
        ) : filter === 'following' ? (
          <div className="space-y-5">
            <div className="text-center py-12 px-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto mb-2">
                <Users size={22} />
              </div>
              <p className="text-slate-900 dark:text-white font-bold text-sm">
                {following.length === 0
                  ? language === 'ar'
                    ? 'لم تتابع أحداً بعد'
                    : "You aren't following anyone yet"
                  : language === 'ar'
                  ? 'لا توجد منشورات جديدة ممن تتابعهم حالياً'
                  : 'No recent posts from accounts you follow'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'ar'
                  ? 'تابع حسابات حقيقية أدناه لتظهر منشوراتهم مباشرة في هذا الخلاصة.'
                  : 'Follow people below to see their posts right here.'}
              </p>
            </div>
            <SuggestedUsersCard layout="list" onOpenProfile={onOpenProfile} />
          </div>
        ) : (
          <div className="text-center py-16 px-6 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-2">
              <ImageIcon size={22} />
            </div>
            <p className="text-slate-900 dark:text-white font-bold text-sm">
              {language === 'ar' ? 'لا توجد منشورات بعد' : 'No posts yet'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {language === 'ar'
                ? 'كن أول من يشارك لحظة جديدة عبر صندوق النشر في الأعلى!'
                : 'Be the first to share a photo or video using the post composer above!'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
