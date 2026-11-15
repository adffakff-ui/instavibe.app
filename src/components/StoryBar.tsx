import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Plus, ChevronLeft, ChevronRight, Camera, Bookmark, Sparkles, Eye, Clock } from 'lucide-react';
import StoryCreation from './StoryCreation';
import StoryViewer, { StoryItem, StoryUserGroup } from './StoryViewer';
import { getSavedStoryDrafts } from '../utils/storyDrafts';
import UserAvatar from './UserAvatar';

export default function StoryBar() {
  const { user, profile, isFirebaseAuthenticated, blockedUsers, language, t } = useAuth();
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreation, setShowCreation] = useState(false);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number | null>(null);
  
  // Persistent viewed story IDs
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem('instavibe_viewed_stories');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [draftsCount, setDraftsCount] = useState<number>(0);

  // Sync viewed stories to session storage
  const markStoryAsViewed = (storyId: string) => {
    setViewedStoryIds((prev) => {
      const next = new Set(prev).add(storyId);
      try {
        sessionStorage.setItem('instavibe_viewed_stories', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (user?.uid) {
      const drafts = getSavedStoryDrafts(user.uid);
      setDraftsCount(drafts.length);
    }
  }, [user, showCreation]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(Math.abs(scrollLeft) > 10);
      setCanScrollRight(Math.abs(scrollLeft) + clientWidth < scrollWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [stories]);

  const scrollByAmount = (offset: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Real-time listener for active stories (with live expiration filter)
  useEffect(() => {
    if (!isFirebaseAuthenticated) {
      setStories([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'stories'),
      orderBy('createdAt', 'desc'),
      limit(60)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const now = Date.now();
        const activeStories: StoryItem[] = [];

        snapshot.docs.forEach((doc) => {
          const data = doc.data() as any;
          if (blockedUsers && blockedUsers.includes(data.authorId)) return;

          // Exclude expired stories
          if (data.expiresAt) {
            const expTime = new Date(data.expiresAt).getTime();
            if (expTime <= now) return;
          }

          activeStories.push({
            id: doc.id,
            authorId: data.authorId,
            authorUsername: data.authorUsername || 'User',
            authorPhotoURL: data.authorPhotoURL || '',
            mediaURL: data.mediaURL,
            mediaType: data.mediaType || 'image',
            caption: data.caption || '',
            likesCount: typeof data.likesCount === 'number' ? data.likesCount : 0,
            viewsCount: typeof data.viewsCount === 'number' ? data.viewsCount : 0,
            reactionCounts: data.reactionCounts || {},
            poll: data.poll,
            createdAt: data.createdAt,
            expiresAt: data.expiresAt,
          });
        });

        setStories(activeStories);
        setLoading(false);
      },
      (error) => {
        console.warn('Stories snapshot listener error:', error);
        setStories([]);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [blockedUsers, isFirebaseAuthenticated]);

  // Group active stories by authorId
  const groupedStories = useMemo(() => {
    return stories.reduce<{ [key: string]: StoryUserGroup }>((acc, story) => {
      if (!acc[story.authorId]) {
        acc[story.authorId] = {
          authorId: story.authorId,
          authorUsername: story.authorUsername,
          authorPhotoURL: story.authorPhotoURL || '',
          stories: [],
        };
      }
      acc[story.authorId].stories.push(story);
      return acc;
    }, {});
  }, [stories]);

  const myUserStoryGroup = user ? groupedStories[user.uid] : null;
  const userHasStory = Boolean(myUserStoryGroup && myUserStoryGroup.stories.length > 0);

  const otherAuthors = useMemo(() => {
    return Object.values(groupedStories).filter(
      (g) => !user || g.authorId !== user.uid
    );
  }, [groupedStories, user]);

  // Total active story groups for seamless inter-user sequence navigation
  const allStoryGroups: StoryUserGroup[] = useMemo(() => {
    const list: StoryUserGroup[] = [];
    if (myUserStoryGroup && myUserStoryGroup.stories.length > 0) {
      list.push(myUserStoryGroup);
    }
    otherAuthors.forEach((group) => {
      if (group.stories.length > 0) {
        list.push(group);
      }
    });
    return list;
  }, [myUserStoryGroup, otherAuthors]);

  // Calculate sum of views on user's own stories
  const myTotalViews = useMemo(() => {
    if (!myUserStoryGroup) return 0;
    return myUserStoryGroup.stories.reduce((acc, s) => acc + (s.viewsCount || 0), 0);
  }, [myUserStoryGroup]);

  // Time remaining helper for badges
  const getGroupExpirationBadge = (groupStories: StoryItem[]) => {
    if (!groupStories || groupStories.length === 0) return null;
    const latestExpires = groupStories
      .map((s) => (s.expiresAt ? new Date(s.expiresAt).getTime() : 0))
      .filter((t) => t > 0);
    if (latestExpires.length === 0) return null;
    const minTime = Math.min(...latestExpires);
    const diffMs = minTime - Date.now();
    if (diffMs <= 0) return null;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours <= 0) {
      const minutes = Math.floor(diffMs / (1000 * 60));
      return { label: language === 'ar' ? `${minutes}د` : `${minutes}m`, isUrgent: true };
    }
    return { label: language === 'ar' ? `${hours}س` : `${hours}h`, isUrgent: hours <= 2 };
  };

  const handleOpenGroup = (targetAuthorId: string) => {
    const index = allStoryGroups.findIndex((g) => g.authorId === targetAuthorId);
    if (index !== -1) {
      // Mark stories as viewed locally
      allStoryGroups[index].stories.forEach((s) => markStoryAsViewed(s.id));
      setSelectedGroupIndex(index);
    }
  };

  return (
    <div className="relative bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-3 sm:p-4 shadow-sm">
      {/* Stories Carousel Bar Header */}
      <div className="flex items-center justify-between px-1 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('stories')}
          </span>
          <div className="flex items-center gap-1 text-[10px] font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-200/50 dark:border-rose-900/40">
            <Clock size={10} />
            <span>{language === 'ar' ? '24 ساعة' : '24h'}</span>
          </div>
          {allStoryGroups.length > 0 && (
            <span className="text-[10px] text-slate-400 font-medium">
              ({stories.length} {language === 'ar' ? 'قصة' : 'stories'})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {draftsCount > 0 && (
            <button
              type="button"
              onClick={() => setShowCreation(true)}
              className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors border border-purple-200/40 dark:border-purple-900/40"
              title={language === 'ar' ? 'لديك مسودات قصص محفوظة' : 'You have saved story drafts'}
            >
              <Bookmark size={12} />
              <span>{language === 'ar' ? `المسودات (${draftsCount})` : `Drafts (${draftsCount})`}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowCreation(true)}
            className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center gap-1.5 hover:underline py-1 px-2 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors"
          >
            <Camera size={14} />
            <span>{t('createStory')}</span>
          </button>
        </div>
      </div>

      {/* Desktop Scroll Chevrons */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollByAmount(language === 'ar' ? 240 : -240)}
          className="hidden sm:flex absolute start-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 items-center justify-center text-slate-700 dark:text-slate-200 hover:scale-105 active:scale-95 transition-all"
          title={language === 'ar' ? 'تمرير' : 'Scroll Left'}
        >
          {language === 'ar' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      )}

      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollByAmount(language === 'ar' ? -240 : 240)}
          className="hidden sm:flex absolute end-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 items-center justify-center text-slate-700 dark:text-slate-200 hover:scale-105 active:scale-95 transition-all"
          title={language === 'ar' ? 'تمرير' : 'Scroll Right'}
        >
          {language === 'ar' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      )}

      {/* Carousel Track */}
      <div
        ref={scrollContainerRef}
        onScroll={checkScroll}
        className="flex items-center gap-4 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1"
      >
        {/* "Your Story" Circle */}
        <div className="flex flex-col items-center gap-1.5 shrink-0 select-none group">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (userHasStory && user) {
                  handleOpenGroup(user.uid);
                } else {
                  setShowCreation(true);
                }
              }}
              className={`p-[2.5px] rounded-full transition-all duration-200 group-hover:scale-105 active:scale-95 block focus:outline-none ${
                userHasStory
                  ? 'bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 shadow-md ring-2 ring-purple-500/20'
                  : 'border-2 border-dashed border-purple-400 dark:border-purple-600 p-[3px]'
              }`}
            >
              <div className="w-16 h-16 rounded-full border-2 border-white dark:border-slate-900 overflow-hidden bg-slate-200 dark:bg-slate-800">
                <UserAvatar
                  src={profile?.photoURL}
                  username={profile?.username}
                  alt={t('profile')}
                  iconSize={22}
                />
              </div>
            </button>

            {/* If user has story: Show '+' badge to add more AND views count pill */}
            {userHasStory ? (
              <>
                {/* Add another story '+' button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCreation(true);
                  }}
                  className="absolute -top-1 -end-1 w-6 h-6 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md hover:scale-110 active:scale-95 transition-transform"
                  title={language === 'ar' ? 'إضافة قصة أخرى' : 'Add another story'}
                >
                  <Plus size={13} strokeWidth={3} />
                </button>

                {/* View Counter pill on avatar */}
                <div 
                  onClick={() => user && handleOpenGroup(user.uid)}
                  className="absolute -bottom-1 inset-x-0 mx-auto w-fit flex items-center gap-1 bg-black/80 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-white/20 shadow-sm cursor-pointer hover:bg-black"
                  title={language === 'ar' ? `${myTotalViews} مشاهدة لقصتك` : `${myTotalViews} views on your story`}
                >
                  <Eye size={10} className="text-blue-400" />
                  <span className="tabular-nums">{myTotalViews}</span>
                </div>
              </>
            ) : (
              <div
                onClick={() => setShowCreation(true)}
                className="absolute -bottom-1 -end-1 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center border-2 border-white dark:border-slate-900 cursor-pointer shadow-sm hover:scale-110 transition-transform"
                title={t('createStory')}
              >
                <Plus size={13} strokeWidth={3} />
              </div>
            )}
          </div>

          {/* User Name & Story Count Label */}
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate w-16 text-center">
              {userHasStory
                ? (language === 'ar' ? 'قصتك' : 'Your Story')
                : (language === 'ar' ? 'أضف قصة' : 'Add Story')}
            </span>
            {userHasStory && myUserStoryGroup && (
              <span className="text-[9px] font-semibold text-purple-600 dark:text-purple-400">
                {myUserStoryGroup.stories.length}{' '}
                {language === 'ar' ? 'مقاطع' : 'items'}
              </span>
            )}
          </div>
        </div>

        {/* Other Users' Stories */}
        {otherAuthors.map((authorGroup) => {
          const allViewed = authorGroup.stories.every((s) => viewedStoryIds.has(s.id));
          const storyCount = authorGroup.stories.length;
          const expiryBadge = getGroupExpirationBadge(authorGroup.stories);

          return (
            <div key={authorGroup.authorId} className="flex flex-col items-center gap-1.5 shrink-0 select-none group">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => handleOpenGroup(authorGroup.authorId)}
                  className={`p-[2.5px] rounded-full transition-all duration-200 group-hover:scale-105 active:scale-95 block focus:outline-none ${
                    allViewed
                      ? 'bg-slate-300 dark:bg-slate-700'
                      : 'bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 shadow-md ring-2 ring-rose-500/20'
                  }`}
                >
                  <div className="w-16 h-16 rounded-full border-2 border-white dark:border-slate-900 overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <UserAvatar
                      src={authorGroup.authorPhotoURL}
                      username={authorGroup.authorUsername}
                      iconSize={22}
                    />
                  </div>
                </button>

                {/* Multiple stories indicator badge (e.g. "3") */}
                {storyCount > 1 && (
                  <span 
                    className="absolute -top-1 -end-1 px-1.5 min-w-[18px] h-[18px] rounded-full text-[9px] font-black bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md"
                    title={language === 'ar' ? `${storyCount} قصص` : `${storyCount} stories`}
                  >
                    {storyCount}
                  </span>
                )}

                {/* Remaining expiration badge (e.g. "4h" / "4س") */}
                {expiryBadge && (
                  <span 
                    className={`absolute -bottom-1 -start-1 px-1.5 py-0.5 rounded-full text-[8.5px] font-bold border border-white/40 dark:border-slate-800 shadow-sm flex items-center gap-0.5 ${
                      expiryBadge.isUrgent
                        ? 'bg-amber-500 text-white animate-pulse'
                        : 'bg-slate-900/80 text-white backdrop-blur-sm'
                    }`}
                    title={language === 'ar' ? `تنتهي خلال ${expiryBadge.label}` : `Expires in ${expiryBadge.label}`}
                  >
                    <Clock size={8} />
                    <span>{expiryBadge.label}</span>
                  </span>
                )}
              </div>

              {/* Author Username */}
              <div className="flex flex-col items-center">
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate w-16 text-center">
                  {authorGroup.authorUsername}
                </span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                  {allViewed ? (language === 'ar' ? 'تمت الرؤية' : 'Viewed') : (language === 'ar' ? 'جديد' : 'New')}
                </span>
              </div>
            </div>
          );
        })}

        {/* Empty state when no stories */}
        {!loading && otherAuthors.length === 0 && !userHasStory && (
          <button
            type="button"
            onClick={() => setShowCreation(true)}
            className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-200 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-600 transition-colors text-start"
          >
            <Sparkles size={16} className="text-purple-500 shrink-0" />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {language === 'ar'
                ? 'لا توجد قصص نشطة الآن — شارك قصتك الأولى لمدة 24 ساعة!'
                : 'No active stories yet — share your first 24h story!'}
            </span>
          </button>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="flex gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse border-2 border-slate-200 dark:border-slate-700" />
                <div className="w-12 h-2.5 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Story Creation Modal */}
      {showCreation && (
        <StoryCreation
          onClose={() => setShowCreation(false)}
        />
      )}

      {/* Continuous Fullscreen Story Viewer (Seamless sequence progression across all stories & users) */}
      {selectedGroupIndex !== null && allStoryGroups.length > 0 && (
        <StoryViewer
          storyGroups={allStoryGroups}
          initialGroupIndex={selectedGroupIndex}
          onClose={() => setSelectedGroupIndex(null)}
          onStoryViewed={markStoryAsViewed}
          onStoryDeleted={(deletedId) => {
            setStories((prev) => prev.filter((s) => s.id !== deletedId));
          }}
          onStoryArchived={(archivedId) => {
            setStories((prev) => prev.filter((s) => s.id !== archivedId));
          }}
        />
      )}
    </div>
  );
}
