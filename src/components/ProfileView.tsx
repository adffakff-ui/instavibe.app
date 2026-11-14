import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp, deleteDoc, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useFirestore } from '../hooks/useFirestore';
import {
  Settings,
  Grid,
  Bookmark,
  Tag,
  Loader2,
  MessageSquare,
  Plus,
  Sparkles,
  X,
  Archive,
  Play,
  RotateCcw,
  Trash2,
  Clock,
  CheckCircle2,
  Calendar,
  Film,
  Search,
  UserMinus,
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import StoryViewer, { StoryItem } from './StoryViewer';
import SettingsModal, { SettingsTab } from './SettingsModal';
import { ProfileSkeleton } from './SkeletonLoaders';
import ActionConfirmationModal from './ActionConfirmationModal';
import UserAvatar from './UserAvatar';
import PostDetailModal from './PostDetailModal';
import FollowButton from './FollowButton';

function getTimestampMs(createdAt: any): number {
  if (!createdAt) return 0;
  if (typeof createdAt?.toDate === 'function') {
    return createdAt.toDate().getTime();
  }
  if (typeof createdAt?.seconds === 'number') {
    return createdAt.seconds * 1000;
  }
  const parsed = new Date(createdAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getStoryExpiryMs(story: any): number {
  if (story.expiresAt) {
    const exp = new Date(story.expiresAt).getTime();
    if (!Number.isNaN(exp)) return exp;
  }
  const createdMs = getTimestampMs(story.createdAt);
  return createdMs > 0 ? createdMs + 24 * 60 * 60 * 1000 : Date.now() + 24 * 60 * 60 * 1000;
}

export default function ProfileView({
  userId,
  onOpenChat,
  onNavigateHome,
  onOpenProfile,
  onSelectTag,
}: {
  userId: string;
  onOpenChat?: (convId: string) => void;
  onNavigateHome?: () => void;
  onOpenProfile?: (uid: string) => void;
  onSelectTag?: (tag: string) => void;
}) {
  const { user: currentUser, profile: currentProfile, isFirebaseAuthenticated, signIn, followers, following, blockedUsers, language, t } = useAuth();
  const {
    removeFollower,
    getOrCreateConversation,
    blockUser,
    unblockUser,
    createHighlightAlbum,
    addStoryToHighlightAlbum,
    createStory,
    deleteStory,
    archiveStory,
    unsavePost,
  } = useFirestore();

  const isOwnProfile = currentUser?.uid === userId;

  const ownFallback = useMemo(() => {
    if (!currentUser) return null;
    return (
      currentProfile || {
        uid: currentUser.uid,
        username:
          currentUser.displayName?.replace(/\s+/g, '_').toLowerCase() ||
          (currentUser.email ? currentUser.email.split('@')[0] : 'user'),
        fullName: currentUser.displayName || '',
        email: currentUser.email || '',
        photoURL: currentUser.photoURL || '',
        bio: '',
      }
    );
  }, [currentUser, currentProfile]);

  const [profile, setProfile] = useState<any>(() => {
    return isOwnProfile ? (currentProfile || ownFallback) : null;
  });

  const activeProfile = useMemo(() => {
    return profile || (isOwnProfile ? ownFallback : null);
  }, [profile, isOwnProfile, ownFallback]);
  const [posts, setPosts] = useState<any[]>([]);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [myStories, setMyStories] = useState<StoryItem[]>([]);
  const [loadingArchives, setLoadingArchives] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(!isOwnProfile);
  const [isBlockedByTarget, setIsBlockedByTarget] = useState(false);
  const [showBlockConfirmModal, setShowBlockConfirmModal] = useState(false);
  const [blockingInProgress, setBlockingInProgress] = useState(false);

  // Highlight creation modal state
  const [showNewHighlightModal, setShowNewHighlightModal] = useState(false);
  const [newHighlightTitle, setNewHighlightTitle] = useState('');
  const [newHighlightCover, setNewHighlightCover] = useState('');
  const [creatingHighlight, setCreatingHighlight] = useState(false);

  // Story viewers (highlights vs archives)
  const [selectedHighlightStories, setSelectedHighlightStories] = useState<StoryItem[] | null>(null);
  const [archiveViewerState, setArchiveViewerState] = useState<{ stories: StoryItem[]; index: number } | null>(null);

  // Archive interactions state
  const [archiveFilter, setArchiveFilter] = useState<'all' | 'image' | 'video'>('all');
  const [highlightTargetStory, setHighlightTargetStory] = useState<StoryItem | null>(null);
  const [newHighlightFromArchiveTitle, setNewHighlightFromArchiveTitle] = useState('');
  const [savingToHighlight, setSavingToHighlight] = useState(false);
  const [confirmDeleteStoryId, setConfirmDeleteStoryId] = useState<string | null>(null);
  const [repostingStoryId, setRepostingStoryId] = useState<string | null>(null);
  const [archivingStoryId, setArchivingStoryId] = useState<string | null>(null);
  const [archiveToast, setArchiveToast] = useState<string | null>(null);

  // Settings & Edit Profile modal state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general');
  const [profileTab, setProfileTab] = useState<'posts' | 'saved' | 'tagged' | 'archives'>('posts');

  // Saved, Tagged, Post Detail & Followers/Following modal states
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [taggedPosts, setTaggedPosts] = useState<any[]>([]);
  const [loadingTagged, setLoadingTagged] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [followListType, setFollowListType] = useState<'followers' | 'following' | null>(null);
  const [followListUsers, setFollowListUsers] = useState<any[]>([]);
  const [loadingFollowList, setLoadingFollowList] = useState(false);
  const [followListSearch, setFollowListSearch] = useState('');
  const [removingFollowerId, setRemovingFollowerId] = useState<string | null>(null);

  const followsMe = followers.includes(userId) && !following.includes(userId);
  const hasBlocked = blockedUsers.includes(userId);

  const showToast = (msg: string) => {
    setArchiveToast(msg);
    setTimeout(() => setArchiveToast(null), 3000);
  };

  useEffect(() => {
    if (!isOwnProfile && profileTab === 'archives') {
      setProfileTab('posts');
    }
  }, [isOwnProfile, profileTab]);

  // Keep own profile updated whenever auth context profile updates
  useEffect(() => {
    if (isOwnProfile && currentProfile) {
      setProfile(currentProfile);
    }
  }, [isOwnProfile, currentProfile]);

  useEffect(() => {
    if (!userId) return;

    if (!isFirebaseAuthenticated) {
      setIsBlockedByTarget(false);
      if (isOwnProfile) {
        setProfile(currentProfile || ownFallback);
      } else {
        setProfile(null);
      }
      setPosts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchData = async () => {
      if (!isOwnProfile || !profile) {
        setLoading(true);
      }
      setIsBlockedByTarget(false);
      try {
        if (currentUser && !isOwnProfile) {
          try {
            const blockSnap = await getDoc(doc(db, 'users', userId, 'blockedUsers', currentUser.uid));
            if (blockSnap.exists()) {
              if (!cancelled) {
                setIsBlockedByTarget(true);
                setLoading(false);
              }
              return;
            }
          } catch {
            // ignore blocked check errors
          }
        }

        const userSnap = await getDoc(doc(db, 'users', userId));
        if (cancelled) return;

        if (userSnap.exists()) {
          setProfile(userSnap.data());
        } else if (isOwnProfile) {
          const resolvedOwn = currentProfile || ownFallback;
          if (resolvedOwn) {
            setProfile(resolvedOwn);
            // Auto-heal doc in firestore so future queries find it
            try {
              await setDoc(
                doc(db, 'users', userId),
                {
                  uid: userId,
                  username: resolvedOwn.username || 'user',
                  fullName: resolvedOwn.fullName || '',
                  bio: resolvedOwn.bio || '',
                  photoURL: resolvedOwn.photoURL || '',
                  email: resolvedOwn.email || currentUser?.email || '',
                  createdAt: serverTimestamp(),
                },
                { merge: true }
              );
            } catch (e) {
              console.warn('Profile bootstrap in firestore notice:', e);
            }
          }
        } else {
          setProfile(null);
        }

        const postsQ = query(collection(db, 'posts'), where('authorId', '==', userId));
        const postsSnap = await getDocs(postsQ);
        if (!cancelled) {
          setPosts(postsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
      } catch (error) {
        console.warn('Profile data fetch notice:', error);
        if (!cancelled && isOwnProfile) {
          setProfile(currentProfile || ownFallback);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [userId, currentUser, isOwnProfile, isFirebaseAuthenticated, currentProfile, ownFallback]);

  // Real-time listeners for Followers & Following counts on this profile
  useEffect(() => {
    if (!userId || !currentUser || !isFirebaseAuthenticated) {
      setFollowersCount(0);
      setFollowingCount(0);
      return;
    }

    const unsubFollowers = onSnapshot(
      collection(db, 'users', userId, 'followers'),
      (snap) => setFollowersCount(snap.size),
      (err) => console.warn('Profile followers count listener notice:', err)
    );

    const unsubFollowing = onSnapshot(
      collection(db, 'users', userId, 'following'),
      (snap) => setFollowingCount(snap.size),
      (err) => console.warn('Profile following count listener notice:', err)
    );

    return () => {
      unsubFollowers();
      unsubFollowing();
    };
  }, [userId, currentUser, isFirebaseAuthenticated]);

  // Real-time listener for user highlights
  useEffect(() => {
    if (!userId || !isFirebaseAuthenticated) {
      setHighlights([]);
      return;
    }
    const highlightsQ = query(collection(db, 'users', userId, 'highlights'));
    const unsubscribe = onSnapshot(
      highlightsQ,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setHighlights(list);
      },
      (err) => {
        console.warn('Highlights fetch notice:', err);
      }
    );
    return unsubscribe;
  }, [userId, isFirebaseAuthenticated]);

  // Real-time listener for own stories -> automatically classifies expired stories into Archives
  useEffect(() => {
    if (!userId || !isOwnProfile || !isFirebaseAuthenticated) {
      setMyStories([]);
      setLoadingArchives(false);
      return;
    }

    setLoadingArchives(true);
    const storiesQ = query(collection(db, 'stories'), where('authorId', '==', userId));
    const unsubscribe = onSnapshot(
      storiesQ,
      (snapshot) => {
        const list: StoryItem[] = snapshot.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            authorId: data.authorId,
            authorUsername: data.authorUsername || activeProfile?.username || 'User',
            authorPhotoURL: data.authorPhotoURL || activeProfile?.photoURL || '',
            mediaURL: data.mediaURL,
            mediaType: data.mediaType || 'image',
            caption: data.caption || '',
            poll: data.poll,
            createdAt: data.createdAt,
            expiresAt: data.expiresAt,
          };
        });
        list.sort((a, b) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt));
        setMyStories(list);
        setNowTick(Date.now());
        setLoadingArchives(false);
      },
      (err) => {
        console.warn('Archives stories listener notice:', err);
        setLoadingArchives(false);
      }
    );

    const interval = setInterval(() => setNowTick(Date.now()), 30000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [userId, isOwnProfile, isFirebaseAuthenticated, activeProfile?.username, activeProfile?.photoURL]);

  const { archivedStories, activeStories } = useMemo(() => {
    const expired: StoryItem[] = [];
    const active: StoryItem[] = [];
    myStories.forEach((story) => {
      if (getStoryExpiryMs(story) <= nowTick) {
        expired.push(story);
      } else {
        active.push(story);
      }
    });
    return { archivedStories: expired, activeStories: active };
  }, [myStories, nowTick]);

  // Real-time listener for Saved posts (own profile only)
  useEffect(() => {
    if (!isOwnProfile || !currentUser?.uid || !isFirebaseAuthenticated) {
      setSavedPosts([]);
      return;
    }

    const savedQ = query(
      collection(db, 'users', currentUser.uid, 'savedPosts'),
      where('userId', '==', currentUser.uid)
    );
    const unsub = onSnapshot(
      savedQ,
      (snap) => {
        const items = snap.docs
          .map((d) => ({
            id: d.data().postId || d.id,
            ...d.data(),
          }))
          .sort((a: any, b: any) => getTimestampMs(b.savedAt) - getTimestampMs(a.savedAt));
        setSavedPosts(items);
      },
      (err) => {
        console.warn('Saved posts listener notice:', err);
        setSavedPosts([]);
      }
    );

    return unsub;
  }, [isOwnProfile, currentUser?.uid, isFirebaseAuthenticated]);

  // Load posts mentioning @username when Tagged tab is opened
  useEffect(() => {
    if (profileTab !== 'tagged' || !activeProfile?.username || !isFirebaseAuthenticated) {
      if (profileTab === 'tagged') setTaggedPosts([]);
      return;
    }
    let cancelled = false;
    const fetchTagged = async () => {
      setLoadingTagged(true);
      try {
        const snap = await getDocs(query(collection(db, 'posts'), limit(60)));
        const mentionNeedle = `@${activeProfile.username}`.toLowerCase();
        const matches = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((p: any) => !blockedUsers.includes(p.authorId))
          .filter((p: any) => (p.caption || '').toLowerCase().includes(mentionNeedle))
          .sort((a: any, b: any) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt));
        if (!cancelled) setTaggedPosts(matches);
      } catch (err) {
        console.warn('Tagged posts fetch notice:', err);
        if (!cancelled) setTaggedPosts([]);
      } finally {
        if (!cancelled) setLoadingTagged(false);
      }
    };
    fetchTagged();
    return () => {
      cancelled = true;
    };
  }, [profileTab, activeProfile?.username, blockedUsers, isFirebaseAuthenticated]);

  // Real-time Followers / Following user list modal when opened
  useEffect(() => {
    if (!followListType || !userId || !currentUser || !isFirebaseAuthenticated) {
      setFollowListUsers([]);
      setLoadingFollowList(false);
      return;
    }
    setLoadingFollowList(true);
    let cancelled = false;

    const unsub = onSnapshot(
      collection(db, 'users', userId, followListType),
      async (snap) => {
        const ids = snap.docs.map((d) => d.id);
        const resolved = await Promise.all(
          ids.map(async (uid) => {
            try {
              const uSnap = await getDoc(doc(db, 'users', uid));
              if (uSnap.exists()) return { uid, ...uSnap.data() };
            } catch {
              // ignore individual lookup error
            }
            return { uid, username: uid.slice(0, 12), fullName: '', photoURL: '' };
          })
        );
        if (!cancelled) {
          setFollowListUsers(resolved);
          setLoadingFollowList(false);
        }
      },
      (err) => {
        console.warn('Follow list error:', err);
        if (!cancelled) {
          setFollowListUsers([]);
          setLoadingFollowList(false);
        }
      }
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [followListType, userId, currentUser, isFirebaseAuthenticated]);

  const filteredFollowListUsers = useMemo(() => {
    const q = followListSearch.trim().toLowerCase();
    return followListUsers
      .filter((u) => !blockedUsers.includes(u.uid))
      .filter((u) => {
        if (!q) return true;
        return (
          (u.username || '').toLowerCase().includes(q) ||
          (u.fullName || '').toLowerCase().includes(q)
        );
      });
  }, [followListUsers, followListSearch, blockedUsers]);

  const filteredArchivedStories = useMemo(() => {
    if (archiveFilter === 'all') return archivedStories;
    return archivedStories.filter((s) => (s.mediaType || 'image') === archiveFilter);
  }, [archivedStories, archiveFilter]);

  const handleRemoveFollower = async (followerUid: string) => {
    if (!currentUser || !isOwnProfile || removingFollowerId) return;
    setRemovingFollowerId(followerUid);
    try {
      await removeFollower(currentUser.uid, followerUid);
    } catch (err) {
      console.error('Failed to remove follower:', err);
    } finally {
      setRemovingFollowerId(null);
    }
  };

  const handleBlockClick = () => {
    if (!currentUser || isOwnProfile) return;
    if (hasBlocked) {
      unblockUser(currentUser.uid, userId).then(() => {
        showToast(language === 'ar' ? 'تم إلغاء الحظر بنجاح' : 'User unblocked successfully');
      });
    } else {
      setShowBlockConfirmModal(true);
    }
  };

  const handleConfirmBlock = async () => {
    if (!currentUser || isOwnProfile) return;
    setBlockingInProgress(true);
    try {
      await blockUser(currentUser.uid, userId);
      setShowBlockConfirmModal(false);
      showToast(language === 'ar' ? 'تم حظر المستخدم وإزالته من المحادثات' : 'User blocked and removed from conversations');
      if (onNavigateHome) {
        onNavigateHome();
      }
    } catch (err) {
      console.error('Failed to block user:', err);
    } finally {
      setBlockingInProgress(false);
    }
  };

  const handleMessage = async () => {
    if (!currentUser || isOwnProfile || !onOpenChat || hasBlocked) return;
    const convId = await getOrCreateConversation(currentUser.uid, userId);
    if (convId) {
      onOpenChat(convId);
    }
  };

  const handleCreateHighlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newHighlightTitle.trim()) return;

    setCreatingHighlight(true);
    try {
      const coverURL = newHighlightCover.trim() || posts[0]?.mediaURL || activeProfile?.photoURL || '';
      await createHighlightAlbum(currentUser.uid, newHighlightTitle.trim(), coverURL, []);
      setNewHighlightTitle('');
      setNewHighlightCover('');
      setShowNewHighlightModal(false);
    } catch (err) {
      console.error('Failed to create highlight album:', err);
    } finally {
      setCreatingHighlight(false);
    }
  };

  const handleAddArchivedToExistingHighlight = async (albumId: string) => {
    if (!currentUser || !highlightTargetStory) return;
    setSavingToHighlight(true);
    try {
      await addStoryToHighlightAlbum(currentUser.uid, albumId, highlightTargetStory.id);
      setHighlightTargetStory(null);
      showToast(language === 'ar' ? 'تمت إضافة القصة إلى الألبوم المميز!' : 'Added archived story to Highlight!');
    } catch (err) {
      console.error('Failed to add story to highlight:', err);
    } finally {
      setSavingToHighlight(false);
    }
  };

  const handleCreateHighlightFromArchived = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !highlightTargetStory || !newHighlightFromArchiveTitle.trim()) return;
    setSavingToHighlight(true);
    try {
      const coverURL =
        highlightTargetStory.mediaType !== 'video'
          ? highlightTargetStory.mediaURL
          : activeProfile?.photoURL || '';
      await createHighlightAlbum(currentUser.uid, newHighlightFromArchiveTitle.trim(), coverURL, [
        highlightTargetStory.id,
      ]);
      setNewHighlightFromArchiveTitle('');
      setHighlightTargetStory(null);
      showToast(language === 'ar' ? 'تم إنشاء ألبوم مميز جديد من الأرشيف!' : 'Created Highlight from archived story!');
    } catch (err) {
      console.error('Failed to create highlight from archive:', err);
    } finally {
      setSavingToHighlight(false);
    }
  };

  const handleRepostArchivedStory = async (story: StoryItem) => {
    if (!currentProfile || repostingStoryId) return;
    setRepostingStoryId(story.id);
    try {
      await createStory(
        currentProfile,
        story.mediaURL,
        story.mediaType || 'image',
        story.caption || '',
        story.poll
      );
      showToast(
        language === 'ar'
          ? 'تمت إعادة نشر القصة لمدة 24 ساعة جديدة!'
          : 'Story reposted to active stories for 24h!'
      );
    } catch (err) {
      console.error('Failed to repost story:', err);
    } finally {
      setRepostingStoryId(null);
    }
  };

  const handleArchiveActiveNow = async (storyId: string) => {
    setArchivingStoryId(storyId);
    try {
      await archiveStory(storyId);
      setNowTick(Date.now());
      showToast(language === 'ar' ? 'تم نقل القصة إلى الأرشيف.' : 'Story moved to Archives.');
    } catch (err) {
      console.error('Failed to archive story:', err);
    } finally {
      setArchivingStoryId(null);
    }
  };

  const handleDeleteArchivedStory = async (storyId: string) => {
    try {
      await deleteStory(storyId);
      setConfirmDeleteStoryId(null);
      showToast(language === 'ar' ? 'تم حذف القصة من الأرشيف.' : 'Story deleted from archive.');
    } catch (err) {
      console.error('Failed to delete archived story:', err);
    }
  };

  const handleOpenHighlightAlbum = async (album: any) => {
    try {
      const storyIds: string[] = album.storyIds || [];
      if (storyIds.length === 0) {
        showToast(
          language === 'ar'
            ? 'هذا الألبوم فارغ. أضف قصصاً من الأرشيف لعرضها هنا.'
            : 'This highlight album is empty. Add stories from your archive.'
        );
        return;
      }

      const fetchedStories: StoryItem[] = [];
      for (const sId of storyIds) {
        const sSnap = await getDoc(doc(db, 'stories', sId));
        if (sSnap.exists()) {
          fetchedStories.push({ id: sSnap.id, ...(sSnap.data() as any) });
        }
      }

      if (fetchedStories.length > 0) {
        setSelectedHighlightStories(fetchedStories);
      } else {
        showToast(
          language === 'ar'
            ? 'لا توجد قصص متاحة داخل هذا الألبوم.'
            : 'No available stories found inside this highlight.'
        );
      }
    } catch (err) {
      console.error('Error opening highlight album:', err);
    }
  };

  const handleQuickUnsave = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    if (!currentUser?.uid || !postId) return;
    try {
      await unsavePost(currentUser.uid, postId);
      showToast(language === 'ar' ? 'تمت إزالة المنشور من المحفوظات' : 'Removed from bookmarks');
    } catch (err) {
      console.error('Error removing bookmark:', err);
    }
  };

  if (loading && !activeProfile) {
    return <ProfileSkeleton />;
  }

  if (isBlockedByTarget && !isOwnProfile) {
    return (
      <div className="text-center py-20 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 m-4 px-4">
        <p className="font-bold text-slate-900 dark:text-white">
          {language === 'ar' ? 'المستخدم غير موجود' : 'User not found'}
        </p>
        <p className="text-sm text-slate-500 mt-1">
          {language === 'ar'
            ? 'قد يكون الرابط معطلاً أو تمت إزالة الصفحة.'
            : 'The link may be broken, or the user may have removed the page.'}
        </p>
        {onNavigateHome && (
          <button
            type="button"
            onClick={onNavigateHome}
            className="mt-4 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors shadow-sm"
          >
            {language === 'ar' ? 'العودة إلى الرئيسية' : 'Back to Home'}
          </button>
        )}
      </div>
    );
  }

  if (!activeProfile) {
    return (
      <div className="text-center py-20 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 m-4 px-4">
        <p className="font-bold text-slate-900 dark:text-white">
          {language === 'ar' ? 'المستخدم غير موجود' : 'User not found'}
        </p>
        <p className="text-sm text-slate-500 mt-1">
          {language === 'ar'
            ? 'قد يكون الرابط معطلاً أو تمت إزالة هذا الحساب.'
            : 'The link may be broken, or this account may have been removed.'}
        </p>
        {onNavigateHome && (
          <button
            type="button"
            onClick={onNavigateHome}
            className="mt-4 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors shadow-sm"
          >
            {language === 'ar' ? 'العودة إلى الرئيسية' : 'Back to Home'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-screen-md mx-auto pb-20 space-y-6">
      {isOwnProfile && !isFirebaseAuthenticated && (
        <div className="mx-4 md:mx-0 p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-purple-900 dark:text-purple-200">
            <p className="font-bold">
              {language === 'ar' ? 'أنت تتصفح بوضع الزائر التجريبي' : 'Guest Trial Mode'}
            </p>
            <p className="opacity-80 mt-0.5">
              {language === 'ar'
                ? 'سجّل الدخول عبر Google لحفظ منشوراتك ومزامنة محفوظاتك في السحابة.'
                : 'Sign in with Google to sync your profile, posts, and private bookmarks.'}
            </p>
          </div>
          <button
            type="button"
            onClick={signIn}
            className="min-h-[38px] px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shrink-0 transition-colors shadow-sm"
          >
            {language === 'ar' ? 'تسجيل الدخول عبر Google' : 'Sign in with Google'}
          </button>
        </div>
      )}

      {/* Profile Header */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-8 px-4 md:px-0">
        <div className="w-24 h-24 md:w-40 md:h-40 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800">
          <UserAvatar
            src={activeProfile.photoURL}
            username={activeProfile.username}
            iconSize={40}
          />
        </div>

        <div className="flex-1 space-y-4 text-center md:text-start">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{activeProfile.username}</h2>
              {!isOwnProfile && followsMe && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                  {t('followsYou')}
                </span>
              )}
            </div>
            <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
              {isOwnProfile ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsTab('profile');
                      setShowSettingsModal(true);
                    }}
                    className="min-h-[44px] px-4 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                  >
                    {language === 'ar' ? 'تعديل الملف الشخصي' : 'Edit Profile'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsTab('general');
                      setShowSettingsModal(true);
                    }}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-700 dark:text-slate-200"
                    aria-label={language === 'ar' ? 'الإعدادات' : 'Settings'}
                    title={language === 'ar' ? 'الإعدادات' : 'Settings'}
                  >
                    <Settings size={20} />
                  </button>
                </>
              ) : (
                <>
                  {!hasBlocked && (
                    <FollowButton targetUserId={userId} variant="primary" />
                  )}
                  {!hasBlocked && (
                    <button
                      type="button"
                      onClick={handleMessage}
                      className="min-h-[40px] px-5 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      {language === 'ar' ? 'مراسلة' : 'Message'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleBlockClick}
                    className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                      hasBlocked
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60 hover:bg-red-100 dark:hover:bg-red-950/70'
                    }`}
                  >
                    <span>
                      {hasBlocked
                        ? language === 'ar'
                          ? 'إلغاء الحظر'
                          : 'Unblock User'
                        : language === 'ar'
                        ? '🚫 حظر المستخدم'
                        : '🚫 Block User'}
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center md:justify-start gap-8 tabular-nums">
            <div className="text-sm">
              <span className="font-bold">{posts.length}</span>{' '}
              {language === 'ar' ? 'منشورات' : 'posts'}
            </div>
            <button
              type="button"
              onClick={() => {
                setFollowListSearch('');
                setFollowListType('followers');
              }}
              className="text-sm cursor-pointer hover:opacity-70 transition-opacity"
            >
              <span className="font-bold">{followersCount}</span>{' '}
              {language === 'ar' ? 'متابِع' : 'followers'}
            </button>
            <button
              type="button"
              onClick={() => {
                setFollowListSearch('');
                setFollowListType('following');
              }}
              className="text-sm cursor-pointer hover:opacity-70 transition-opacity"
            >
              <span className="font-bold">{followingCount}</span>{' '}
              {language === 'ar' ? 'يتابع' : 'following'}
            </button>
          </div>

          <div>
            <p className="font-bold text-sm text-slate-900 dark:text-white">{activeProfile.fullName}</p>
            <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
              {activeProfile.bio || (language === 'ar' ? 'لا توجد نبذة تعريفية بعد.' : 'No bio yet.')}
            </p>
          </div>
        </div>
      </div>

      {/* STORY HIGHLIGHTS REEL */}
      <div className="px-4 md:px-0">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-500" />
            {language === 'ar' ? 'أبرز القصص' : 'Story Highlights'}
          </span>
          {isOwnProfile && (
            <button
              type="button"
              onClick={() => setShowNewHighlightModal(true)}
              className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
            >
              <Plus size={14} />
              {language === 'ar' ? 'ألبوم جديد' : 'New Highlight'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-2">
          {isOwnProfile && (
            <div
              onClick={() => setShowNewHighlightModal(true)}
              className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
            >
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center bg-slate-50 dark:bg-slate-800/50 group-hover:border-purple-500 transition-colors">
                <Plus size={22} className="text-slate-400 group-hover:text-purple-500 transition-colors" />
              </div>
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                {language === 'ar' ? 'جديد' : 'New'}
              </span>
            </div>
          )}

          {highlights.map((album) => (
            <div
              key={album.id}
              onClick={() => handleOpenHighlightAlbum(album)}
              className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group select-none"
            >
              <div className="p-[3px] rounded-full bg-gradient-to-tr from-yellow-400 via-rose-500 to-purple-600 shadow-sm group-hover:scale-105 transition-transform">
                <div className="w-16 h-16 rounded-full border-2 border-white dark:border-slate-900 overflow-hidden bg-slate-200 dark:bg-slate-800">
                  <UserAvatar
                    src={album.coverImageURL}
                    username={album.title}
                    iconSize={20}
                  />
                </div>
              </div>
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate w-16 text-center">
                {album.title}
              </span>
            </div>
          ))}

          {highlights.length === 0 && !isOwnProfile && (
            <p className="text-xs text-slate-400 italic py-2">
              {language === 'ar' ? 'لا توجد ألبومات قصص مميزة بعد.' : 'No highlight albums yet.'}
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-t border-slate-200 dark:border-slate-800 pt-2">
        <div className="flex justify-center gap-4 sm:gap-10 overflow-x-auto no-scrollbar px-2">
          <button
            type="button"
            onClick={() => setProfileTab('posts')}
            className={`min-h-[44px] flex items-center gap-1.5 sm:gap-2 py-3 -mt-[9px] text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
              profileTab === 'posts'
                ? 'border-t-2 border-slate-900 dark:border-white text-slate-900 dark:text-white'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <Grid size={16} />
            {language === 'ar' ? 'المنشورات' : 'Posts'}
          </button>
          {isOwnProfile && (
            <button
              type="button"
              onClick={() => setProfileTab('saved')}
              className={`min-h-[44px] flex items-center gap-1.5 sm:gap-2 py-3 -mt-[9px] text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                profileTab === 'saved'
                  ? 'border-t-2 border-purple-600 dark:border-purple-400 text-purple-600 dark:text-purple-400'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <Bookmark size={16} className={profileTab === 'saved' ? 'fill-current' : ''} />
              <span>{language === 'ar' ? 'المحفوظات' : 'Bookmarks'}</span>
              {savedPosts.length > 0 && (
                <span className="tabular-nums text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                  {savedPosts.length}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => setProfileTab('tagged')}
            className={`min-h-[44px] flex items-center gap-1.5 sm:gap-2 py-3 -mt-[9px] text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
              profileTab === 'tagged'
                ? 'border-t-2 border-slate-900 dark:border-white text-slate-900 dark:text-white'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <Tag size={16} />
            {language === 'ar' ? 'الإشارات' : 'Tagged'}
          </button>
          {isOwnProfile && (
            <button
              type="button"
              onClick={() => {
                setNowTick(Date.now());
                setProfileTab('archives');
              }}
              className={`min-h-[44px] flex items-center gap-1.5 sm:gap-2 py-3 -mt-[9px] text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                profileTab === 'archives'
                  ? 'border-t-2 border-purple-600 dark:border-purple-400 text-purple-600 dark:text-purple-400'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <Archive size={16} />
              <span>{language === 'ar' ? 'الأرشيف' : 'Archives'}</span>
              {archivedStories.length > 0 && (
                <span className="tabular-nums text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                  {archivedStories.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      {profileTab === 'archives' && isOwnProfile ? (
        <div className="space-y-4 px-4 md:px-0">
          {archiveToast && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{archiveToast}</span>
            </div>
          )}

          {/* Archives Header & Filter */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Archive size={17} className="text-purple-600 dark:text-purple-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {language === 'ar' ? 'أرشيف القصص المنتهية' : 'Story Archives'}
                </h3>
                <span className="text-[11px] font-bold tabular-nums text-slate-500 dark:text-slate-400">
                  ({archivedStories.length})
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'ar'
                  ? 'تُحفظ هنا جميع قصصك تلقائياً بعد انتهاء مدتها (24 ساعة) لتتمكن من مراجعة سجلك وإعادتها أو إضافتها لأبرز القصص.'
                  : 'Expired stories (after 24h) are automatically stored here so only you can revisit, repost, or add them to Highlights.'}
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0 self-start sm:self-center">
              {(
                [
                  { id: 'all', label: language === 'ar' ? 'الكل' : 'All' },
                  { id: 'image', label: language === 'ar' ? 'صور' : 'Photos' },
                  { id: 'video', label: language === 'ar' ? 'فيديو' : 'Videos' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setArchiveFilter(tab.id)}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    archiveFilter === tab.id
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active Stories Quick Archive Option */}
          {activeStories.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-purple-900 dark:text-purple-200">
                <Clock size={16} className="text-purple-600 dark:text-purple-400 shrink-0" />
                <span>
                  {language === 'ar'
                    ? `لديك ${activeStories.length} قصة نشطة حالياً (ستُحفظ تلقائياً في الأرشيف بعد 24 ساعة).`
                    : `You currently have ${activeStories.length} active ${activeStories.length === 1 ? 'story' : 'stories'} (automatically archived after 24h).`}
                </span>
              </div>
              <button
                type="button"
                disabled={archivingStoryId === activeStories[0].id}
                onClick={() => handleArchiveActiveNow(activeStories[0].id)}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                {archivingStoryId === activeStories[0].id ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Archive size={13} />
                )}
                <span>{language === 'ar' ? 'أرشفة أحدث قصة الآن' : 'Archive Latest Story Now'}</span>
              </button>
            </div>
          )}

          {/* Archive Grid / Empty State */}
          {loadingArchives ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-slate-400" size={28} />
            </div>
          ) : filteredArchivedStories.length === 0 ? (
            <div className="text-center py-16 px-4 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto mb-2">
                <Archive size={22} />
              </div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {archiveFilter === 'all'
                  ? language === 'ar'
                    ? 'لا توجد قصص منتهية في الأرشيف بعد.'
                    : 'No expired stories in your archive yet.'
                  : language === 'ar'
                  ? 'لا توجد قصص مطابقة لهذا التصنيف في الأرشيف.'
                  : 'No archived stories match this filter.'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {language === 'ar'
                  ? 'عند انتهاء صلاحية أي قصة تنشرها (بعد 24 ساعة)، ستنتقل تلقائياً إلى هنا لحفظ تاريخك.'
                  : 'Whenever a story you share expires after 24 hours, it is automatically saved here for your history.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredArchivedStories.map((story, idx) => {
                const createdMs = getTimestampMs(story.createdAt);
                const dateLabel = createdMs
                  ? format(new Date(createdMs), 'd MMM yyyy', {
                      locale: language === 'ar' ? ar : undefined,
                    })
                  : language === 'ar'
                  ? 'مؤرشفة'
                  : 'Archived';

                return (
                  <div
                    key={story.id}
                    onClick={() => setArchiveViewerState({ stories: filteredArchivedStories, index: idx })}
                    className="group relative aspect-[9/16] rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer"
                  >
                    {story.mediaType === 'video' ? (
                      <>
                        <video
                          src={story.mediaURL}
                          muted
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-2.5 end-2.5 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm text-white flex items-center justify-center">
                          <Play size={13} fill="currentColor" />
                        </div>
                      </>
                    ) : (
                      <img
                        src={story.mediaURL}
                        alt={story.caption || 'Archived story'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                    )}

                    {/* Top Date Badge */}
                    <div className="absolute top-2.5 start-2.5 px-2 py-1 rounded-lg bg-black/65 backdrop-blur-md text-white text-[10px] font-bold flex items-center gap-1 shadow-sm">
                      <Calendar size={10} className="text-purple-300 shrink-0" />
                      <span>{dateLabel}</span>
                    </div>

                    {/* Bottom Gradient Overlay + Caption + Actions */}
                    <div
                      className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/90 via-black/60 to-transparent space-y-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {story.caption && (
                        <p className="text-[11px] text-white/95 line-clamp-2 leading-snug">
                          {story.caption}
                        </p>
                      )}

                      {confirmDeleteStoryId === story.id ? (
                        <div className="flex items-center gap-1.5 bg-red-950/90 border border-red-500/40 rounded-xl p-1.5">
                          <button
                            type="button"
                            onClick={() => handleDeleteArchivedStory(story.id)}
                            className="flex-1 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold"
                          >
                            {language === 'ar' ? 'تأكيد الحذف' : 'Delete'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteStoryId(null)}
                            className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[10px] font-semibold"
                          >
                            {language === 'ar' ? 'إلغاء' : 'Cancel'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setHighlightTargetStory(story)}
                            title={language === 'ar' ? 'إضافة لأبرز القصص' : 'Add to Highlight'}
                            className="flex-1 min-h-[32px] px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                          >
                            <Sparkles size={11} className="text-amber-300 shrink-0" />
                            <span className="truncate">{language === 'ar' ? 'تمييز' : 'Highlight'}</span>
                          </button>
                          <button
                            type="button"
                            disabled={repostingStoryId === story.id}
                            onClick={() => handleRepostArchivedStory(story)}
                            title={language === 'ar' ? 'إعادة نشر كقصة' : 'Repost Story'}
                            className="min-h-[32px] min-w-[32px] px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white flex items-center justify-center transition-colors disabled:opacity-50"
                          >
                            {repostingStoryId === story.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <RotateCcw size={12} />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteStoryId(story.id)}
                            title={language === 'ar' ? 'حذف من الأرشيف' : 'Delete'}
                            className="min-h-[32px] min-w-[32px] px-2 py-1 rounded-lg bg-white/15 hover:bg-red-600/80 backdrop-blur-sm text-white flex items-center justify-center transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : profileTab === 'saved' ? (
        !isOwnProfile ? (
          <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 mx-4 md:mx-0">
            <p className="text-slate-500 font-medium text-sm">
              {language === 'ar'
                ? 'المنشورات المحفوظة خاصة بصاحب الحساب فقط.'
                : 'Saved posts are private to the account owner.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4 px-2 sm:px-0">
            {/* Private Bookmarks Collection Header Banner */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <Bookmark size={18} className="fill-current" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {language === 'ar' ? 'مجموعتك المحفوظة الخاصة' : 'Private Bookmarks Collection'}
                    </h3>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {language === 'ar' ? 'خاص بك فقط' : 'Private'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {language === 'ar'
                      ? 'لا يمكن لأي مستخدم آخر رؤية المنشورات التي قمت بحفظها هنا.'
                      : 'Only you can see the posts and reels you have saved.'}
                  </p>
                </div>
              </div>
              {savedPosts.length > 0 && (
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400 shrink-0 tabular-nums">
                  {savedPosts.length} {language === 'ar' ? 'منشور' : 'saved'}
                </span>
              )}
            </div>

            {savedPosts.length === 0 ? (
              <div className="text-center py-16 px-4 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Bookmark size={30} />
                </div>
                <h4 className="font-bold text-base text-slate-900 dark:text-white">
                  {language === 'ar' ? 'لم تحفظ أي منشورات بعد' : 'No saved posts yet'}
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-5">
                  {language === 'ar'
                    ? 'احفظ الصور ومقاطع الفيديو والريلز المفضلة لديك بنقرة واحدة على أيقونة الإشارة المرجعية لتجدها هنا دائماً.'
                    : 'Save photos, videos, and reels with a single tap on the bookmark icon to find them here anytime.'}
                </p>
                {onNavigateHome && (
                  <button
                    type="button"
                    onClick={onNavigateHome}
                    className="min-h-[44px] px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors shadow-sm active:scale-95"
                  >
                    {language === 'ar' ? 'استكشف المنشورات لحفظها' : 'Explore Posts to Save'}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1 md:gap-4">
                {savedPosts.map((post) => (
                  <div
                    key={post.id}
                    onClick={() => setSelectedPost(post)}
                    className="aspect-square bg-slate-100 dark:bg-slate-800 overflow-hidden relative group cursor-pointer rounded-lg sm:rounded-xl border border-slate-200/50 dark:border-slate-800/80"
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
                        <div className="absolute top-2 end-2 p-1 rounded-full bg-black/60 text-white shadow-sm">
                          <Film size={13} />
                        </div>
                      </>
                    ) : (
                      <img
                        src={post.mediaURL}
                        alt=""
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    )}

                    {/* Hover stats & quick unsave */}
                    <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2 text-white">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => handleQuickUnsave(e, post.id)}
                          title={language === 'ar' ? 'إزالة من المحفوظات' : 'Remove from bookmarks'}
                          aria-label={language === 'ar' ? 'إزالة من المحفوظات' : 'Remove bookmark'}
                          className="p-1.5 rounded-full bg-black/60 hover:bg-red-600 text-white transition-colors"
                        >
                          <Bookmark size={14} className="fill-current text-purple-400 hover:text-white" />
                        </button>
                      </div>
                      <div className="flex items-center justify-center gap-4 text-xs sm:text-sm font-bold tabular-nums pb-2">
                        <span>❤️ {post.likesCount || 0}</span>
                        <span>💬 {post.commentsCount || 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      ) : profileTab === 'tagged' ? (
        loadingTagged ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-slate-400" size={28} />
          </div>
        ) : taggedPosts.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 mx-4 md:mx-0">
            <p className="text-slate-500 font-medium">
              {language === 'ar'
                ? 'لا توجد منشورات تمت الإشارة إليك فيها.'
                : 'No tagged posts yet.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1 md:gap-4 px-1 md:px-0">
            {taggedPosts.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => setSelectedPost(post)}
                className="aspect-square bg-slate-100 dark:bg-slate-800 overflow-hidden relative group cursor-pointer text-start"
              >
                {post.mediaType === 'video' ? (
                  <>
                    <video src={post.mediaURL} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                    <div className="absolute top-2 end-2 p-1 rounded-full bg-black/55 text-white">
                      <Film size={12} />
                    </div>
                  </>
                ) : (
                  <img src={post.mediaURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                )}
                <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white text-xs sm:text-sm font-bold tabular-nums">
                  <span>❤️ {post.likesCount || 0}</span>
                  <span>💬 {post.commentsCount || 0}</span>
                </div>
              </button>
            ))}
          </div>
        )
      ) : posts.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 mx-4 md:mx-0">
          <p className="text-slate-500 font-medium">
            {language === 'ar' ? 'لا توجد منشورات بعد.' : 'No posts yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 md:gap-4 px-1 md:px-0">
          {posts.map((post) => (
            <button
              key={post.id}
              type="button"
              onClick={() => setSelectedPost(post)}
              className="aspect-square bg-slate-100 dark:bg-slate-800 overflow-hidden relative group cursor-pointer text-start"
            >
              {post.mediaType === 'video' ? (
                <>
                  <video src={post.mediaURL} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                  <div className="absolute top-2 end-2 p-1 rounded-full bg-black/55 text-white">
                    <Film size={12} />
                  </div>
                </>
              ) : (
                <img src={post.mediaURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              )}
              <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white text-xs sm:text-sm font-bold tabular-nums">
                <span>❤️ {post.likesCount || 0}</span>
                <span>💬 {post.commentsCount || 0}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* CREATE NEW HIGHLIGHT ALBUM MODAL */}
      {showNewHighlightModal && (
        <div
          className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowNewHighlightModal(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {language === 'ar' ? 'إنشاء ألبوم قصص مميزة' : 'Create Highlight Album'}
              </h3>
              <button
                type="button"
                onClick={() => setShowNewHighlightModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateHighlight} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                  {language === 'ar' ? 'اسم الألبوم' : 'Album Title'}
                </label>
                <input
                  type="text"
                  maxLength={30}
                  value={newHighlightTitle}
                  onChange={(e) => setNewHighlightTitle(e.target.value)}
                  placeholder={language === 'ar' ? 'مثال: سفر، طعام، ذكريات...' : 'e.g., Travels, Food, Vibe...'}
                  className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                  {language === 'ar' ? 'رابط صورة الغلاف (اختياري)' : 'Cover Photo URL (Optional)'}
                </label>
                <input
                  type="url"
                  value={newHighlightCover}
                  onChange={(e) => setNewHighlightCover(e.target.value)}
                  placeholder={language === 'ar' ? 'اتركه فارغاً لاستخدام أحدث منشور...' : 'Leave empty to use latest post...'}
                  className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewHighlightModal(false)}
                  className="flex-1 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={creatingHighlight || !newHighlightTitle.trim()}
                  className="flex-[2] py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {creatingHighlight ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {language === 'ar' ? 'إنشاء الألبوم' : 'Create Album'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD ARCHIVED STORY TO HIGHLIGHT MODAL */}
      {highlightTargetStory && (
        <div
          className="fixed inset-0 z-[125] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setHighlightTargetStory(null)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-amber-500" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {language === 'ar' ? 'إضافة القصة لأبرز القصص' : 'Add to Story Highlights'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHighlightTargetStory(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            {highlights.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {language === 'ar' ? 'اختر ألبوماً حالياً:' : 'Choose an existing highlight:'}
                </p>
                {highlights.map((album) => (
                  <button
                    key={album.id}
                    type="button"
                    disabled={savingToHighlight}
                    onClick={() => handleAddArchivedToExistingHighlight(album.id)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-purple-50 dark:hover:bg-purple-950/30 border border-slate-200 dark:border-slate-700 flex items-center gap-3 text-start transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                      <UserAvatar
                        src={album.coverImageURL}
                        username={album.title}
                        iconSize={16}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {album.title}
                      </p>
                      <p className="text-[11px] text-slate-400 tabular-nums">
                        {(album.storyIds || []).length} {language === 'ar' ? 'قصص' : 'stories'}
                      </p>
                    </div>
                    <Plus size={16} className="text-purple-600 dark:text-purple-400 shrink-0" />
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleCreateHighlightFromArchived} className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                {language === 'ar' ? 'أو أنشئ ألبوماً جديداً بهذه القصة:' : 'Or create a new highlight album:'}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={30}
                  value={newHighlightFromArchiveTitle}
                  onChange={(e) => setNewHighlightFromArchiveTitle(e.target.value)}
                  placeholder={language === 'ar' ? 'اسم الألبوم الجديد...' : 'New highlight name...'}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  type="submit"
                  disabled={savingToHighlight || !newHighlightFromArchiveTitle.trim()}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold disabled:opacity-50 whitespace-nowrap"
                >
                  {language === 'ar' ? 'حفظ' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REUSABLE ACTION CONFIRMATION MODAL FOR BLOCK */}
      <ActionConfirmationModal
        isOpen={showBlockConfirmModal}
        onClose={() => setShowBlockConfirmModal(false)}
        onConfirm={handleConfirmBlock}
        targetUsername={activeProfile?.username}
        targetPhotoURL={activeProfile?.photoURL}
        isProcessing={blockingInProgress}
      />

      {/* HIGHLIGHT VIEWER MODAL */}
      {selectedHighlightStories && (
        <StoryViewer
          stories={selectedHighlightStories}
          onClose={() => setSelectedHighlightStories(null)}
        />
      )}

      {/* ARCHIVE STORY VIEWER MODAL */}
      {archiveViewerState && (
        <StoryViewer
          stories={archiveViewerState.stories}
          initialIndex={archiveViewerState.index}
          isArchiveMode={true}
          onClose={() => setArchiveViewerState(null)}
          onStoryDeleted={(deletedId) => {
            setArchiveViewerState((prev) => {
              if (!prev) return null;
              const nextStories = prev.stories.filter((s) => s.id !== deletedId);
              if (nextStories.length === 0) return null;
              return {
                stories: nextStories,
                index: Math.min(prev.index, nextStories.length - 1),
              };
            });
          }}
        />
      )}

      {/* SETTINGS & EDIT PROFILE MODAL */}
      {isOwnProfile && (
        <SettingsModal
          isOpen={showSettingsModal}
          initialTab={settingsTab}
          onClose={() => setShowSettingsModal(false)}
          onProfileUpdated={(updated) => {
            setProfile((prev: any) => (prev ? { ...prev, ...updated } : updated));
          }}
        />
      )}

      {/* POST DETAIL MODAL */}
      <PostDetailModal
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
        onOpenChat={onOpenChat}
        onOpenProfile={onOpenProfile}
        onSelectTag={onSelectTag}
        onPostDeleted={(deletedId) => {
          setPosts((prev) => prev.filter((p) => p.id !== deletedId));
          setSavedPosts((prev) => prev.filter((p) => p.id !== deletedId));
          setTaggedPosts((prev) => prev.filter((p) => p.id !== deletedId));
        }}
      />

      {/* FOLLOWERS / FOLLOWING INTERACTIVE MANAGER MODAL */}
      {followListType && (
        <div
          className="fixed inset-0 z-[125] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
          onClick={() => setFollowListType(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[78vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header + Tabs */}
            <div className="px-5 pt-3.5 pb-2 border-b border-slate-100 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  @{activeProfile.username}
                </h3>
                <button
                  type="button"
                  onClick={() => setFollowListType(null)}
                  aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFollowListSearch('');
                    setFollowListType('followers');
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors tabular-nums ${
                    followListType === 'followers'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {language === 'ar' ? `المتابعون (${followersCount})` : `Followers (${followersCount})`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFollowListSearch('');
                    setFollowListType('following');
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors tabular-nums ${
                    followListType === 'following'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {language === 'ar' ? `يتابع (${followingCount})` : `Following (${followingCount})`}
                </button>
              </div>

              <div className="relative pb-1">
                <Search className="absolute start-3 top-2.5 text-slate-400" size={14} />
                <input
                  type="text"
                  value={followListSearch}
                  onChange={(e) => setFollowListSearch(e.target.value)}
                  placeholder={language === 'ar' ? 'ابحث باسم المستخدم...' : 'Search users...'}
                  className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl py-2 ps-9 pe-8 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                {followListSearch && (
                  <button
                    type="button"
                    onClick={() => setFollowListSearch('')}
                    className="absolute end-2.5 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-2">
              {loadingFollowList ? (
                <div className="py-10 flex justify-center">
                  <Loader2 size={22} className="animate-spin text-slate-400" />
                </div>
              ) : filteredFollowListUsers.length === 0 ? (
                <p className="py-10 text-center text-xs text-slate-400">
                  {followListSearch.trim()
                    ? language === 'ar'
                      ? 'لا توجد نتائج مطابقة.'
                      : 'No matching users.'
                    : followListType === 'followers'
                    ? language === 'ar'
                      ? 'لا يوجد متابعون بعد.'
                      : 'No followers yet.'
                    : language === 'ar'
                    ? 'لا يتابع أي حسابات بعد.'
                    : 'Not following anyone yet.'}
                </p>
              ) : (
                filteredFollowListUsers.map((u) => {
                  const rowFollowsMe = followers.includes(u.uid) && !following.includes(u.uid);
                  const isMe = currentUser?.uid === u.uid;
                  return (
                    <div
                      key={u.uid}
                      className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setFollowListType(null);
                          onOpenProfile?.(u.uid);
                        }}
                        className="flex items-center gap-3 min-w-0 flex-1 text-start"
                      >
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                          <UserAvatar src={u.photoURL} username={u.username} iconSize={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {u.username}
                            </p>
                            {!isMe && rowFollowsMe && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 shrink-0">
                                {t('followsYou')}
                              </span>
                            )}
                          </div>
                          {u.fullName && (
                            <p className="text-xs text-slate-500 truncate">{u.fullName}</p>
                          )}
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isMe && currentUser && onOpenChat && (
                          <button
                            type="button"
                            onClick={async () => {
                              const convId = await getOrCreateConversation(currentUser.uid, u.uid);
                              if (convId) {
                                setFollowListType(null);
                                onOpenChat(convId);
                              }
                            }}
                            aria-label={t('message')}
                            title={t('message')}
                            className="min-h-[34px] min-w-[34px] rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors"
                          >
                            <MessageSquare size={14} />
                          </button>
                        )}
                        {!isMe && <FollowButton targetUserId={u.uid} variant="compact" />}
                        {isOwnProfile && followListType === 'followers' && !isMe && (
                          <button
                            type="button"
                            disabled={removingFollowerId === u.uid}
                            onClick={() => handleRemoveFollower(u.uid)}
                            title={t('removeFollower')}
                            aria-label={t('removeFollower')}
                            className="min-h-[34px] px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                          >
                            {removingFollowerId === u.uid ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <UserMinus size={13} />
                            )}
                            <span>{t('removeFollower')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
