import { AlertCircle, CheckCircle2, Download, Globe, Loader2, LogIn, ShieldCheck, Smartphone, UserCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { OfflineIndicator, PWAInstallModal } from './PWAInstallModal';

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
  const { signIn, signingIn, authError, clearAuthError, language, setLanguage } = useAuth();
  const isAr = language === 'ar';

  const highlights = [
    {
      icon: UserCheck,
      title: isAr ? 'حساب موثّق ومرتبط بقاعدة البيانات' : 'Database-Synced Account',
      desc: isAr
        ? 'حفظ ملفك الشخصي ومنشوراتك ومحفوظاتك الخاصة مباشرة في السحابة.'
        : 'Persist your profile, posts, and private bookmarks directly in cloud Firestore.',
    },
    {
      icon: ShieldCheck,
      title: isAr ? 'اسم مستخدم فريد وحماية الجلسات' : 'Unique Username & Session Control',
      desc: isAr
        ? 'توثيق اسم المستخدم ومنع التكرار مع متابعة وإدارة جلسات الدخول النشطة.'
        : 'Atomic username reservation and real-time active device session management.',
    },
    {
      icon: CheckCircle2,
      title: isAr ? 'دخول فوري وآمن عبر Google' : 'Secure Google Authentication',
      desc: isAr
        ? 'مصادقة مشفرة ومباشرة دون كلمات مرور قابلة للاختراق.'
        : 'Encrypted OAuth sign-in backed by Firebase Authentication.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6">
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

        {/* Heading */}
        <div className="space-y-1.5">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {isAr ? 'تسجيل الدخول إلى حسابك' : 'Sign in to InstaVibe'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isAr
              ? 'شارك لحظاتك، قصصك، وبثك المباشر ضمن حساب سحابي متكامل.'
              : 'Share moments, stories, and live broadcasts with a cloud-synced account.'}
          </p>
        </div>

        {/* Architecture Highlights */}
        <div className="space-y-2.5">
          {highlights.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{item.title}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Error Banner */}
        {authError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-500" />
              <span>{authError}</span>
            </div>
            <button
              type="button"
              onClick={clearAuthError}
              aria-label={isAr ? 'إغلاق التنبيه' : 'Dismiss error'}
              className="text-rose-400 hover:text-rose-600 shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Primary Auth Actions */}
        <div className="space-y-3">
          <button
            type="button"
            disabled={signingIn}
            onClick={signIn}
            className="w-full min-h-[48px] flex items-center justify-center gap-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 px-4 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-60 transition-all active:scale-[0.98] shadow-sm"
          >
            {signingIn ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
            <span>
              {signingIn
                ? isAr
                  ? 'جاري تسجيل الدخول...'
                  : 'Signing in...'
                : isAr
                ? 'تسجيل الدخول / إنشاء حساب عبر Google'
                : 'Continue with Google'}
            </span>
          </button>

          {!isInstalled && (
            <button
              type="button"
              onClick={onInstallTrigger}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
            >
              <Download size={16} />
              <span>
                {isAr ? 'تثبيت التطبيق على الجوال / APK' : 'Install Mobile App / APK'}
              </span>
            </button>
          )}
        </div>

        {!isInstalled && (
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <Smartphone size={13} className="text-purple-500 shrink-0" />
            <span>
              {isAr
                ? 'يعمل على أندرويد وآيفون كحزمة تطبيق مستقلة'
                : 'Installable on Android & iPhone as a standalone app'}
            </span>
          </div>
        )}
      </div>

      <OfflineIndicator />
      <PWAInstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
    </div>
  );
}
