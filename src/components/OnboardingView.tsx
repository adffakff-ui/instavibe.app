import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Globe,
  Loader2,
  LogOut,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  buildSuggestedUsername,
  checkUsernameAvailability,
  USERNAME_REGEX,
} from '../lib/authService';
import UserAvatar from './UserAvatar';

export default function OnboardingView() {
  const {
    user,
    profile,
    authProvider,
    emailVerified,
    resendVerificationEmail,
    language,
    setLanguage,
    completeOnboarding,
    logOut,
  } = useAuth();
  const isAr = language === 'ar';
  const [verificationResent, setVerificationResent] = useState(false);

  const [username, setUsername] = useState(() =>
    profile?.username && USERNAME_REGEX.test(profile.username)
      ? profile.username
      : buildSuggestedUsername(user?.email, user?.uid)
  );
  const [fullName, setFullName] = useState(() => profile?.fullName || user?.displayName || '');
  const [bio, setBio] = useState(() => profile?.bio || '');
  const [photoURL, setPhotoURL] = useState(() => profile?.photoURL || user?.photoURL || '');

  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'available' | 'taken' | 'invalid'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const trimmed = username.trim();
    if (!trimmed) {
      setUsernameStatus('invalid');
      return;
    }
    if (!USERNAME_REGEX.test(trimmed)) {
      setUsernameStatus('invalid');
      return;
    }

    let cancelled = false;
    setCheckingUsername(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await checkUsernameAvailability(trimmed, user?.uid);
        if (cancelled) return;
        if (res.available) {
          setUsernameStatus('available');
        } else {
          setUsernameStatus(res.reason === 'invalid' ? 'invalid' : 'taken');
        }
      } catch {
        if (!cancelled) setUsernameStatus('idle');
      } finally {
        if (!cancelled) setCheckingUsername(false);
      }
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [username, user?.uid]);

  const compressAvatar = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const size = 256;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas not supported'));
            return;
          }
          const minSide = Math.min(img.width, img.height);
          const sx = (img.width - minSide) / 2;
          const sy = (img.height - minSide) / 2;
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => reject(new Error('Invalid image'));
        img.src = ev.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const dataUrl = await compressAvatar(file);
      setPhotoURL(dataUrl);
    } catch {
      setErrorMsg(isAr ? 'تعذر معالجة الصورة المختارة.' : 'Could not process the selected image.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedUsername = username.trim();
    if (!USERNAME_REGEX.test(trimmedUsername)) {
      setErrorMsg(
        isAr
          ? 'اسم المستخدم يجب أن يكون بين 3 و30 حرفاً (أحرف إنجليزية، أرقام، أو _ فقط).'
          : 'Username must be 3–30 characters using letters, numbers, or underscores only.'
      );
      return;
    }

    if (usernameStatus === 'taken') {
      setErrorMsg(
        isAr
          ? 'اسم المستخدم محجوز لحساب آخر، يرجى اختيار اسم مختلف.'
          : 'That username is already taken. Please choose another one.'
      );
      return;
    }

    setSubmitting(true);
    try {
      await completeOnboarding({
        username: trimmedUsername,
        fullName,
        bio,
        photoURL,
      });
    } catch (err: any) {
      if (err?.message === 'USERNAME_TAKEN') {
        setUsernameStatus('taken');
        setErrorMsg(
          isAr
            ? 'اسم المستخدم محجوز لحساب آخر، يرجى اختيار اسم مختلف.'
            : 'That username is already taken. Please choose another one.'
        );
      } else if (err?.message === 'INVALID_USERNAME') {
        setUsernameStatus('invalid');
        setErrorMsg(
          isAr
            ? 'صيغة اسم المستخدم غير صالحة.'
            : 'Invalid username format.'
        );
      } else {
        setErrorMsg(
          isAr
            ? 'تعذر حفظ بيانات الحساب في قاعدة البيانات. يرجى المحاولة مجدداً.'
            : 'Could not save account profile to the database. Please try again.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              {isAr ? 'إعداد الحساب في قاعدة البيانات' : 'Complete Account Setup'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setLanguage(isAr ? 'en' : 'ar')}
            className="min-h-[36px] px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1"
          >
            <Globe size={13} />
            <span>{isAr ? 'English' : 'عربي'}</span>
          </button>
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
            {isAr ? 'مرحباً بك في InstaVibe' : 'Welcome to InstaVibe'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isAr
              ? `مسجّل عبر ${user?.email || 'حسابك'}. اختر اسم مستخدم فريد لإتمام التسجيل.`
              : `Signed in as ${user?.email || 'your account'}. Choose a unique username to finish registration.`}
          </p>
        </div>

        {authProvider === 'password' && !emailVerified && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between gap-2">
            <span>
              {verificationResent
                ? isAr
                  ? 'تم إرسال رابط التفعيل إلى بريدك الإلكتروني.'
                  : 'Verification email resent.'
                : isAr
                ? 'تم إرسال رابط تأكيد البريد الإلكتروني لحسابك.'
                : 'A verification link was sent to your email.'}
            </span>
            {!verificationResent && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await resendVerificationEmail();
                  if (ok) setVerificationResent(true);
                }}
                className="font-bold underline shrink-0"
              >
                {isAr ? 'إعادة الإرسال' : 'Resend'}
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0">
              <UserAvatar src={photoURL} username={username} alt={username} iconSize={24} />
            </div>
            <div className="flex-1 min-w-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-2 transition-colors"
              >
                <Camera size={15} />
                <span>{isAr ? 'تغيير الصورة الشخصية' : 'Change Photo'}</span>
              </button>
            </div>
          </div>

          {/* Username with Live Firestore Availability Check */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              {isAr ? 'اسم المستخدم الفريد' : 'Unique Username'}
            </label>
            <div className="relative">
              <input
                type="text"
                dir="ltr"
                required
                minLength={3}
                maxLength={30}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username_123"
                className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 pe-10 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
              <div className="absolute inset-y-0 end-3 flex items-center pointer-events-none">
                {checkingUsername ? (
                  <Loader2 size={15} className="animate-spin text-slate-400" />
                ) : usernameStatus === 'available' ? (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                ) : usernameStatus === 'taken' || usernameStatus === 'invalid' ? (
                  <AlertCircle size={16} className="text-rose-500" />
                ) : null}
              </div>
            </div>
            <p
              className={`text-[11px] font-medium ${
                usernameStatus === 'available'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : usernameStatus === 'taken' || usernameStatus === 'invalid'
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-400'
              }`}
            >
              {checkingUsername
                ? isAr
                  ? 'جاري التحقق من التوفر في قاعدة البيانات...'
                  : 'Checking availability in database...'
                : usernameStatus === 'available'
                ? isAr
                  ? 'اسم المستخدم متاح وجاهز للحجز.'
                  : 'Username is available.'
                : usernameStatus === 'taken'
                ? isAr
                  ? 'اسم المستخدم محجوز لحساب آخر.'
                  : 'This username is already taken.'
                : usernameStatus === 'invalid'
                ? isAr
                  ? 'استخدم 3 إلى 30 حرفاً إنجليزياً أو رقماً أو _ فقط.'
                  : 'Use 3–30 English letters, numbers, or underscores (_).'
                : isAr
                ? '3 إلى 30 حرفاً (a-z, 0-9, _)'
                : '3–30 characters (a-z, 0-9, _)'}
            </p>
          </div>

          {/* Full Name */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              {isAr ? 'الاسم الكامل' : 'Full Name'}
            </label>
            <input
              type="text"
              maxLength={80}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={isAr ? 'اسمك الكامل...' : 'Your full name...'}
              className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
            />
          </div>

          {/* Bio */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isAr ? 'نبذة تعريفية (اختياري)' : 'Bio (Optional)'}
              </label>
              <span className="text-[11px] text-slate-400 tabular-nums">{bio.length}/220</span>
            </div>
            <textarea
              rows={2}
              maxLength={220}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={isAr ? 'عرّف عن نفسك باختصار...' : 'Tell others a little about yourself...'}
              className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 resize-none"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 text-xs font-medium flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || checkingUsername || usernameStatus === 'taken' || usernameStatus === 'invalid'}
            className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={17} className="animate-spin" /> : <UserCheck size={17} />}
            <span>{isAr ? 'حفظ الحساب والمتابعة' : 'Save Account & Continue'}</span>
          </button>
        </form>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-center">
          <button
            type="button"
            onClick={logOut}
            className="text-xs font-semibold text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 flex items-center gap-1.5 py-1.5"
          >
            <LogOut size={14} />
            <span>{isAr ? 'استخدام حساب آخر' : 'Use a different account'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
