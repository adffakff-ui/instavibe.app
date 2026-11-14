import type { User } from 'firebase/auth';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from './firebase';

export enum AuthOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export type AuthProviderType = 'google' | 'password';

interface FirestoreErrorInfo {
  error: string;
  operationType: AuthOperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleAuthFirestoreError(
  error: unknown,
  operationType: AuthOperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;
export const USERNAME_KEY_REGEX = /^[a-z0-9_]{3,30}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SESSION_STORAGE_KEY = 'instavibe_auth_session_id';

export interface LoginSessionRecord {
  sessionId: string;
  userId: string;
  provider: AuthProviderType;
  deviceLabel: string;
  platform?: string;
  status: 'active' | 'revoked';
  createdAt?: any;
  lastActiveAt?: any;
}

export interface PasswordStrengthResult {
  minLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
  hasMixedOrSymbol: boolean;
  score: number;
  isValid: boolean;
}

export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  return trimmed.length > 0 && trimmed.length <= 320 && EMAIL_REGEX.test(trimmed);
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const minLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasMixedOrSymbol = /[A-Z]/.test(password) || /[^a-zA-Z0-9]/.test(password);
  const score = [minLength, hasLetter, hasNumber, hasMixedOrSymbol].filter(Boolean).length;
  return {
    minLength,
    hasLetter,
    hasNumber,
    hasMixedOrSymbol,
    score,
    isValid: minLength && hasLetter && hasNumber,
  };
}

export function detectAuthProvider(firebaseUser?: User | null): AuthProviderType {
  const providers = firebaseUser?.providerData?.map((p) => p.providerId) || [];
  if (providers.includes('google.com')) return 'google';
  if (providers.includes('password')) return 'password';
  return 'password';
}

export function mapFirebaseAuthError(error: any, language: 'ar' | 'en'): string | null {
  const code = error?.code || '';
  const isAr = language === 'ar';

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return null;
  }

  switch (code) {
    case 'auth/operation-not-allowed':
      return isAr
        ? 'طريقة تسجيل الدخول عبر البريد وكلمة المرور غير مفعّلة بعد في إعدادات Firebase Authentication. فعّل خيار Email/Password من لوحة تحكم Firebase.'
        : 'Email/Password sign-in is not enabled in Firebase Authentication yet. Enable Email/Password under Sign-in method in Firebase Console.';
    case 'auth/invalid-email':
      return isAr ? 'صيغة البريد الإلكتروني غير صالحة.' : 'Please enter a valid email address.';
    case 'auth/email-already-in-use':
      return isAr
        ? 'هذا البريد الإلكتروني مسجل بحساب آخر بالفعل. جرّب تسجيل الدخول أو استعادة كلمة المرور.'
        : 'An account with this email already exists. Try signing in or resetting your password.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return isAr
        ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
        : 'Incorrect email address or password.';
    case 'auth/weak-password':
      return isAr
        ? 'كلمة المرور ضعيفة جداً. استخدم 8 أحرف على الأقل تتضمن أحرفاً وأرقاماً.'
        : 'Password is too weak. Use at least 8 characters with letters and numbers.';
    case 'auth/too-many-requests':
      return isAr
        ? 'تم تنفيذ محاولات متكررة كثيرة. يرجى الانتظار قليلاً ثم المحاولة مجدداً.'
        : 'Too many attempts. Please wait a moment before trying again.';
    case 'auth/user-disabled':
      return isAr
        ? 'تم تعطيل هذا الحساب من قِبل الإدارة.'
        : 'This account has been disabled.';
    case 'auth/requires-recent-login':
      return isAr
        ? 'يرجى التحقق من كلمة المرور الحالية أو إعادة تسجيل الدخول لإتمام هذا الإجراء الحساس.'
        : 'Please verify your current password or sign in again to complete this action.';
    case 'auth/network-request-failed':
      return isAr
        ? 'تعذر الاتصال بخادم المصادقة. تحقق من اتصال الإنترنت وحاول مجدداً.'
        : 'Network error while reaching the authentication server. Check your connection and try again.';
    case 'auth/popup-blocked':
      return isAr
        ? 'المتصفح منع نافذة تسجيل الدخول المنبثقة. يرجى السماح بالنوافذ المنبثقة أو استخدام البريد وكلمة المرور.'
        : 'Sign-in popup was blocked by your browser. Please allow popups or use Email & Password.';
    case 'auth/unauthorized-domain':
      return isAr
        ? 'هذا النطاق غير مصرح به في Firebase Auth بعد. أضف النطاق من إعدادات Firebase Console.'
        : 'This domain is not yet authorized in Firebase Authentication settings.';
    default:
      return isAr
        ? 'تعذر إتمام عملية المصادقة حالياً. يرجى المحاولة مجدداً.'
        : 'Unable to complete authentication right now. Please try again.';
  }
}

export function normalizeUsernameKey(username: string): string {
  return username.trim().toLowerCase();
}

export function buildSuggestedUsername(email?: string | null, uid?: string): string {
  const rawPrefix = (email?.split('@')[0] || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (rawPrefix.length >= 3) {
    return rawPrefix.slice(0, 30);
  }
  const suffix = (uid || Math.random().toString(36).slice(2, 10))
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 8);
  return `user_${suffix || 'member'}`.slice(0, 30);
}

export function parseDeviceInfo(): { deviceLabel: string; platform: string } {
  if (typeof navigator === 'undefined') {
    return { deviceLabel: 'Web Browser', platform: 'Web' };
  }
  const ua = navigator.userAgent || '';
  let browser = 'Browser';
  if (/OPR|Opera/i.test(ua)) browser = 'Opera';
  else if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/Chrome|CriOS/i.test(ua)) browser = 'Chrome';
  else if (/Firefox|FxiOS/i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua)) browser = 'Safari';

  let os = 'Web';
  if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  const deviceLabel = `${browser} • ${os}`.slice(0, 100);
  const platform = ((navigator as any).userAgentData?.platform || navigator.platform || os || 'Web')
    .toString()
    .slice(0, 60);

  return { deviceLabel, platform };
}

