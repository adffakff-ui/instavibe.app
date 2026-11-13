import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, query, collection, onSnapshot } from 'firebase/firestore';

export const translations = {
  en: {
    home: 'Home',
    search: 'Search',
    discover: 'Discover',
    reels: 'Reels',
    live: 'Live',
    goLive: 'Go Live',
    analytics: 'Analytics',
    messages: 'Messages',
    notifications: 'Notifications',
    profile: 'Profile',
    logOut: 'Log Out',
    createStory: 'Create Story',
    stories: 'Stories',
    shareToStory: 'Share to Story',
    saveDraft: 'Save Draft',
    poll: 'Interactive Poll',
    likes: 'likes',
    comments: 'comments',
    post: 'Post',
    following: 'Following',
    follow: 'Follow',
    message: 'Message',
  },
  ar: {
    home: 'الرئيسية',
    search: 'بحث',
    discover: 'اكتشف',
    reels: 'ريلز',
    live: 'بث مباشر',
    goLive: 'بدء بث مباشر',
    analytics: 'الإحصائيات',
    messages: 'الرسائل',
    notifications: 'الإشعارات',
    profile: 'الملف الشخصي',
    logOut: 'تسجيل الخروج',
    createStory: 'إنشاء قصة',
    stories: 'القصص',
    shareToStory: 'نشر في القصة',
    saveDraft: 'حفظ مسودة',
    poll: 'استطلاع رأي',
    likes: 'إعجابات',
    comments: 'تعليقات',
    post: 'نشر',
    following: 'تتابع',
    follow: 'متابعة',
    message: 'مراسلة',
  }
};

interface AuthContextType {
  user: User | null;
  profile: any | null;
  following: string[];
  blockedUsers: string[];
  loading: boolean;
  language: 'en' | 'ar';
  setLanguage: (lang: 'en' | 'ar') => void;
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  t: (key: string) => string;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [following, setFollowing] = useState<string[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [language, setLanguageState] = useState<'en' | 'ar'>(() => {
    return (localStorage.getItem('instavibe_lang') as 'en' | 'ar') || 'ar'; // Default to Arabic for great Arabic support
  });
  const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('instavibe_theme');
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
  });

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    localStorage.setItem('instavibe_lang', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('instavibe_theme', theme);
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const isDark = theme === 'dark' || (theme === 'system' && mediaQuery.matches);
      document.documentElement.classList.toggle('dark', isDark);
    };

    applyTheme();

    if (theme === 'system') {
      mediaQuery.addEventListener('change', applyTheme);
      return () => mediaQuery.removeEventListener('change', applyTheme);
    }
  }, [theme]);

  const setLanguage = (lang: 'en' | 'ar') => {
    setLanguageState(lang);
  };

  const setTheme = (nextTheme: 'light' | 'dark' | 'system') => {
    setThemeState(nextTheme);
  };

  const t = (key: string): string => {
    const dict = translations[language] || translations.ar;
    return (dict as any)[key] || translations.ar[key as keyof typeof translations.ar] || key;
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeFollowing: (() => void) | undefined;
    let unsubscribeBlocked: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeFollowing) unsubscribeFollowing();
      if (unsubscribeBlocked) unsubscribeBlocked();

      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            setProfile(userDoc.data());
          } else {
            const newProfile = {
              uid: user.uid,
              username: user.email?.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_') || 'user_' + Math.random().toString(36).substring(7),
              fullName: user.displayName || '',
              email: user.email || '',
              photoURL: user.photoURL || '',
              bio: '',
              createdAt: serverTimestamp(),
            };
            await setDoc(userRef, newProfile);
            setProfile(newProfile);
          }

          unsubscribeProfile = onSnapshot(
            userRef,
            (snap) => {
              if (snap.exists()) {
                setProfile(snap.data());
              }
            },
            (err) => console.warn('Profile listener notice:', err)
          );

          // Following list logic
          const qFollowing = query(collection(db, 'users', user.uid, 'following'));
          unsubscribeFollowing = onSnapshot(
            qFollowing,
            (snapshot) => {
              setFollowing(snapshot.docs.map(doc => doc.id));
            },
            (err) => console.warn('Following listener notice:', err)
          );

          // Blocked list logic
          const qBlocked = query(collection(db, 'users', user.uid, 'blockedUsers'));
          unsubscribeBlocked = onSnapshot(
            qBlocked,
            (snapshot) => {
              setBlockedUsers(snapshot.docs.map(doc => doc.id));
            },
            (err) => console.warn('Blocked users listener notice:', err)
          );
        } catch (err) {
          console.error('Auth profile initialization error:', err);
        }
      } else {
        setProfile(null);
        setFollowing([]);
        setBlockedUsers([]);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeFollowing) unsubscribeFollowing();
      if (unsubscribeBlocked) unsubscribeBlocked();
    };
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logOut = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, following, blockedUsers, loading, language, setLanguage, theme, setTheme, t, signIn, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
