import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, query, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Search as SearchIcon, Loader2, Sparkles, Hash, X, Play, Flame } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SkeletonBox } from './SkeletonLoaders';
import UserAvatar from './UserAvatar';
import PostDetailModal from './PostDetailModal';
import FollowButton from './FollowButton';

const CATEGORY_TAGS = [
  { ar: 'الكل', en: 'All', tag: 'all', aliases: [] as string[] },
  { ar: 'طبيعة', en: '#nature', tag: 'nature', aliases: ['طبيعة', 'nature', 'ocean', 'sunset'] },
  { ar: 'سفر', en: '#travel', tag: 'travel', aliases: ['سفر', 'سياحة', 'travel', 'summer', 'vibes'] },
  { ar: 'طعام', en: '#food', tag: 'food', aliases: ['طعام', 'طبخ', 'food', 'pasta'] },
  { ar: 'تقنية', en: '#tech', tag: 'tech', aliases: ['تقنية', 'برمجة', 'tech', 'workspace'] },
  { ar: 'فن', en: '#art', tag: 'art', aliases: ['فن', 'تصوير', 'art', 'photo', 'design'] },
];

export default function ExploreView({
  onOpenProfile,
  onOpenChat,
  initialTag,
}: {
  onOpenProfile?: (uid: string) => void;
  onOpenChat?: (convId: string) => void;
  initialTag?: string;
}) {
  const { user, followers, following, blockedUsers, language, t } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [postSearchResults, setPostSearchResults] = useState<any[]>([]);
  const [explorePosts, setExplorePosts] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingExplore, setLoadingExplore] = useState(true);
  const [activeTag, setActiveTag] = useState<string>(initialTag || 'all');
  const [searchTab, setSearchTab] = useState<'users' | 'posts' | 'tags'>('users');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialTag) {
      setActiveTag(initialTag);
    }
  }, [initialTag]);

  // Close search dropdown on Escape or outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Fetch explore posts
  useEffect(() => {
    const fetchExplore = async () => {
      try {
        const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(60));
        const snapshot = await getDocs(q);
        const posts = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((p: any) => !blockedUsers.includes(p.authorId));

        setExplorePosts(posts);
      } catch (error) {
        console.error('Error fetching explore posts:', error);
      } finally {
        setLoadingExplore(false);
      }
    };
    fetchExplore();
  }, [blockedUsers]);

  // Extract trending hashtags from explore posts dynamically
  const trendingHashtags = useMemo(() => {
    const counts = new Map<string, number>();
    explorePosts.forEach((p: any) => {
      const explicitTags: string[] = Array.isArray(p.tags) ? p.tags : [];
      const captionMatches: string[] = (p.caption || '').match(/#[\p{L}\p{N}_]+/giu) || [];
      const combined = new Set([
        ...explicitTags.map((t) => String(t).replace(/^#/, '').toLowerCase()),
        ...captionMatches.map((t) => t.slice(1).toLowerCase()),
      ]);
      combined.forEach((tag) => {
        if (tag) counts.set(tag, (counts.get(tag) || 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag, count]) => ({ tag, count }));
  }, [explorePosts]);

  // Real-time search execution for users, posts, and hashtags
  const executeSearch = async (queryText?: string) => {
    const term = (queryText !== undefined ? queryText : searchQuery).trim();
    if (!term || term.length < 2) {
      setSearchResults([]);
      setPostSearchResults([]);
      return;
    }

    setIsDropdownOpen(true);
    setSearching(true);
    try {
      const lowerTerm = term.toLowerCase().replace(/^#/, '');

      // Query users snapshot (filtered client-side to also match fullName & case-insensitive usernames cleanly)
      const usersSnap = await getDocs(query(collection(db, 'users'), limit(50)));
      const foundUsers = usersSnap.docs
        .map(doc => doc.data())
        .filter((u: any) => {
          if (u.uid === user?.uid || blockedUsers.includes(u.uid)) return false;
          const uname = (u.username || '').toLowerCase();
          const fname = (u.fullName || '').toLowerCase();
          return uname.includes(lowerTerm) || fname.includes(lowerTerm);
        })
        .slice(0, 12);

      // Search posts by caption, authorUsername, or hashtags
      const postsSnap = await getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(60)));
      const foundPosts = postsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((p: any) => {
          if (blockedUsers.includes(p.authorId)) return false;
          const caption = (p.caption || '').toLowerCase();
          const author = (p.authorUsername || '').toLowerCase();
          const tags = (p.tags || []).map((t: string) => t.toLowerCase());
          return caption.includes(lowerTerm) || author.includes(lowerTerm) || tags.some((t: string) => t.includes(lowerTerm));
        });

      setSearchResults(foundUsers);
      setPostSearchResults(foundPosts);
    } catch (error) {
      console.error('Error executing search:', error);
    } finally {
      setSearching(false);
    }
  };

  // Debounced search as user types
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        executeSearch(searchQuery);
      } else {
        setSearchResults([]);
        setPostSearchResults([]);
        setIsDropdownOpen(false);
      }
    }, 280);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, user]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeSearch();
    }
  };

  const matchingTagsInSearch = useMemo(() => {
    const clean = searchQuery.trim().toLowerCase().replace(/^#/, '');
    if (clean.length < 2) return trendingHashtags;
    return trendingHashtags.filter((item) => item.tag.includes(clean));
  }, [searchQuery, trendingHashtags]);

  // Filter explore posts by active tag or custom hashtag
  const filteredPosts = useMemo(() => {
    if (activeTag === 'all') return explorePosts;
    const categoryDef = CATEGORY_TAGS.find((c) => c.tag === activeTag);
    const terms = categoryDef ? [categoryDef.tag, ...categoryDef.aliases] : [activeTag.toLowerCase()];

    return explorePosts.filter((post: any) => {
      const tags = (post.tags || []).map((t: string) => t.toLowerCase());
      const caption = (post.caption || '').toLowerCase();
      return terms.some((term) => tags.includes(term) || caption.includes(`#${term}`) || caption.includes(term));
    });
  }, [explorePosts, activeTag]);

  const isCustomActiveTag = activeTag !== 'all' && !CATEGORY_TAGS.some((c) => c.tag === activeTag);
  const showDropdown = isDropdownOpen && searchQuery.trim().length >= 2;

  return (
    <div className="space-y-6 pb-20">
      {/* Search Bar & Search Button Toolbar */}
      <div className="relative" ref={searchContainerRef}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onFocus={() => {
                if (searchQuery.trim().length >= 2) setIsDropdownOpen(true);
              }}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                language === 'ar'
                  ? 'ابحث عن مستخدمين، وسوم (#)، أو منشورات...'
                  : 'Search users, hashtags (#), or posts...'
              }
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 ps-11 pe-10 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm transition-all"
            />
            <SearchIcon className="absolute start-4 top-4 text-slate-400" size={18} />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setPostSearchResults([]);
                  setIsDropdownOpen(false);
                }}
                aria-label={language === 'ar' ? 'مسح البحث' : 'Clear search'}
                className="absolute end-3 top-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => executeSearch()}
            disabled={searching || searchQuery.trim().length < 2}
            className="min-h-[46px] px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 active:scale-95 shrink-0 whitespace-nowrap"
          >
            {searching ? <Loader2 size={16} className="animate-spin" /> : <SearchIcon size={16} />}
            <span>{t('search')}</span>
          </button>
        </div>

        {/* Real-Time Search Results Dropdown with Tabs */}
        {showDropdown && (
          <div className="absolute top-full inset-x-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in">
            <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => setSearchTab('users')}
                className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
                  searchTab === 'users'
                    ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {language === 'ar' ? `المستخدمون (${searchResults.length})` : `Users (${searchResults.length})`}
              </button>
              <button
                type="button"
                onClick={() => setSearchTab('posts')}
                className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
                  searchTab === 'posts'
                    ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {language === 'ar' ? `المنشورات (${postSearchResults.length})` : `Posts (${postSearchResults.length})`}
              </button>
              <button
                type="button"
                onClick={() => setSearchTab('tags')}
                className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
                  searchTab === 'tags'
                    ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {language === 'ar' ? `الوسوم (${matchingTagsInSearch.length})` : `Hashtags (${matchingTagsInSearch.length})`}
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {searching ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="animate-spin text-purple-600" size={24} />
                </div>
              ) : searchTab === 'users' ? (
                searchResults.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    {language === 'ar' ? 'لا يوجد مستخدمون مطابقون' : 'No matching users'}
                  </div>
                ) : (
                  searchResults.map((result) => {
                    const followsMe = followers.includes(result.uid) && !following.includes(result.uid);
                    return (
                      <div key={result.uid} className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors gap-2">
                        <div
                          onClick={() => {
                            onOpenProfile?.(result.uid);
                            setIsDropdownOpen(false);
                          }}
                          className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                        >
                          <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                            <UserAvatar src={result.photoURL} username={result.username} iconSize={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{result.username}</p>
                              {followsMe && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 shrink-0">
                                  {t('followsYou')}
                                </span>
                              )}
                            </div>
                            {result.fullName && (
                              <p className="text-xs text-slate-500 truncate">{result.fullName}</p>
                            )}
                          </div>
                        </div>
                        <FollowButton targetUserId={result.uid} variant="compact" />
                      </div>
                    );
                  })
                )
              ) : searchTab === 'posts' ? (
                postSearchResults.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    {language === 'ar' ? 'لا توجد منشورات مطابقة' : 'No matching posts'}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1 p-2">
                    {postSearchResults.map((post) => (
                      <button
                        key={post.id}
                        type="button"
                        onClick={() => {
                          setSelectedPost(post);
                          setIsDropdownOpen(false);
                        }}
                        className="aspect-square bg-slate-100 dark:bg-slate-800 relative group cursor-pointer rounded-lg overflow-hidden"
                      >
                        {post.mediaType === 'video' ? (
                          <>
                            <video src={post.mediaURL} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                            <span className="absolute top-1.5 end-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center">
                              <Play size={11} className="fill-white" />
                            </span>
                          </>
                        ) : (
                          <img
                            src={post.mediaURL}
                            alt={post.caption || ''}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1 text-center text-white text-[10px]">
                          <p className="line-clamp-2">{post.caption}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )
              ) : matchingTagsInSearch.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  {language === 'ar' ? 'لا توجد وسوم مطابقة' : 'No matching hashtags'}
                </div>
              ) : (
                matchingTagsInSearch.map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => {
                      setActiveTag(item.tag);
                      setIsDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-start"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                        <Hash size={15} />
                      </span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">#{item.tag}</span>
                    </div>
                    <span className="text-xs text-slate-400 tabular-nums">
                      {item.count} {language === 'ar' ? 'منشورات' : 'posts'}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Category Filter Chips + Custom Active Hashtag */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar items-center">
        {CATEGORY_TAGS.map((cat) => (
          <button
            key={cat.tag}
            type="button"
            onClick={() => setActiveTag(cat.tag)}
            className={`min-h-[38px] px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
              activeTag === cat.tag
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Hash size={13} />
            <span>{language === 'ar' ? cat.ar : cat.en}</span>
          </button>
        ))}

        {isCustomActiveTag && (
          <button
            type="button"
            onClick={() => setActiveTag('all')}
            className="min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap bg-purple-600 text-white flex items-center gap-1.5 shadow-sm shrink-0"
          >
            <Hash size={13} />
            <span>{activeTag}</span>
            <X size={13} />
          </button>
        )}
      </div>

      {/* Trending Hashtags Bar (when available from real posts) */}
      {trendingHashtags.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1 shrink-0">
            <Flame size={13} className="text-amber-500" />
            <span>{language === 'ar' ? 'الرائج:' : 'Trending:'}</span>
          </span>
          {trendingHashtags.slice(0, 8).map((item) => (
            <button
              key={item.tag}
              type="button"
              onClick={() => setActiveTag(item.tag)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                activeTag === item.tag
                  ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                  : 'text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              #{item.tag}
            </button>
          ))}
        </div>
      )}

      {/* Explore Grid */}
      <div>
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="text-purple-600" size={18} />
            <span>{language === 'ar' ? 'استكشاف المحتوى' : 'Explore'}</span>
          </h2>
          <span className="text-xs text-slate-400 font-medium tabular-nums">
            {filteredPosts.length} {language === 'ar' ? 'منشور' : 'posts'}
          </span>
        </div>

        {loadingExplore ? (
          <div className="grid grid-cols-3 gap-1 md:gap-4 rounded-2xl overflow-hidden">
            <SkeletonBox className="aspect-square col-span-2 row-span-2 !rounded-none" />
            <SkeletonBox className="aspect-square !rounded-none" />
            <SkeletonBox className="aspect-square !rounded-none" />
            <SkeletonBox className="aspect-square !rounded-none" />
            <SkeletonBox className="aspect-square !rounded-none" />
            <SkeletonBox className="aspect-square !rounded-none" />
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <p className="text-slate-500 text-sm font-medium">
              {language === 'ar'
                ? 'لا توجد منشورات مطابقة لهذا الوسم.'
                : 'No posts matching this tag yet.'}
            </p>
            {activeTag !== 'all' && (
              <button
                type="button"
                onClick={() => setActiveTag('all')}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {language === 'ar' ? 'عرض جميع المنشورات' : 'Show All Posts'}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1 md:gap-4 rounded-2xl overflow-hidden">
            {filteredPosts.map((post, idx) => (
              <button
                key={post.id}
                type="button"
                onClick={() => setSelectedPost(post)}
                className={`aspect-square bg-slate-100 dark:bg-slate-800 relative group cursor-pointer overflow-hidden ${
                  idx % 10 === 0 ? 'col-span-2 row-span-2' : ''
                }`}
              >
                {post.mediaType === 'video' ? (
                  <>
                    <video
                      src={post.mediaURL}
                      muted
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2 end-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center">
                      <Play size={13} className="fill-white" />
                    </span>
                  </>
                ) : (
                  <img
                    src={post.mediaURL}
                    alt={post.caption || ''}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center text-white">
                  <p className="font-bold text-xs truncate max-w-full">@{post.authorUsername}</p>
                  {post.caption && (
                    <p className="text-[10px] text-white/80 line-clamp-1 mt-0.5">{post.caption}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <PostDetailModal
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
        onOpenChat={onOpenChat}
        onOpenProfile={onOpenProfile}
        onSelectTag={(tag) => setActiveTag(tag)}
        onPostDeleted={(deletedId) => setExplorePosts((prev) => prev.filter((p) => p.id !== deletedId))}
      />
    </div>
  );
}
