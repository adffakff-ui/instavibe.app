import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  query,
  collection,
  onSnapshot,
  where,
  updateDoc,
} from 'firebase/firestore';
import {
  buildSuggestedUsername,
  claimUsernameAndSaveProfile,
  getOrCreateLocalSessionId,
  LoginSessionRecord,
  normalizeUsernameKey,
  revokeLoginSession,
  rotateLocalSessionId,
  upsertLoginSession,
  USERNAME_KEY_REGEX,
} from '../lib/authService';

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
  },
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

interface CompleteOnboardingInput {
  username: string;
  fullName: string;
  bio: string;
  photoURL: string;
}

interface AuthContextType {
  user: User | null;
  profile: any | null;
  isFirebaseAuthenticated: boolean;
  needsOnboarding: boolean;
  dbSyncStatus: 'idle' | 'syncing' | 'connected' | 'error';
  signingIn: boolean;
  currentSessionId: string | null;
  loginSessions: LoginSessionRecord[];
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
  completeOnboarding: (data: CompleteOnboardingInput) => Promise<void>;
  revokeSession: (sessionId: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [isFirebaseAuthenticated, setIsFirebaseAuthenticated] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [dbSyncStatus, setDbSyncStatus] = useState<'idle' | 'syncing' | 'connected' | 'error'>('idle');
  const [signingIn, setSigningIn] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loginSessions, setLoginSessions] = useState<LoginSessionRecord[]>([]);
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

  const activeSessionIdRef = useRef<string | null>(null);
  const languageRef = useRef(language);
  languageRef.current = language;

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
    let unsubscribeSessions: (() => void) | undefined;

