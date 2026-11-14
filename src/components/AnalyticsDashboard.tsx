import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import {
  BarChart3,
  TrendingUp,
  Users,
  Heart,
  MessageCircle,
  Loader2,
  LayoutDashboard,
  FileText,
  Film,
} from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { ar } from 'date-fns/locale';

function getPostTimestampMs(post: any): number {
  if (!post?.createdAt) return 0;
  if (typeof post.createdAt?.toMillis === 'function') return post.createdAt.toMillis();
  if (typeof post.createdAt?.toDate === 'function') return post.createdAt.toDate().getTime();
  if (typeof post.createdAt?.seconds === 'number') return post.createdAt.seconds * 1000;
  const parsed = new Date(post.createdAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export default function AnalyticsDashboard() {
  const { user, profile, isFirebaseAuthenticated, language } = useAuth();
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [totalFollowers, setTotalFollowers] = useState(0);
  const [timeframe, setTimeframe] = useState<'30d' | '7d'>('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !isFirebaseAuthenticated) {
      setAllPosts([]);
      setTotalFollowers(0);
      setLoading(false);
      return;
    }

    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const postsQ = query(
          collection(db, 'posts'),
          where('authorId', '==', user.uid)
        );
        const [postsSnap, followersSnap] = await Promise.all([
          getDocs(postsQ),
          getDocs(collection(db, 'users', user.uid, 'followers')),
        ]);

        const posts = postsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => getPostTimestampMs(b) - getPostTimestampMs(a));

        setAllPosts(posts);
        setTotalFollowers(followersSnap.size);
      } catch (error) {
        console.warn('Analytics fetch notice:', error);
        setAllPosts([]);
        setTotalFollowers(0);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [user, isFirebaseAuthenticated]);

  const {
    filteredPosts,
    totalLikes,
    totalComments,
    avgInteractions,
    buckets,
    dateLabels,
    topInterests,
  } = useMemo(() => {
    const days = timeframe === '7d' ? 7 : 30;
    const now = new Date();
    const cutoffMs = startOfDay(subDays(now, days - 1)).getTime();

    const inWindow = allPosts.filter((p) => {
      const ms = getPostTimestampMs(p);
      return ms === 0 || ms >= cutoffMs;
    });

    const likes = inWindow.reduce((sum, p) => sum + (p.likesCount || 0), 0);
    const comments = inWindow.reduce((sum, p) => sum + (p.commentsCount || 0), 0);
    const totalInteractions = likes + comments;
    const avg = inWindow.length > 0 ? (totalInteractions / inWindow.length).toFixed(1) : '0';

    // Build real activity buckets
    const bucketCount = timeframe === '7d' ? 7 : 10;
    const daysPerBucket = timeframe === '7d' ? 1 : 3;
    const startMs = startOfDay(subDays(now, days - 1)).getTime();
    const bucketDurationMs = daysPerBucket * 24 * 60 * 60 * 1000;

    const rawBuckets = Array.from({ length: bucketCount }, (_, i) => {
      const bucketStart = new Date(startMs + i * bucketDurationMs);
      return {
        label: format(bucketStart, 'd MMM', { locale: language === 'ar' ? ar : undefined }),
        postsCount: 0,
        interactions: 0,
      };
    });

    inWindow.forEach((p) => {
      const ms = getPostTimestampMs(p);
      if (ms < startMs) return;
      const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor((ms - startMs) / bucketDurationMs)));
      rawBuckets[idx].postsCount += 1;
      rawBuckets[idx].interactions += (p.likesCount || 0) + (p.commentsCount || 0);
    });

    const maxScore = Math.max(
      1,
      ...rawBuckets.map((b) => b.interactions + b.postsCount)
    );

    const normalizedBuckets = rawBuckets.map((b) => {
      const score = b.interactions + b.postsCount;
      const pct = score > 0 ? Math.max(14, Math.round((score / maxScore) * 100)) : 6;
      return { ...b, heightPct: pct, hasActivity: score > 0 };
    });

    const labels = [
      format(subDays(now, days - 1), 'd MMM', { locale: language === 'ar' ? ar : undefined }),
      format(subDays(now, Math.floor(days / 2)), 'd MMM', { locale: language === 'ar' ? ar : undefined }),
      format(now, 'd MMM', { locale: language === 'ar' ? ar : undefined }),
    ];

    const interestEntries = Object.entries((profile?.interests || {}) as Record<string, number>)
      .filter(([, val]) => typeof val === 'number' && val > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    const interestTotal = interestEntries.reduce((sum, [, val]) => sum + val, 0) || 1;
    const formattedInterests = interestEntries.map(([tag, val]) => ({
      tag,
      count: val,
      pct: Math.round((val / interestTotal) * 100),
    }));

    return {
      filteredPosts: inWindow,
      totalLikes: likes,
      totalComments: comments,
      avgInteractions: avg,
      buckets: normalizedBuckets,
      dateLabels: labels,
      topInterests: formattedInterests,
    };
  }, [allPosts, timeframe, language, profile?.interests]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  const KpiCard = ({ icon: Icon, label, value, subtitle }: { icon: any; label: string; value: string | number; subtitle: string }) => (
    <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl">
          <Icon size={20} className="text-slate-600 dark:text-slate-300" />
        </div>
        <span className="text-[11px] font-semibold text-slate-400">
          {subtitle}
        </span>
      </div>
      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wide">{label}</p>
      <h3 className="text-2xl font-bold mt-1 tabular-nums text-slate-900 dark:text-white">{value}</h3>
    </div>
  );

  const windowSubtitle =
    timeframe === '7d'
      ? language === 'ar'
        ? 'آخر 7 أيام'
        : 'Last 7d'
      : language === 'ar'
      ? 'آخر 30 يوماً'
      : 'Last 30d';

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500 text-white rounded-2xl shadow-sm">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              {language === 'ar' ? 'استوديو المبدعين' : 'Creator Studio'}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              {timeframe === '7d'
                ? language === 'ar'
                  ? 'تحليلات أدائك الفعلي خلال آخر 7 أيام.'
                  : 'Real performance insights for the last 7 days.'
                : language === 'ar'
                ? 'تحليلات أدائك الفعلي خلال آخر 30 يوماً.'
                : 'Real performance insights for the last 30 days.'}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Users}
          label={language === 'ar' ? 'إجمالي المتابعين' : 'Total Followers'}
          value={totalFollowers.toLocaleString()}
          subtitle={language === 'ar' ? 'الحالي' : 'Current'}
        />
        <KpiCard
          icon={FileText}
          label={language === 'ar' ? 'المنشورات المنشورة' : 'Published Posts'}
          value={filteredPosts.length.toLocaleString()}
          subtitle={windowSubtitle}
        />
        <KpiCard
          icon={BarChart3}
          label={language === 'ar' ? 'متوسط التفاعل لكل منشور' : 'Avg. Interactions / Post'}
          value={avgInteractions}
          subtitle={windowSubtitle}
        />
        <KpiCard
          icon={Heart}
          label={language === 'ar' ? 'إجمالي الإعجابات والتعليقات' : 'Likes & Comments'}
          value={(totalLikes + totalComments).toLocaleString()}
          subtitle={`${totalLikes} ❤️ · ${totalComments} 💬`}
        />
      </div>

      {/* Charts / Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm min-h-[300px] flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <TrendingUp size={18} className="text-indigo-500" />
              {language === 'ar' ? 'نشاط التفاعل' : 'Engagement Activity'}
            </h4>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as '30d' | '7d')}
              aria-label={language === 'ar' ? 'الفترة الزمنية' : 'Timeframe'}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 outline-none cursor-pointer"
            >
              <option value="30d">{language === 'ar' ? 'آخر 30 يوماً' : 'Last 30 Days'}</option>
              <option value="7d">{language === 'ar' ? 'آخر 7 أيام' : 'Last 7 Days'}</option>
            </select>
          </div>

          <div className="flex items-end gap-2 h-40 mt-6">
            {buckets.map((bucket, i) => (
              <div
                key={i}
                className={`flex-1 rounded-t-lg relative group transition-all ${
                  bucket.hasActivity
                    ? 'bg-indigo-500/35 hover:bg-indigo-500/60 dark:bg-indigo-400/35 dark:hover:bg-indigo-400/60'
                    : 'bg-slate-100 dark:bg-slate-800/70'
                }`}
                style={{ height: `${bucket.heightPct}%` }}
              >
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-semibold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-md z-10 tabular-nums">
                  {bucket.label}: {bucket.interactions} {language === 'ar' ? 'تفاعل' : 'eng.'} · {bucket.postsCount}{' '}
                  {language === 'ar' ? 'منشور' : 'post'}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
            <span>{dateLabels[0]}</span>
            <span>{dateLabels[1]}</span>
            <span>{dateLabels[2]}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <h4 className="font-bold mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
            <Heart size={18} className="text-pink-500" />
            {language === 'ar' ? 'أبرز الاهتمامات' : 'Top Interests'}
          </h4>
          {topInterests.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6 px-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                {language === 'ar'
                  ? 'تفاعل مع المنشورات والوسوم لبناء قائمة اهتماماتك تلقائياً.'
                  : 'Like posts with hashtags to build your personalized interest breakdown.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4 flex-1">
              {topInterests.map((item) => (
                <div key={item.tag}>
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <span className="tracking-wide text-slate-800 dark:text-slate-200">#{item.tag}</span>
                    <span className="text-slate-400 tabular-nums">{item.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-pink-500 rounded-full transition-all" style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Content */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h4 className="font-bold text-slate-900 dark:text-white">
            {language === 'ar' ? 'أداء المحتوى الأخير' : 'Recent Content Performance'}
          </h4>
          <span className="text-xs text-slate-400 tabular-nums">
            {filteredPosts.slice(0, 5).length}
          </span>
        </div>
        <div className="divide-y divide-slate-50 dark:divide-slate-800">
          {filteredPosts.length === 0 ? (
            <div className="p-10 text-center text-slate-500 dark:text-slate-400 text-sm">
              {language === 'ar' ? 'لا توجد منشورات حديثة لتحليلها.' : 'No recent posts to analyze.'}
            </div>
          ) : (
            filteredPosts.slice(0, 5).map((post) => {
              const interactions = (post.likesCount || 0) + (post.commentsCount || 0);
              const postMs = getPostTimestampMs(post);
              return (
                <div key={post.id} className="p-4 flex items-center gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 relative">
                    {post.mediaType === 'video' ? (
                      <>
                        <video src={post.mediaURL} muted playsInline className="w-full h-full object-cover" />
                        <div className="absolute top-1 end-1 p-0.5 rounded bg-black/60 text-white">
                          <Film size={11} />
                        </div>
                      </>
                    ) : (
                      <img src={post.mediaURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate mb-2">
                      {post.caption || (language === 'ar' ? 'بدون وصف' : 'No caption')}
                    </p>
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-400 tabular-nums">
                      <span className="flex items-center gap-1">
                        <Heart size={14} className="text-rose-500" /> {post.likesCount || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle size={14} className="text-indigo-500" /> {post.commentsCount || 0}
                      </span>
                      {postMs > 0 && (
                        <span className="text-[11px] font-normal text-slate-400">
                          {format(new Date(postMs), 'd MMM', { locale: language === 'ar' ? ar : undefined })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-end shrink-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                      {interactions}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {language === 'ar' ? 'إجمالي التفاعل' : 'Interactions'}
                    </p>
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
