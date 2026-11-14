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
const SESSION_STORAGE_KEY = 'instavibe_auth_session_id';

export interface LoginSessionRecord {
  sessionId: string;
  userId: string;
  provider: 'google';
  deviceLabel: string;
  platform?: string;
  status: 'active' | 'revoked';
  createdAt?: any;
  lastActiveAt?: any;
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
  sessionId: string
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
        provider: 'google',
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
        authProvider: 'google',
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
