import React, { useMemo, useState } from 'react';
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
  Smartphone,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  evaluatePasswordStrength,
  isValidEmail,
  USERNAME_REGEX,
} from '../lib/authService';
import { OfflineIndicator, PWAInstallModal } from './PWAInstallModal';

type AuthMode = 'login' | 'register' | 'reset';

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
    sendPasswordReset,
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
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const passwordStrength = useMemo(() => evaluatePasswordStrength(password), [password]);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setLocalError(null);
    setResetSent(false);
    clearAuthError();
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

        {/* Mode Switcher Tabs (Login / Register) */}
        {mode !== 'reset' ? (
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`min-h-[42px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                mode === 'login'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LogIn size={15} />
              <span>{isAr ? 'تسجيل الدخول' : 'Sign In'}</span>
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`min-h-[42px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                mode === 'register'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UserPlus size={15} />
              <span>{isAr ? 'إنشاء حساب جديد' : 'Create Account'}</span>
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

        {/* LOGIN FORM */}
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

        {/* Mobile App Install */}
        {!isInstalled && (
          <div className="pt-1 space-y-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onInstallTrigger}
              className="w-full min-h-[42px] flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
            >
              <Download size={15} />
              <span>{isAr ? 'تثبيت التطبيق على الجوال / APK' : 'Install Mobile App / APK'}</span>
            </button>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <Smartphone size={13} className="text-purple-500 shrink-0" />
              <span>
                {isAr
                  ? 'يعمل على أندرويد وآيفون كحزمة تطبيق مستقلة'
                  : 'Installable on Android & iPhone as a standalone app'}
              </span>
            </div>
          </div>
        )}
      </div>

      <OfflineIndicator />
      <PWAInstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
    </div>
  );
}
