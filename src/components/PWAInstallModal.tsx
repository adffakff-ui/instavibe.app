import React, { useState } from 'react';
import { X, Check, Copy, Share2, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

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
    isInstallable,
    isInstalled,
    isEmbedded,
    install,
    publicAppUrl,
    browserInstallUrl,
    pwaBuilderUrl,
  } = usePWAInstall();
  const [copied, setCopied] = useState(false);
  const [installing, setInstalling] = useState(false);

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
    >
      <div
        className="max-w-md w-full mx-auto bg-gray-900 dark:bg-slate-900 text-white p-6 rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-800 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-800">
          <div className="flex items-center space-x-4 space-x-reverse">
            <div className="bg-purple-600 p-3 rounded-xl shrink-0 shadow-md">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {isAr ? 'تثبيت تطبيق InstaVibe' : 'Install InstaVibe App'}
              </h2>
              <p className="text-xs text-gray-400">
                {isAr ? 'تثبيت مباشر على الهاتف أو بناء حزمة APK' : 'Direct phone install or Android APK package'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Installed State Banner */}
        {isInstalled && (
          <div className="mb-4 p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs font-semibold">
            {isAr ? '✓ التطبيق مثبّت ويعمل الآن كتطبيق مستقل على جهازك!' : '✓ App is installed and running in standalone mode!'}
          </div>
        )}

        {/* 1-Tap Native Install Button */}
        {isInstallable && !isInstalled && (
          <div className="mb-4">
            <button
              type="button"
              onClick={handleDirectInstall}
              disabled={installing}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <span>{installing ? (isAr ? 'جاري التثبيت...' : 'Installing...') : (isAr ? '⚡ تثبيت التطبيق الآن (بنقرة واحدة)' : '⚡ Install App Now (1-Tap)')}</span>
            </button>
          </div>
        )}

        {/* AI Studio Iframe Escape Prompt */}
        {isEmbedded && !isInstalled && (
          <div className="mb-4 bg-purple-950/50 p-4 rounded-xl border border-purple-800/80 space-y-2.5">
            <p className="text-xs text-purple-200 font-bold">
              {isAr ? '🔗 افتح التطبيق في نافذة مستقلة للتثبيت الفوري' : 'Open in a standalone window for 1-tap install'}
            </p>
            <p className="text-[11px] text-purple-300/90">
              {isAr
                ? 'تمنع المتصفحات نافذة التثبيت داخل إطارات المعاينة. اضغط الزر أدناه لفتح التطبيق في متصفحك وتثبيته مباشرة:'
                : 'Browsers block install prompts inside preview iframes. Click below to open in your browser and install directly:'}
            </p>
            <a
              href={browserInstallUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-lg text-xs transition shadow-sm flex items-center justify-center gap-1.5"
            >
              <ExternalLink size={14} />
              <span>{isAr ? 'فتح التطبيق في المتصفح للتثبيت المباشر' : 'Open in Browser to Install'}</span>
            </a>
          </div>
        )}

        {/* خيار تحميل APK الحقيقي عبر PWABuilder */}
        <div className="bg-gray-800 p-4 rounded-xl mb-4 border border-gray-700 shadow-sm">
          <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
            📦 {isAr ? 'تصدير وتحميل حزمة Android APK حقيقية' : 'Build & Download Real Android APK'}
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            {isAr
              ? 'قم بتحميل رابط التطبيق العام مباشرة عبر PWABuilder للحصول على ملف APK موقع وجاهز للتثبيت والمشاركة على هواتف أندرويد.'
              : 'Package the live app with PWABuilder to download a signed Android APK ready to install.'}
          </p>
          <a
            href={pwaBuilderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-lg text-sm transition shadow-sm"
          >
            ⬇️ {isAr ? 'توليد وتحميل حزمة APK عبر PWABuilder' : 'Generate Android APK via PWABuilder'}
          </a>
        </div>

        {/* خيار تثبيت متصفح كروم */}
        <div className="bg-gray-800 p-3.5 rounded-xl mb-3 text-xs text-gray-300 border border-gray-700/50">
          <p className="font-semibold text-white mb-1">📱 {isAr ? 'على هواتف أندرويد (Chrome / Edge)' : 'On Android Phones (Chrome / Edge)'}</p>
          {isAr
            ? 'بعد الفتح في Chrome اضغط قائمة ⋮ ثم اختر «تثبيت التطبيق» لتثبيته كطبيق أندرويد مستقل (WebAPK).'
            : 'Open in Chrome, tap menu ⋮ and select "Install app" to install as a standalone Android WebAPK.'}
        </div>

        {/* خيار تثبيت آيفون */}
        <div className="bg-gray-800 p-3.5 rounded-xl mb-4 text-xs text-gray-300 border border-gray-700/50">
          <p className="font-semibold text-white mb-1">🍎 {isAr ? 'على آيفون وآيباد (iOS Safari)' : 'On iPhone & iPad (iOS Safari)'}</p>
          {isAr
            ? 'افتح الرابط في Safari، اضغط زر المشاركة في الأسفل ثم اختر «إضافة إلى الصفحة الرئيسية».'
            : 'Open in Safari, tap the Share icon in the toolbar, then select "Add to Home Screen".'}
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
