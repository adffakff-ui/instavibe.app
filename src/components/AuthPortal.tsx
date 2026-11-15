import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Mail,
  MailCheck,
  MessageSquareCode,
  Phone,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  COUNTRY_CALLING_CODES,
  evaluatePasswordStrength,
  isValidE164Phone,
  isValidEmail,
  normalizeDigits,
  normalizePhoneNumber,
  USERNAME_REGEX,
} from '../lib/authService';
import { OfflineIndicator, PWAInstallModal } from './PWAInstallModal';

type AuthMode = 'login' | 'phone' | 'register' | 'reset';
type PhoneStep = 'enter-phone' | 'verify-otp';

const PHONE_RECAPTCHA_CONTAINER_ID = 'instavibe-phone-recaptcha';

export default function AuthPortal({
  isInstalled,
  showInstallModal,
  setShowInstallModal,
  onInstallTrigger,
}: {
  isInstalled: boolean;
  showInstallModal: boolean;
  setShowInstallModal: (open: boolean) => void;
  onInstallTrigger: () => Promise<void>;
}) {
  const {
    signIn,
    signInWithEmail,
    signUpWithEmail,
    sendPhoneVerificationCode,
    confirmPhoneVerificationCode,
    resetPhoneVerification,
    sendPasswordReset,
    pendingEmailVerification,
    resendVerificationEmail,
    refreshEmailVerification,
    dismissPendingEmailVerification,
    logOut,
    signingIn,
    authError,
    clearAuthError,
    language,
    setLanguage,
  } = useAuth();
  const isAr = language === 'ar';

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [countryCode, setCountryCode] = useState('+966');
  const [localPhone, setLocalPhone] = useState('');
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('enter-phone');
  const [sentPhoneNumber, setSentPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const [checkingEmailVerification, setCheckingEmailVerification] = useState(false);
  const [resendingVerificationEmail, setResendingVerificationEmail] = useState(false);
  const [emailResendCooldown, setEmailResendCooldown] = useState(0);
  const [verificationNotice, setVerificationNotice] = useState<{
    type: 'success' | 'warning';
    text: string;
  } | null>(null);

  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const passwordStrength = useMemo(() => evaluatePasswordStrength(password), [password]);
  const formattedPhone = useMemo(
    () => normalizePhoneNumber(countryCode, localPhone),
    [countryCode, localPhone]
  );
  const phoneIsValid = useMemo(() => isValidE164Phone(formattedPhone), [formattedPhone]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (emailResendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setEmailResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [emailResendCooldown]);

  useEffect(() => {
    if (pendingEmailVerification?.sent) {
      setEmailResendCooldown((prev) => (prev > 0 ? prev : 60));
    } else if (!pendingEmailVerification) {
      setEmailResendCooldown(0);
      setVerificationNotice(null);
    }
  }, [pendingEmailVerification?.email, pendingEmailVerification?.sent]);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setLocalError(null);
    setResetSent(false);
    clearAuthError();
    if (nextMode !== 'phone') {
      setPhoneStep('enter-phone');
      setOtpCode('');
      setResendCooldown(0);
      resetPhoneVerification();
    }
  };

  const activeError = localError || authError;

  const handleDismissError = () => {
    setLocalError(null);
    clearAuthError();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    if (!isValidEmail(email)) {
      setLocalError(isAr ? 'يرجى إدخال بريد إلكتروني صحيح.' : 'Please enter a valid email address.');
      return;
    }
    if (!password) {
      setLocalError(isAr ? 'يرجى إدخال كلمة المرور.' : 'Please enter your password.');
      return;
    }

    await signInWithEmail(email, password);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    const cleanName = fullName.trim();
    const cleanUsername = username.trim();

    if (cleanName.length < 2) {
      setLocalError(isAr ? 'يرجى إدخال الاسم الكامل.' : 'Please enter your full name.');
      return;
    }
    if (!USERNAME_REGEX.test(cleanUsername)) {
      setLocalError(
        isAr
          ? 'اسم المستخدم يجب أن يكون 3–30 حرفاً (أحرف إنجليزية، أرقام، أو _ فقط).'
          : 'Username must be 3–30 characters using letters, numbers, or underscores only.'
      );
      return;
    }
    if (!isValidEmail(email)) {
      setLocalError(isAr ? 'يرجى إدخال بريد إلكتروني صحيح.' : 'Please enter a valid email address.');
      return;
    }
    if (!passwordStrength.isValid) {
      setLocalError(
        isAr
          ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على أحرف وأرقام.'
          : 'Password must be at least 8 characters and include both letters and numbers.'
      );
      return;
    }
    if (password !== confirmPassword) {
      setLocalError(
        isAr ? 'كلمتا المرور غير متطابقتين.' : 'Password confirmation does not match.'
      );
      return;
    }

    await signUpWithEmail({
      email,
      password,
      fullName: cleanName,
      username: cleanUsername,
    });
  };

  const handleSendPhoneCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLocalError(null);
    clearAuthError();

    if (!phoneIsValid) {
      setLocalError(
        isAr
          ? 'يرجى إدخال رقم هاتف محمول صحيح مع رمز الدولة.'
          : 'Please enter a valid mobile number with its country code.'
      );
      return;
    }

    const ok = await sendPhoneVerificationCode(formattedPhone, PHONE_RECAPTCHA_CONTAINER_ID);
    if (ok) {
      setSentPhoneNumber(formattedPhone);
      setPhoneStep('verify-otp');
      setOtpCode('');
      setResendCooldown(60);
    }
  };

  const handleConfirmPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    const cleanOtp = normalizeDigits(otpCode).replace(/\D/g, '');
    if (cleanOtp.length !== 6) {
      setLocalError(
        isAr
          ? 'يرجى إدخال رمز التحقق المكون من 6 أرقام.'
          : 'Please enter the 6-digit verification code.'
      );
      return;
    }

    await confirmPhoneVerificationCode(cleanOtp);
  };

  const handleChangePhoneNumber = () => {
    setLocalError(null);
    setPhoneStep('enter-phone');
    setOtpCode('');
    setResendCooldown(0);
    resetPhoneVerification();
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();
    setResetSent(false);

    if (!isValidEmail(email)) {
      setLocalError(isAr ? 'يرجى إدخال بريد إلكتروني صحيح.' : 'Please enter a valid email address.');
      return;
    }

    const ok = await sendPasswordReset(email);
    if (ok) {
      setResetSent(true);
    }
  };

  const handleCheckEmailVerified = async () => {
    setLocalError(null);
    clearAuthError();
    setVerificationNotice(null);
    setCheckingEmailVerification(true);
    try {
      const verified = await refreshEmailVerification();
      if (!verified) {
        setVerificationNotice({
          type: 'warning',
          text: isAr
            ? 'لم يتم تأكيد البريد الإلكتروني بعد. افتح رسالة التفعيل في بريدك الوارد (أو الرسائل غير المرغوب فيها) واضغط على الرابط ثم أعد المحاولة.'
            : 'Your email is not verified yet. Please open the link in your inbox (or spam folder) and try again.',
        });
      }
    } catch {
      setVerificationNotice({
        type: 'warning',
        text: isAr
          ? 'تعذر التحقق من الحالة الآن. يرجى المحاولة مرة أخرى.'
          : 'Could not check verification status right now. Please try again.',
      });
    } finally {
      setCheckingEmailVerification(false);
    }
  };

  const handleResendEmailVerification = async () => {
    if (emailResendCooldown > 0) return;
    setLocalError(null);
    clearAuthError();
    setVerificationNotice(null);
    setResendingVerificationEmail(true);
    try {
      const ok = await resendVerificationEmail();
      if (ok) {
        setEmailResendCooldown(60);
        setVerificationNotice({
          type: 'success',
          text: isAr
            ? 'تم إرسال رسالة تأكيد جديدة إلى بريدك الإلكتروني. يرجى مراجعة صندوق الوارد.'
            : 'A new verification email has been sent. Please check your inbox.',
        });
      }
    } finally {
      setResendingVerificationEmail(false);
    }
  };

  const handleBackFromVerification = async () => {
    setLocalError(null);
    setVerificationNotice(null);
    await logOut();
    setMode('login');
  };

  const usernameValid = username.trim().length === 0 ? null : USERNAME_REGEX.test(username.trim());

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-5">
        {/* Top Row: Brand & Language Toggle */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-purple-600 to-rose-500 bg-clip-text text-transparent">
            InstaVibe
          </span>
          <button
            type="button"
            onClick={() => setLanguage(isAr ? 'en' : 'ar')}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Globe size={14} />
            <span>{isAr ? 'English' : 'العربية'}</span>
          </button>
        </div>

        {/* Pending Email Verification View (after Sign Up) */}
        {pendingEmailVerification ? (
          <div className="space-y-5 pt-1">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200/80 dark:border-purple-900 flex items-center justify-center text-purple-600 dark:text-purple-400">
                {pendingEmailVerification.sending ? (
                  <Loader2 size={26} className="animate-spin" />
                ) : (
                  <MailCheck size={26} />
                )}
              </div>
              <div className="space-y-1.5">
                <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {isAr ? 'تحقق من بريدك الوارد' : 'Check your inbox'}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {pendingEmailVerification.sending ? (
                    isAr ? (
                      'تم إنشاء حسابك! جاري إرسال رسالة تأكيد البريد الإلكتروني...'
                    ) : (
                      'Your account has been created! Sending your verification email...'
                    )
                  ) : (
                    <>
                      {isAr
                        ? 'تم إنشاء حسابك وإرسال رابط التفعيل إلى '
                        : 'Your account has been created and we sent a verification link to '}
                      <span dir="ltr" className="font-bold text-slate-900 dark:text-white">
                        {pendingEmailVerification.email}
                      </span>
                      {isAr
                        ? '. يرجى فتح صندوق الوارد (أو مجلد الرسائل غير المرغوب فيها) والضغط على الرابط لتفعيل حسابك.'
                        : '. Please check your inbox (or spam folder) and click the link to verify your email.'}
                    </>
                  )}
                </p>
              </div>
            </div>

            {(pendingEmailVerification.error || activeError) && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-500" />
                <span>{pendingEmailVerification.error || activeError}</span>
              </div>
            )}

            {verificationNotice && (
              <div
                className={`p-3 rounded-xl border text-xs font-medium flex items-start gap-2 ${
                  verificationNotice.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                }`}
              >
                {verificationNotice.type === 'success' ? (
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                )}
                <span>{verificationNotice.text}</span>
              </div>
            )}

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={checkingEmailVerification || pendingEmailVerification.sending}
                onClick={handleCheckEmailVerified}
                className="w-full min-h-[46px] flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 px-4 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-60 transition-all active:scale-[0.98]"
              >
                {checkingEmailVerification ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={17} />
                )}
                <span>
                  {checkingEmailVerification
                    ? isAr
                      ? 'جاري التحقق...'
                      : 'Checking verification...'
                    : isAr
                    ? 'لقد فعّلت بريدي الإلكتروني — متابعة'
                    : "I've verified my email — Continue"}
                </span>
              </button>

              <button
                type="button"
                disabled={
                  resendingVerificationEmail ||
                  emailResendCooldown > 0 ||
                  pendingEmailVerification.sending
                }
                onClick={handleResendEmailVerification}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 py-2.5 px-4 rounded-xl text-xs font-bold disabled:opacity-55 transition-colors"
              >
                {resendingVerificationEmail ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <RefreshCw size={15} />
                )}
                <span>
                  {emailResendCooldown > 0
                    ? isAr
                      ? `إعادة إرسال رابط التفعيل (${emailResendCooldown} ث)`
                      : `Resend verification email (${emailResendCooldown}s)`
                    : isAr
                    ? 'إعادة إرسال رابط التفعيل'
                    : 'Resend verification email'}
                </span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <button
                type="button"
                onClick={dismissPendingEmailVerification}
                className="font-semibold text-purple-600 dark:text-purple-400 hover:underline py-1"
              >
                {isAr ? 'المتابعة إلى التطبيق الآن' : 'Continue to app for now'}
              </button>
              <button
                type="button"
                onClick={handleBackFromVerification}
                className="font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white py-1"
              >
                {isAr ? 'استخدام حساب آخر' : 'Use a different account'}
              </button>
            </div>
          </div>
        ) : (
          <>
        {/* Mode Switcher Tabs (Email Login / Phone Login / Create Account) */}
        {mode !== 'reset' ? (
          <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`min-h-[42px] px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LogIn size={14} className="shrink-0" />
              <span>{isAr ? 'البريد' : 'Email'}</span>
            </button>
            <button
              type="button"
              onClick={() => switchMode('phone')}
              className={`min-h-[42px] px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                mode === 'phone'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Phone size={14} className="shrink-0" />
              <span>{isAr ? 'الهاتف' : 'Phone'}</span>
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`min-h-[42px] px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                mode === 'register'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UserPlus size={14} className="shrink-0" />
              <span>{isAr ? 'حساب جديد' : 'Sign Up'}</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <KeyRound size={18} className="text-purple-600 dark:text-purple-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {isAr ? 'استعادة كلمة المرور' : 'Reset Password'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1"
            >
              <ArrowRight size={14} className={isAr ? '' : 'rotate-180'} />
              <span>{isAr ? 'العودة' : 'Back'}</span>
            </button>
          </div>
        )}

        {/* Heading */}
        <div className="space-y-1">
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {mode === 'login'
              ? isAr
                ? 'مرحباً بعودتك'
                : 'Welcome back'
              : mode === 'phone'
              ? phoneStep === 'enter-phone'
                ? isAr
                  ? 'تسجيل الدخول برقم الهاتف'
                  : 'Sign in with Phone'
                : isAr
                ? 'أدخل رمز التحقق (SMS)'
                : 'Enter SMS Code'
              : mode === 'register'
              ? isAr
                ? 'إنشاء حساب سحابي جديد'
                : 'Create your cloud account'
              : isAr
              ? 'إرسال رابط استعادة الحساب'
              : 'Recover your account'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {mode === 'login'
              ? isAr
                ? 'ادخل بريدك الإلكتروني وكلمة المرور أو تابع عبر Google.'
                : 'Enter your email and password or continue with Google.'
              : mode === 'phone'
              ? phoneStep === 'enter-phone'
                ? isAr
                  ? 'سنرسل لك رمز تحقق لمرة واحدة عبر رسالة SMS لتسجيل الدخول بأمان.'
                  : 'We will send a one-time SMS verification code to sign in securely.'
                : isAr
                ? 'أدخل الرمز المكون من 6 أرقام المرسل إلى رقم هاتفك.'
                : 'Enter the 6-digit verification code sent to your mobile number.'
              : mode === 'register'
              ? isAr
                ? 'أنشئ حساباً محفوظاً ومزامَناً مباشرة مع قاعدة البيانات.'
                : 'Register a verified profile synced directly with the cloud database.'
              : isAr
              ? 'أدخل بريدك الإلكتروني المسجل وسنرسل لك رابطاً لتعيين كلمة مرور جديدة.'
              : 'Enter your registered email and we will send you a password reset link.'}
          </p>
        </div>

        {/* Error Banner */}
        {activeError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-500" />
              <span>{activeError}</span>
            </div>
            <button
              type="button"
              onClick={handleDismissError}
              aria-label={isAr ? 'إغلاق التنبيه' : 'Dismiss error'}
              className="text-rose-400 hover:text-rose-600 shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Reset Success Banner */}
        {mode === 'reset' && resetSent && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-start gap-2">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <span>
              {isAr
                ? 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني. تحقق من البريد الوارد أو الرسائل غير المرغوب فيها.'
                : 'Password reset link sent! Please check your inbox or spam folder.'}
            </span>
          </div>
        )}

        {/* EMAIL LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                {isAr ? 'البريد الإلكتروني' : 'Email Address'}
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute inset-y-0 start-3.5 my-auto text-slate-400 pointer-events-none"
                />
                <input
                  type="email"
                  dir="ltr"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl ps-10 pe-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isAr ? 'كلمة المرور' : 'Password'}
                </label>
                <button
                  type="button"
                  onClick={() => switchMode('reset')}
                  className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                >
                  {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                </button>
              </div>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute inset-y-0 start-3.5 my-auto text-slate-400 pointer-events-none"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  dir="ltr"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl ps-10 pe-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={isAr ? 'إظهار أو إخفاء كلمة المرور' : 'Toggle password visibility'}
                  className="absolute inset-y-0 end-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={signingIn}
              className="w-full min-h-[46px] flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 px-4 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-60 transition-all active:scale-[0.98]"
            >
              {signingIn ? <Loader2 size={17} className="animate-spin" /> : <LogIn size={17} />}
              <span>{isAr ? 'تسجيل الدخول' : 'Sign In'}</span>
            </button>
          </form>
        )}

        {/* PHONE NUMBER LOGIN FORM (FIREBASE PHONE AUTH) */}
        {mode === 'phone' && (
          <div className="space-y-3.5">
            {phoneStep === 'enter-phone' ? (
              <form onSubmit={handleSendPhoneCode} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    {isAr ? 'رمز الدولة ورقم الهاتف المحمول' : 'Country Code & Mobile Number'}
                  </label>
                  <div className="grid grid-cols-[minmax(128px,0.9fr)_1.2fr] gap-2" dir="ltr">
                    <select
                      aria-label={isAr ? 'رمز الدولة' : 'Country code'}
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-2.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-600"
                    >
                      {COUNTRY_CALLING_CODES.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {isAr ? opt.labelAr : opt.labelEn}
                        </option>
                      ))}
                    </select>
                    <div className="relative">
                      <Phone
                        size={15}
                        className="absolute inset-y-0 left-3 my-auto text-slate-400 pointer-events-none"
                      />
                      <input
                        type="tel"
                        dir="ltr"
                        inputMode="tel"
                        required
                        autoComplete="tel-national"
                        value={localPhone}
                        onChange={(e) => setLocalPhone(e.target.value)}
                        placeholder="501234567"
                        className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                    <span>
                      {isAr
                        ? 'أو اكتب الرقم الدولي كاملاً بدءاً بـ +'
                        : 'Or enter full international format with +'}
                    </span>
                    {formattedPhone && (
                      <span
                        dir="ltr"
                        className={`font-mono font-semibold ${
                          phoneIsValid
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {formattedPhone}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={signingIn || !phoneIsValid}
                  className="w-full min-h-[46px] flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 px-4 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-55 transition-all active:scale-[0.98]"
                >
                  {signingIn ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <MessageSquareCode size={17} />
                  )}
                  <span>
                    {signingIn
                      ? isAr
                        ? 'جاري إرسال الرمز...'
                        : 'Sending Code...'
                      : isAr
                      ? 'إرسال رمز التحقق (SMS)'
                      : 'Send Verification Code'}
                  </span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleConfirmPhoneOtp} className="space-y-3.5">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span dir="ltr" className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {sentPhoneNumber}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={signingIn}
                    onClick={handleChangePhoneNumber}
                    className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline shrink-0"
                  >
                    {isAr ? 'تغيير الرقم' : 'Change'}
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isAr ? 'رمز التحقق (6 أرقام)' : '6-Digit Verification Code'}
                    </label>
                    <button
                      type="button"
                      disabled={signingIn || resendCooldown > 0}
                      onClick={() => handleSendPhoneCode()}
                      className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline disabled:text-slate-400 disabled:no-underline"
                    >
                      {resendCooldown > 0
                        ? isAr
                          ? `إعادة الإرسال خلال ${resendCooldown} ث`
                          : `Resend in ${resendCooldown}s`
                        : isAr
                        ? 'إعادة إرسال الرمز'
                        : 'Resend code'}
                    </button>
                  </div>
                  <input
                    type="text"
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(normalizeDigits(e.target.value).replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-center font-mono text-lg font-bold tracking-[0.45em] focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={signingIn || otpCode.length !== 6}
                  className="w-full min-h-[46px] flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 px-4 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-55 transition-all active:scale-[0.98]"
                >
                  {signingIn ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={17} />
                  )}
                  <span>
                    {signingIn
                      ? isAr
                        ? 'جاري التحقق...'
                        : 'Verifying...'
                      : isAr
                      ? 'تأكيد الرمز وتسجيل الدخول'
                      : 'Verify & Sign In'}
                  </span>
                </button>
              </form>
            )}

            {/* Firebase RecaptchaVerifier mount container */}
            <div id={PHONE_RECAPTCHA_CONTAINER_ID} className="flex justify-center" />
          </div>
        )}

        {/* REGISTER FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  {isAr ? 'الاسم الكامل' : 'Full Name'}
                </label>
                <div className="relative">
                  <User
                    size={15}
                    className="absolute inset-y-0 start-3 my-auto text-slate-400 pointer-events-none"
                  />
                  <input
                    type="text"
                    required
                    maxLength={80}
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={isAr ? 'الاسم الكامل' : 'Your name'}
                    className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl ps-9 pe-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  {isAr ? 'اسم المستخدم' : 'Username'}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  required
                  minLength={3}
                  maxLength={30}
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username_123"
                  className={`w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 ${
                    usernameValid === false
                      ? 'focus:ring-rose-500 ring-1 ring-rose-400'
                      : 'focus:ring-purple-600'
                  }`}
                />
              </div>
            </div>

            {usernameValid === false && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400">
                {isAr
                  ? 'اسم المستخدم: 3–30 حرفاً إنجليزياً أو رقماً أو _ فقط.'
                  : 'Username: 3–30 English letters, numbers, or underscores (_).'}
              </p>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                {isAr ? 'البريد الإلكتروني' : 'Email Address'}
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute inset-y-0 start-3.5 my-auto text-slate-400 pointer-events-none"
                />
                <input
                  type="email"
                  dir="ltr"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl ps-10 pe-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                {isAr ? 'كلمة المرور' : 'Password'}
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute inset-y-0 start-3.5 my-auto text-slate-400 pointer-events-none"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  dir="ltr"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl ps-10 pe-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={isAr ? 'إظهار أو إخفاء كلمة المرور' : 'Toggle password visibility'}
                  className="absolute inset-y-0 end-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {password.length > 0 && (
                <div className="pt-1 space-y-1.5">
                  <div className="grid grid-cols-4 gap-1">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-1 rounded-full transition-colors ${
                          passwordStrength.score >= step
                            ? passwordStrength.score >= 3
                              ? 'bg-emerald-500'
                              : passwordStrength.score === 2
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                            : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                    <span
                      className={
                        passwordStrength.minLength
                          ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                          : 'text-slate-400'
                      }
                    >
                      {isAr ? '8+ أحرف' : '8+ chars'}
                    </span>
                    <span
                      className={
                        passwordStrength.hasLetter
                          ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                          : 'text-slate-400'
                      }
                    >
                      {isAr ? 'حرف إنجليزي' : 'Letter'}
                    </span>
                    <span
                      className={
                        passwordStrength.hasNumber
                          ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                          : 'text-slate-400'
                      }
                    >
                      {isAr ? 'رقم' : 'Number'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                {isAr ? 'تأكيد كلمة المرور' : 'Confirm Password'}
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute inset-y-0 start-3.5 my-auto text-slate-400 pointer-events-none"
                />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  dir="ltr"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl ps-10 pe-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={isAr ? 'إظهار أو إخفاء التأكيد' : 'Toggle confirm password visibility'}
                  className="absolute inset-y-0 end-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400">
                  {isAr ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.'}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={signingIn}
              className="w-full min-h-[46px] flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 px-4 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-60 transition-all active:scale-[0.98]"
            >
              {signingIn ? <Loader2 size={17} className="animate-spin" /> : <UserPlus size={17} />}
              <span>{isAr ? 'إنشاء الحساب والمتابعة' : 'Create Account & Continue'}</span>
            </button>
          </form>
        )}

        {/* RESET PASSWORD FORM */}
        {mode === 'reset' && (
          <form onSubmit={handleResetSubmit} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                {isAr ? 'البريد الإلكتروني' : 'Email Address'}
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute inset-y-0 start-3.5 my-auto text-slate-400 pointer-events-none"
                />
                <input
                  type="email"
                  dir="ltr"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl ps-10 pe-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={signingIn}
              className="w-full min-h-[46px] flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 px-4 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-60 transition-all active:scale-[0.98]"
            >
              {signingIn ? <Loader2 size={17} className="animate-spin" /> : <KeyRound size={17} />}
              <span>{isAr ? 'إرسال رابط إعادة التعيين' : 'Send Password Reset Link'}</span>
            </button>
          </form>
        )}

        {/* Divider & Google OAuth Option */}
        {mode !== 'reset' && (
          <>
            <div className="relative flex items-center py-0.5">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
              <span className="shrink-0 mx-3 text-[11px] font-semibold text-slate-400">
                {isAr ? 'أو المتابعة عبر' : 'Or continue with'}
              </span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
            </div>

            <button
              type="button"
              disabled={signingIn}
              onClick={signIn}
              className="w-full min-h-[44px] flex items-center justify-center gap-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white py-2.5 px-4 rounded-xl text-xs font-bold border border-slate-200/80 dark:border-slate-700 disabled:opacity-60 transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              <span>{isAr ? 'المتابعة باستخدام Google' : 'Continue with Google'}</span>
            </button>
          </>
        )}
          </>
        )}

        {/* Mobile App Install (Outside App) */}
        <div className="pt-2 space-y-2 border-t border-slate-100 dark:border-slate-800">
          {!isInstalled ? (
            <button
              type="button"
              onClick={onInstallTrigger}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-all active:scale-[0.98] shadow-sm"
            >
              <Download size={15} />
              <span>{isAr ? 'تثبيت التطبيق على جهازك (v2.1.0)' : 'Install App on Device (v2.1.0)'}</span>
            </button>
          ) : (
            <div className="w-full py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5">
              <CheckCircle2 size={14} />
              <span>{isAr ? 'التطبيق مثبّت • الإصدار v2.1.0' : 'App Installed • v2.1.0'}</span>
            </div>
          )}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <Smartphone size={13} className="text-purple-500 shrink-0" />
            <span>
              {isAr
                ? 'يعمل على أندرويد وآيفون وسطح المكتب كتطبيق مستقل • الإصدار 2.1.0'
                : 'Standalone app for Android, iPhone & Desktop • Version 2.1.0'}
            </span>
          </div>
        </div>
      </div>

      <OfflineIndicator />
      <PWAInstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
    </div>
  );
}
