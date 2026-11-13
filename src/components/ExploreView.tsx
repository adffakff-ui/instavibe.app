import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Search as SearchIcon, Loader2, UserPlus, UserCheck, Sparkles, Hash, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFirestore } from '../hooks/useFirestore';

const CATEGORY_TAGS = [
  { ar: 'الكل', en: 'All', tag: 'all' },
  { ar: 'طبيعة', en: '#nature', tag: 'nature' },
  { ar: 'سفر', en: '#travel', tag: 'travel' },
  { ar: 'طعام', en: '#food', tag: 'food' },
  { ar: 'تقنية', en: '#tech', tag: 'tech' },
  { ar: 'فن', en: '#art', tag: 'art' },
];

export default function ExploreView({ onOpenProfile }: { onOpenProfile?: (uid: string) => void }) {
  const { user, profile, following, blockedUsers, language, t } = useAuth();
  const { followUser, unfollowUser } = useFirestore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [explorePosts, setExplorePosts] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingExplore, setLoadingExplore] = useState(true);
  const [activeTag, setActiveTag] = useState<string>('all');

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

  // Handle user search execution
  const executeSearch = async (queryText?: string) => {
    const term = (queryText !== undefined ? queryText : searchQuery).trim();
    if (!term || term.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('username', '>=', term.toLowerCase()),
        where('username', '<=', term.toLowerCase() + '\uf8ff'),
        limit(12)
      );
      const snapshot = await getDocs(q);
      setSearchResults(
        snapshot.docs
          .map(doc => doc.data())
          .filter(u => u.uid !== user?.uid && !blockedUsers.includes(u.uid))
      );
    } catch (error) {
      console.error('Error searching users:', error);
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
      }
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, user]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeSearch();
    }
  };

  // Filter explore posts by active category tag
  const filteredPosts = explorePosts.filter((post: any) => {
    if (activeTag === 'all') return true;
    const tags = post.tags || [];
    const caption = (post.caption || '').toLowerCase();
    return tags.includes(activeTag) || caption.includes(activeTag);
  });

  return (
    <div className="space-y-6 pb-20">
      {/* Search Bar & Search Button Toolbar */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                language === 'ar'
                  ? 'ابحث عن مستخدمين أو منشئي محتوى...'
                  : 'Search creators or users...'
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
                }}
                aria-label="Clear search"
                className="absolute end-3 top-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => executeSearch()}
            disabled={searching || !searchQuery.trim()}
            className="min-h-[44px] px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50 active:scale-95 shrink-0 whitespace-nowrap"
          >
            {searching ? <Loader2 size={16} className="animate-spin" /> : <SearchIcon size={16} />}
            <span>{t('search')}</span>
          </button>
        </div>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute top-full inset-x-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in">
            {searchResults.map((result) => {
              const isFollowing = following.includes(result.uid);
              return (
                <div key={result.uid} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <div
                    onClick={() => {
                      onOpenProfile?.(result.uid);
                      setSearchResults([]);
                    }}
                    className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 shrink-0">
                      <img
                        src={result.photoURL || '/placeholder-avatar.jpg'}
                        alt={result.username || ''}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{result.username}</p>
                      <p className="text-xs text-slate-500 truncate">{result.fullName}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => isFollowing ? unfollowUser(user!.uid, result.uid) : followUser(user!.uid, result.uid, profile!)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                      isFollowing
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        : 'bg-purple-600 text-white shadow-sm'
                    }`}
                  >
                    {isFollowing ? <UserCheck size={14} /> : <UserPlus size={14} />}
                    <span>{isFollowing ? t('following') : t('follow')}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Category Filter Chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {CATEGORY_TAGS.map((cat) => (
          <button
            key={cat.tag}
            type="button"
            onClick={() => setActiveTag(cat.tag)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTag === cat.tag
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Hash size={13} />
            <span>{language === 'ar' ? cat.ar : cat.en}</span>
          </button>
        ))}
      </div>

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
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-purple-600" size={32} />
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <p className="text-slate-500 text-sm font-medium">
              {language === 'ar'
                ? 'لا توجد منشورات مطابقة لهذا الوسم.'
                : 'No posts matching this tag yet.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1 md:gap-4 rounded-2xl overflow-hidden">
            {filteredPosts.map((post, idx) => (
              <div
                key={post.id}
                onClick={() => onOpenProfile?.(post.authorId)}
                className={`aspect-square bg-slate-100 dark:bg-slate-800 relative group cursor-pointer ${
                  idx % 10 === 0 ? 'col-span-2 row-span-2' : ''
                }`}
              >
                <img
                  src={post.mediaURL}
                  alt={post.caption || ''}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center text-white">
                  <p className="font-bold text-xs truncate max-w-full">@{post.authorUsername}</p>
                  <p className="text-[10px] text-white/80 line-clamp-1 mt-0.5">{post.caption}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
