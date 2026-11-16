import type { User } from 'firebase/auth';
import {
  doc,
  enableNetwork,
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

export type AuthProviderType = 'google' | 'password' | 'phone';

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
export const E164_PHONE_REGEX = /^\+[1-9]\d{6,14}$/;
const SESSION_STORAGE_KEY = 'instavibe_auth_session_id';

export interface CountryCallingOption {
  code: string;
  labelAr: string;
  labelEn: string;
}

export const COUNTRY_CALLING_CODES: CountryCallingOption[] = [
  { code: '+966', labelAr: 'السعودية (+966)', labelEn: 'Saudi Arabia (+966)' },
  { code: '+971', labelAr: 'الإمارات (+971)', labelEn: 'UAE (+971)' },
  { code: '+20', labelAr: 'مصر (+20)', labelEn: 'Egypt (+20)' },
  { code: '+962', labelAr: 'الأردن (+962)', labelEn: 'Jordan (+962)' },
  { code: '+965', labelAr: 'الكويت (+965)', labelEn: 'Kuwait (+965)' },
  { code: '+974', labelAr: 'قطر (+974)', labelEn: 'Qatar (+974)' },
  { code: '+973', labelAr: 'البحرين (+973)', labelEn: 'Bahrain (+973)' },
  { code: '+968', labelAr: 'عُمان (+968)', labelEn: 'Oman (+968)' },
  { code: '+964', labelAr: 'العراق (+964)', labelEn: 'Iraq (+964)' },
  { code: '+961', labelAr: 'لبنان (+961)', labelEn: 'Lebanon (+961)' },
  { code: '+970', labelAr: 'فلسطين (+970)', labelEn: 'Palestine (+970)' },
  { code: '+963', labelAr: 'سوريا (+963)', labelEn: 'Syria (+963)' },
  { code: '+967', labelAr: 'اليمن (+967)', labelEn: 'Yemen (+967)' },
  { code: '+212', labelAr: 'المغرب (+212)', labelEn: 'Morocco (+212)' },
  { code: '+213', labelAr: 'الجزائر (+213)', labelEn: 'Algeria (+213)' },
  { code: '+216', labelAr: 'تونس (+216)', labelEn: 'Tunisia (+216)' },
  { code: '+218', labelAr: 'ليبيا (+218)', labelEn: 'Libya (+218)' },
  { code: '+249', labelAr: 'السودان (+249)', labelEn: 'Sudan (+249)' },
  { code: '+90', labelAr: 'تركيا (+90)', labelEn: 'Turkey (+90)' },
  { code: '+44', labelAr: 'المملكة المتحدة (+44)', labelEn: 'UK (+44)' },
  { code: '+1', labelAr: 'الولايات المتحدة / كندا (+1)', labelEn: 'US / Canada (+1)' },
  { code: '+33', labelAr: 'فرنسا (+33)', labelEn: 'France (+33)' },
  { code: '+49', labelAr: 'ألمانيا (+49)', labelEn: 'Germany (+49)' },
];

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

export function normalizeDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export function normalizePhoneNumber(countryCode: string, localInput: string): string {
  const converted = normalizeDigits(localInput).trim();
  if (!converted) return '';

  if (converted.startsWith('+')) {
    const digitsOnly = converted.slice(1).replace(/\D/g, '');
    return digitsOnly ? `+${digitsOnly}` : '';
  }

  if (converted.startsWith('00')) {
    const digitsOnly = converted.slice(2).replace(/\D/g, '');
    return digitsOnly ? `+${digitsOnly}` : '';
  }

  const codeDigits = normalizeDigits(countryCode).replace(/\D/g, '');
  let localDigits = converted.replace(/\D/g, '');
  localDigits = localDigits.replace(/^0+/, '');
  if (!codeDigits || !localDigits) return '';
  return `+${codeDigits}${localDigits}`;
}

export function isValidE164Phone(phone: string): boolean {
  return E164_PHONE_REGEX.test(phone.trim());
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
  if (providers.includes('phone')) return 'phone';
  if (providers.includes('password')) return 'password';
  if (firebaseUser?.phoneNumber && !firebaseUser?.email) return 'phone';
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
        ? 'طريقة تسجيل الدخول المطلوبة غير مفعّلة بعد في إعدادات Firebase Authentication. فعّل المزوّد (Email/Password أو Phone) من لوحة تحكم Firebase.'
        : 'This sign-in method is not enabled in Firebase Authentication yet. Enable it under Sign-in method in Firebase Console.';
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
    case 'auth/invalid-phone-number':
      return isAr
        ? 'رقم الهاتف غير صالح. أدخل الرقم بالصيغة الدولية الصحيحة (مثال: +966501234567).'
        : 'Invalid phone number. Please enter a valid international number (e.g. +966501234567).';
    case 'auth/missing-phone-number':
      return isAr ? 'يرجى إدخال رقم الهاتف المحمول.' : 'Please enter your mobile phone number.';
    case 'auth/invalid-verification-code':
      return isAr
        ? 'رمز التحقق (SMS) غير صحيح. يرجى التأكد من الأرقام الستة والمحاولة مجدداً.'
        : 'Incorrect SMS verification code. Please check the 6-digit code and try again.';
    case 'auth/missing-verification-code':
      return isAr ? 'يرجى إدخال رمز التحقق المرسل إلى هاتفك.' : 'Please enter the verification code sent to your phone.';
    case 'auth/code-expired':
      return isAr
        ? 'انتهت صلاحية رمز التحقق. يرجى طلب رمز جديد.'
        : 'The verification code has expired. Please request a new code.';
    case 'auth/invalid-verification-id':
    case 'auth/missing-verification-id':
      return isAr
        ? 'انتهت جلسة التحقق من الهاتف. يرجى إعادة إرسال الرمز.'
        : 'Phone verification session expired. Please resend the code.';
    case 'auth/captcha-check-failed':
    case 'auth/missing-recaptcha-token':
    case 'auth/invalid-recaptcha-token':
      return isAr
        ? 'تعذر إكمال التحقق الأمني (reCAPTCHA). يرجى المحاولة مجدداً والتأكد من السماح للنطاق في Firebase Auth.'
        : 'Security verification (reCAPTCHA) failed. Please try again and verify your domain is authorized in Firebase Auth.';
    case 'auth/quota-exceeded':
      return isAr
        ? 'تم الوصول إلى الحد الأقصى لرسائل التحقق SMS في المشروع حالياً. حاول لاحقاً أو استخدم أرقام الاختبار.'
        : 'SMS quota exceeded for this project right now. Try again later or use configured test numbers.';
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
        ? 'المتصفح منع نافذة تسجيل الدخول المنبثقة. يرجى السماح بالنوافذ المنبثقة أو استخدام البريد أو الهاتف.'
        : 'Sign-in popup was blocked by your browser. Please allow popups or use Email / Phone.';
    case 'auth/unauthorized-domain':
    case 'auth/app-not-authorized':
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

export function buildSuggestedUsername(
  email?: string | null,
  uid?: string,
  phoneNumber?: string | null
): string {
  const rawPrefix = (email?.split('@')[0] || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (rawPrefix.length >= 3) {
    return rawPrefix.slice(0, 30);
  }
  const phoneTail = (phoneNumber || '').replace(/\D/g, '').slice(-4);
  const suffix = (uid || Math.random().toString(36).slice(2, 10))
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, phoneTail ? 4 : 8);
  if (phoneTail) {
    return `user_${phoneTail}${suffix ? `_${suffix}` : ''}`.slice(0, 30);
  }
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
  } catch (error: any) {
    const isOfflineErr =
      error?.code === 'unavailable' ||
      (typeof error?.message === 'string' && error.message.toLowerCase().includes('offline'));
    if (isOfflineErr) {
      try {
        await enableNetwork(db).catch(() => {});
        const retrySnap = await getDoc(doc(db, 'usernames', normalizedKey));
        if (!retrySnap.exists() || retrySnap.data()?.uid === currentUid) {
          return { available: true, normalizedKey };
        }
        return { available: false, reason: 'taken', normalizedKey };
      } catch {
        return { available: true, normalizedKey };
      }
    }
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

    if (!data?.createdAt || !data?.sessionId || !data?.userId) {
      await setDoc(sessionRef, {
        sessionId,
        userId,
        provider: data?.provider || provider,
        deviceLabel,
        platform,
        status: 'active',
        createdAt: data?.createdAt || serverTimestamp(),
        lastActiveAt: serverTimestamp(),
      });
      return 'active';
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
  const sessionRef = doc(db, 'users', userId, 'loginSessions', sessionId);
  try {
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) {
      return;
    }

    const data = snap.data();
    if (data?.status === 'revoked') {
      return;
    }

    if (!data?.createdAt || !data?.sessionId || !data?.userId || !data?.deviceLabel || !data?.provider) {
      return;
    }

    await updateDoc(sessionRef, {
      status: 'revoked',
      lastActiveAt: serverTimestamp(),
    });
  } catch (error) {
    handleAuthFirestoreError(error, AuthOperationType.UPDATE, path);
  }
}

export function sanitizeWebsiteUrl(rawUrl?: string | null): string {
  const trimmed = (rawUrl || '').trim().slice(0, 200);
  if (!trimmed) return '';
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return '';
  }
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return '';
    }
    return parsed.toString().slice(0, 200);
  } catch {
    return '';
  }
}

