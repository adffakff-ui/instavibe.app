import React, { useState } from 'react';
import {
  X,
  Check,
  Copy,
  Share2,
  ExternalLink,
  Download,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';
import { APP_VERSION_LABEL } from '../lib/version';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { language } = useAuth();
  const isAr = language === 'ar';

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 md:bottom-4 start-4 z-[110] flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg"
    >
      <span>
        {isAr
          ? 'أنت غير متصل بالإنترنت — يتم عرض البيانات المخزنة'
          : 'Offline Mode — Showing cached content'}
      </span>
    </div>
  );
};

export const AppUpdateBanner: React.FC = () => {
  const { updateAvailable, applyUpdate, appVersion } = usePWAInstall();
  const { language } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const isAr = language === 'ar';

  if (!updateAvailable || dismissed) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 md:bottom-5 end-4 z-[125] max-w-xs w-[calc(100vw-2rem)] bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl p-3.5 shadow-2xl border border-slate-700/60 dark:border-slate-200 flex items-center gap-3 animate-in slide-in-from-bottom-4 fade-in"
    >
      <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
        <Sparkles size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold truncate">
          {isAr ? `يتوفر تحديث جديد (${appVersion})` : `New Update Ready (${appVersion})`}
        </p>
        <p className="text-[11px] opacity-80 truncate">
          {isAr ? 'اضغط للتحديث إلى أحدث إصدار فوراً.' : 'Tap to load the newest version.'}
        </p>
      </div>
      <button
        type="button"
        disabled={updating}
        onClick={async () => {
          setUpdating(true);
          await applyUpdate();
        }}
        className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shrink-0 flex items-center gap-1 transition-colors disabled:opacity-60"
      >
        <RefreshCw size={12} className={updating ? 'animate-spin' : ''} />
        <span>{isAr ? 'تحديث' : 'Update'}</span>
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={isAr ? 'إغلاق' : 'Dismiss'}
        className="p-1 opacity-70 hover:opacity-100 shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export function PWAInstallModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { language } = useAuth();
  const isAr = language === 'ar';
  const {
    appVersion,
    isInstallable,
    isInstalled,
    isIOS,
    isEmbedded,
    swReady,
    updateAvailable,
    checkingUpdate,
    install,
    applyUpdate,
    checkForUpdates,
    publicAppUrl,
    browserInstallUrl,
    pwaBuilderUrl,
  } = usePWAInstall();
  const [copied, setCopied] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [updateStatusMsg, setUpdateStatusMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const shareUrl = publicAppUrl || (typeof window !== 'undefined' ? window.location.origin : '');

  const handleDirectInstall = async () => {
    setInstalling(true);
    try {
      const ok = await install();
      if (ok) onClose();
    } finally {
      setInstalling(false);
    }
  };

  const handleCheckUpdate = async () => {
    setUpdateStatusMsg(null);
    const res = await checkForUpdates();
    if (res === 'update-ready') {
      setUpdateStatusMsg(
        isAr ? 'يتوفر تحديث جديد جاهز للتطبيق الآن!' : 'A new update is ready to apply!'
      );
    } else {
      setUpdateStatusMsg(
        isAr
          ? `أنت تستخدم أحدث إصدار (${APP_VERSION_LABEL}).`
          : `You are running the latest version (${APP_VERSION_LABEL}).`
      );
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'InstaVibe',
          text: isAr
            ? 'جرّب تطبيق InstaVibe وثبّته مباشرة على هاتفك!'
            : 'Check out InstaVibe and install it directly on your phone!',
          url: shareUrl,
        });
        return;
      } catch {
        // Cancelled
      }
    }
    await handleCopyLink();
  };

  return (
    <div
      className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isAr ? 'تثبيت وتحديث تطبيق InstaVibe' : 'Install & Update InstaVibe'}
    >
      <div
        className="max-w-md w-full mx-auto bg-gray-900 dark:bg-slate-900 text-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-6 rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-800 max-h-[92dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-800 gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="bg-gradient-to-br from-purple-600 to-rose-500 p-3 rounded-xl shrink-0 shadow-md">
              <Smartphone size={24} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold truncate">
                  {isAr ? 'تثبيت تطبيق InstaVibe' : 'Install InstaVibe'}
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-purple-950/80 border border-purple-700/60 text-purple-300 text-[10px] font-extrabold tabular-nums">
                  v{appVersion}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                {isAr ? 'تثبيت مباشر كتطبيق مستقل أو تحديث الإصدار' : 'Standalone mobile install & version updates'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-gray-400 hover:text-white rounded-full transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Installed State Banner */}
        {isInstalled && (
          <div className="mb-4 p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
            <span>
              {isAr
                ? `التطبيق مثبّت ويعمل كتطبيق مستقل (الإصدار ${appVersion}).`
                : `App is installed in standalone mode (v${appVersion}).`}
            </span>
          </div>
        )}

        {/* Update Ready Card */}
        {updateAvailable && (
          <div className="mb-4 p-4 rounded-xl bg-amber-950/50 border border-amber-700/70 space-y-2.5">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
              <Sparkles size={15} className="shrink-0" />
              <span>{isAr ? `يتوفر تحديث جديد للتطبيق (${appVersion})` : `New App Update Available (${appVersion})`}</span>
            </div>
            <button
              type="button"
              onClick={applyUpdate}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <RefreshCw size={14} />
              <span>{isAr ? 'تحديث وإعادة التشغيل الآن' : 'Update & Reload Now'}</span>
            </button>
          </div>
        )}

        {/* 1-Tap Native Install Button */}
        {isInstallable && !isInstalled && (
          <div className="mb-4">
            <button
              type="button"
              onClick={handleDirectInstall}
              disabled={installing}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <Download size={17} />
              <span>
                {installing
                  ? isAr
                    ? 'جاري التثبيت...'
                    : 'Installing...'
                  : isAr
                  ? 'تثبيت التطبيق الآن (تثبيت مباشر بنقرة واحدة)'
                  : 'Install App Now (Direct 1-Tap)'}
              </span>
            </button>
          </div>
        )}

        {/* Native SW active notice when Chrome hasn't surfaced auto-prompt yet */}
        {!isInstallable && !isInstalled && !isIOS && !isEmbedded && (
          <div className="mb-4 bg-indigo-950/40 border border-indigo-700/60 p-3.5 rounded-xl text-xs text-indigo-100 space-y-1.5">
            <p className="font-bold text-white flex items-center justify-between gap-2">
              <span>{isAr ? 'تثبيت مباشر عبر المتصفح' : 'Direct Browser Install'}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${swReady ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                {swReady ? (isAr ? 'جاهز للتثبيت' : 'PWA Ready') : (isAr ? 'جاري التهيئة...' : 'Initializing...')}
              </span>
            </p>
            <p className="text-indigo-200/90 leading-relaxed">
              {isAr
                ? 'إذا لم يظهر زر التثبيت التلقائي فوراً، اضغط قائمة المتصفح (⋮) في الأعلى ثم اختر «تثبيت التطبيق» أو «الإضافة إلى الشاشة الرئيسية».'
                : 'If the 1-tap dialog did not appear automatically, open your browser menu (⋮) and tap "Install app" or "Add to Home Screen".'}
            </p>
          </div>
        )}

        {/* AI Studio Iframe Escape Prompt */}
        {isEmbedded && !isInstalled && (
          <div className="mb-4 bg-purple-950/50 p-4 rounded-xl border border-purple-800/80 space-y-2.5">
            <p className="text-xs text-purple-200 font-bold">
              {isAr ? 'افتح التطبيق في المتصفح للتثبيت المباشر' : 'Open in browser for 1-tap install'}
            </p>
            <p className="text-[11px] text-purple-300/90 leading-relaxed">
              {isAr
                ? 'تمنع المتصفحات نافذة التثبيت التلقائية داخل إطارات المعاينة. افتح الرابط في نافذة متصفح مستقلة لتثبيت التطبيق فوراً:'
                : 'Browsers block install prompts inside preview iframes. Open in an external browser tab to install directly:'}
            </p>
            <a
              href={browserInstallUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-center bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 px-4 rounded-lg text-xs transition shadow-sm flex items-center justify-center gap-1.5"
            >
              <ExternalLink size={14} />
              <span>{isAr ? 'فتح التطبيق في المتصفح للتثبيت' : 'Open in Browser to Install'}</span>
            </a>
          </div>
        )}

        {/* iOS Safari Focused Guide when on iPhone/iPad */}
        {isIOS && !isInstalled && (
          <div className="bg-indigo-950/50 border border-indigo-700/70 p-4 rounded-xl mb-4 text-xs text-indigo-100 space-y-1.5">
            <p className="font-bold text-white flex items-center gap-1.5">
              <span>🍎</span>
              <span>{isAr ? 'تثبيت التطبيق على آيفون وآيباد (Safari)' : 'Install on iPhone & iPad (Safari)'}</span>
            </p>
            <p className="text-indigo-200 leading-relaxed">
              {isAr
                ? '1. افتح الرابط في متصفح Safari  ←  2. اضغط زر المشاركة (Share)  ←  3. اختر «إضافة إلى الشاشة الرئيسية» (Add to Home Screen).'
                : '1. Open in Safari → 2. Tap the Share button → 3. Tap "Add to Home Screen".'}
            </p>
          </div>
        )}

        {/* خيار تحميل APK الحقيقي عبر PWABuilder */}
        <div className="bg-gray-800 p-4 rounded-xl mb-4 border border-gray-700 shadow-sm">
          <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
            <span>📦</span>
            <span>{isAr ? 'تصدير حزمة Android APK حقيقية' : 'Build Real Android APK'}</span>
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            {isAr
              ? 'استخدم رابط التطبيق عبر PWABuilder لتوليد ملف APK موقع وجاهز للتثبيت والمشاركة على هواتف أندرويد.'
              : 'Package the live app with PWABuilder to download a signed Android APK.'}
          </p>
          <a
            href={pwaBuilderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-4 rounded-lg text-xs transition shadow-sm"
          >
            <Download size={14} />
            <span>{isAr ? 'توليد وتحميل APK عبر PWABuilder' : 'Generate Android APK via PWABuilder'}</span>
          </a>
        </div>

        {/* Platform Guides (Android + iOS fallback) */}
        <div className="space-y-2.5 mb-4">
          <div className="bg-gray-800 p-3.5 rounded-xl text-xs text-gray-300 border border-gray-700/50">
            <p className="font-semibold text-white mb-1">
              📱 {isAr ? 'على هواتف أندرويد والكمبيوتر (Chrome / Edge)' : 'Android & Desktop (Chrome / Edge)'}
            </p>
            <p>
              {isAr
                ? 'افتح التطبيق في Chrome ثم اضغط قائمة ⋮ واختر «تثبيت التطبيق» (Install App) لتثبيته كحزمة مستقلة.'
                : 'Open in Chrome, tap menu ⋮ and select "Install app" to install as a standalone app.'}
            </p>
          </div>

          {!isIOS && (
            <div className="bg-gray-800 p-3.5 rounded-xl text-xs text-gray-300 border border-gray-700/50">
              <p className="font-semibold text-white mb-1">
                🍎 {isAr ? 'على آيفون وآيباد (iOS Safari)' : 'iPhone & iPad (iOS Safari)'}
              </p>
              <p>
                {isAr
                  ? 'افتح الرابط في Safari، اضغط زر المشاركة في الأسفل ثم اختر «إضافة إلى الشاشة الرئيسية».'
                  : 'Open in Safari, tap Share in the toolbar, then select "Add to Home Screen".'}
              </p>
            </div>
          )}
        </div>

        {/* Version Check Section */}
        <div className="bg-gray-800/70 p-3 rounded-xl mb-4 border border-gray-700/60 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white">
              {isAr ? `الإصدار الحالي: ${APP_VERSION_LABEL}` : `Current Version: ${APP_VERSION_LABEL}`}
            </p>
            {updateStatusMsg && (
              <p className="text-[11px] text-emerald-300 mt-0.5">{updateStatusMsg}</p>
            )}
          </div>
          <button
            type="button"
            disabled={checkingUpdate}
            onClick={updateAvailable ? applyUpdate : handleCheckUpdate}
            className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-50"
          >
            <RefreshCw size={13} className={checkingUpdate ? 'animate-spin' : ''} />
            <span>
              {updateAvailable
                ? isAr
                  ? 'تثبيت التحديث'
                  : 'Apply Update'
                : isAr
                ? 'فحص التحديثات'
                : 'Check Updates'}
            </span>
          </button>
        </div>

        {/* مشاركة الرابط */}
        <div className="pt-3 border-t border-gray-800 flex items-center justify-between gap-2">
          <span className="text-xs text-gray-400">{isAr ? 'مشاركة التطبيق مع الجميع' : 'Share App With Everyone'}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleNativeShare}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Share2 size={14} />
              <span>{isAr ? 'مشاركة' : 'Share'}</span>
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? (isAr ? 'تم' : 'Copied') : (isAr ? 'نسخ' : 'Copy')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
