import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  X, 
  Upload, 
  Camera, 
  Film, 
  Image as ImageIcon, 
  Send, 
  Loader2, 
  Sparkles, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  Smile,
  Bookmark,
  Trash2,
  ArrowRight,
  Edit3,
  Sun,
  Sliders,
  SlidersHorizontal,
  RotateCcw,
  Palette,
  Eye,
  BarChart2,
  Check
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import { useFirestore } from '../hooks/useFirestore';
import { 
  StoryDraft, 
  getSavedStoryDrafts, 
  saveStoryDraft, 
  deleteStoryDraft 
} from '../utils/storyDrafts';

interface StoryCreationProps {
  onClose: () => void;
  onSuccess?: () => void;
  initialDraftId?: string;
}

const FILTER_PRESETS = [
  { id: 'none', name: 'Normal', nameAr: 'عادي', css: '' },
  { id: 'bw', name: 'Monochrome', nameAr: 'أبيض وأسود', css: 'grayscale(100%) contrast(115%)' },
  { id: 'bright', name: 'Brighten', nameAr: 'ساطع', css: 'brightness(120%) contrast(105%)' },
  { id: 'warm', name: 'Warm Sunset', nameAr: 'دافئ', css: 'sepia(25%) saturate(135%) brightness(105%)' },
  { id: 'cinematic', name: 'Cinematic', nameAr: 'سينمائي', css: 'contrast(125%) saturate(120%)' },
  { id: 'vintage', name: 'Vintage', nameAr: 'كلاسيكي', css: 'sepia(40%) contrast(110%) brightness(95%)' },
  { id: 'vibrant', name: 'Vibrant Pop', nameAr: 'ألوان حيوية', css: 'saturate(160%) contrast(110%)' },
];

const SAMPLE_STORIES = [
  {
    title: 'Sunset Sky',
    titleAr: 'سماء الغروب',
    type: 'image' as const,
    url: '/src/assets/images/story_sunset_1794501562415.jpg',
    caption: 'Golden hour bliss ✨🌅',
    captionAr: 'جمال لحظات الغروب الذهبية ✨🌅',
    category: 'Photo'
  },
  {
    title: 'Coffee Moment',
    titleAr: 'لحظة قهوة',
    type: 'image' as const,
    url: '/src/assets/images/story_coffee_1794501561737.jpg',
    caption: 'Morning brew fuels the soul ☕️🤎',
    captionAr: 'قهوة الصباح تعدل المزاج ☕️🤎',
    category: 'Photo'
  },
  {
    title: 'City Lights',
    titleAr: 'أضواء المدينة',
    type: 'image' as const,
    url: '/src/assets/images/city_night_1794501562076.jpg',
    caption: 'Neon nights in the metropolis 🌃💫',
    captionAr: 'أجواء المدينة الساحرة ليلاً 🌃💫',
    category: 'Photo'
  },
  {
    title: 'Beach Waves',
    titleAr: 'أمواج الشاطئ',
    type: 'image' as const,
    url: '/src/assets/images/beach_lifestyle_1794501561335.jpg',
    caption: 'Salt in the air, sand in my hair 🌊🌴',
    captionAr: 'نسيم البحر وهدوء الشاطئ 🌊🌴',
    category: 'Photo'
  },
  {
    title: 'Ocean Swell',
    titleAr: 'موج البحر',
    type: 'video' as const,
    url: 'https://assets.mixkit.co/videos/preview/mixkit-vertical-view-of-waves-on-a-beach-43187-large.mp4',
    caption: 'Calm ocean tides soothing the mind 🌊🎧',
    captionAr: 'هدوء الأمواج يريح البال 🌊🎧',
    category: 'Video Clip'
  }
];

const EMOJI_SHORTCUTS = ['🔥', '✨', '🌊', '☕', '❤️', '🎉', '🌴', '💫'];

