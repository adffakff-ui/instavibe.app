import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Eye,
  Heart,
  MessageCircle,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  Play,
  Calendar,
  Star,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  BarChart2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { StoryItem } from './StoryViewer';
import { getTopReactionEntries } from '../utils/reactions';

interface StoryAnalyticsPanelProps {
  stories: StoryItem[];
  language: 'ar' | 'en';
  selectedStoryId?: string | null;
  onClearSelection?: () => void;
  onOpenStory: (story: StoryItem) => void;
}

type SortKey = 'newest' | 'views' | 'engagement' | 'taps';

function getStoryTimestampMs(story: StoryItem): number {
  const ts = story?.createdAt;
  if (!ts) return 0;
  if (typeof ts?.toMillis === 'function') return ts.toMillis();
  if (typeof ts?.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts?.seconds === 'number') return ts.seconds * 1000;
  const parsed = new Date(ts).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getStoryLikesCount(story: StoryItem): number {
  const fromCounts = story.reactionCounts
    ? Object.values(story.reactionCounts).reduce((sum, v) => sum + (Number(v) || 0), 0)
    : 0;
  return Math.max(Number(story.likesCount) || 0, fromCounts);
}

export default function StoryAnalyticsPanel({
  stories,
  language,
  selectedStoryId,
  onClearSelection,
  onOpenStory,
}: StoryAnalyticsPanelProps) {
  const isAr = language === 'ar';
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (selectedStoryId) {
      setIsCollapsed(false);
      setTimeout(() => {
        rowRefs.current[selectedStoryId]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }, 60);
    }
  }, [selectedStoryId]);

  const enrichedStories = useMemo(() => {
    return stories.map((story) => {
      const views = Number(story.viewsCount) || 0;
      const tapsForward = Number(story.tapsForwardCount) || 0;
      const tapsBack = Number(story.tapsBackCount) || 0;
      const likes = getStoryLikesCount(story);
      const replies = Number(story.repliesCount) || 0;
      const pollVotes = story.poll
        ? (Number(story.poll.votesA) || 0) + (Number(story.poll.votesB) || 0)
        : 0;
      const totalEngagement = likes + replies;
      const engagementRate = views > 0 ? Math.min(100, Math.round((totalEngagement / views) * 100)) : 0;
      const totalTaps = tapsForward + tapsBack;
      const createdMs = getStoryTimestampMs(story);
      const topReactions = getTopReactionEntries(story.reactionCounts || {}, likes, 3);

      return {
        story,
        views,
        tapsForward,
        tapsBack,
        totalTaps,
        likes,
        replies,
        pollVotes,
        totalEngagement,
        engagementRate,
        createdMs,
        topReactions,
      };
    });
  }, [stories]);

  const totals = useMemo(() => {
    return enrichedStories.reduce(
      (acc, item) => {
        acc.views += item.views;
        acc.tapsForward += item.tapsForward;
        acc.tapsBack += item.tapsBack;
        acc.likes += item.likes;
        acc.replies += item.replies;
        acc.engagement += item.totalEngagement;
        acc.maxViews = Math.max(acc.maxViews, item.views);
        return acc;
      },
      {
        views: 0,
        tapsForward: 0,
        tapsBack: 0,
        likes: 0,
        replies: 0,
        engagement: 0,
        maxViews: 1,
      }
    );
  }, [enrichedStories]);

  const sortedStories = useMemo(() => {
    const copy = [...enrichedStories];
    copy.sort((a, b) => {
      if (sortBy === 'views') return b.views - a.views || b.createdMs - a.createdMs;
      if (sortBy === 'engagement') return b.totalEngagement - a.totalEngagement || b.views - a.views;
      if (sortBy === 'taps') return b.totalTaps - a.totalTaps || b.views - a.views;
      return b.createdMs - a.createdMs;
    });
    return copy;
  }, [enrichedStories, sortBy]);

  const totalTapsAll = totals.tapsForward + totals.tapsBack;
  const forwardShare = totalTapsAll > 0 ? Math.round((totals.tapsForward / totalTapsAll) * 100) : 50;
  const backShare = totalTapsAll > 0 ? 100 - forwardShare : 50;
  const avgViews = stories.length > 0 ? Math.round(totals.views / stories.length) : 0;
  const overallEngagementRate =
    totals.views > 0 ? ((totals.engagement / totals.views) * 100).toFixed(1) : '0.0';

  return (
    <section
      aria-label={isAr ? 'تحليلات القصص المنتهية' : 'Expired Story Analytics'}
      className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden"
    >
      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-purple-50/70 via-white to-rose-50/50 dark:from-purple-950/30 dark:via-slate-900 dark:to-rose-950/20">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-rose-500 text-white flex items-center justify-center shadow-sm shrink-0">
            <BarChart3 size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                {isAr ? 'تحليلات القصص المنتهية' : 'Story Archive Analytics'}
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 tabular-nums">
                {stories.length} {isAr ? 'قصة' : stories.length === 1 ? 'story' : 'stories'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isAr
                ? 'إجمالي المشاهدات، نقرات التقدم والعودة، وإجمالي التفاعل (الإعجابات والردود) لكل قصة منتهية.'
                : 'Total views, forward & back taps, and engagement (likes & replies) for every expired story.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 self-start sm:self-center transition-colors shrink-0"
        >
          <span>{isCollapsed ? (isAr ? 'عرض التحليلات' : 'Expand Panel') : (isAr ? 'تصغير' : 'Collapse')}</span>
          {isCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="p-4 sm:p-5 space-y-5">
          {/* Aggregate Metric Summary Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Total Views */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1.5">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-[11px] font-bold">
                  {isAr ? 'إجمالي المشاهدات' : 'Total Views'}
                </span>
                <Eye size={15} className="text-blue-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                {totals.views.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                {isAr ? `متوسط ${avgViews} لكل قصة` : `Avg ${avgViews} per story`}
              </p>
            </div>

            {/* Taps Forward */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1.5">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-[11px] font-bold">
                  {isAr ? 'نقرات التقدم للأمام' : 'Taps Forward'}
                </span>
                <ArrowRight size={15} className="text-emerald-500 rtl:rotate-180" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                {totals.tapsForward.toLocaleString()}
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                {totalTapsAll > 0
                  ? `${forwardShare}% ${isAr ? 'من نقرات التنقل' : 'of navigation taps'}`
                  : isAr
                  ? 'بانتظار نقرات المشاهدين'
                  : 'Waiting for viewer taps'}
              </p>
            </div>

            {/* Taps Back */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1.5">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-[11px] font-bold">
                  {isAr ? 'نقرات العودة للخلف' : 'Taps Back'}
                </span>
                <ArrowLeft size={15} className="text-amber-500 rtl:rotate-180" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                {totals.tapsBack.toLocaleString()}
              </div>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold tabular-nums">
                {totalTapsAll > 0
                  ? `${backShare}% ${isAr ? 'نسبة إعادة المشاهدة' : 'rewatch tap share'}`
                  : isAr
                  ? 'مؤشر اهتمام المشاهدين'
                  : 'Indicates viewer rewatches'}
              </p>
            </div>

            {/* Total Engagement */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-rose-50 to-purple-50 dark:from-rose-950/30 dark:to-purple-950/30 border border-rose-200/70 dark:border-rose-900/50 space-y-1.5">
              <div className="flex items-center justify-between text-rose-700 dark:text-rose-300">
                <span className="text-[11px] font-bold">
                  {isAr ? 'إجمالي التفاعل' : 'Total Engagement'}
                </span>
                <TrendingUp size={15} className="text-rose-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                {totals.engagement.toLocaleString()}
              </div>
              <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                <span className="inline-flex items-center gap-1">
                  <Heart size={11} className="text-rose-500 fill-rose-500" />
                  {totals.likes}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle size={11} className="text-sky-500" />
                  {totals.replies}
                </span>
                <span className="ms-auto text-purple-600 dark:text-purple-400 font-bold">
                  {overallEngagementRate}%
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Taps Balance Bar (when taps exist) */}
          {stories.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200 shrink-0">
                {isAr ? 'توازن نقرات التنقل:' : 'Tap Navigation Balance:'}
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex">
                  <div
                    style={{ width: `${totalTapsAll > 0 ? forwardShare : 50}%` }}
                    className="h-full bg-emerald-500 transition-all"
                    title={`${isAr ? 'تقدم للأمام' : 'Taps Forward'}: ${totals.tapsForward}`}
                  />
                  <div
                    style={{ width: `${totalTapsAll > 0 ? backShare : 50}%` }}
                    className="h-full bg-amber-500 transition-all"
                    title={`${isAr ? 'عودة للخلف' : 'Taps Back'}: ${totals.tapsBack}`}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    {isAr ? 'تقدم' : 'Forward'}: {totals.tapsForward} ({totalTapsAll > 0 ? `${forwardShare}%` : '0%'})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                    {isAr ? 'عودة' : 'Back'}: {totals.tapsBack} ({totalTapsAll > 0 ? `${backShare}%` : '0%'})
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Per-Story Analytics Breakdown */}
          {stories.length === 0 ? (
            <div className="py-8 px-4 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
                {isAr
                  ? 'لا توجد قصص منتهية لعرض تحليلاتها بعد.'
                  : 'No expired stories to analyze yet.'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {isAr
                  ? 'بمجرد انتهاء صلاحية قصصك أو أرشفتها، ستظهر تفاصيل المشاهدات والتنقل والتفاعل لكل قصة هنا.'
                  : 'Once your stories expire or are archived, per-story views, navigation taps, and engagement appear here.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Sort Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <ArrowUpDown size={14} className="text-purple-500" />
                  <span>{isAr ? 'التفاصيل لكل قصة منتهية' : 'Per-Story Breakdown'}</span>
                  {selectedStoryId && onClearSelection && (
                    <button
                      type="button"
                      onClick={onClearSelection}
                      className="ms-2 text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                    >
                      {isAr ? 'إلغاء التمييز' : 'Clear highlight'}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-x-auto no-scrollbar">
                  {(
                    [
                      { id: 'newest', label: isAr ? 'الأحدث' : 'Newest' },
                      { id: 'views', label: isAr ? 'المشاهدات' : 'Top Views' },
                      { id: 'engagement', label: isAr ? 'التفاعل' : 'Engagement' },
                      { id: 'taps', label: isAr ? 'النقرات' : 'Most Taps' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSortBy(opt.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap ${
                        sortBy === opt.id
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Per-Story Rows */}
              <div className="space-y-2.5 max-h-[540px] overflow-y-auto pe-0.5">
                {sortedStories.map((entry) => {
                  const {
                    story,
                    views,
                    tapsForward,
                    tapsBack,
                    likes,
                    replies,
                    pollVotes,
                    totalEngagement,
                    engagementRate,
                    createdMs,
                    topReactions,
                  } = entry;

                  const dateText = createdMs
                    ? format(new Date(createdMs), 'd MMM yyyy • p', {
                        locale: isAr ? ar : undefined,
                      })
                    : isAr
                    ? 'قصة مؤرشفة'
                    : 'Archived story';
                  const viewBarPct = Math.round((views / Math.max(1, totals.maxViews)) * 100);
                  const isHighlighted = selectedStoryId === story.id;

                  return (
                    <div
                      key={story.id}
                      ref={(el) => {
                        rowRefs.current[story.id] = el;
                      }}
                      className={`p-3 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center gap-3.5 ${
                        isHighlighted
                          ? 'bg-purple-50/70 dark:bg-purple-950/30 border-purple-400 dark:border-purple-500 ring-2 ring-purple-500/20'
                          : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {/* Thumbnail & Story Identity */}
                      <div className="flex items-center gap-3 min-w-0 md:w-[34%]">
                        <button
                          type="button"
                          onClick={() => onOpenStory(story)}
                          className="relative w-12 h-20 rounded-xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-700 shrink-0 group cursor-pointer"
                          title={isAr ? 'معاينة القصة' : 'Preview story'}
                        >
                          {story.mediaType === 'video' ? (
                            <>
                              <video
                                src={story.mediaURL}
                                muted
                                playsInline
                                preload="metadata"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/25 flex items-center justify-center text-white">
                                <Play size={14} fill="currentColor" />
                              </div>
                            </>
                          ) : (
                            <img
                              src={story.mediaURL}
                              alt={story.caption || 'Archived story'}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              referrerPolicy="no-referrer"
                            />
                          )}
                        </button>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                              <Calendar size={11} className="text-purple-500 shrink-0" />
                              <span className="truncate">{dateText}</span>
                            </span>
                            {story.audience === 'close_friends' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[9px] font-extrabold">
                                <Star size={9} fill="currentColor" />
                                {isAr ? 'مقربون' : 'Close'}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1 font-medium">
                            {story.caption?.trim()
                              ? story.caption
                              : isAr
                              ? 'قصة بدون نص توضيحي'
                              : 'Story without caption'}
                          </p>

                          {/* Relative Reach Bar */}
                          <div className="space-y-0.5 pt-0.5">
                            <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <div
                                style={{ width: `${viewBarPct}%` }}
                                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-rose-500 transition-all"
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 tabular-nums">
                              <span>
                                {isAr ? `معدل التفاعل: ${engagementRate}%` : `Eng. rate: ${engagementRate}%`}
                              </span>
                              {pollVotes > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-purple-500 font-semibold">
                                  <BarChart2 size={10} />
                                  {pollVotes} {isAr ? 'تصويت' : 'poll votes'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 4 Metrics Breakdown Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
                        {/* Views */}
                        <div className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/70">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            <Eye size={11} className="text-blue-500 shrink-0" />
                            <span className="truncate">{isAr ? 'المشاهدات' : 'Views'}</span>
                          </div>
                          <div className="text-base font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
                            {views.toLocaleString()}
                          </div>
                        </div>

                        {/* Taps Forward */}
                        <div className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/70">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            <ArrowRight size={11} className="text-emerald-500 rtl:rotate-180 shrink-0" />
                            <span className="truncate">{isAr ? 'تقدم للأمام' : 'Taps Forward'}</span>
                          </div>
                          <div className="text-base font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
                            {tapsForward.toLocaleString()}
                          </div>
                        </div>

                        {/* Taps Back */}
                        <div className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/70">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            <ArrowLeft size={11} className="text-amber-500 rtl:rotate-180 shrink-0" />
                            <span className="truncate">{isAr ? 'عودة للخلف' : 'Taps Back'}</span>
                          </div>
                          <div className="text-base font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
                            {tapsBack.toLocaleString()}
                          </div>
                        </div>

                        {/* Total Engagement (Likes + Replies) */}
                        <div className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-rose-200/80 dark:border-rose-900/50">
                          <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                            <span className="truncate">{isAr ? 'التفاعل الكلي' : 'Engagement'}</span>
                            {topReactions.length > 0 && (
                              <span className="text-[11px] leading-none">
                                {topReactions.map((r) => r.meta.emoji).join('')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-baseline justify-between gap-1 mt-0.5">
                            <span className="text-base font-black text-slate-900 dark:text-white tabular-nums">
                              {totalEngagement.toLocaleString()}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                              {likes} ❤️ • {replies} 💬
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
