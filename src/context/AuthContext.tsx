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
    followBack: 'Follow Back',
    followsYou: 'Follows you',
    mutual: 'Mutual',
    unfollow: 'Unfollow',
    removeFollower: 'Remove',
    suggestedForYou: 'Suggested for you',
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
    following: 'تتابعه',
    follow: 'متابعة',
    followBack: 'ردّ المتابعة',
    followsYou: 'يتابعك',
    mutual: 'متابعة متبادلة',
    unfollow: 'إلغاء المتابعة',
    removeFollower: 'إزالة',
    suggestedForYou: 'مقترحون لك',
    message: 'مراسلة',
  }
};

function safeGetStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage access errors in restricted environments
  }
}

function buildValidUsername(email?: string | null, uid?: string): string {
  const rawPrefix = (email?.split('@')[0] || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (rawPrefix.length >= 3) {
    return rawPrefix.slice(0, 30);
  }
  const suffix = (uid || Math.random().toString(36).slice(2, 8)).slice(0, 8);
  return `user_${suffix}`.slice(0, 30);
}

interface AuthContextType {
  user: User | null;
  profile: any | null;
  following: string[];
  followers: string[];
  blockedUsers: string[];
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
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
  const [followers, setFollowers] = useState<string[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [language, setLanguageState] = useState<'en' | 'ar'>(() => {
    const saved = safeGetStorage('instavibe_lang');
    return saved === 'en' ? 'en' : 'ar';
  });
  const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = safeGetStorage('instavibe_theme');
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
  });

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    safeSetStorage('instavibe_lang', language);
  }, [language]);

  useEffect(() => {
    safeSetStorage('instavibe_theme', theme);
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

  const clearAuthError = () => setAuthError(null);

  const t = (key: string): string => {
    const dict = translations[language] || translations.ar;
    return (dict as any)[key] || translations.ar[key as keyof typeof translations.ar] || key;
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeFollowing: (() => void) | undefined;
    let unsubscribeFollowers: (() => void) | undefined;
    let unsubscribeBlocked: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(firebaseUser);
        if (unsubscribeProfile) unsubscribeProfile();
        if (unsubscribeFollowing) unsubscribeFollowing();
        if (unsubscribeFollowers) unsubscribeFollowers();
        if (unsubscribeBlocked) unsubscribeBlocked();

        if (firebaseUser) {
          setAuthError(null);
          const fallbackProfile = {
            uid: firebaseUser.uid,
            username: buildValidUsername(firebaseUser.email, firebaseUser.uid),
            fullName: firebaseUser.displayName || '',
            email: firebaseUser.email || '',
            photoURL: firebaseUser.photoURL || '',
            bio: '',
          };
          setProfile((prev: any) => (prev?.uid === firebaseUser.uid ? prev : fallbackProfile));

          const userRef = doc(db, 'users', firebaseUser.uid);

          // Attach real-time listeners immediately so UI never blocks behind a slow network call
          unsubscribeProfile = onSnapshot(
            userRef,
            (snap) => {
              if (snap.exists()) {
                setProfile(snap.data());
              }
            },
            (err) => console.warn('Profile listener notice:', err)
          );

          getDoc(userRef)
            .then(async (userDoc) => {
              if (!userDoc.exists()) {
                const newProfile = {
                  ...fallbackProfile,
                  createdAt: serverTimestamp(),
                };
                await setDoc(userRef, newProfile);
              }
            })
            .catch((err) => {
              console.warn('Auth profile bootstrap notice:', err);
            });

          const qFollowing = query(collection(db, 'users', firebaseUser.uid, 'following'));
          unsubscribeFollowing = onSnapshot(
            qFollowing,
            (snapshot) => {
              setFollowing(snapshot.docs.map((d) => d.id));
            },
            (err) => console.warn('Following listener notice:', err)
          );

          const qFollowers = query(collection(db, 'users', firebaseUser.uid, 'followers'));
          unsubscribeFollowers = onSnapshot(
            qFollowers,
            (snapshot) => {
              setFollowers(snapshot.docs.map((d) => d.id));
            },
            (err) => console.warn('Followers listener notice:', err)
          );

          const qBlocked = query(collection(db, 'users', firebaseUser.uid, 'blockedUsers'));
          unsubscribeBlocked = onSnapshot(
            qBlocked,
            (snapshot) => {
              setBlockedUsers(snapshot.docs.map((d) => d.id));
            },
            (err) => console.warn('Blocked users listener notice:', err)
          );
        } else {
          setProfile(null);
          setFollowing([]);
          setFollowers([]);
          setBlockedUsers([]);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Auth state listener error:', err);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeFollowing) unsubscribeFollowing();
      if (unsubscribeFollowers) unsubscribeFollowers();
      if (unsubscribeBlocked) unsubscribeBlocked();
    };
  }, []);

  const signIn = async () => {
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      const code = error?.code || '';
      if (code === 'auth/popup-blocked') {
        setAuthError(
          language === 'ar'
            ? 'المتصفح منع نافذة تسجيل الدخول المنبثقة. يرجى السماح بالنوافذ المنبثقة أو فتح التطبيق في نافذة جديدة.'
            : 'Sign-in popup was blocked by your browser. Please allow popups or open the app in a new tab.'
        );
      } else if (code === 'auth/unauthorized-domain') {
        setAuthError(
          language === 'ar'
            ? 'هذا النطاق غير مصرح به في Firebase Auth بعد. أضف النطاق من إعدادات Firebase Console.'
            : 'This domain is not yet authorized in Firebase Authentication settings.'
        );
      } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setAuthError(
          language === 'ar'
            ? 'تعذر تسجيل الدخول عبر Google حالياً. يرجى المحاولة مجدداً.'
            : 'Unable to sign in with Google right now. Please try again.'
        );
      }
    }
  };

  const logOut = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, following, followers, blockedUsers, loading, authError, clearAuthError, language, setLanguage, theme, setTheme, t, signIn, logOut }}>
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
