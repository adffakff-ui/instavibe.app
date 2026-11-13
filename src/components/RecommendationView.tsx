import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Play, Video, Loader2, TrendingUp } from 'lucide-react';
import Post from './Post';

export default function RecommendationView({ onOpenProfile, onOpenChat }: { onOpenProfile: (uid: string) => void, onOpenChat: (convId: string) => void }) {
  const { profile, blockedUsers, language } = useAuth();
  const [recommendedPosts, setRecommendedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [topInterests, setTopInterests] = useState<string[]>([]);

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

  const liveStreams = [
    { id: '1', username: 'pro_gamer', title: language === 'ar' ? 'رحلة الوصول إلى القمة! 🎮' : 'Road to Grandmaster! 🎮', viewers: '1.2k', photo: '/src/assets/images/avatar_man_1794501560820.jpg' },
    { id: '2', username: 'yoga_life', title: language === 'ar' ? 'تمارين الصباح والهدوء 🧘‍♀️✨' : 'Morning Flow 🧘‍♀️✨', viewers: '850', photo: '/src/assets/images/avatar_woman_1794501562592.jpg' },
  ];

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

      {/* Live Now Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Video size={20} className="text-red-500" />
            {language === 'ar' ? 'مباشر الآن' : 'Live Now'}
          </h3>
          <button className="text-xs font-bold text-blue-500 uppercase tracking-wider">
            {language === 'ar' ? 'عرض الكل' : 'See All'}
          </button>
        </div>
        <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
          {liveStreams.map((stream) => (
            <div key={stream.id} className="relative shrink-0 w-64 group cursor-pointer">
              <div className="aspect-video rounded-2xl overflow-hidden bg-slate-900 border-2 border-red-500 relative">
                <img src={stream.photo} alt="" className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                <div className="absolute top-2 start-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                  {language === 'ar' ? 'مباشر' : 'Live'}
                </div>
                <div className="absolute bottom-2 end-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded tabular-nums">
                  {stream.viewers} {language === 'ar' ? 'مشاهد' : 'viewers'}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 group-hover:scale-110 transition-transform">
                    <Play size={24} className="text-white fill-white ms-1" />
                  </div>
                </div>
              </div>
              <div className="mt-2">
                <p className="font-bold text-sm truncate">{stream.title}</p>
                <p className="text-xs text-slate-500">@{stream.username}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recommended For You Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <TrendingUp size={20} className="text-emerald-500" />
            {language === 'ar' ? 'مقترح لك' : 'Recommended For You'}
          </h3>
          {topInterests.length > 0 && (
            <div className="flex gap-2">
              {topInterests.map(tag => (
                <span key={tag} className="text-[11px] text-slate-500 font-semibold">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-slate-400" size={32} />
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
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