export async function claimUsernameAndSaveProfile(params: {
  uid: string;
  email: string;
  phoneNumber?: string;
  username: string;
  fullName: string;
  bio: string;
  website?: string;
  photoURL: string;
  coverPhotoURL?: string;
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

      const existingData = userSnap.exists() ? userSnap.data() : {};
      const resolvedWebsite =
        params.website !== undefined
          ? sanitizeWebsiteUrl(params.website)
          : typeof existingData?.website === 'string'
          ? existingData.website.slice(0, 200)
          : '';
      const resolvedCoverPhotoURL =
        params.coverPhotoURL !== undefined
          ? params.coverPhotoURL.trim().slice(0, 900000)
          : typeof existingData?.coverPhotoURL === 'string'
          ? existingData.coverPhotoURL.slice(0, 900000)
          : '';

      const payload: Record<string, any> = {
        uid: params.uid,
        username: cleanUsername,
        usernameLower: newKey,
        fullName: params.fullName.trim().slice(0, 80),
        bio: params.bio.trim().slice(0, 220),
        website: resolvedWebsite,
        photoURL: params.photoURL.trim().slice(0, 900000),
        coverPhotoURL: resolvedCoverPhotoURL,
        email: params.email.slice(0, 320),
        phoneNumber: (params.phoneNumber || '').slice(0, 32),
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
    if (error?.message?.includes('client is offline')) {
      enableNetwork(db).catch(() => {});
    }
    handleAuthFirestoreError(error, AuthOperationType.WRITE, `users/${params.uid}`);
  }
}
