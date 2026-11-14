import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected application error',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('InstaVibe ErrorBoundary caught error:', error, info);
  }

  handleRecover = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // Ignore cleanup errors
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    let isAr = true;
    try {
      isAr = (localStorage.getItem('instavibe_lang') || 'ar') === 'ar';
    } catch {
      isAr = true;
    }

    return (
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6"
      >
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-7 shadow-xl text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <AlertTriangle size={28} />
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              {isAr ? 'حدث خطأ غير متوقع أثناء فتح التطبيق' : 'Something went wrong loading the app'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {isAr
                ? 'قد يكون هناك تحديث جديد في الذاكرة المؤقتة. اضغط أدناه لتحديث التطبيق والبدء فوراً.'
                : 'A cached version mismatch or unexpected error occurred. Tap below to refresh cleanly.'}
            </p>
          </div>
          {this.state.errorMessage && (
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300 break-words">
              {this.state.errorMessage}
            </div>
          )}
          <button
            type="button"
            onClick={this.handleRecover}
            className="w-full py-3 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            <RefreshCw size={16} />
            <span>{isAr ? 'تحديث وفتح التطبيق' : 'Refresh & Reload App'}</span>
          </button>
        </div>
      </div>
    );
  }
}
