import React, { useState, useEffect } from 'react';
import {
  X,
  Flag,
  AlertTriangle,
  ShieldAlert,
  EyeOff,
  UserX,
  CheckCircle2,
  Loader2,
  Info,
  Flame,
  HelpCircle,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFirestore, ReportReason, SubmitReportInput } from '../hooks/useFirestore';
import UserAvatar from './UserAvatar';

export interface ReportTarget {
  type: 'post' | 'profile';
  id: string;
  authorId?: string;
  username?: string;
  photoURL?: string;
  mediaURL?: string;
  summary?: string;
}

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: ReportTarget | null;
  onReportSubmitted?: () => void;
}

interface ReasonOption {
  key: ReportReason;
  labelAr: string;
  labelEn: string;
  descAr: string;
  descEn: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const REPORT_REASONS: ReasonOption[] = [
  {
    key: 'spam',
    labelAr: 'بريد عشوائي أو احتيال',
    labelEn: 'Spam or scam',
    descAr: 'رسائل أو روابط ترويجية مضللة، محاولات احتيال أو تكرار',
    descEn: 'Deceptive ads, phishing links, repetitive or misleading content',
    icon: AlertTriangle,
  },
  {
    key: 'harassment',
    labelAr: 'مضايقة أو تنمر',
    labelEn: 'Harassment or bullying',
    descAr: 'سلوك مسيء موجه ضد شخص معين أو استهداف غير لائق',
    descEn: 'Abusive comments, targeted insults or intimidation',
    icon: UserX,
  },
  {
    key: 'inappropriate',
    labelAr: 'محتوى إباحي أو غير لائق',
    labelEn: 'Inappropriate or adult content',
    descAr: 'صور أو نصوص غير لائقة، عري أو إيحاءات خادشة للحياء',
    descEn: 'Nudity, sexual activity or suggestive adult material',
    icon: EyeOff,
  },
  {
    key: 'hate_speech',
    labelAr: 'خطاب كراهية أو تمييز',
    labelEn: 'Hate speech or discrimination',
    descAr: 'هجوم على أساس العرق أو الدين أو الهوية أو الجنس',
    descEn: 'Attacks or slurs based on race, religion, origin or identity',
    icon: ShieldAlert,
  },
  {
    key: 'violence',
    labelAr: 'عنف أو خطر أو إيذاء النفس',
    labelEn: 'Violence or danger',
    descAr: 'تحريض على العنف أو التهديد بالأذى الجسدي',
    descEn: 'Threats, dangerous organizations or promoting self-harm',
    icon: Flame,
  },
  {
    key: 'misinformation',
    labelAr: 'معلومات مضللة أو كاذبة',
    labelEn: 'False information',
    descAr: 'أخبار زائفة، شائعات خطيرة أو انتحال مصادر موثوقة',
    descEn: 'Fake news, dangerous hoaxes or health misinformation',
    icon: HelpCircle,
  },
  {
    key: 'impersonation',
    labelAr: 'انتحال شخصية أو انتهاك ملكية',
    labelEn: 'Impersonation or copyright',
    descAr: 'التظاهر بأنك شخص آخر أو انتهاك حقوق النشر والتأليف',
    descEn: 'Pretending to be someone else or copyright infringement',
    icon: ShieldAlert,
  },
  {
    key: 'other',
    labelAr: 'سبب آخر',
    labelEn: 'Something else',
    descAr: 'أي مشكلة أخرى لا تندرج تحت الخيارات السابقة',
    descEn: 'An issue that is not covered by the categories above',
    icon: Flag,
  },
];

export default function ReportModal({
  isOpen,
  onClose,
  target,
  onReportSubmitted,
}: ReportModalProps) {
  const { user, profile, language } = useAuth();
  const { submitReport } = useFirestore();

  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedReason(null);
      setDetails('');
      setErrorMsg(null);
      setIsSuccess(false);
    }
  }, [isOpen, target]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen || !target) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrorMsg(language === 'ar' ? 'يرجى تسجيل الدخول لتقديم بلاغ' : 'Please sign in to report');
      return;
    }
    if (!selectedReason) {
      setErrorMsg(language === 'ar' ? 'يرجى اختيار سبب البلاغ' : 'Please select a reason for reporting');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const chosenOption = REPORT_REASONS.find((r) => r.key === selectedReason);
    const reasonLabel = language === 'ar' ? chosenOption?.labelAr : chosenOption?.labelEn;

    try {
      const reportPayload: SubmitReportInput = {
        targetType: target.type,
        targetId: target.id,
        targetAuthorId: target.authorId || undefined,
        targetUsername: target.username || undefined,
        targetSummary: target.summary ? target.summary.slice(0, 500) : undefined,
        reason: selectedReason,
        reasonLabel: reasonLabel || undefined,
        details: details.trim() || undefined,
        reporterUsername: profile?.username || user.displayName || undefined,
      };

      await submitReport(reportPayload);
      setIsSuccess(true);
      onReportSubmitted?.();
    } catch (err: any) {
      console.error('Failed to submit report:', err);
      setErrorMsg(
        language === 'ar'
          ? 'حدث خطأ أثناء إرسال البلاغ. يرجى المحاولة مرة أخرى.'
          : 'Failed to submit report. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isPost = target.type === 'post';

  return (
    <div
      className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={() => !submitting && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      <div
        className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90dvh] pb-safe sm:pb-0 animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <Flag size={16} />
            </div>
            <div>
              <h2 id="report-modal-title" className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                {language === 'ar'
                  ? isPost
                    ? 'إبلاغ عن هذا المنشور'
                    : 'إبلاغ عن هذا الحساب'
                  : isPost
                  ? 'Report Post'
                  : 'Report Profile'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'ar' ? 'بلاغك سري ومحمي لسلامة المجتمع' : 'Your report is anonymous and kept secure'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content body */}
        <div className="overflow-y-auto p-5 space-y-4 no-scrollbar">
          {isSuccess ? (
            /* Success Screen */
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center animate-in zoom-in-75 duration-300">
                <CheckCircle2 size={36} />
              </div>
              <div className="space-y-1.5 max-w-sm mx-auto">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {language === 'ar' ? 'تم استلام بلاغك بنجاح' : 'Report Received'}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {language === 'ar'
                    ? 'شكراً لحرصك على أمان مجتمعنا. سيقوم فريق الإشراف بمراجعة هذا المحتوى واتخاذ الإجراءات المناسبة وفقاً لمعايير المجتمع.'
                    : 'Thank you for helping keep our community safe. Our moderation team will review this report and take appropriate action.'}
                </p>
              </div>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto min-w-[140px] px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition-colors shadow-sm"
                >
                  {language === 'ar' ? 'تم / إغلاق' : 'Done'}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Target info preview badge */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0 border border-slate-200 dark:border-slate-700">
                  {target.mediaURL && isPost ? (
                    <img
                      src={target.mediaURL}
                      alt="thumbnail"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserAvatar
                      src={target.photoURL}
                      username={target.username}
                      iconSize={18}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                      @{target.username || 'user'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {isPost ? (language === 'ar' ? 'منشور' : 'Post') : (language === 'ar' ? 'حساب' : 'Profile')}
                    </span>
                  </div>
                  {target.summary && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                      {target.summary}
                    </p>
                  )}
                </div>
              </div>

              {/* Instruction */}
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  {language === 'ar' ? 'ما سبب إبلاغك عن هذا المحتوى؟' : 'Why are you reporting this content?'}
                </p>

                {/* Reason options */}
                <div className="space-y-2">
                  {REPORT_REASONS.map((opt) => {
                    const isSelected = selectedReason === opt.key;
                    const IconComponent = opt.icon;
                    return (
                      <label
                        key={opt.key}
                        onClick={() => setSelectedReason(opt.key)}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-500 ring-1 ring-purple-500'
                            : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="reportReason"
                          value={opt.key}
                          checked={isSelected}
                          onChange={() => setSelectedReason(opt.key)}
                          className="mt-1 text-purple-600 focus:ring-purple-500 border-slate-300 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <IconComponent
                              size={15}
                              className={isSelected ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}
                            />
                            <span className={`text-xs font-bold leading-tight ${
                              isSelected ? 'text-purple-900 dark:text-purple-200' : 'text-slate-800 dark:text-slate-200'
                            }`}>
                              {language === 'ar' ? opt.labelAr : opt.labelEn}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                            {language === 'ar' ? opt.descAr : opt.descEn}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Optional details textarea */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="report-details" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <FileText size={14} className="text-slate-400" />
                    <span>{language === 'ar' ? 'تفاصيل إضافية (اختياري)' : 'Additional details (optional)'}</span>
                  </label>
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    {details.length}/500
                  </span>
                </div>
                <textarea
                  id="report-details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value.slice(0, 500))}
                  placeholder={
                    language === 'ar'
                      ? 'أضف أي تفاصيل أو سياق لمساعدة فريق الإشراف على اتخاذ القرار الصحيح...'
                      : 'Provide extra context to help moderation review this issue...'
                  }
                  rows={3}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none transition-all"
                />
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Actions footer */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedReason}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>{language === 'ar' ? 'جارٍ الإرسال...' : 'Submitting...'}</span>
                    </>
                  ) : (
                    <>
                      <Flag size={14} />
                      <span>{language === 'ar' ? 'إرسال البلاغ' : 'Submit Report'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
