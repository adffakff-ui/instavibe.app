import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Plus, ChevronLeft, ChevronRight, Camera, Bookmark, Sparkles } from 'lucide-react';
import StoryCreation from './StoryCreation';
import StoryViewer, { StoryItem } from './StoryViewer';
import { getSavedStoryDrafts } from '../utils/storyDrafts';
import UserAvatar from './UserAvatar';

export default function StoryBar() {
  const { user, profile, isFirebaseAuthenticated, blockedUsers, language, t } = useAuth();
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreation, setShowCreation] = useState(false);
  const [selectedUserStories, setSelectedUserStories] = useState<StoryItem[] | null>(null);
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(() => new Set());
  const [draftsCount, setDraftsCount] = useState<number>(0);

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
  const groupedStories = stories.reduce<{ [key: string]: { authorId: string; authorUsername: string; authorPhotoURL: string; stories: StoryItem[] } }>((acc, story) => {
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

  const myUserStoryGroup = user ? groupedStories[user.uid] : null;
  const userHasStory = Boolean(myUserStoryGroup && myUserStoryGroup.stories.length > 0);

  const otherAuthors = Object.values(groupedStories).filter(
    (g) => !user || g.authorId !== user.uid
  );

  const handleOpenUserStories = (authorStories: StoryItem[]) => {
    setViewedStoryIds((prev) => {
      const next = new Set(prev);
      authorStories.forEach((s) => next.add(s.id));
      return next;
    });
    setSelectedUserStories(authorStories);
  };

  return (
    <div className="relative bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-sm">
      {/* Stories Carousel Bar Header */}
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {t('stories')}
          </span>
          <span className="text-[10px] font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded-full">
            {language === 'ar' ? '24 ساعة' : '24h'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {draftsCount > 0 && (
            <button
              type="button"
              onClick={() => setShowCreation(true)}
              className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors"
              title={language === 'ar' ? 'لديك مسودات قصص محفوظة' : 'You have saved story drafts'}
            >
              <Bookmark size={12} />
              <span>{language === 'ar' ? `المسودات (${draftsCount})` : `Drafts (${draftsCount})`}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowCreation(true)}
            className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center gap-1 hover:underline"
          >
            <Camera size={13} />
            {t('createStory')}
          </button>
        </div>
      </div>

      {/* Desktop Scroll Chevrons */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollByAmount(language === 'ar' ? 220 : -220)}
          className="hidden sm:flex absolute start-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 items-center justify-center text-slate-700 dark:text-slate-200 hover:scale-105 active:scale-95 transition-all"
          title={language === 'ar' ? 'تمرير' : 'Scroll Left'}
        >
          {language === 'ar' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      )}

      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollByAmount(language === 'ar' ? -220 : 220)}
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
        <div className="flex flex-col items-center gap-1.5 shrink-0 select-none">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (userHasStory && myUserStoryGroup) {
                  handleOpenUserStories(myUserStoryGroup.stories);
                } else {
                  setShowCreation(true);
                }
              }}
              className={`p-[2.5px] rounded-full transition-transform active:scale-95 block focus:outline-none ${
                userHasStory
                  ? 'bg-gradient-to-tr from-yellow-400 via-rose-500 to-purple-600 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800'
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

            {userHasStory ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCreation(true);
                }}
                className="absolute -bottom-1 -end-1 w-6 h-6 rounded-full bg-gradient-to-tr from-yellow-400 to-purple-600 text-white flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md hover:scale-110 active:scale-95 transition-transform"
                title={language === 'ar' ? 'إضافة قصة أخرى' : 'Add another story'}
              >
                <Plus size={13} strokeWidth={3} />
              </button>
            ) : (
              <div
                onClick={() => setShowCreation(true)}
                className="absolute -bottom-1 -end-1 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center border-2 border-white dark:border-slate-900 cursor-pointer shadow-sm hover:scale-110 transition-transform"
                title={t('createStory')}
              >
                <Plus size={13} strokeWidth={3} />
              </div>
            )}
          </div>
          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate w-16 text-center">
            {userHasStory
              ? (language === 'ar' ? 'قصتك' : 'Your Story')
              : (language === 'ar' ? 'أضف قصة' : 'Add Story')}
          </span>
        </div>

        {/* Other Users' Stories */}
        {otherAuthors.map((authorGroup) => {
          const allViewed = authorGroup.stories.every((s) => viewedStoryIds.has(s.id));
          return (
            <div key={authorGroup.authorId} className="flex flex-col items-center gap-1.5 shrink-0 select-none">
              <button
                type="button"
                onClick={() => handleOpenUserStories(authorGroup.stories)}
                className={`p-[2.5px] rounded-full transition-transform active:scale-95 block focus:outline-none ${
                  allViewed
                    ? 'bg-slate-300 dark:bg-slate-700'
                    : 'bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 hover:opacity-90'
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
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 truncate w-16 text-center">
                {authorGroup.authorUsername}
              </span>
            </div>
          );
        })}

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

        {loading && (
          <div className="flex gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
                <div className="w-10 h-2 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
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

      {/* Story Fullscreen Viewer Modal */}
      {selectedUserStories && (
        <StoryViewer
          stories={selectedUserStories}
          onClose={() => setSelectedUserStories(null)}
          onStoryDeleted={(deletedId) => {
            setStories((prev) => prev.filter((s) => s.id !== deletedId));
          }}
        />
      )}
    </div>
  );
}
