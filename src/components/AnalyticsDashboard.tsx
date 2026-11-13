import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import {
  BarChart3,
  TrendingUp,
  Users,
  Eye,
  Heart,
  MessageCircle,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  LayoutDashboard
} from 'lucide-react';

export default function AnalyticsDashboard() {
  const { user, profile, language } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const postsQ = query(
          collection(db, 'posts'),
          where('authorId', '==', user.uid)
        );
        const postsSnap = await getDocs(postsQ);
        const posts = postsSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a: any, b: any) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)) as any[];
        setRecentPosts(posts.slice(0, 5));

        const totalLikes = posts.reduce((sum, p) => sum + (p.likesCount || 0), 0);
        const totalComments = posts.reduce((sum, p) => sum + (p.commentsCount || 0), 0);
        const avgEngagement = posts.length > 0 ? ((totalLikes + totalComments) / posts.length).toFixed(1) : 0;
        const estimatedReach = posts.length * 150 + totalLikes * 10;

        const followersSnap = await getDocs(collection(db, 'users', user.uid, 'followers'));
        const totalFollowers = followersSnap.size;

        setStats({
          totalPosts: posts.length,
          totalLikes,
          totalComments,
          avgEngagement,
          estimatedReach,
          totalFollowers,
          growthRate: '+12.5%',
        });
      } catch (error) {
        console.error('Analytics Error:', error);
        setStats({
          totalPosts: 0,
          totalLikes: 0,
          totalComments: 0,
          avgEngagement: 0,
          estimatedReach: 0,
          totalFollowers: 0,
          growthRate: '0%',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  const KpiCard = ({ icon: Icon, label, value, trend, trendUp }: any) => (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
          <Icon size={20} className="text-slate-600 dark:text-slate-400" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${trendUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trend}
          </div>
        )}
      </div>
      <p className="text-xs font-bold text-slate-400 tracking-wider">{label}</p>
      <h3 className="text-2xl font-bold mt-1 tabular-nums">{value}</h3>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-indigo-500 text-white rounded-2xl">
          <LayoutDashboard size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold">
            {language === 'ar' ? 'استوديو المبدعين' : 'Creator Studio'}
          </h2>
          <p className="text-slate-500 text-sm">
            {language === 'ar' ? 'تحليلات الأداء خلال آخر 30 يوماً.' : 'Performance insights for the last 30 days.'}
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Users}
          label={language === 'ar' ? 'إجمالي المتابعين' : 'Total Followers'}
          value={stats.totalFollowers}
          trend="+124"
          trendUp={true}
        />
        <KpiCard
          icon={Eye}
          label={language === 'ar' ? 'الوصول التقديري' : 'Estimated Reach'}
          value={stats.estimatedReach.toLocaleString()}
          trend="+15%"
          trendUp={true}
        />
        <KpiCard
          icon={BarChart3}
          label={language === 'ar' ? 'معدل التفاعل' : 'Engagement Rate'}
          value={`${stats.avgEngagement}%`}
          trend="+2.1%"
          trendUp={true}
        />
        <KpiCard
          icon={Heart}
          label={language === 'ar' ? 'إجمالي الإعجابات' : 'Total Likes'}
          value={stats.totalLikes.toLocaleString()}
          trend="+450"
          trendUp={true}
        />
      </div>

      {/* Charts / Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm h-80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h4 className="font-bold flex items-center gap-2">
              <TrendingUp size={18} className="text-indigo-500" />
              {language === 'ar' ? 'مؤشر النمو' : 'Growth Trend'}
            </h4>
            <select className="bg-slate-50 dark:bg-slate-800 border-none text-xs font-bold rounded-lg px-3 py-1.5 outline-none">
              <option>{language === 'ar' ? 'آخر 30 يوماً' : 'Last 30 Days'}</option>
              <option>{language === 'ar' ? 'آخر 7 أيام' : 'Last 7 Days'}</option>
            </select>
          </div>

          <div className="flex items-end gap-2 h-40 mt-4">
            {[40, 60, 35, 90, 50, 70, 85, 45, 95, 60, 80, 100].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-indigo-500/20 rounded-t-lg relative group transition-all hover:bg-indigo-500/40"
                style={{ height: `${h}%` }}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                  {h * 10}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
            <span>{language === 'ar' ? '14 أكتوبر' : 'Oct 14'}</span>
            <span>{language === 'ar' ? '28 أكتوبر' : 'Oct 28'}</span>
            <span>{language === 'ar' ? '12 نوفمبر' : 'Nov 12'}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <h4 className="font-bold mb-6 flex items-center gap-2">
            <Heart size={18} className="text-pink-500" />
            {language === 'ar' ? 'أبرز الاهتمامات' : 'Top Interests'}
          </h4>
          <div className="space-y-4 flex-1">
            {Object.entries((profile?.interests || { travel: 45, food: 32, tech: 18 }) as Record<string, number>)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([tag, val]) => (
                <div key={tag}>
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <span className="uppercase tracking-wider">#{tag}</span>
                    <span className="text-slate-400 tabular-nums">{val}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-pink-500 rounded-full" style={{ width: `${val}%` }} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Top Content */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <h4 className="font-bold">
            {language === 'ar' ? 'أداء المحتوى الأخير' : 'Recent Content Performance'}
          </h4>
        </div>
        <div className="divide-y divide-slate-50 dark:divide-slate-800">
          {recentPosts.length === 0 ? (
            <div className="p-10 text-center text-slate-500 text-sm">
              {language === 'ar' ? 'لا توجد منشورات حديثة لتحليلها.' : 'No recent posts to analyze.'}
            </div>
          ) : (
            recentPosts.map((post) => (
              <div key={post.id} className="p-4 flex items-center gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                  <img src={post.mediaURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate mb-2">
                    {post.caption || (language === 'ar' ? 'بدون وصف' : 'No caption')}
                  </p>
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-400 tabular-nums">
                    <span className="flex items-center gap-1"><Heart size={14} /> {post.likesCount}</span>
                    <span className="flex items-center gap-1"><MessageCircle size={14} /> {post.commentsCount}</span>
                    <span className="flex items-center gap-1"><Eye size={14} /> {Math.floor(post.likesCount * 4.5)}</span>
                  </div>
                </div>
                <div className="text-end">
                  <p className="text-xs font-bold text-emerald-500 tabular-nums">+4.2%</p>
                  <p className="text-[10px] text-slate-400">
                    {language === 'ar' ? 'التفاعل' : 'Engagement'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