    const cleanupListeners = () => {
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeFollowing) unsubscribeFollowing();
      if (unsubscribeFollowers) unsubscribeFollowers();
      if (unsubscribeBlocked) unsubscribeBlocked();
      if (unsubscribeSessions) unsubscribeSessions();
    };

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        cleanupListeners();

        try {
          window.localStorage.removeItem('instavibe_guest_session');
        } catch {
          // ignore storage errors
        }

        if (firebaseUser) {
          if (firebaseUser.isAnonymous) {
            signOut(auth).catch(() => {});
            setIsFirebaseAuthenticated(false);
            setNeedsOnboarding(false);
            setDbSyncStatus('idle');
            setCurrentSessionId(null);
            activeSessionIdRef.current = null;
            setLoginSessions([]);
            setUser(null);
            setProfile(null);
            setFollowing([]);
            setFollowers([]);
            setBlockedUsers([]);
            setLoading(false);
            return;
          }

          setUser(firebaseUser);
          setIsFirebaseAuthenticated(true);
          setDbSyncStatus('syncing');
          setAuthError(null);

          const sessionId = getOrCreateLocalSessionId();
          activeSessionIdRef.current = sessionId;
          setCurrentSessionId(sessionId);

          const suggestedProfile = {
            uid: firebaseUser.uid,
            username: buildSuggestedUsername(firebaseUser.email, firebaseUser.uid),
            fullName: firebaseUser.displayName || '',
            email: firebaseUser.email || '',
            photoURL: firebaseUser.photoURL || '',
            bio: '',
            authProvider: 'google',
            onboardingCompleted: false,
          };
          setProfile((prev: any) => (prev?.uid === firebaseUser.uid ? prev : suggestedProfile));

          const userRef = doc(db, 'users', firebaseUser.uid);
          let loginRecorded = false;

          unsubscribeProfile = onSnapshot(
            userRef,
            (snap) => {
              setDbSyncStatus('connected');
              if (snap.exists()) {
                const data = snap.data();
                setProfile(data);

                const incomplete = data.onboardingCompleted === false || !data.username;
                setNeedsOnboarding(incomplete);

                if (!incomplete && !loginRecorded) {
                  loginRecorded = true;
                  const normalizedKey = normalizeUsernameKey(data.username);

                  // Ensure legacy or returning users keep lastLoginAt & username lock synced
                  const syncReturningUser = async () => {
                    try {
                      await updateDoc(userRef, {
                        lastLoginAt: serverTimestamp(),
                        authProvider: 'google',
                        onboardingCompleted: true,
                        ...(USERNAME_KEY_REGEX.test(normalizedKey) && !data.usernameLower
                          ? { usernameLower: normalizedKey }
                          : {}),
                      });
                    } catch {
                      // Non-blocking metadata sync
                    }

                    if (USERNAME_KEY_REGEX.test(normalizedKey)) {
                      try {
                        const unameRef = doc(db, 'usernames', normalizedKey);
                        const unameSnap = await getDoc(unameRef);
                        if (!unameSnap.exists()) {
                          await setDoc(unameRef, {
                            uid: firebaseUser.uid,
                            username: data.username,
                            createdAt: serverTimestamp(),
                          });
                        }
                      } catch {
                        // Non-blocking legacy reservation backfill
                      }
                    }

                    const status = await upsertLoginSession(firebaseUser.uid, sessionId);
                    if (status === 'revoked') {
                      rotateLocalSessionId();
                      await signOut(auth).catch(() => {});
                    }
                  };
                  syncReturningUser();
                }
              } else {
                // New user or cleared profile -> route to structured onboarding
                setNeedsOnboarding(true);
                setProfile(suggestedProfile);
                setLoading(false);
              }
            },
            (err) => {
              console.warn('Profile listener notice:', err);
              setDbSyncStatus('error');
            }
          );

          const qSessions = query(
            collection(db, 'users', firebaseUser.uid, 'loginSessions'),
            where('userId', '==', firebaseUser.uid)
          );
          unsubscribeSessions = onSnapshot(
            qSessions,
            (snapshot) => {
              const items = snapshot.docs
                .map((d) => ({ ...(d.data() as LoginSessionRecord), sessionId: d.id }))
                .sort((a, b) => (b.lastActiveAt?.toMillis?.() ?? 0) - (a.lastActiveAt?.toMillis?.() ?? 0));

              setLoginSessions(items);

              const currentRecord = items.find((s) => s.sessionId === activeSessionIdRef.current);
              if (currentRecord && currentRecord.status === 'revoked') {
                rotateLocalSessionId();
                setAuthError(
                  languageRef.current === 'ar'
                    ? 'تم إنهاء هذه الجلسة من جهاز آخر. يرجى تسجيل الدخول مجدداً.'
                    : 'This session was revoked from another device. Please sign in again.'
                );
                signOut(auth).catch(() => {});
              }
            },
            (err) => console.warn('Login sessions listener notice:', err)
          );

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
          setIsFirebaseAuthenticated(false);
          setNeedsOnboarding(false);
          setDbSyncStatus('idle');
          setCurrentSessionId(null);
          activeSessionIdRef.current = null;
          setLoginSessions([]);
          setUser(null);
          setProfile(null);
          setFollowing([]);
          setFollowers([]);
          setBlockedUsers([]);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Auth state listener error:', err);
        setDbSyncStatus('error');
        setLoading(false);
      }
    );

    return () => {
      unsubscribeAuth();
      cleanupListeners();
    };
  }, []);

  const signIn = async () => {
    setAuthError(null);
    setSigningIn(true);
    try {
      rotateLocalSessionId();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
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
    } finally {
      setSigningIn(false);
    }
  };

  const completeOnboarding = async (data: CompleteOnboardingInput) => {
    if (!user) throw new Error('Not authenticated');
    await claimUsernameAndSaveProfile({
      uid: user.uid,
      email: user.email || '',
      username: data.username,
      fullName: data.fullName,
      bio: data.bio,
      photoURL: data.photoURL,
      previousUsername: profile?.username,
    });

    const sessionId = activeSessionIdRef.current || getOrCreateLocalSessionId();
    activeSessionIdRef.current = sessionId;
    setCurrentSessionId(sessionId);
    await upsertLoginSession(user.uid, sessionId);
    setNeedsOnboarding(false);
  };

  const revokeSession = async (sessionId: string) => {
    if (!user) return;
    await revokeLoginSession(user.uid, sessionId);
    if (sessionId === activeSessionIdRef.current) {
      await logOut();
    }
  };

  const logOut = async () => {
    const uid = user?.uid;
    const sid = activeSessionIdRef.current;
    if (uid && sid) {
      try {
        await revokeLoginSession(uid, sid);
      } catch {
        // Continue sign-out even if session update fails
      }
    }
    rotateLocalSessionId();
    try {
      await signOut(auth);
    } catch {
      // ignore signOut errors
    }
    setIsFirebaseAuthenticated(false);
    setNeedsOnboarding(false);
    setDbSyncStatus('idle');
    setCurrentSessionId(null);
    activeSessionIdRef.current = null;
    setLoginSessions([]);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isFirebaseAuthenticated,
        needsOnboarding,
        dbSyncStatus,
        signingIn,
        currentSessionId,
        loginSessions,
        following,
        followers,
        blockedUsers,
        loading,
        authError,
        clearAuthError,
        language,
        setLanguage,
        theme,
        setTheme,
        t,
        signIn,
        completeOnboarding,
        revokeSession,
        logOut,
      }}
    >
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