export function getOrCreateLocalSessionId(): string {
  const fallback = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  if (typeof window === 'undefined') return fallback;
  try {
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) {
      return existing;
    }
    window.localStorage.setItem(SESSION_STORAGE_KEY, fallback);
    return fallback;
  } catch {
    return fallback;
  }
}

export function rotateLocalSessionId(): string {
  const next = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, next);
    } catch {
      // Ignore storage errors
    }
  }
  return next;
}

export async function checkUsernameAvailability(
  rawUsername: string,
  currentUid?: string
): Promise<{ available: boolean; reason?: 'invalid' | 'taken'; normalizedKey: string }> {
  const trimmed = rawUsername.trim();
  const normalizedKey = normalizeUsernameKey(trimmed);

  if (!USERNAME_REGEX.test(trimmed) || !USERNAME_KEY_REGEX.test(normalizedKey)) {
    return { available: false, reason: 'invalid', normalizedKey };
  }

  const path = `usernames/${normalizedKey}`;
  try {
    const snap = await getDoc(doc(db, 'usernames', normalizedKey));
    if (!snap.exists() || snap.data()?.uid === currentUid) {
      return { available: true, normalizedKey };
    }
    return { available: false, reason: 'taken', normalizedKey };
  } catch (error) {
    handleAuthFirestoreError(error, AuthOperationType.GET, path);
  }
}

export async function upsertLoginSession(
  userId: string,
  sessionId: string,
  provider: AuthProviderType = 'password'
): Promise<'active' | 'revoked'> {
  const path = `users/${userId}/loginSessions/${sessionId}`;
  const sessionRef = doc(db, 'users', userId, 'loginSessions', sessionId);
  const { deviceLabel, platform } = parseDeviceInfo();

  try {
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) {
      await setDoc(sessionRef, {
        sessionId,
        userId,
        provider,
        deviceLabel,
        platform,
        status: 'active',
        createdAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
      });
      return 'active';
    }

    const data = snap.data();
    if (data?.status === 'revoked') {
      return 'revoked';
    }

    await updateDoc(sessionRef, {
      status: 'active',
      deviceLabel,
      platform,
      lastActiveAt: serverTimestamp(),
    });
    return 'active';
  } catch (error) {
    console.warn(`Login session sync notice (${path}):`, error);
    return 'active';
  }
}

export async function revokeLoginSession(userId: string, sessionId: string): Promise<void> {
  const path = `users/${userId}/loginSessions/${sessionId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'loginSessions', sessionId), {
      status: 'revoked',
      lastActiveAt: serverTimestamp(),
    });
  } catch (error) {
    handleAuthFirestoreError(error, AuthOperationType.UPDATE, path);
  }
}

export async function claimUsernameAndSaveProfile(params: {
  uid: string;
  email: string;
  username: string;
  fullName: string;
  bio: string;
  photoURL: string;
  previousUsername?: string;
  authProvider?: AuthProviderType;
  emailVerified?: boolean;
}): Promise<void> {
  const cleanUsername = params.username.trim().slice(0, 30);
  const newKey = normalizeUsernameKey(cleanUsername);

  if (!USERNAME_REGEX.test(cleanUsername) || !USERNAME_KEY_REGEX.test(newKey)) {
    throw new Error('INVALID_USERNAME');
  }

  const oldKey = params.previousUsername ? normalizeUsernameKey(params.previousUsername) : '';
  const userRef = doc(db, 'users', params.uid);
  const newUsernameRef = doc(db, 'usernames', newKey);
  const oldUsernameRef =
    oldKey && oldKey !== newKey && USERNAME_KEY_REGEX.test(oldKey)
      ? doc(db, 'usernames', oldKey)
      : null;

  try {
    await runTransaction(db, async (tx) => {
      const [userSnap, newNameSnap, oldNameSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(newUsernameRef),
        oldUsernameRef ? tx.get(oldUsernameRef) : Promise.resolve(null),
      ]);

      if (newNameSnap.exists() && newNameSnap.data()?.uid !== params.uid) {
        throw new Error('USERNAME_TAKEN');
      }

      if (oldUsernameRef && oldNameSnap?.exists() && oldNameSnap.data()?.uid === params.uid) {
        tx.delete(oldUsernameRef);
      }

      if (!newNameSnap.exists()) {
        tx.set(newUsernameRef, {
          uid: params.uid,
          username: cleanUsername,
          createdAt: serverTimestamp(),
        });
      }

      const payload: Record<string, any> = {
        uid: params.uid,
        username: cleanUsername,
        usernameLower: newKey,
        fullName: params.fullName.trim().slice(0, 80),
        bio: params.bio.trim().slice(0, 220),
        photoURL: params.photoURL.trim().slice(0, 900000),
        email: params.email.slice(0, 320),
        emailVerified: Boolean(params.emailVerified),
        authProvider: params.authProvider || 'google',
        onboardingCompleted: true,
        lastLoginAt: serverTimestamp(),
      };

      if (!userSnap.exists()) {
        payload.createdAt = serverTimestamp();
      }

      tx.set(userRef, payload, { merge: true });
    });
  } catch (error: any) {
    if (error?.message === 'USERNAME_TAKEN' || error?.message === 'INVALID_USERNAME') {
      throw error;
    }
    handleAuthFirestoreError(error, AuthOperationType.WRITE, `users/${params.uid}`);
  }
}
