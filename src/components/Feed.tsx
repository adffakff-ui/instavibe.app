import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, where, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Post from './Post';
import StoryBar from './StoryBar';
import PostCreation from './PostCreation';
import { Sparkles, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEMO_POSTS = [
  {
    id: 'demo-1',
    authorId: 'user_traveler',
    authorUsername: 'traveler_joy',
    authorPhotoURL: '/src/assets/images/avatar_woman_1794501562592.jpg',
    mediaURL: '/src/assets/images/beach_lifestyle_1794501561335.jpg',
    mediaType: 'image',
    caption: 'Nothing beats a sunset at the beach! 🌊🌅 #summer #vibes',
    likesCount: 124,
    commentsCount: 12,
    createdAt: { toDate: () => new Date() },
  },
  {
    id: 'demo-video-1',
    authorId: 'user_ocean',
    authorUsername: 'ocean_escapes',
    authorPhotoURL: '/src/assets/images/avatar_woman_1794501562592.jpg',
    mediaURL: 'https://assets.mixkit.co/videos/preview/mixkit-vertical-view-of-waves-on-a-beach-43187-large.mp4',
    mediaType: 'video',
    caption: 'Calm ocean waves rolling onto the shore 🌊🎥 #ocean #relax',
    likesCount: 218,
    commentsCount: 19,
    createdAt: { toDate: () => new Date() },
  },
  {
    id: 'demo-2',
    authorId: 'user_chef',
    authorUsername: 'chef_mario',
    authorPhotoURL: '/src/assets/images/avatar_man_1794501560820.jpg',
    mediaURL: '/src/assets/images/pasta_dish_1794501561956.jpg',
    mediaType: 'image',
    caption: 'Fresh pasta with truffles. Simple is best. 🍝✨',
    likesCount: 89,
    commentsCount: 5,
    createdAt: { toDate: () => new Date() },
  },
  {
    id: 'demo-3',
    authorId: 'user_minimalist',
    authorUsername: 'tech_minimalist',
    authorPhotoURL: '/src/assets/images/avatar_man_1794501560820.jpg',
    mediaURL: '/src/assets/images/minimal_workspace_1794501562383.jpg',
    mediaType: 'image',
    caption: 'Focused morning. 💻🌿',
    likesCount: 56,
    commentsCount: 3,
    createdAt: { toDate: () => new Date() },
  }
];

export default function Feed({ 
  onOpenChat, 
  onOpenProfile,
  setView
}: { 
  onOpenChat: (convId: string) => void, 
  onOpenProfile: (uid: string) => void,
  setView: (view: any) => void
}) {
  const { user, blockedUsers, language } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'following'>('all');

  useEffect(() => {
    if (!user) return;
    
    // Fetch following list
    const q = query(collection(db, 'users', user.uid, 'following'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const ids = snapshot.docs.map(doc => doc.id);
        setFollowingIds(ids);
      },
      (err) => {
        console.warn('Following feed listener notice:', err);
      }
    );

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    let q;
    const isFollowingFilter = filter === 'following' && Boolean(user);
    if (isFollowingFilter) {
      if (followingIds.length > 0) {
        q = query(
          collection(db, 'posts'),
          where('authorId', 'in', followingIds.slice(0, 30))
        );
      } else {
        setPosts([]);
        return;
      }
    } else {
      q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let postsData = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((p: any) => !blockedUsers.includes(p.authorId)); // Filter out blocked users

        if (isFollowingFilter) {
          postsData = postsData.sort(
            (a: any, b: any) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
          );
        }

        setPosts(postsData.length > 0 ? postsData : (filter === 'all' ? DEMO_POSTS : []));
      },
      (err) => {
        console.warn('Posts feed listener error:', err);
        setPosts(filter === 'all' ? DEMO_POSTS : []);
      }
    );

    return unsubscribe;
  }, [filter, followingIds, user, blockedUsers]);

  return (
    <div className="space-y-6">
      <StoryBar />

      <div className="flex items-center justify-center gap-8 border-b border-slate-100 dark:border-slate-800 mb-4">
        <button 
          onClick={() => setFilter('all')}
          className={cn(
            "pb-3 text-sm font-semibold transition-colors relative",
            filter === 'all' ? "text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-600"
          )}
        >
          {language === 'ar' ? 'لك' : 'For You'}
          {filter === 'all' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 dark:bg-white" />}
        </button>
        <button 
          onClick={() => setFilter('following')}
          className={cn(
            "pb-3 text-sm font-semibold transition-colors relative",
            filter === 'following' ? "text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-600"
          )}
        >
          {language === 'ar' ? 'المتابَعون' : 'Following'}
          {filter === 'following' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 dark:bg-white" />}
        </button>
      </div>

      <div 
        onClick={() => setView('discover')}
        className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity mb-2 shadow-lg shadow-slate-900/10"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="text-yellow-400" size={20} />
          <span className="text-sm font-bold">
            {language === 'ar' ? 'اكتشف محتوى مخصصاً لك' : 'Discover content tailored for you'}
          </span>
        </div>
        <ChevronRight size={18} className={language === 'ar' ? 'rotate-180' : ''} />
      </div>

      <PostCreation />
      
      <div className="flex flex-col gap-8 pb-10">
        {posts.map((post) => (
          <Post key={post.id} post={post} onOpenChat={onOpenChat} onOpenProfile={onOpenProfile} />
        ))}
        {filter === 'following' && posts.length === 0 && (
          <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            <p className="text-slate-500 font-medium">
              {language === 'ar'
                ? 'تابع بعض الأشخاص لرؤية منشوراتهم هنا!'
                : 'Follow some people to see their posts here!'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
