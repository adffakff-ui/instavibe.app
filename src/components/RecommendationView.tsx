import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Play, Video, TrendingUp, Radio } from 'lucide-react';
import Post from './Post';
import UserAvatar from './UserAvatar';
import SuggestedUsersCard from './SuggestedUsersCard';
import { DiscoverySkeleton, PostSkeleton } from './SkeletonLoaders';

export default function RecommendationView({
  onOpenProfile,
  onOpenChat,
  onSelectTag,
  setView,
}: {
  onOpenProfile: (uid: string) => void;
  onOpenChat: (convId: string) => void;
  onSelectTag?: (tag: string) => void;
  setView?: (view: any) => void;
}) {
  const { user, profile, blockedUsers, language } = useAuth();
  const [recommendedPosts, setRecommendedPosts] = useState<any[]>([]);
  const [liveStreams, setLiveStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [topInterests, setTopInterests] = useState<string[]>([]);

  // Real-time subscription to currently active live streams
  useEffect(() => {
    if (!user) return;
    const liveQ = query(
      collection(db, 'liveStreams'),
      where('status', '==', 'live'),
      limit(12)
    );
    const unsubscribe = onSnapshot(
      liveQ,
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((s: any) => !blockedUsers.includes(s.hostId));
        setLiveStreams(list);
      },
      (err) => console.warn('Discovery live streams notice:', err)
    );
    return unsubscribe;
  }, [user, blockedUsers]);

  useEffect(() => {
    if (!profile) return;

    const fetchRecommendations = async () => {
      setLoading(true);
      try {
        const interests = profile.interests || {};
        const sortedInterests = Object.entries(interests)
          .sort(([, a]: any, [, b]: any) => b - a)
          .map(([tag]) => tag)
          .slice(0, 3);

        setTopInterests(sortedInterests);

        let postsData: any[] = [];
        if (sortedInterests.length > 0) {
          const q = query(
            collection(db, 'posts'),
            where('tags', 'array-contains-any', sortedInterests),
            limit(20)
          );
          const snapshot = await getDocs(q);
          postsData = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a: any, b: any) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
            .slice(0, 10);
        }

        if (postsData.length === 0) {
          const fallbackQ = query(
            collection(db, 'posts'),
            orderBy('createdAt', 'desc'),
            limit(10)
          );
          const fallbackSnap = await getDocs(fallbackQ);
          postsData = fallbackSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        setRecommendedPosts(postsData.filter((p: any) => !blockedUsers.includes(p.authorId)));
      } catch (error) {
        console.error('Recommendation fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [profile, blockedUsers]);

  if (loading && recommendedPosts.length === 0) {
    return <DiscoverySkeleton />;
  }

  return (
    <div className="space-y-10 pb-20">
      {/* Smart Suggestions Header */}
      <div className="flex items-center gap-3 p-6 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-3xl text-white shadow-lg">
        <Sparkles size={32} className="shrink-0" />
        <div>
          <h2 className="text-xl font-bold">
            {language === 'ar' ? 'الاستكشاف الذكي' : 'Smart Discovery'}
          </h2>
          <p className="text-white/85 text-sm">
            {language === 'ar' ? 'محتوى مخصص بناءً على اهتماماتك.' : 'Tailored content based on your interests.'}
          </p>
        </div>
      </div>

      {/* Live Now Section (Real Firestore Streams) */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Video size={20} className="text-rose-500" />
            <span>{language === 'ar' ? 'مباشر الآن' : 'Live Now'}</span>
            {liveStreams.length > 0 && (
              <span className="text-xs font-bold tabular-nums text-rose-500">({liveStreams.length})</span>
            )}
          </h3>
          <button
            type="button"
            onClick={() => setView?.('live')}
            className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline uppercase tracking-wider px-2 py-1"
          >
            {language === 'ar' ? 'عرض الكل' : 'See All'}
          </button>
        </div>

        {liveStreams.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center shrink-0">
                <Radio size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {language === 'ar' ? 'لا يوجد بث مباشر نشط الآن' : 'No active live broadcasts right now'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {language === 'ar' ? 'افتح مركز البث المباشر لمشاهدة التسجيلات أو بدء بثك.' : 'Open the Live Hub to start your own broadcast.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setView?.('live')}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Radio size={15} />
              <span>{language === 'ar' ? 'مركز البث المباشر' : 'Open Live Hub'}</span>
            </button>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
            {liveStreams.map((stream) => (
              <button
                key={stream.id}
                type="button"
                onClick={() => setView?.('live')}
                className="relative shrink-0 w-64 group cursor-pointer text-start"
              >
                <div className="aspect-video rounded-2xl overflow-hidden bg-slate-900 border-2 border-rose-500 relative">
                  {stream.thumbnailURL ? (
                    <img
                      src={stream.thumbnailURL}
                      alt={stream.title}
                      className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950">
                      <Radio size={28} className="text-rose-500" />
                    </div>
                  )}
                  <div className="absolute top-2 start-2 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-white rounded-full" />
                    <span>{language === 'ar' ? 'مباشر' : 'LIVE'}</span>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-11 h-11 bg-black/45 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 group-hover:scale-110 transition-transform">
                      <Play size={20} className="text-white fill-white ms-0.5" />
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                    <UserAvatar src={stream.hostPhotoURL} username={stream.hostUsername} iconSize={12} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate text-slate-900 dark:text-white">{stream.title}</p>
                    <p className="text-xs text-slate-500 truncate">@{stream.hostUsername}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Suggested Users to Follow */}
      <SuggestedUsersCard layout="horizontal" onOpenProfile={onOpenProfile} />

      {/* Recommended For You Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <TrendingUp size={20} className="text-emerald-500" />
            {language === 'ar' ? 'مقترح لك' : 'Recommended For You'}
          </h3>
          {topInterests.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {topInterests.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onSelectTag?.(tag)}
                  className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline font-semibold"
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-6">
            <PostSkeleton />
            <PostSkeleton />
          </div>
        ) : recommendedPosts.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
            <p className="text-slate-500 font-medium px-10">
              {language === 'ar'
                ? 'تفاعل مع المزيد من المنشورات للحصول على توصيات أذكى!'
                : 'Interact with more posts to get smarter recommendations!'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {recommendedPosts.map((post) => (
              <Post
                key={post.id}
                post={post}
                onOpenProfile={onOpenProfile}
                onOpenChat={onOpenChat}
                onSelectTag={onSelectTag}
                onPostDeleted={(deletedId) => setRecommendedPosts((prev) => prev.filter((p) => p.id !== deletedId))}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