export default function StoryCreation({ onClose, onSuccess, initialDraftId }: StoryCreationProps) {
  const { profile, language } = useAuth();
  const { createStory, loading } = useFirestore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [activeDraftId, setActiveDraftId] = useState<string | null>(initialDraftId || null);
  const [savedDrafts, setSavedDrafts] = useState<StoryDraft[]>([]);
  const [showDraftsList, setShowDraftsList] = useState<boolean>(false);
  const [showExitPrompt, setShowExitPrompt] = useState<boolean>(false);
  const [draftToast, setDraftToast] = useState<string | null>(null);

  const [rawSourceUrl, setRawSourceUrl] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState<string>('');

  // CSS Filter Adjustments State
  const [selectedFilter, setSelectedFilter] = useState<string>('none');
  const [brightness, setBrightness] = useState<number>(100); // 50% - 150%
  const [contrast, setContrast] = useState<number>(100); // 60% - 140%
  const [isMonochrome, setIsMonochrome] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<'presets' | 'adjust'>('presets');

  // Poll Sticker State
  const [pollQuestion, setPollQuestion] = useState<string>('');
  const [pollOptionA, setPollOptionA] = useState<string>(language === 'ar' ? 'نعم' : 'Yes');
  const [pollOptionB, setPollOptionB] = useState<string>(language === 'ar' ? 'لا' : 'No');
  const [showPollBuilder, setShowPollBuilder] = useState<boolean>(false);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [showUrlField, setShowUrlField] = useState<boolean>(false);

  // Compute 24-hour expiration time notice
  const [expiryFormatted, setExpiryFormatted] = useState<string>('');

  useEffect(() => {
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    setExpiryFormatted(
      expires.toLocaleDateString(undefined, { 
        weekday: 'short', 
        hour: 'numeric', 
        minute: '2-digit' 
      })
    );
  }, []);

  // Compute live CSS filter string
  const activeFilterCss = useMemo(() => {
    const parts: string[] = [];

    if (isMonochrome || selectedFilter === 'bw') {
      parts.push('grayscale(100%)');
    }
    if (brightness !== 100) {
      parts.push(`brightness(${brightness}%)`);
    }
    if (contrast !== 100) {
      parts.push(`contrast(${contrast}%)`);
    }

    const preset = FILTER_PRESETS.find(f => f.id === selectedFilter);
    if (preset && preset.css && preset.id !== 'bw') {
      parts.push(preset.css);
    }

    return parts.length > 0 ? parts.join(' ') : 'none';
  }, [isMonochrome, brightness, contrast, selectedFilter]);

  const hasFilterAdjustments = isMonochrome || brightness !== 100 || contrast !== 100 || selectedFilter !== 'none';

  // Load saved drafts on mount
  const refreshDrafts = () => {
    if (!profile) return;
    const drafts = getSavedStoryDrafts(profile.uid);
    setSavedDrafts(drafts);
    return drafts;
  };

  useEffect(() => {
    if (!profile) return;
    const drafts = refreshDrafts();

    // If an initialDraftId was passed, load it directly
    if (initialDraftId && drafts) {
      const match = drafts.find((d) => d.id === initialDraftId);
      if (match) {
        loadDraft(match);
      }
    }
  }, [profile, initialDraftId]);

  const loadDraft = (draft: StoryDraft) => {
    setActiveDraftId(draft.id);
    setRawSourceUrl(draft.rawSourceUrl || draft.mediaURL);
    setPreviewUrl(draft.mediaURL);
    setMediaType(draft.mediaType);
    setCaption(draft.caption || '');
    setSelectedFilter(draft.selectedFilter || 'none');
    setBrightness(typeof draft.brightness === 'number' ? draft.brightness : 100);
    setContrast(typeof draft.contrast === 'number' ? draft.contrast : 100);
    setIsMonochrome(Boolean(draft.isMonochrome || draft.selectedFilter === 'bw'));
    setPollQuestion(draft.poll?.question || '');
    setPollOptionA(draft.poll?.optionA || (language === 'ar' ? 'نعم' : 'Yes'));
    setPollOptionB(draft.poll?.optionB || (language === 'ar' ? 'لا' : 'No'));
    setShowPollBuilder(Boolean(draft.poll?.question));
    setShowDraftsList(false);
    const timeAgo = formatDistanceToNow(draft.updatedAt, { addSuffix: true, locale: language === 'ar' ? ar : undefined });
    setDraftToast(language === 'ar' ? `تم استئناف المسودة من ${timeAgo}` : `Resumed draft from ${timeAgo}`);
    setTimeout(() => setDraftToast(null), 3000);
  };

  // Compress image on canvas with chosen CSS filter baked into pixels
  const compressImage = (sourceUrl: string, filterCss: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const MAX_WIDTH = 1080;
        const MAX_HEIGHT = 1920;
        let { width, height } = img;

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        if (filterCss && filterCss !== 'none') {
          ctx.filter = filterCss;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
        resolve(compressedBase64);
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = sourceUrl;
    });
  };

  const handleFile = async (file: File) => {
    setErrorMessage(null);
    setIsProcessing(true);
    setUploadProgress(25);

    try {
      if (file.type.startsWith('image/')) {
        setMediaType('image');
        const reader = new FileReader();
        reader.onload = async (e) => {
          setUploadProgress(60);
          const rawUrl = e.target?.result as string;
          setRawSourceUrl(rawUrl);
          setPreviewUrl(rawUrl);
          setUploadProgress(100);
          setIsProcessing(false);
        };
        reader.readAsDataURL(file);
      } else if (file.type.startsWith('video/')) {
        setMediaType('video');
        if (file.size > 650 * 1024) {
          setErrorMessage(
            language === 'ar'
              ? `حجم الفيديو (${(file.size / (1024 * 1024)).toFixed(1)} ميجابايت) يتجاوز الحد الأقصى المسموح به (650 كيلوبايت). يرجى اختيار مقطع قصير أو أحد المقاطع الجاهزة.`
              : `Video file size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 650 KB limit for inline base64 storage. Please upload a short 3-5s clip, or select a sample clip below!`
          );
          setIsProcessing(false);
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          setUploadProgress(100);
          const dataUrl = e.target?.result as string;
          if (dataUrl.length > 890000) {
            setErrorMessage(
              language === 'ar'
                ? 'حجم بيانات الفيديو يتجاوز الحد الأقصى للتخزين. يرجى اختيار مقطع أصغر.'
                : 'Video data exceeds maximum storage packet. Please choose a smaller clip.'
            );
            setIsProcessing(false);
            return;
          }
          setRawSourceUrl(dataUrl);
          setPreviewUrl(dataUrl);
          setIsProcessing(false);
        };
        reader.readAsDataURL(file);
      } else {
        setErrorMessage(
          language === 'ar'
            ? 'صيغة الملف غير مدعومة. يرجى اختيار صورة (JPG, PNG, WebP) أو فيديو قصير (MP4, WebM).'
            : 'Unsupported file format. Please select a photo (JPG, PNG, WebP) or video clip (MP4, WebM).'
        );
        setIsProcessing(false);
      }
    } catch (err: any) {
      console.error('File read error:', err);
      setErrorMessage(err.message || (language === 'ar' ? 'حدث خطأ أثناء معالجة الملف المختار' : 'Error processing selected file'));
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleSelectSample = (sample: typeof SAMPLE_STORIES[0]) => {
    setErrorMessage(null);
    setMediaType(sample.type);
    setRawSourceUrl(sample.url);
    setPreviewUrl(sample.url);
    setCaption(language === 'ar' ? sample.captionAr : sample.caption);
    handleResetFilters();
  };

  const handleCustomUrlApply = () => {
    if (!customUrlInput.trim()) return;
    const url = customUrlInput.trim();
    const isVideo = url.endsWith('.mp4') || url.endsWith('.webm') || url.includes('video');
    setMediaType(isVideo ? 'video' : 'image');
    setRawSourceUrl(url);
    setPreviewUrl(url);
    setShowUrlField(false);
  };

  const handleAddEmoji = (emoji: string) => {
    setCaption((prev) => (prev ? `${prev} ${emoji}` : emoji));
  };

  const handleResetFilters = () => {
    setSelectedFilter('none');
    setBrightness(100);
    setContrast(100);
    setIsMonochrome(false);
  };

  const handleSelectPreset = (presetId: string) => {
    setSelectedFilter(presetId);
    if (presetId === 'bw') {
      setIsMonochrome(true);
    } else if (presetId === 'none') {
      handleResetFilters();
    } else if (presetId === 'bright') {
      setBrightness(120);
      setIsMonochrome(false);
    }
  };

  // Save story as draft
  const handleSaveDraft = (closeAfterSave: boolean = false) => {
    if (!profile) return;
    if (!previewUrl && !caption.trim()) {
      setErrorMessage(language === 'ar' ? 'لا يوجد محتوى لحفظه كمسودة بعد' : 'Nothing to save as a draft yet');
      return;
    }

    const saved = saveStoryDraft({
      id: activeDraftId || undefined,
      userId: profile.uid,
      mediaURL: previewUrl,
      rawSourceUrl,
      mediaType,
      caption,
      selectedFilter,
      brightness,
      contrast,
      isMonochrome,
      poll: showPollBuilder && pollQuestion.trim() ? {
        question: pollQuestion.trim(),
        optionA: pollOptionA.trim() || (language === 'ar' ? 'نعم' : 'Yes'),
        optionB: pollOptionB.trim() || (language === 'ar' ? 'لا' : 'No'),
        votesA: 0,
        votesB: 0,
        voters: {}
      } : undefined,
    });

    if (saved) {
      setActiveDraftId(saved.id);
      refreshDrafts();
      setDraftToast(
        language === 'ar'
          ? 'تم حفظ المسودة! يمكنك إكمالها ونشرها لاحقاً.'
          : 'Story draft saved! You can finish and post it anytime.'
      );
      setTimeout(() => setDraftToast(null), 3000);

      if (closeAfterSave) {
        setShowExitPrompt(false);
        onClose();
      }
    } else {
      setErrorMessage(language === 'ar' ? 'تعذر حفظ المسودة' : 'Failed to save draft to storage');
    }
  };

  // Intercept close button if user has unsaved edits
  const handleAttemptClose = () => {
    const hasUnsavedWork = Boolean(previewUrl.trim() || caption.trim() || pollQuestion.trim());
    if (hasUnsavedWork) {
      setShowExitPrompt(true);
    } else {
      onClose();
    }
  };

  const handleDeleteDraftItem = (draftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile) return;
    deleteStoryDraft(profile.uid, draftId);
    if (activeDraftId === draftId) {
      setActiveDraftId(null);
    }
    refreshDrafts();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      setErrorMessage(language === 'ar' ? 'يجب تسجيل الدخول لنشر قصة' : 'You must be signed in to post a story');
      return;
    }
    if (!previewUrl) {
      setErrorMessage(language === 'ar' ? 'يرجى اختيار أو رفع صورة أو فيديو لقصتك' : 'Please select or upload a photo or video for your story');
      return;
    }

    try {
      setErrorMessage(null);
      setIsProcessing(true);

      let finalMediaUrl = previewUrl;

      if (mediaType === 'image') {
        const sourceToCompress = rawSourceUrl || previewUrl;
        const bakedDataUrl = await compressImage(sourceToCompress, activeFilterCss);
        finalMediaUrl = bakedDataUrl;
      }

      const pollData = showPollBuilder && pollQuestion.trim() ? {
        question: pollQuestion.trim(),
        optionA: pollOptionA.trim() || (language === 'ar' ? 'نعم' : 'Yes'),
        optionB: pollOptionB.trim() || (language === 'ar' ? 'لا' : 'No')
      } : undefined;

      await createStory(profile, finalMediaUrl, mediaType, caption, pollData);
      
      if (activeDraftId) {
        deleteStoryDraft(profile.uid, activeDraftId);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Story upload failed:', err);
      setErrorMessage(err.message || (language === 'ar' ? 'فشل نشر القصة. يرجى المحاولة مرة أخرى.' : 'Failed to create story. Please try again.'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 text-white">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {showDraftsList
                    ? (language === 'ar' ? 'مسودات القصص المحفوظة' : 'Saved Story Drafts')
                    : activeDraftId
                    ? (language === 'ar' ? 'تعديل مسودة القصة' : 'Edit Story Draft')
                    : (language === 'ar' ? 'إنشاء قصة' : 'Create Story')}
                </h3>
                {activeDraftId && !showDraftsList && (
                  <span className="text-[10px] bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-semibold px-2 py-0.5 rounded-full">
                    {language === 'ar' ? 'مسودة' : 'Draft'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <Clock size={11} className="text-amber-500" />
                {language === 'ar' ? 'تستمر لمدة 24 ساعة بعد النشر' : 'Active for 24 hours once posted'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {savedDrafts.length > 0 && !showDraftsList && (
              <button
                type="button"
                onClick={() => setShowDraftsList(true)}
                className="px-2.5 py-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-xl transition-colors flex items-center gap-1"
                title={language === 'ar' ? 'عرض المسودات المحفوظة' : 'View your saved drafts'}
              >
                <Bookmark size={14} />
                <span>{language === 'ar' ? `المسودات (${savedDrafts.length})` : `Drafts (${savedDrafts.length})`}</span>
              </button>
            )}

            <button 
              type="button"
              onClick={handleAttemptClose} 
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              aria-label="Close story creator"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Hidden inputs for Device and Camera */}
        <input 
          ref={fileInputRef}
          type="file" 
          accept="image/*,video/*"
          className="hidden" 
          onChange={handleFileSelect} 
        />
        <input 
          ref={cameraInputRef}
          type="file" 
          accept="image/*"
          capture="environment"
          className="hidden" 
          onChange={handleFileSelect} 
        />

        {/* Toast / Draft Notification Banner */}
        {draftToast && (
          <div className="mx-6 mt-4 p-2.5 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-xl text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 size={16} className="text-green-500 shrink-0" />
            <span className="flex-1">{draftToast}</span>
          </div>
        )}

        {/* SAVED DRAFTS DRAWER / VIEW */}
        {showDraftsList ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {language === 'ar'
                  ? `مسوداتك المحفوظة (${savedDrafts.length})`
                  : `Your Saved In-Progress Stories (${savedDrafts.length})`}
              </span>
              <button
                type="button"
                onClick={() => setShowDraftsList(false)}
                className="text-xs text-purple-600 dark:text-purple-400 font-semibold hover:underline"
              >
                {language === 'ar' ? 'العودة للمحرر' : 'Back to Editor'}
              </button>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pe-1">
              {savedDrafts.map((draft) => (
                <div
                  key={draft.id}
                  onClick={() => loadDraft(draft)}
                  className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 cursor-pointer transition-all group"
                >
                  <div className="w-14 h-20 rounded-xl overflow-hidden bg-black shrink-0 relative ring-1 ring-slate-300 dark:ring-slate-700">
                    {draft.mediaType === 'video' ? (
                      <div className="w-full h-full flex items-center justify-center bg-slate-900 text-white">
                        <Film size={20} className="text-purple-400" />
                      </div>
                    ) : (
                      <img 
                        src={draft.mediaURL} 
                        alt="Draft thumbnail" 
                        className="w-full h-full object-cover" 
                      />
                    )}
                    <span className="absolute bottom-1 end-1 text-[8px] bg-black/70 text-white px-1 rounded uppercase font-mono">
                      {draft.mediaType === 'video' ? 'VID' : 'IMG'}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {draft.caption || draft.poll?.question || (language === 'ar' ? 'مسودة قصة بدون عنوان' : 'Untitled story draft')}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {language === 'ar' ? 'حُفظت' : 'Saved'}{' '}
                      {formatDistanceToNow(draft.updatedAt, { addSuffix: true, locale: language === 'ar' ? ar : undefined })}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {draft.isMonochrome && (
                        <span className="text-[9px] bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-1.5 py-0.5 rounded font-mono">
                          B&W
                        </span>
                      )}
                      {draft.poll?.question && (
                        <span className="text-[9px] bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded font-medium">
                          {language === 'ar' ? '📊 ملصق استطلاع' : '📊 Poll Sticker'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleDeleteDraftItem(draft.id, e)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
                      title={language === 'ar' ? 'حذف المسودة' : 'Delete draft'}
                    >
                      <Trash2 size={16} />
                    </button>
                    <div className="p-2 text-purple-600 dark:text-purple-400 rounded-xl group-hover:translate-x-0.5 transition-transform">
                      <ArrowRight size={16} className={language === 'ar' ? 'rotate-180' : ''} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveDraftId(null);
                setPreviewUrl('');
                setRawSourceUrl('');
                setCaption('');
                setPollQuestion('');
                setShowPollBuilder(false);
                handleResetFilters();
                setShowDraftsList(false);
              }}
              className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <Edit3 size={14} />
              {language === 'ar' ? 'بدء قصة جديدة فارغة' : 'Start a New Blank Story'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {errorMessage && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div className="flex-1">{errorMessage}</div>
              </div>
            )}

            {!previewUrl ? (
              <div className="space-y-4">
                {savedDrafts.length > 0 && (
                  <div className="p-3.5 bg-gradient-to-r from-purple-50 via-pink-50 to-amber-50 dark:from-purple-950/30 dark:via-pink-950/20 dark:to-amber-950/20 border border-purple-200/80 dark:border-purple-800/50 rounded-2xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <Bookmark size={18} />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {language === 'ar'
                            ? `لديك ${savedDrafts.length} مسودة قصة محفوظة`
                            : `You have ${savedDrafts.length} saved story ${savedDrafts.length === 1 ? 'draft' : 'drafts'}`}
                        </h5>
                        <p className="text-[11px] text-slate-500">
                          {language === 'ar' ? 'أكمل من حيث توقفت' : 'Pick up right where you left off'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => loadDraft(savedDrafts[0])}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 shadow-sm active:scale-95 shrink-0"
                    >
                      {language === 'ar' ? 'استئناف' : 'Resume Latest'}
                    </button>
                  </div>
                )}

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
                    isDragging 
                      ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/20 scale-[0.99]' 
                      : 'border-slate-200 dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 text-white flex items-center justify-center shadow-md">
                      <Upload size={22} />
                    </div>
                  </div>

                  <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm mb-1">
                    {language === 'ar' ? 'ارفع صورة أو مقطع فيديو قصير' : 'Upload Photo or Short Video Clip'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mb-4">
                    {language === 'ar'
                      ? 'اسحب الملف وأفلته هنا، أو انقر للاختيار من جهازك'
                      : 'Drag and drop media from your device, or click to browse files'}
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <ImageIcon size={15} />
                      {language === 'ar' ? 'اختيار ملف' : 'Choose File'}
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 active:scale-95"
                    >
                      <Camera size={15} />
                      {language === 'ar' ? 'التقاط صورة' : 'Take Photo'}
                    </button>
                  </div>

                  {isProcessing && (
                    <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 rounded-2xl flex flex-col items-center justify-center backdrop-blur-sm z-10">
                      <Loader2 size={28} className="animate-spin text-purple-600 mb-2" />
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300 tabular-nums">
                        {language === 'ar'
                          ? `جاري تجهيز الوسائط للقصة (${uploadProgress}%)...`
                          : `Optimizing media for 24h story (${uploadProgress}%)...`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Sample Inspiration Presets */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {language === 'ar' ? 'أو اختر قصة تجريبية جاهزة' : 'Or select a sample story'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowUrlField(!showUrlField)}
                      className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium"
                    >
                      {showUrlField
                        ? (language === 'ar' ? 'إخفاء حقل الرابط' : 'Hide URL link')
                        : (language === 'ar' ? 'لصق رابط من الويب' : 'Paste web URL')}
                    </button>
                  </div>

                  {showUrlField && (
                    <div className="flex gap-2 mb-3">
                      <input
                        type="url"
                        placeholder={language === 'ar' ? 'الصق رابط صورة أو فيديو mp4...' : 'Paste image or mp4 video URL...'}
                        value={customUrlInput}
                        onChange={(e) => setCustomUrlInput(e.target.value)}
                        className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <button
                        type="button"
                        onClick={handleCustomUrlApply}
                        className="px-3 py-2 bg-purple-600 text-white rounded-xl text-xs font-semibold hover:bg-purple-700"
                      >
                        {language === 'ar' ? 'استخدام' : 'Use'}
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-5 gap-2">
                    {SAMPLE_STORIES.map((sample, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectSample(sample)}
                        className="group relative flex flex-col items-center p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all text-start"
                      >
                        <div className="w-full aspect-[9/16] rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 relative ring-1 ring-slate-200 dark:ring-slate-700 group-hover:ring-purple-500 transition-all">
                          {sample.type === 'video' ? (
                            <div className="w-full h-full bg-slate-800 flex items-center justify-center text-white relative">
                              <Film size={18} className="text-purple-400" />
                              <span className="absolute bottom-1 end-1 text-[8px] bg-black/70 px-1 rounded text-white font-mono">
                                VID
                              </span>
                            </div>
                          ) : (
                            <img 
                              src={sample.url} 
                              alt={language === 'ar' ? sample.titleAr : sample.title} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                            />
                          )}
                        </div>
                        <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300 mt-1 truncate w-full text-center">
                          {language === 'ar' ? sample.titleAr : sample.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Selected Media Preview & Story Editor with CSS Filters & Poll Sticker */
              <div className="space-y-4">
                {/* 9:16 Visual Canvas Preview */}
                <div className="relative aspect-[9/14] sm:aspect-[9/15] max-h-[350px] w-full max-w-[245px] mx-auto rounded-2xl overflow-hidden bg-black shadow-xl ring-2 ring-slate-200 dark:ring-slate-800 flex items-center justify-center">
                  {/* Live CSS Filter Rendered on Media */}
                  {mediaType === 'video' ? (
                    <video 
                      ref={videoRef}
                      src={previewUrl} 
                      autoPlay 
                      loop 
                      muted 
                      playsInline 
                      className="absolute inset-0 w-full h-full object-cover transition-all duration-150"
                      style={{ filter: activeFilterCss }}
                    />
                  ) : (
                    <img 
                      src={rawSourceUrl || previewUrl} 
                      alt={language === 'ar' ? 'معاينة القصة' : 'Story Preview'} 
                      className="absolute inset-0 w-full h-full object-cover transition-all duration-150"
                      style={{ filter: activeFilterCss }}
                    />
                  )}

                  {/* Top overlay pills */}
                  <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-10 pointer-events-none">
                    <div className="bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-medium text-white flex items-center gap-1">
                      <Clock size={10} className="text-amber-400" />
                      {language === 'ar' ? 'قصة 24 ساعة' : '24h Story'}
                    </div>

                    {hasFilterAdjustments && (
                      <div className="bg-purple-900/80 backdrop-blur-md text-purple-200 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border border-purple-400/30">
                        <Sparkles size={10} />
                        {isMonochrome
                          ? (language === 'ar' ? 'أبيض وأسود' : 'B&W')
                          : selectedFilter !== 'none'
                          ? (language === 'ar'
                              ? (FILTER_PRESETS.find((f) => f.id === selectedFilter)?.nameAr || selectedFilter)
                              : selectedFilter)
                          : (language === 'ar' ? 'مخصص' : 'Custom')}
                      </div>
                    )}
                  </div>

                  {/* Reset / Change media button */}
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewUrl('');
                      setRawSourceUrl('');
                      handleResetFilters();
                    }}
                    className="absolute top-2.5 end-2.5 p-1 bg-black/65 text-white hover:bg-black/90 rounded-full transition-colors z-20"
                    title={language === 'ar' ? 'إزالة الوسائط' : 'Remove media'}
                  >
                    <X size={14} />
                  </button>

                  {/* Interactive Poll Sticker Preview Overlay */}
                  {showPollBuilder && (
                    <div className="absolute top-1/3 inset-x-3 z-15 bg-slate-900/90 backdrop-blur-md rounded-xl p-3 shadow-lg border border-white/20 text-white space-y-2 pointer-events-none">
                      <div className="flex items-center gap-1.5 text-purple-400 text-[10px] font-bold uppercase tracking-wider">
                        <BarChart2 size={12} />
                        <span>{language === 'ar' ? 'استطلاع تفاعلي' : 'Interactive Poll'}</span>
                      </div>
                      <p className="text-xs font-bold text-white leading-snug">
                        {pollQuestion.trim() || (language === 'ar' ? 'اطرح سؤالاً...' : 'Ask a question...')}
                      </p>
                      <div className="space-y-1.5 pt-0.5">
                        <div className="bg-white/15 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white/90 flex items-center justify-between">
                          <span>{pollOptionA.trim() || (language === 'ar' ? 'الخيار أ' : 'Option A')}</span>
                          <span className="text-[10px] opacity-60 tabular-nums">50%</span>
                        </div>
                        <div className="bg-white/15 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white/90 flex items-center justify-between">
                          <span>{pollOptionB.trim() || (language === 'ar' ? 'الخيار ب' : 'Option B')}</span>
                          <span className="text-[10px] opacity-60 tabular-nums">50%</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Live Caption Overlay on Preview */}
                  {caption.trim() && (
                    <div className="absolute bottom-3 inset-x-2.5 z-10 pointer-events-none">
                      <div className="bg-black/65 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-xl text-center leading-snug line-clamp-2 shadow-lg border border-white/10">
                        {caption}
                      </div>
                    </div>
                  )}
                </div>

                {/* PHOTO FILTERING INTERFACE */}
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-700/60 pb-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setFilterMode('presets')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          filterMode === 'presets'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Palette size={13} />
                        {language === 'ar' ? 'الفلاتر الجاهزة' : 'Presets'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterMode('adjust')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          filterMode === 'adjust'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Sliders size={13} />
                        {language === 'ar' ? 'تعديل (السطوع / أبيض وأسود)' : 'Adjust (Brightness / B&W)'}
                      </button>
                    </div>

                    {hasFilterAdjustments && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 transition-colors"
                        title={language === 'ar' ? 'إعادة تعيين الفلاتر' : 'Reset filters'}
                      >
                        <RotateCcw size={11} />
                        {language === 'ar' ? 'إعادة ضبط' : 'Reset'}
                      </button>
                    )}
                  </div>

                  {filterMode === 'presets' ? (
                    <div className="space-y-1.5">
                      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {FILTER_PRESETS.map((preset) => {
                          const isSelected = selectedFilter === preset.id || (preset.id === 'bw' && isMonochrome);
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => handleSelectPreset(preset.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
                                isSelected
                                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                              }`}
                            >
                              {language === 'ar' ? preset.nameAr : preset.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isMonochrome ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-500 dark:bg-slate-700'}`}>
                            <Eye size={13} />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                              {language === 'ar' ? 'مظهر أحادي اللون (أبيض وأسود)' : 'Monochrome Look'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {language === 'ar' ? 'تأثير كلاسيكي بالأبيض والأسود' : 'Classic black & white aesthetic'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setIsMonochrome(!isMonochrome);
                            if (!isMonochrome) {
                              setSelectedFilter('bw');
                            } else if (selectedFilter === 'bw') {
                              setSelectedFilter('none');
                            }
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                            isMonochrome
                              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-300'
                          }`}
                        >
                          {isMonochrome
                            ? (language === 'ar' ? 'مفعّل' : 'B&W Active')
                            : (language === 'ar' ? 'إيقاف' : 'Off')}
                        </button>
                      </div>

                      <div className="space-y-1 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Sun size={14} className="text-amber-500" />
                            {language === 'ar' ? 'السطوع' : 'Brightness'}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-slate-500 tabular-nums">{brightness}%</span>
                        </div>
                        <input
                          type="range"
                          min={50}
                          max={160}
                          step={2}
                          value={brightness}
                          onChange={(e) => setBrightness(Number(e.target.value))}
                          className="w-full accent-purple-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div className="space-y-1 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <SlidersHorizontal size={14} className="text-indigo-500" />
                            {language === 'ar' ? 'التباين' : 'Contrast'}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-slate-500 tabular-nums">{contrast}%</span>
                        </div>
                        <input
                          type="range"
                          min={60}
                          max={150}
                          step={2}
                          value={contrast}
                          onChange={(e) => setContrast(Number(e.target.value))}
                          className="w-full accent-purple-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* INTERACTIVE POLL STICKER BUILDER SECTION */}
                <div className="bg-purple-50/50 dark:bg-purple-950/20 p-3.5 rounded-2xl border border-purple-200/80 dark:border-purple-900/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                        <BarChart2 size={14} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">
                          {language === 'ar' ? 'ملصق استطلاع تفاعلي' : 'Interactive Poll Sticker'}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {language === 'ar' ? 'اسمح للمتابعين بالتصويت بين خيارين' : 'Let viewers vote on 2 choices'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowPollBuilder(!showPollBuilder);
                        if (showPollBuilder) setPollQuestion('');
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        showPollBuilder
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {showPollBuilder
                        ? (language === 'ar' ? 'الاستطلاع مفعّل' : 'Poll Enabled')
                        : (language === 'ar' ? '+ إضافة استطلاع' : '+ Add Poll')}
                    </button>
                  </div>

                  {showPollBuilder && (
                    <div className="space-y-2.5 pt-1 animate-in fade-in duration-200">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                          {language === 'ar' ? 'سؤال الاستطلاع' : 'Poll Question'}
                        </label>
                        <input
                          type="text"
                          maxLength={80}
                          value={pollQuestion}
                          onChange={(e) => setPollQuestion(e.target.value)}
                          placeholder={language === 'ar' ? 'اطرح سؤالاً (مثال: قهوة أم شاي؟)...' : 'Ask a question (e.g., Coffee or Tea?)...'}
                          className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 border border-purple-200 dark:border-purple-900"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                            {language === 'ar' ? 'الخيار أ' : 'Option A'}
                          </label>
                          <input
                            type="text"
                            maxLength={30}
                            value={pollOptionA}
                            onChange={(e) => setPollOptionA(e.target.value)}
                            placeholder={language === 'ar' ? 'الخيار أ' : 'Option A'}
                            className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 border border-slate-200 dark:border-slate-700"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                            {language === 'ar' ? 'الخيار ب' : 'Option B'}
                          </label>
                          <input
                            type="text"
                            maxLength={30}
                            value={pollOptionB}
                            onChange={(e) => setPollOptionB(e.target.value)}
                            placeholder={language === 'ar' ? 'الخيار ب' : 'Option B'}
                            className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 border border-slate-200 dark:border-slate-700"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Caption Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {language === 'ar' ? 'وصف القصة' : 'Story Caption'}
                    </label>
                    <span className="text-[10px] text-slate-400 tabular-nums">
                      {caption.length}/150
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={150}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder={language === 'ar' ? 'أضف تعليقاً أو وصفاً لقصتك...' : 'Add a caption to your story...'}
                    className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                  />

                  {/* Emoji Bar */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-400 me-1 flex items-center gap-1">
                      <Smile size={12} />
                    </span>
                    {EMOJI_SHORTCUTS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleAddEmoji(emoji)}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm transition-transform active:scale-125"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="flex items-center gap-2 flex-1">
                <button
                  type="button"
                  onClick={handleAttemptClose}
                  className="flex-1 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>

                {/* "Save as Draft" Button */}
                {Boolean(previewUrl.trim() || caption.trim() || pollQuestion.trim()) && (
                  <button
                    type="button"
                    onClick={() => handleSaveDraft(false)}
                    className="py-3 px-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 active:scale-95"
                    title={language === 'ar' ? 'حفظ العمل الحالي لإكماله لاحقاً' : 'Save current work to finish later'}
                  >
                    <Bookmark size={14} className="text-purple-500" />
                    <span>{language === 'ar' ? 'حفظ مسودة' : 'Save Draft'}</span>
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !previewUrl || isProcessing}
                className="py-3 px-5 bg-gradient-to-r from-yellow-500 via-rose-500 to-purple-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 hover:opacity-95 disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                {loading || isProcessing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {language === 'ar' ? 'جاري نشر القصة...' : 'Publishing Story...'}
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    {language === 'ar' ? 'مشاركة في القصة (24 ساعة)' : 'Share to Story (24h)'}
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* EXIT CONFIRMATION MODAL */}
        {showExitPrompt && (
          <div className="absolute inset-0 z-30 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div 
              className="w-full max-w-xs bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 mx-auto flex items-center justify-center">
                <Bookmark size={22} />
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  {language === 'ar' ? 'حفظ القصة كمسودة؟' : 'Save Story as Draft?'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {language === 'ar'
                    ? 'لم تقم بنشر قصتك بعد. احفظها كمسودة لتتمكن من إكمالها ونشرها لاحقاً.'
                    : "You haven't shared your story yet. Save it as a draft so you can finish and post it later."}
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleSaveDraft(true)}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Bookmark size={14} />
                  {language === 'ar' ? 'حفظ المسودة والخروج' : 'Save Draft & Exit'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowExitPrompt(false);
                    onClose();
                  }}
                  className="w-full py-2 text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors"
                >
                  {language === 'ar' ? 'تجاهل القصة' : 'Discard Story'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowExitPrompt(false)}
                  className="w-full py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  {language === 'ar' ? 'متابعة التعديل' : 'Keep Editing'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
