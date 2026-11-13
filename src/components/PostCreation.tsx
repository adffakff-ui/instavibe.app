import React, { useState, useEffect, useRef } from 'react';
import {
  Image,
  Film,
  X,
  Send,
  Loader2,
  Bookmark,
  Trash2,
  ArrowRight,
  CheckCircle2,
  Edit3,
  Upload,
  Camera,
  Link2,
  Clapperboard,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import { useFirestore } from '../hooks/useFirestore';
import {
  PostDraft,
  getSavedPostDrafts,
  savePostDraft,
  deletePostDraft,
} from '../utils/postDrafts';
import {
  ProcessedMediaResult,
  processGalleryImageFile,
  processGalleryVideoFile,
} from '../utils/mediaProcessor';
import UserAvatar from './UserAvatar';

interface PostCreationProps {
  onClose?: () => void;
  defaultMediaType?: 'image' | 'video';
  mode?: 'post' | 'reel';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PostCreation({
  onClose,
  defaultMediaType = 'image',
  mode = 'post',
}: PostCreationProps) {
  const { profile, language } = useAuth();
  const { createPost, loading } = useFirestore();

  const photoGalleryInputRef = useRef<HTMLInputElement>(null);
  const videoGalleryInputRef = useRef<HTMLInputElement>(null);
  const anyGalleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [savedDrafts, setSavedDrafts] = useState<PostDraft[]>([]);
  const [showDraftsList, setShowDraftsList] = useState<boolean>(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [caption, setCaption] = useState('');
  const [mediaURL, setMediaURL] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>(
    mode === 'reel' ? 'video' : defaultMediaType
  );
  const [inputSource, setInputSource] = useState<'gallery' | 'url'>('gallery');
  const [urlInputValue, setUrlInputValue] = useState('');
  const [mediaMeta, setMediaMeta] = useState<Omit<ProcessedMediaResult, 'dataUrl'> | null>(null);

  const [isProcessingMedia, setIsProcessingMedia] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const isReelContext = mode === 'reel' || mediaType === 'video';

  const refreshDrafts = () => {
    if (!profile) return [];
    const drafts = getSavedPostDrafts(profile.uid);
    setSavedDrafts(drafts);
    return drafts;
  };

  useEffect(() => {
    if (!profile) return;
    refreshDrafts();
  }, [profile]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const showToast = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(null), 3200);
  };

  const loadDraft = (draft: PostDraft) => {
    setActiveDraftId(draft.id);
    setMediaURL(draft.mediaURL);
    setMediaType(mode === 'reel' ? 'video' : draft.mediaType);
    setCaption(draft.caption || '');
    setMediaMeta(null);
    setErrorMessage(null);
    setShowDraftsList(false);
    const timeAgo = formatDistanceToNow(draft.updatedAt, {
      addSuffix: true,
      locale: language === 'ar' ? ar : undefined,
    });
    showToast(language === 'ar' ? `تم استئناف المسودة من ${timeAgo}` : `Resumed draft from ${timeAgo}`);
  };

  const handleSaveDraft = () => {
    if (!profile) return;
    if (!mediaURL.trim() && !caption.trim()) return;

    const saved = savePostDraft({
      id: activeDraftId || undefined,
      userId: profile.uid,
      mediaURL: mediaURL.trim(),
      mediaType,
      caption: caption.trim(),
    });

    if (saved) {
      setActiveDraftId(saved.id);
      refreshDrafts();
      showToast(
        language === 'ar'
          ? 'تم حفظ المسودة بنجاح! يمكنك استكمالها لاحقاً.'
          : 'Draft saved successfully! You can resume editing later.'
      );
    } else {
      setErrorMessage(
        language === 'ar'
          ? 'حجم الوسائط كبير على ذاكرة المسودات المحلية؛ يمكنك نشرها مباشرة.'
          : 'Media is too large for local draft storage; you can publish it directly.'
      );
    }
  };

  const handleDeleteDraftItem = (draftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile) return;
    deletePostDraft(profile.uid, draftId);
    if (activeDraftId === draftId) setActiveDraftId(null);
    refreshDrafts();
  };

  const handleGalleryFile = async (file: File) => {
    setErrorMessage(null);

    if (mode === 'reel' && !file.type.startsWith('video/')) {
      setErrorMessage(
        language === 'ar'
          ? 'يرجى اختيار ملف فيديو من المعرض لنشر ريلز.'
          : 'Please select a video file from your gallery to post a Reel.'
      );
      return;
    }

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setErrorMessage(
        language === 'ar'
          ? 'صيغة الملف غير مدعومة. اختر صورة (JPG, PNG, WebP) أو فيديو (MP4, WebM, MOV).'
          : 'Unsupported file type. Choose an image (JPG, PNG, WebP) or video (MP4, WebM, MOV).'
      );
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsProcessingMedia(true);
    setProcessingProgress(5);

    try {
      if (file.type.startsWith('image/')) {
        const res = await processGalleryImageFile(file, setProcessingProgress);
        if (controller.signal.aborted) return;
        setMediaType('image');
        setMediaURL(res.dataUrl);
        setMediaMeta({
          mediaType: 'image',
          width: res.width,
          height: res.height,
          originalSizeBytes: res.originalSizeBytes,
          finalSizeBytes: res.finalSizeBytes,
          compressed: res.compressed,
        });
      } else {
        const res = await processGalleryVideoFile(file, {
          onProgress: setProcessingProgress,
          signal: controller.signal,
          language,
        });
        if (controller.signal.aborted) return;
        setMediaType('video');
        setMediaURL(res.dataUrl);
        setMediaMeta({
          mediaType: 'video',
          width: res.width,
          height: res.height,
          durationSeconds: res.durationSeconds,
          originalSizeBytes: res.originalSizeBytes,
          finalSizeBytes: res.finalSizeBytes,
          compressed: res.compressed,
        });
      }
    } catch (err: any) {
      if (!controller.signal.aborted) {
        setErrorMessage(
          err?.message ||
            (language === 'ar' ? 'تعذر تجهيز الملف المختار.' : 'Failed to process selected media.')
        );
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsProcessingMedia(false);
      setProcessingProgress(0);
    }
  };

  const handleCancelProcessing = () => {
    abortControllerRef.current?.abort();
    setIsProcessingMedia(false);
    setProcessingProgress(0);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      handleGalleryFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleGalleryFile(file);
    }
  };

  const handleApplyUrl = () => {
    const trimmed = urlInputValue.trim();
    if (!trimmed) return;
    setErrorMessage(null);
    setMediaMeta(null);
    setMediaURL(trimmed);
    if (mode === 'reel' || /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(trimmed)) {
      setMediaType('video');
    }
  };

  const clearMedia = () => {
    setMediaURL('');
    setUrlInputValue('');
    setMediaMeta(null);
    setErrorMessage(null);
  };

  const appendHashtag = (tag: string) => {
    const formatted = `#${tag}`;
    if (caption.includes(formatted)) return;
    setCaption((prev) => (prev.trim() ? `${prev.trim()} ${formatted}` : `${formatted} `));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !mediaURL.trim()) return;
    setErrorMessage(null);

    try {
      await createPost(profile, mediaURL.trim(), mediaType, caption);

      if (activeDraftId) {
        deletePostDraft(profile.uid, activeDraftId);
        setActiveDraftId(null);
        refreshDrafts();
      }

      setCaption('');
      setMediaURL('');
      setUrlInputValue('');
      setMediaMeta(null);
      setMediaType(mode === 'reel' ? 'video' : defaultMediaType);

      if (onClose) {
        onClose();
      } else {
        showToast(
          mediaType === 'video'
            ? language === 'ar'
              ? 'تم نشر الريلز بنجاح في الخلاصة وتبويب ريلز!'
              : 'Reel published to your feed and Reels tab!'
            : language === 'ar'
            ? 'تم نشر المنشور بنجاح!'
            : 'Post published successfully!'
        );
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message?.includes('Missing or insufficient permissions')
          ? language === 'ar'
            ? 'تعذر النشر: تحقق من صلاحيات الحساب أو حجم الملف.'
            : 'Unable to publish: check account permissions or media size.'
          : language === 'ar'
          ? 'حدث خطأ أثناء النشر. يرجى المحاولة مرة أخرى.'
          : 'Failed to publish post. Please try again.'
      );
    }
  };

  const quickTags =
    language === 'ar'
      ? mediaType === 'video'
        ? ['ريلز', 'فيديو', 'إبداع', 'لحظات']
        : ['تصوير', 'يوميات', 'إبداع', 'عدستي']
      : mediaType === 'video'
      ? ['reels', 'video', 'creative', 'vibes']
      : ['photography', 'daily', 'moments', 'vibes'];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xl mb-6">
      {/* Hidden Gallery & Camera Inputs */}
      <input
        ref={photoGalleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />
      <input
        ref={videoGalleryInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileInputChange}
      />
      <input
        ref={anyGalleryInputRef}
        type="file"
        accept={mode === 'reel' ? 'video/*' : 'image/*,video/*'}
        className="hidden"
        onChange={handleFileInputChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept={isReelContext ? 'video/*' : 'image/*'}
        capture="environment"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700">
            <UserAvatar src={profile?.photoURL} username={profile?.username} iconSize={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-900 dark:text-white">
                {profile?.username}
              </span>
              {activeDraftId && (
                <span className="text-[10px] bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-semibold px-2 py-0.5 rounded-full">
                  {language === 'ar' ? 'مسودة' : 'Draft'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {showDraftsList
                ? language === 'ar'
                  ? 'مسودات المنشورات المحفوظة'
                  : 'Saved Post Drafts'
                : mode === 'reel'
                ? language === 'ar'
                  ? 'نشر ريلز من المعرض أو رابط'
                  : 'Post a Reel from gallery or link'
                : language === 'ar'
                ? 'إضافة منشور أو ريلز من المعرض'
                : 'Share a post or Reel from gallery'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {savedDrafts.length > 0 && !showDraftsList && (
            <button
              type="button"
              onClick={() => setShowDraftsList(true)}
              className="px-2.5 py-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-xl transition-colors flex items-center gap-1"
            >
              <Bookmark size={14} />
              <span>
                {language === 'ar' ? `المسودات (${savedDrafts.length})` : `Drafts (${savedDrafts.length})`}
              </span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {statusToast && (
        <div className="mb-4 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
          <span className="flex-1">{statusToast}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-medium flex items-start gap-2">
          <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
          <span className="flex-1">{errorMessage}</span>
        </div>
      )}

      {showDraftsList ? (
        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {language === 'ar'
                ? `مسوداتك المحفوظة (${savedDrafts.length})`
                : `Saved Post Drafts (${savedDrafts.length})`}
            </span>
            <button
              type="button"
              onClick={() => setShowDraftsList(false)}
              className="text-xs text-purple-600 dark:text-purple-400 font-semibold hover:underline"
            >
              {language === 'ar' ? 'العودة للمحرر' : 'Back to Editor'}
            </button>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto">
            {savedDrafts.map((draft) => (
              <div
                key={draft.id}
                onClick={() => loadDraft(draft)}
                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 cursor-pointer transition-all group"
              >
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-black shrink-0 relative">
                  {draft.mediaType === 'video' ? (
                    <div className="w-full h-full flex items-center justify-center bg-slate-900 text-white">
                      <Film size={18} className="text-purple-400" />
                    </div>
                  ) : (
                    <img
                      src={draft.mediaURL}
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {draft.caption || (language === 'ar' ? 'منشور بدون وصف' : 'Untitled post draft')}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {formatDistanceToNow(draft.updatedAt, {
                      addSuffix: true,
                      locale: language === 'ar' ? ar : undefined,
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => handleDeleteDraftItem(draft.id, e)}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                  <ArrowRight
                    size={16}
                    className={`text-purple-600 ${language === 'ar' ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveDraftId(null);
              clearMedia();
              setCaption('');
              setShowDraftsList(false);
            }}
            className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5"
          >
            <Edit3 size={14} />
            {language === 'ar' ? 'بدء منشور جديد فارغ' : 'Start a New Blank Post'}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Caption Box */}
          <div className="space-y-2">
            <textarea
              placeholder={
                isReelContext
                  ? language === 'ar'
                    ? 'أضف وصفاً مشوقاً للريلز أو #وسوماً...'
                    : 'Write a catchy caption or #hashtags for your Reel...'
                  : language === 'ar'
                  ? 'بماذا تفكر؟ أضف وصفاً أو #وسوماً...'
                  : "What's on your mind? Add caption or #tags..."
              }
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-none h-20"
            />
            <div className="flex items-center gap-1.5 flex-wrap">
              {quickTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => appendHashtag(tag)}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-950/40 dark:hover:text-purple-400 transition-colors"
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          {/* Media Type + Source Controls (shown when no media selected yet) */}
          {!mediaURL && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {mode !== 'reel' && (
                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setMediaType('image')}
                      className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                        mediaType === 'image'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Image size={14} />
                      <span>{language === 'ar' ? 'منشور صورة' : 'Photo Post'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMediaType('video')}
                      className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                        mediaType === 'video'
                          ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Clapperboard size={14} />
                      <span>{language === 'ar' ? 'ريلز / فيديو' : 'Reel / Video'}</span>
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl ms-auto">
                  <button
                    type="button"
                    onClick={() => setInputSource('gallery')}
                    className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                      inputSource === 'gallery'
                        ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Upload size={13} />
                    <span>{language === 'ar' ? 'من المعرض' : 'Gallery'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputSource('url')}
                    className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                      inputSource === 'url'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Link2 size={13} />
                    <span>{language === 'ar' ? 'رابط' : 'URL'}</span>
                  </button>
                </div>
              </div>

              {inputSource === 'gallery' ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                  }}
                  onDrop={handleDrop}
                  onClick={() => {
                    if (!isProcessingMedia) {
                      if (mode === 'reel' || mediaType === 'video') {
                        videoGalleryInputRef.current?.click();
                      } else {
                        anyGalleryInputRef.current?.click();
                      }
                    }
                  }}
                  className={`relative border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-purple-500 bg-purple-50/60 dark:bg-purple-950/20 scale-[0.99]'
                      : 'border-slate-200 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-600 bg-slate-50/60 dark:bg-slate-800/40'
                  }`}
                >
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-500 to-rose-500 text-white flex items-center justify-center shadow-md mb-2.5">
                    {isReelContext ? <Clapperboard size={20} /> : <Upload size={20} />}
                  </div>

                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {mode === 'reel' || mediaType === 'video'
                      ? language === 'ar'
                        ? 'اختر فيديو ريلز من المعرض'
                        : 'Pick a Reel video from gallery'
                      : language === 'ar'
                      ? 'اختر صورة أو ريلز من المعرض'
                      : 'Choose a photo or Reel from gallery'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 mb-3.5 max-w-xs">
                    {language === 'ar'
                      ? 'اسحب الملف وأفلته هنا — يتم ضغط الصور والفيديوهات القصيرة تلقائياً للنشر السريع.'
                      : 'Drag and drop a file here — photos and short videos are optimized automatically.'}
                  </p>

                  <div
                    className="flex flex-wrap items-center justify-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {mode !== 'reel' && (
                      <button
                        type="button"
                        onClick={() => photoGalleryInputRef.current?.click()}
                        className="min-h-[38px] px-3.5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm active:scale-95"
                      >
                        <Image size={14} />
                        <span>{language === 'ar' ? 'صورة من المعرض' : 'Photo from Gallery'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => videoGalleryInputRef.current?.click()}
                      className={`min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 ${
                        mode === 'reel' || mediaType === 'video'
                          ? 'bg-gradient-to-r from-rose-600 to-purple-600 text-white hover:opacity-95'
                          : 'bg-purple-600 hover:bg-purple-700 text-white'
                      }`}
                    >
                      <Clapperboard size={14} />
                      <span>{language === 'ar' ? 'ريلز من المعرض' : 'Reel from Gallery'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="min-h-[38px] px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 active:scale-95"
                    >
                      <Camera size={14} />
                      <span>{language === 'ar' ? 'الكاميرا' : 'Camera'}</span>
                    </button>
                  </div>

                  {isProcessingMedia && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 rounded-2xl flex flex-col items-center justify-center p-4 backdrop-blur-sm z-10 space-y-3"
                    >
                      <Loader2 size={28} className="animate-spin text-purple-600" />
                      <div className="w-full max-w-xs space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                          <span>
                            {mediaType === 'video'
                              ? language === 'ar'
                                ? 'جاري تجهيز وضغط فيديو الريلز...'
                                : 'Optimizing Reel video...'
                              : language === 'ar'
                              ? 'جاري تجهيز الصورة...'
                              : 'Optimizing photo...'}
                          </span>
                          <span className="tabular-nums text-purple-600 dark:text-purple-400">
                            {processingProgress}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-600 to-rose-500 transition-all duration-200"
                            style={{ width: `${Math.max(8, processingProgress)}%` }}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleCancelProcessing}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-600 transition-colors"
                      >
                        {language === 'ar' ? 'إلغاء' : 'Cancel'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="url"
                      placeholder={
                        mediaType === 'video'
                          ? language === 'ar'
                            ? 'الصق رابط الفيديو (MP4 / WebM)...'
                            : 'Paste video URL (MP4 / WebM)...'
                          : language === 'ar'
                          ? 'الصق رابط الصورة هنا...'
                          : 'Paste image URL here...'
                      }
                      value={urlInputValue}
                      onChange={(e) => setUrlInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyUrl();
                        }
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl py-2.5 pe-4 ps-10 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    />
                    {mediaType === 'video' ? (
                      <Film className="absolute start-3 top-2.5 text-slate-400" size={18} />
                    ) : (
                      <Image className="absolute start-3 top-2.5 text-slate-400" size={18} />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyUrl}
                    disabled={!urlInputValue.trim()}
                    className="min-h-[40px] px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold disabled:opacity-40 whitespace-nowrap"
                  >
                    {language === 'ar' ? 'معاينة' : 'Preview'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Selected Media Preview */}
          {mediaURL && (
            <div className="space-y-2.5">
              <div
                className={`rounded-2xl overflow-hidden bg-slate-950 relative border border-slate-200 dark:border-slate-800 ${
                  mediaType === 'video'
                    ? 'aspect-[9/16] max-h-[380px] max-w-[235px] mx-auto shadow-lg'
                    : 'aspect-video max-h-[360px] w-full'
                }`}
              >
                {mediaType === 'video' ? (
                  <video
                    src={mediaURL}
                    controls
                    muted
                    autoPlay
                    loop
                    playsInline
                    className="w-full h-full object-cover bg-black"
                  />
                ) : (
                  <img
                    src={mediaURL}
                    alt={language === 'ar' ? 'معاينة المنشور' : 'Post preview'}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                )}

                <div className="absolute top-2.5 start-2.5 flex items-center gap-1.5 pointer-events-none">
                  <span className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[10px] font-bold flex items-center gap-1 border border-white/15">
                    {mediaType === 'video' ? (
                      <>
                        <Clapperboard size={11} className="text-rose-400" />
                        <span>{language === 'ar' ? 'ريلز' : 'Reel'}</span>
                      </>
                    ) : (
                      <>
                        <Image size={11} className="text-purple-300" />
                        <span>{language === 'ar' ? 'صورة' : 'Photo'}</span>
                      </>
                    )}
                    {mediaMeta?.durationSeconds ? (
                      <span className="opacity-80 tabular-nums">
                        • {Math.max(1, Math.round(mediaMeta.durationSeconds))}s
                      </span>
                    ) : null}
                    {mediaMeta?.finalSizeBytes ? (
                      <span className="opacity-80 tabular-nums">
                        • {formatBytes(mediaMeta.finalSizeBytes)}
                      </span>
                    ) : null}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={clearMedia}
                  aria-label={language === 'ar' ? 'إزالة الوسائط' : 'Remove media'}
                  className="absolute top-2.5 end-2.5 w-8 h-8 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center transition-colors shadow-md"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  {mediaType === 'video'
                    ? language === 'ar'
                      ? 'سيظهر هذا الريلز في الخلاصة وتبويب ريلز تلقائياً.'
                      : 'This video will appear in both your Feed and Reels tab.'
                    : language === 'ar'
                    ? 'الصورة جاهزة للنشر في خلاصة المنشورات.'
                    : 'Photo is ready to publish to your feed.'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (mediaType === 'video') {
                      videoGalleryInputRef.current?.click();
                    } else {
                      photoGalleryInputRef.current?.click();
                    }
                  }}
                  className="text-purple-600 dark:text-purple-400 font-bold hover:underline flex items-center gap-1 shrink-0"
                >
                  <RefreshCw size={12} />
                  <span>{language === 'ar' ? 'تغيير من المعرض' : 'Replace from gallery'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isProcessingMedia || (!mediaURL.trim() && !caption.trim())}
              className="px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-40"
            >
              <Bookmark size={16} />
              <span>{language === 'ar' ? 'حفظ كمسودة' : 'Save as Draft'}</span>
            </button>

            <button
              type="submit"
              disabled={loading || isProcessingMedia || !mediaURL.trim()}
              className="flex-1 bg-gradient-to-r from-purple-600 to-rose-600 hover:opacity-95 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-md shadow-purple-500/20"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : mediaType === 'video' ? (
                <Clapperboard size={17} />
              ) : (
                <Send size={17} />
              )}
              <span>
                {mediaType === 'video'
                  ? language === 'ar'
                    ? 'نشر الريلز'
                    : 'Publish Reel'
                  : language === 'ar'
                  ? 'نشر المنشور'
                  : 'Share Post'}
              </span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
