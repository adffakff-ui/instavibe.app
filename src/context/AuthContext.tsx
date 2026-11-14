import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  User,
} from 'firebase/auth';
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
  AuthProviderType,
  buildSuggestedUsername,
  claimUsernameAndSaveProfile,
  detectAuthProvider,
  getOrCreateLocalSessionId,
  isValidEmail,
  LoginSessionRecord,
  mapFirebaseAuthError,
  normalizeUsernameKey,
  revokeLoginSession,
  rotateLocalSessionId,
  upsertLoginSession,
  USERNAME_KEY_REGEX,
  USERNAME_REGEX,
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

interface EmailSignUpInput {
  email: string;
  password: string;
  fullName: string;
  username?: string;
}

interface AuthContextType {
  user: User | null;
  profile: any | null;
  authProvider: AuthProviderType | null;
  emailVerified: boolean;
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
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signUpWithEmail: (input: EmailSignUpInput) => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<boolean>;
  resendVerificationEmail: () => Promise<boolean>;
  refreshEmailVerification: () => Promise<boolean>;
  changeUserPassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string }>;
  completeOnboarding: (data: CompleteOnboardingInput) => Promise<void>;
  revokeSession: (sessionId: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [authProvider, setAuthProvider] = useState<AuthProviderType | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
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
            setAuthProvider(null);
            setEmailVerified(false);
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

          const detectedProvider = detectAuthProvider(firebaseUser);
          setUser(firebaseUser);
          setAuthProvider(detectedProvider);
          setEmailVerified(Boolean(firebaseUser.emailVerified));
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
            emailVerified: Boolean(firebaseUser.emailVerified),
            photoURL: firebaseUser.photoURL || '',
            bio: '',
            authProvider: detectedProvider,
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

                  const syncReturningUser = async () => {
                    try {
                      await updateDoc(userRef, {
                        lastLoginAt: serverTimestamp(),
                        authProvider: detectedProvider,
                        emailVerified: Boolean(firebaseUser.emailVerified),
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

                    const status = await upsertLoginSession(firebaseUser.uid, sessionId, detectedProvider);
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
          setAuthProvider(null);
          setEmailVerified(false);
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
      const message = mapFirebaseAuthError(error, language);
      if (message) setAuthError(message);
    } finally {
      setSigningIn(false);
    }
  };

  const signInWithEmail = async (email: string, password: string): Promise<boolean> => {
    setAuthError(null);
    const cleanEmail = email.trim();
    if (!isValidEmail(cleanEmail)) {
      setAuthError(
        language === 'ar' ? 'يرجى إدخال بريد إلكتروني صحيح.' : 'Please enter a valid email address.'
      );
      return false;
    }
    if (!password) {
      setAuthError(
        language === 'ar' ? 'يرجى إدخال كلمة المرور.' : 'Please enter your password.'
      );
      return false;
    }

    setSigningIn(true);
    try {
      rotateLocalSessionId();
      await signInWithEmailAndPassword(auth, cleanEmail, password);
      return true;
    } catch (error: any) {
      const message = mapFirebaseAuthError(error, language);
      if (message) setAuthError(message);
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const signUpWithEmail = async (input: EmailSignUpInput): Promise<boolean> => {
    setAuthError(null);
    const cleanEmail = input.email.trim();
    const cleanFullName = input.fullName.trim().slice(0, 80);
    const cleanUsername = input.username?.trim().slice(0, 30) || '';

    if (!isValidEmail(cleanEmail)) {
      setAuthError(
        language === 'ar' ? 'يرجى إدخال بريد إلكتروني صحيح.' : 'Please enter a valid email address.'
      );
      return false;
    }
    if (input.password.length < 8) {
      setAuthError(
        language === 'ar'
          ? 'كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.'
          : 'Password must be at least 8 characters long.'
      );
      return false;
    }
    if (cleanUsername && !USERNAME_REGEX.test(cleanUsername)) {
      setAuthError(
        language === 'ar'
          ? 'اسم المستخدم يجب أن يكون 3 إلى 30 حرفاً (أحرف إنجليزية، أرقام، أو _).'
          : 'Username must be 3–30 characters using letters, numbers, or underscores.'
      );
      return false;
    }

    setSigningIn(true);
    try {
      const sessionId = rotateLocalSessionId();
      const credential = await createUserWithEmailAndPassword(auth, cleanEmail, input.password);

      if (cleanFullName) {
        await updateProfile(credential.user, { displayName: cleanFullName }).catch(() => {});
      }

      // Send verification email in background without blocking profile creation
      sendEmailVerification(credential.user).catch(() => {});

      if (cleanUsername && USERNAME_REGEX.test(cleanUsername)) {
        try {
          await claimUsernameAndSaveProfile({
            uid: credential.user.uid,
            email: cleanEmail,
            username: cleanUsername,
            fullName: cleanFullName,
            bio: '',
            photoURL: '',
            authProvider: 'password',
            emailVerified: credential.user.emailVerified,
          });
          activeSessionIdRef.current = sessionId;
          setCurrentSessionId(sessionId);
          await upsertLoginSession(credential.user.uid, sessionId, 'password');
          setNeedsOnboarding(false);
        } catch (profileErr: any) {
          // If chosen username was already taken, user stays authenticated and enters OnboardingView to pick another
          if (profileErr?.message === 'USERNAME_TAKEN') {
            setNeedsOnboarding(true);
          } else {
            throw profileErr;
          }
        }
      }

      return true;
    } catch (error: any) {
      const message = mapFirebaseAuthError(error, language);
      if (message) setAuthError(message);
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const sendPasswordReset = async (email: string): Promise<boolean> => {
    setAuthError(null);
    const cleanEmail = email.trim();
    if (!isValidEmail(cleanEmail)) {
      setAuthError(
        language === 'ar' ? 'يرجى إدخال بريد إلكتروني صحيح.' : 'Please enter a valid email address.'
      );
      return false;
    }

    setSigningIn(true);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      return true;
    } catch (error: any) {
      const message = mapFirebaseAuthError(error, language);
      if (message) setAuthError(message);
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const resendVerificationEmail = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    try {
      await sendEmailVerification(auth.currentUser);
      return true;
    } catch (error: any) {
      const message = mapFirebaseAuthError(error, language);
      if (message) setAuthError(message);
      return false;
    }
  };

  const refreshEmailVerification = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const verified = Boolean(auth.currentUser.emailVerified);
    setEmailVerified(verified);
    if (verified) {
      try {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          emailVerified: true,
        });
      } catch {
        // Non-blocking sync
      }
    }
    return verified;
  };

  const changeUserPassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      return {
        ok: false,
        error: language === 'ar' ? 'لم يتم العثور على الحساب الحالي.' : 'No active email account found.',
      };
    }
    if (newPassword.length < 8) {
      return {
        ok: false,
        error:
          language === 'ar'
            ? 'كلمة المرور الجديدة يجب أن تتكون من 8 أحرف على الأقل.'
            : 'New password must be at least 8 characters long.',
      };
    }

    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      return { ok: true };
    } catch (error: any) {
      return {
        ok: false,
        error:
          mapFirebaseAuthError(error, language) ||
          (language === 'ar' ? 'تعذر تحديث كلمة المرور.' : 'Failed to update password.'),
      };
    }
  };

  const completeOnboarding = async (data: CompleteOnboardingInput) => {
    if (!user) throw new Error('Not authenticated');
    const provider = detectAuthProvider(user);
    await claimUsernameAndSaveProfile({
      uid: user.uid,
      email: user.email || '',
      username: data.username,
      fullName: data.fullName,
      bio: data.bio,
      photoURL: data.photoURL,
      previousUsername: profile?.username,
      authProvider: provider,
      emailVerified: user.emailVerified,
    });

    const sessionId = activeSessionIdRef.current || getOrCreateLocalSessionId();
    activeSessionIdRef.current = sessionId;
    setCurrentSessionId(sessionId);
    await upsertLoginSession(user.uid, sessionId, provider);
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
    setAuthProvider(null);
    setEmailVerified(false);
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
        authProvider,
        emailVerified,
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
        signInWithEmail,
        signUpWithEmail,
        sendPasswordReset,
        resendVerificationEmail,
        refreshEmailVerification,
        changeUserPassword,
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
