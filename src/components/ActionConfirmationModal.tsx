import React, { useEffect } from 'react';
import { Ban, ShieldAlert, Loader2, X, AlertTriangle, MessageSquareOff, EyeOff, UserX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import UserAvatar from './UserAvatar';

export interface ActionConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  targetUsername?: string;
  targetPhotoURL?: string;
  type?: 'block' | 'destructive' | 'warning';
  confirmLabel?: string;
  cancelLabel?: string;
  isProcessing?: boolean;
}

export default function ActionConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  targetUsername,
  targetPhotoURL,
  type = 'block',
  confirmLabel,
  cancelLabel,
  isProcessing = false,
}: ActionConfirmationModalProps) {
  const { language } = useAuth();

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  const defaultTitle = type === 'block'
    ? (targetUsername
        ? (language === 'ar' ? `حظر @${targetUsername}؟` : `Block @${targetUsername}?`)
        : (language === 'ar' ? 'تأكيد الحظر' : 'Block User'))
    : (language === 'ar' ? 'تأكيد الإجراء' : 'Confirm Action');

  const defaultConfirmLabel = confirmLabel || (type === 'block'
    ? (language === 'ar' ? 'تأكيد الحظر' : 'Block')
    : (language === 'ar' ? 'تأكيد' : 'Confirm'));

  const defaultCancelLabel = cancelLabel || (language === 'ar' ? 'إلغاء' : 'Cancel');

  return (
    <div
      className="fixed inset-0 z-[140] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={() => {
        if (!isProcessing) onClose();
      }}
    >
      <div
        className="w-full max-w-sm sm:max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Row with Icon & Close Button */}
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shadow-sm">
            {type === 'block' ? <Ban size={24} /> : <AlertTriangle size={24} />}
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Target User Preview (if provided) */}
        {targetUsername && (
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
            <div className="w-11 h-11 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800">
              <UserAvatar
                src={targetPhotoURL}
                username={targetUsername}
                iconSize={18}
              />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                @{targetUsername}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {language === 'ar' ? 'حساب المستخدم المراد حظره' : 'Target account to block'}
              </p>
            </div>
          </div>
        )}

        {/* Title & Explanatory Warning Content */}
        <div className="space-y-3">
          <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
            {title || defaultTitle}
          </h3>

          {description ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {description}
            </p>
          ) : (
            <div className="space-y-2.5 pt-1 text-xs text-slate-600 dark:text-slate-300">
              <p className="font-medium text-slate-700 dark:text-slate-200">
                {language === 'ar'
                  ? 'عند حظر هذا المستخدم، ستحدث التأثيرات التالية تلقائياً:'
                  : 'Blocking this user will immediately apply the following restrictions:'}
              </p>
              
              <ul className="space-y-2 bg-red-50/60 dark:bg-red-950/20 p-3.5 rounded-2xl border border-red-200/60 dark:border-red-900/40">
                <li className="flex items-start gap-2.5">
                  <MessageSquareOff size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <span>
                    {language === 'ar'
                      ? 'إخفاؤهم وإزالتهم فوراً من نظام المحادثات والرسائل المباشرة النشطة.'
                      : 'Hides and removes them from active conversations in the messaging system.'}
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <EyeOff size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <span>
                    {language === 'ar'
                      ? 'تقييد التفاعل؛ لن يتمكنوا من رؤية ملفك الشخصي أو قصصك أو منشوراتك.'
                      : 'Restricts interaction; they will not be able to find your profile, stories, or posts.'}
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <UserX size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <span>
                    {language === 'ar'
                      ? 'إلغاء المتابعة المتبادلة تلقائياً بين كلا الحسابين.'
                      : 'Automatically severs any following/follower connections between both accounts.'}
                  </span>
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Action Buttons Row */}
        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            disabled={isProcessing}
            onClick={onClose}
            className="flex-1 min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {defaultCancelLabel}
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={onConfirm}
            className="flex-1 min-h-[44px] rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-red-600/20 disabled:opacity-50"
          >
            {isProcessing && <Loader2 size={15} className="animate-spin" />}
            <span>{defaultConfirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
