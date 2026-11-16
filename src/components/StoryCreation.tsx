import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
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
  Settings as SettingsIcon,
  Music,
  LayoutGrid,
  Layers,
  ChevronDown,
  Check,
  RefreshCw,
  Zap,
  Timer,
  Grid,
  Search,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Upload,
  Plus,
  AtSign,
  PenTool,
  Download,
  UserCheck,
  MoreHorizontal,
  ChevronUp,
  ChevronLeft,
  ArrowLeft,
  Star,
  Undo2,
  Eraser,
  MapPin,
  BarChart2 as PollIcon,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useFirestore } from '../hooks/useFirestore';
import {
  StoryDraft,
  getSavedStoryDrafts,
  saveStoryDraft,
  deleteStoryDraft
} from '../utils/storyDrafts';
import {
  CameraSettings,
  getCameraSettings,
} from '../utils/cameraSettings';
import { getStorySettings } from '../utils/storySettings';
import {
  MusicTrack,
  MUSIC_TRACKS,
  playMusicPreview,
  stopAnyActiveMusicPreview
} from '../utils/musicTracks';
import {
  StoryTemplate,
  STORY_TEMPLATES
} from '../utils/storyTemplates';
import CameraSettingsModal from './CameraSettingsModal';
import UserAvatar from './UserAvatar';
import {
  CloseFriendUser,
  DrawStroke,
  StoryAudience,
  StoryMention,
  StoryPartnership,
  StorySticker,
  StoryTextOverlay,
} from '../types/story';
import {
  STORY_FILTER_PRESETS,
  composeStoryMediaForPublish,
  exportFullStoryImage,
  renderStrokesToCanvas,
} from '../utils/storyEffects';
import {
  StoryEffectsDrawer,
  StoryMoreOptionsSheet,
  StoryStickersDrawer,
  StoryTextModal,
  StoryUserPickerModal,
  getTextOverlayStyleClasses,
} from './StoryStudioDrawers';

interface StoryCreationProps {
  onClose: () => void;
  onSuccess?: () => void;
  initialDraftId?: string;
  onOpenReels?: () => void;
  onOpenLive?: () => void;
}

const FILTER_PRESETS = STORY_FILTER_PRESETS;

const EMOJI_SHORTCUTS = ['🔥', '✨', '🌊', '☕', '❤️', '🎉', '🌴', '💫', '😍', '👏'];

// Curated high quality gallery items for instant story creation
const SAMPLE_GALLERY_ITEMS = [
  {
    id: 'sample-1',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    type: 'image' as const,
  },
  {
    id: 'sample-2',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
    type: 'image' as const,
  },
  {
    id: 'sample-3',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    type: 'image' as const,
  },
  {
    id: 'sample-4',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
    type: 'image' as const,
  },
  {
    id: 'sample-5',
    url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80',
    type: 'image' as const,
  },
  {
    id: 'sample-6',
    url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
    type: 'image' as const,
  },
  {
    id: 'sample-7',
    url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80',
    type: 'image' as const,
  },
  {
    id: 'sample-8',
    url: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=800&q=80',
    type: 'image' as const,
  },
];

type CollageLayoutType = 'split-v' | 'split-h' | 'grid-3' | 'grid-4';

export default function StoryCreation({
  onClose,
  onSuccess,
  initialDraftId,
  onOpenReels,
  onOpenLive,
}: StoryCreationProps) {
  const { profile, isFirebaseAuthenticated, language } = useAuth();
  const { createStory, addCloseFriend, removeCloseFriend, loading } = useFirestore();
  const isAr = language === 'ar';

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const liveCameraVideoRef = useRef<HTMLVideoElement>(null);
  const liveCameraStreamRef = useRef<MediaStream | null>(null);

  // Top level screen view:
  // 'gallery' = Screenshot 1 ("إضافة إلى القصة" with top action cards, recents dropdown, multi-select, gallery grid & camera tile)
  // 'camera'  = Live camera view with toolbars on selected side
  // 'editor'  = Story preview & adjustments (filters, poll, stickers, caption, publishing)
  // 'collage' = Multi-photo collage builder
  const [screenMode, setScreenMode] = useState<'gallery' | 'camera' | 'editor' | 'collage'>('gallery');

  // Modals & Drawers
  const [showCameraSettings, setShowCameraSettings] = useState(false);
  const [showMusicDrawer, setShowMusicDrawer] = useState(false);
  const [showTemplatesDrawer, setShowTemplatesDrawer] = useState(false);
  const [showDraftsList, setShowDraftsList] = useState(false);
  const [showExitPrompt, setShowExitPrompt] = useState(false);

  // Camera Settings
  const [cameraSettings, setCameraSettings] = useState<CameraSettings>(() => getCameraSettings());
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('environment');
  const [isFlashActive, setIsFlashActive] = useState(false);
  const [cameraTimer, setCameraTimer] = useState<0 | 3 | 10>(0);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [showGridOverlay, setShowGridOverlay] = useState(false);
  const [isCameraStarting, setIsCameraStarting] = useState(false);

  // Gallery view controls
  const [mediaFilter, setMediaFilter] = useState<'all' | 'photos' | 'videos' | 'favorites' | 'drafts'>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedGalleryItemIds, setSelectedGalleryItemIds] = useState<string[]>([]);
  const [recentUploads, setRecentUploads] = useState<{ id: string; url: string; type: 'image' | 'video' }[]>([]);

  // Drafts & Status
  const [activeDraftId, setActiveDraftId] = useState<string | null>(initialDraftId || null);
  const [savedDrafts, setSavedDrafts] = useState<StoryDraft[]>([]);
  const [draftToast, setDraftToast] = useState<string | null>(null);

  // Active Story Content
  const [rawSourceUrl, setRawSourceUrl] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState<string>('');

  // Selected Music & Template
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack | null>(null);
  const [musicSearchQuery, setMusicSearchQuery] = useState('');
  const [musicFilterGenre, setMusicFilterGenre] = useState<string>('all');
  const [playingPreviewTrackId, setPlayingPreviewTrackId] = useState<string | null>(null);

  const [selectedTemplate, setSelectedTemplate] = useState<StoryTemplate | null>(null);
  const [customTemplatePrompt, setCustomTemplatePrompt] = useState('');

  // Collage Builder State
  const [collageLayout, setCollageLayout] = useState<CollageLayoutType>('grid-4');
  const [collageSlots, setCollageSlots] = useState<{ [index: number]: string }>({});
  const [activeCollageSlot, setActiveCollageSlot] = useState<number | null>(null);

  // CSS Filter Adjustments State
  const [selectedFilter, setSelectedFilter] = useState<string>('none');
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [isMonochrome, setIsMonochrome] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<'presets' | 'adjust'>('presets');

  // Poll Sticker State
  const [pollQuestion, setPollQuestion] = useState<string>('');
  const [pollOptionA, setPollOptionA] = useState<string>(isAr ? 'نعم' : 'Yes');
  const [pollOptionB, setPollOptionB] = useState<string>(isAr ? 'لا' : 'No');
  const [showPollBuilder, setShowPollBuilder] = useState<boolean>(false);

  // Full-Screen Story Studio Interactive States (Screenshot features)
  const [toolbarExpanded, setToolbarExpanded] = useState<boolean>(true);
  const [textOverlays, setTextOverlays] = useState<StoryTextOverlay[]>([]);
  const [editingTextOverlay, setEditingTextOverlay] = useState<StoryTextOverlay | null>(null);
  const [showTextModal, setShowTextModal] = useState<boolean>(false);

  const [stickers, setStickers] = useState<StorySticker[]>([]);
  const [showStickersDrawer, setShowStickersDrawer] = useState<boolean>(false);
  const [showEffectsDrawer, setShowEffectsDrawer] = useState<boolean>(false);

  const [mentions, setMentions] = useState<StoryMention[]>([]);
  const [partnership, setPartnership] = useState<StoryPartnership | null>(null);
  const [userPickerMode, setUserPickerMode] = useState<'mention' | 'partner' | 'close_friends' | null>(null);

  const [closeFriends, setCloseFriends] = useState<CloseFriendUser[]>([]);
  const [selectedAudience, setSelectedAudience] = useState<StoryAudience>(() => {
    return getStorySettings(profile?.uid, profile?.storySettings).defaultAudience;
  });
  const [allowReplies, setAllowReplies] = useState<boolean>(() => {
    return getStorySettings(profile?.uid, profile?.storySettings).repliesPermission !== 'off';
  });
  const [showMoreOptions, setShowMoreOptions] = useState<boolean>(false);
  const [isCaptionFocused, setIsCaptionFocused] = useState<boolean>(false);

  // Freehand Drawing Mode States
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false);
  const [drawStrokes, setDrawStrokes] = useState<DrawStroke[]>([]);
  const [activeBrushColor, setActiveBrushColor] = useState<string>('#ffffff');
  const [activeBrushWidth, setActiveBrushWidth] = useState<number>(6);
  const [isBrushGlow, setIsBrushGlow] = useState<boolean>(false);
  const [isBrushEraser, setIsBrushEraser] = useState<boolean>(false);
  const activeStrokeRef = useRef<DrawStroke | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const studioCanvasRef = useRef<HTMLDivElement>(null);

  // Dragging state for canvas overlays
  const [draggingItem, setDraggingItem] = useState<{
    kind: 'text' | 'sticker' | 'mention';
    id: string;
    moved: boolean;
  } | null>(null);
  const [isOverTrash, setIsOverTrash] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // Listen for camera settings updates
  useEffect(() => {
    const handleSettingsUpdate = (e: any) => {
      if (e.detail) {
        setCameraSettings(e.detail);
      }
    };
    window.addEventListener('instavibe:camera-settings-updated', handleSettingsUpdate);
    const handleStorySettingsUpdate = (e: any) => {
      if (e.detail) {
        if (e.detail.defaultAudience) {
          setSelectedAudience(e.detail.defaultAudience);
        }
        if (e.detail.repliesPermission) {
          setAllowReplies(e.detail.repliesPermission !== 'off');
        }
      }
    };
    window.addEventListener('instavibe:story-settings-updated', handleStorySettingsUpdate);
    return () => {
      window.removeEventListener('instavibe:camera-settings-updated', handleSettingsUpdate);
      window.removeEventListener('instavibe:story-settings-updated', handleStorySettingsUpdate);
    };
  }, []);

  // Synchronize initial camera facing mode with user preference
  useEffect(() => {
    if (cameraSettings.frontCameraAlways) {
      setCameraFacing('user');
    }
  }, [cameraSettings.frontCameraAlways]);

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
    const preset = FILTER_PRESETS.find((f) => f.id === selectedFilter);
    if (preset && preset.css && preset.id !== 'bw') {
      parts.push(preset.css);
    }
    return parts.length > 0 ? parts.join(' ') : 'none';
  }, [isMonochrome, brightness, contrast, selectedFilter]);

  const hasFilterAdjustments = isMonochrome || brightness !== 100 || contrast !== 100 || selectedFilter !== 'none';

  // Load saved drafts on mount
  const refreshDrafts = () => {
    if (!profile) return [];
    const drafts = getSavedStoryDrafts(profile.uid);
    setSavedDrafts(drafts);
    return drafts;
  };

  useEffect(() => {
    if (!profile?.uid || !isFirebaseAuthenticated) {
      setCloseFriends([]);
      return;
    }
    const q = collection(db, 'users', profile.uid, 'closeFriends');
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: CloseFriendUser[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            friendId: data.friendId || d.id,
            username: data.username || 'user',
            photoURL: data.photoURL || '',
          };
        });
        setCloseFriends(list);
      },
      (err) => console.warn('Close friends listener notice:', err)
    );
    return unsub;
  }, [profile?.uid, isFirebaseAuthenticated]);

  // Re-render drawing canvas whenever strokes change
  useEffect(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (drawStrokes.length > 0) {
      renderStrokesToCanvas(ctx, drawStrokes, canvas.width, canvas.height);
    }
  }, [drawStrokes, screenMode]);

  useEffect(() => {
    if (!profile) return;
    const drafts = refreshDrafts();
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
    setTextOverlays(Array.isArray(draft.textOverlays) ? draft.textOverlays : []);
    setStickers(Array.isArray(draft.stickers) ? draft.stickers : []);
    setMentions(Array.isArray(draft.mentions) ? draft.mentions : []);
    setPartnership(draft.partnership || null);
    setDrawStrokes(Array.isArray(draft.strokes) ? draft.strokes : []);
    setSelectedAudience(draft.audience === 'close_friends' ? 'close_friends' : 'everyone');
    setAllowReplies(draft.allowReplies !== false);
    setPollQuestion(draft.poll?.question || '');
    setPollOptionA(draft.poll?.optionA || (isAr ? 'نعم' : 'Yes'));
    setPollOptionB(draft.poll?.optionB || (isAr ? 'لا' : 'No'));
    setShowPollBuilder(Boolean(draft.poll?.question));
    setShowDraftsList(false);
    setScreenMode('editor');
    const timeAgo = formatDistanceToNow(draft.updatedAt, { addSuffix: true, locale: isAr ? ar : undefined });
    setDraftToast(isAr ? `تم استئناف المسودة من ${timeAgo}` : `Resumed draft from ${timeAgo}`);
    setTimeout(() => setDraftToast(null), 3000);
  };

  // Cleanup music and camera on unmount
  useEffect(() => {
    return () => {
      stopAnyActiveMusicPreview();
      stopCameraStream();
    };
  }, []);

  const stopCameraStream = () => {
    if (liveCameraStreamRef.current) {
      liveCameraStreamRef.current.getTracks().forEach((t) => t.stop());
      liveCameraStreamRef.current = null;
    }
  };

  const startCameraStream = async (facing: 'user' | 'environment') => {
    stopCameraStream();
    setIsCameraStarting(true);
    setErrorMessage(null);
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error(isAr ? 'الكاميرا غير مدعومة في هذا المتصفح' : 'Camera not supported in this browser');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1080 },
          height: { ideal: 1920 },
        },
        audio: false,
      });
      liveCameraStreamRef.current = stream;
      if (liveCameraVideoRef.current) {
        liveCameraVideoRef.current.srcObject = stream;
        liveCameraVideoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('Camera stream warning:', err);
      // Fallback to basic video constraint if specific facingMode fails
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        liveCameraStreamRef.current = stream;
        if (liveCameraVideoRef.current) {
          liveCameraVideoRef.current.srcObject = stream;
          liveCameraVideoRef.current.play().catch(() => {});
        }
      } catch (fallbackErr: any) {
        setErrorMessage(
          isAr
            ? 'تعذر الوصول إلى الكاميرا. يرجى السماح بالوصول للكاميرا أو اختيار صورة من المعرض.'
            : 'Unable to access camera. Please allow camera permissions or pick an image from gallery.'
        );
        setScreenMode('gallery');
      }
    } finally {
      setIsCameraStarting(false);
    }
  };

  const handleOpenLiveCamera = () => {
    const initialFacing = cameraSettings.frontCameraAlways ? 'user' : 'environment';
    setCameraFacing(initialFacing);
    setScreenMode('camera');
    setTimeout(() => {
      startCameraStream(initialFacing);
    }, 50);
  };

  const handleFlipCamera = () => {
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(nextFacing);
    startCameraStream(nextFacing);
  };

  const handleCapturePhoto = () => {
    if (cameraTimer > 0) {
      setCountdownSeconds(cameraTimer);
      const interval = setInterval(() => {
        setCountdownSeconds((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            executeCapture();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      return;
    }
    executeCapture();
  };

  const executeCapture = () => {
    const video = liveCameraVideoRef.current;
    if (!video) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1080;
      canvas.height = video.videoHeight || 1920;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (cameraFacing === 'user') {
        // Mirror selfie capture
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      stopCameraStream();

      // If activeCollageSlot is set, fill that slot and return to collage
      if (screenMode === 'camera' && activeCollageSlot !== null) {
        setCollageSlots((prev) => ({ ...prev, [activeCollageSlot]: dataUrl }));
        setActiveCollageSlot(null);
        setScreenMode('collage');
        return;
      }

      setMediaType('image');
      setRawSourceUrl(dataUrl);
      setPreviewUrl(dataUrl);
      setScreenMode('editor');
    } catch (err) {
      console.error('Capture failed:', err);
    }
  };

  const handleFile = async (file: File) => {
    setErrorMessage(null);
    setIsProcessing(true);
    setUploadProgress(25);

    try {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          setUploadProgress(60);
          const rawUrl = e.target?.result as string;

          // If filling collage slot
          if (activeCollageSlot !== null) {
            setCollageSlots((prev) => ({ ...prev, [activeCollageSlot]: rawUrl }));
            setActiveCollageSlot(null);
            setIsProcessing(false);
            setScreenMode('collage');
            return;
          }

          setMediaType('image');
          setRawSourceUrl(rawUrl);
          setPreviewUrl(rawUrl);
          setRecentUploads((prev) => [{ id: `upload_${Date.now()}`, url: rawUrl, type: 'image' }, ...prev]);
          setUploadProgress(100);
          setIsProcessing(false);
          setScreenMode('editor');
        };
        reader.readAsDataURL(file);
      } else if (file.type.startsWith('video/')) {
        setMediaType('video');
        if (file.size > 700 * 1024) {
          setErrorMessage(
            isAr
              ? `حجم الفيديو (${(file.size / (1024 * 1024)).toFixed(1)} ميجابايت) يتجاوز الحد الأقصى (700 كيلوبايت). يرجى اختيار مقطع فيديو أقصر.`
              : `Video file size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds 700 KB limit. Please select a shorter clip.`
          );
          setIsProcessing(false);
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          setUploadProgress(100);
          const dataUrl = e.target?.result as string;
          setRawSourceUrl(dataUrl);
          setPreviewUrl(dataUrl);
          setRecentUploads((prev) => [{ id: `upload_${Date.now()}`, url: dataUrl, type: 'video' }, ...prev]);
          setIsProcessing(false);
          setScreenMode('editor');
        };
        reader.readAsDataURL(file);
      } else {
        setErrorMessage(
          isAr
            ? 'صيغة الملف غير مدعومة. يرجى اختيار صورة أو فيديو قصير.'
            : 'Unsupported file format. Please choose an image or short video clip.'
        );
        setIsProcessing(false);
      }
    } catch (err: any) {
      console.error('File read error:', err);
      setErrorMessage(err.message || (isAr ? 'حدث خطأ أثناء معالجة الملف' : 'Error processing file'));
      setIsProcessing(false);
    }
  };

  const handleSelectGalleryItem = (itemUrl: string, itemType: 'image' | 'video' = 'image') => {
    if (isMultiSelectMode) {
      setSelectedGalleryItemIds((prev) =>
        prev.includes(itemUrl) ? prev.filter((id) => id !== itemUrl) : [...prev, itemUrl]
      );
      return;
    }

    if (activeCollageSlot !== null) {
      setCollageSlots((prev) => ({ ...prev, [activeCollageSlot]: itemUrl }));
      setActiveCollageSlot(null);
      setScreenMode('collage');
      return;
    }

    setMediaType(itemType);
    setRawSourceUrl(itemUrl);
    setPreviewUrl(itemUrl);
    setScreenMode('editor');
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

  // Music Selection & Audio Preview
  const handleTogglePlayMusic = (track: MusicTrack) => {
    if (playingPreviewTrackId === track.id) {
      stopAnyActiveMusicPreview();
      setPlayingPreviewTrackId(null);
    } else {
      setPlayingPreviewTrackId(track.id);
      playMusicPreview(track, () => {
        setPlayingPreviewTrackId(null);
      });
    }
  };

  const handleSelectMusicTrack = (track: MusicTrack) => {
    stopAnyActiveMusicPreview();
    setPlayingPreviewTrackId(null);
    setSelectedMusic(track);
    setShowMusicDrawer(false);
    // If not in editor, transition or stay in current flow
    if (screenMode !== 'editor' && previewUrl) {
      setScreenMode('editor');
    }
  };

  // Template Selection
  const handleSelectTemplate = (template: StoryTemplate) => {
    setSelectedTemplate(template);
    setCustomTemplatePrompt(template.promptAr || template.prompt);
    setShowTemplatesDrawer(false);
    if (screenMode !== 'editor' && previewUrl) {
      setScreenMode('editor');
    }
  };

  // Build Collage Composite Image onto Canvas
  const handleGenerateCollage = async () => {
    const slotKeys = Object.keys(collageSlots).map(Number);
    const requiredCount = collageLayout === 'split-v' || collageLayout === 'split-h' ? 2 : collageLayout === 'grid-3' ? 3 : 4;

    if (slotKeys.length < requiredCount) {
      setErrorMessage(
        isAr
          ? `يرجى تعبئة جميع الفتحات (${slotKeys.length}/${requiredCount}) في المنشور المجمع.`
          : `Please fill all slots (${slotKeys.length}/${requiredCount}) for the collage.`
      );
      return;
    }

    setIsProcessing(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not available');

      // Dark background with clean borders
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 1080, 1920);

      const borderWidth = 12;
      const radius = 24;

      const drawSlotImage = (url: string, x: number, y: number, w: number, h: number) => {
        return new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.save();
            // Rounded clipping path
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, radius);
            ctx.clip();

            // Cover math
            const imgAspect = img.width / img.height;
            const slotAspect = w / h;
            let sx = 0, sy = 0, sw = img.width, sh = img.height;
            if (imgAspect > slotAspect) {
              sw = img.height * slotAspect;
              sx = (img.width - sw) / 2;
            } else {
              sh = img.width / slotAspect;
              sy = (img.height - sh) / 2;
            }

            ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
            ctx.restore();
            resolve();
          };
          img.onerror = () => resolve();
          img.src = url;
        });
      };

      if (collageLayout === 'split-v') {
        const slotW = (1080 - borderWidth * 3) / 2;
        const slotH = 1920 - borderWidth * 2;
        await drawSlotImage(collageSlots[0], borderWidth, borderWidth, slotW, slotH);
        await drawSlotImage(collageSlots[1], borderWidth * 2 + slotW, borderWidth, slotW, slotH);
      } else if (collageLayout === 'split-h') {
        const slotW = 1080 - borderWidth * 2;
        const slotH = (1920 - borderWidth * 3) / 2;
        await drawSlotImage(collageSlots[0], borderWidth, borderWidth, slotW, slotH);
        await drawSlotImage(collageSlots[1], borderWidth, borderWidth * 2 + slotH, slotW, slotH);
      } else if (collageLayout === 'grid-3') {
        const topH = 1000;
        const bottomH = 1920 - topH - borderWidth * 3;
        const bottomW = (1080 - borderWidth * 3) / 2;
        await drawSlotImage(collageSlots[0], borderWidth, borderWidth, 1080 - borderWidth * 2, topH);
        await drawSlotImage(collageSlots[1], borderWidth, borderWidth * 2 + topH, bottomW, bottomH);
        await drawSlotImage(collageSlots[2], borderWidth * 2 + bottomW, borderWidth * 2 + topH, bottomW, bottomH);
      } else {
        // 2x2 Grid
        const slotW = (1080 - borderWidth * 3) / 2;
        const slotH = (1920 - borderWidth * 3) / 2;
        await drawSlotImage(collageSlots[0], borderWidth, borderWidth, slotW, slotH);
        await drawSlotImage(collageSlots[1], borderWidth * 2 + slotW, borderWidth, slotW, slotH);
        await drawSlotImage(collageSlots[2], borderWidth, borderWidth * 2 + slotH, slotW, slotH);
        await drawSlotImage(collageSlots[3], borderWidth * 2 + slotW, borderWidth * 2 + slotH, slotW, slotH);
      }

      const compositeDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setMediaType('image');
      setRawSourceUrl(compositeDataUrl);
      setPreviewUrl(compositeDataUrl);
      setScreenMode('editor');
    } catch (err: any) {
      console.error('Collage creation error:', err);
      setErrorMessage(isAr ? 'تعذر دمج المنشور المجمع. حاول مجدداً.' : 'Failed to create collage.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Save story as draft
  const handleSaveDraft = (closeAfterSave: boolean = false) => {
    if (!profile) return;
    if (!previewUrl && !caption.trim()) {
      setErrorMessage(isAr ? 'لا يوجد محتوى لحفظه كمسودة بعد' : 'Nothing to save as a draft yet');
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
      audience: selectedAudience,
      allowReplies,
      textOverlays,
      stickers,
      mentions,
      partnership: partnership || undefined,
      strokes: drawStrokes,
      poll: showPollBuilder && pollQuestion.trim() ? {
        question: pollQuestion.trim(),
        optionA: pollOptionA.trim() || (isAr ? 'نعم' : 'Yes'),
        optionB: pollOptionB.trim() || (isAr ? 'لا' : 'No'),
        votesA: 0,
        votesB: 0,
        voters: {}
      } : undefined,
    });

    if (saved) {
      setActiveDraftId(saved.id);
      refreshDrafts();
      setDraftToast(
        isAr
          ? 'تم حفظ المسودة في أرشيف المسودات!'
          : 'Story draft saved! You can finish and post it anytime.'
      );
      setTimeout(() => setDraftToast(null), 3000);

      if (closeAfterSave) {
        setShowExitPrompt(false);
        onClose();
      }
    }
  };

  // Download / Save composite story to device
  const handleDownloadStoryToDevice = async () => {
    if (!previewUrl || isExporting) return;
    try {
      setIsExporting(true);
      let downloadHref = previewUrl;
      let filename = `instavibe-story-${Date.now()}.jpg`;

      if (mediaType === 'video') {
        filename = `instavibe-story-${Date.now()}.mp4`;
      } else {
        downloadHref = await exportFullStoryImage({
          sourceUrl: rawSourceUrl || previewUrl,
          filterCss: activeFilterCss,
          strokes: drawStrokes,
          textOverlays,
          stickers,
          mentions,
          partnership,
          caption,
        });
      }

      const link = document.createElement('a');
      link.href = downloadHref;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDraftToast(
        isAr ? 'تم تنزيل القصة وحفظها على جهازك ✓' : 'Story saved to your device ✓'
      );
      setTimeout(() => setDraftToast(null), 3000);
    } catch (err) {
      console.error('Export failed:', err);
      setErrorMessage(
        isAr
          ? 'تعذر تصدير هذه الصورة بسبب قيود المصدر. جرب صورة مرفوعة من جهازك.'
          : 'Could not export image due to source restrictions. Try an uploaded photo.'
      );
      setTimeout(() => setErrorMessage(null), 3500);
    } finally {
      setIsExporting(false);
    }
  };

  // Toggle Close Friend in Firestore
  const handleToggleCloseFriend = async (
    targetUser: { uid: string; username: string; photoURL?: string },
    isAdding: boolean
  ) => {
    if (!profile?.uid) return;
    if (isAdding) {
      await addCloseFriend(profile.uid, targetUser);
    } else {
      await removeCloseFriend(profile.uid, targetUser.uid);
    }
  };

  // Drawing Canvas Handlers
  const getNormalizedPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0.5, y: 0.5 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handleDrawPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getNormalizedPoint(e);
    const stroke: DrawStroke = {
      id: `stk_${Date.now()}`,
      color: activeBrushColor,
      width: isBrushEraser ? activeBrushWidth * 2.2 : activeBrushWidth,
      isGlow: isBrushGlow && !isBrushEraser,
      isEraser: isBrushEraser,
      points: [pt],
    };
    activeStrokeRef.current = stroke;
    setDrawStrokes((prev) => [...prev, stroke]);
  };

  const handleDrawPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode || !activeStrokeRef.current) return;
    const pt = getNormalizedPoint(e);
    const currentId = activeStrokeRef.current.id;
    activeStrokeRef.current.points.push(pt);
    setDrawStrokes((prev) =>
      prev.map((s) => (s.id === currentId ? { ...s, points: [...activeStrokeRef.current!.points] } : s))
    );
  };

  const handleDrawPointerUp = () => {
    activeStrokeRef.current = null;
  };

  // Dragging Canvas Overlays (Text / Stickers / Mentions)
  const handleStudioPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingItem || !studioCanvasRef.current) return;
    const rect = studioCanvasRef.current.getBoundingClientRect();
    const xPct = Math.min(94, Math.max(6, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.min(92, Math.max(8, ((e.clientY - rect.top) / rect.height) * 100));

    setDraggingItem((prev) => (prev ? { ...prev, moved: true } : null));
    setIsOverTrash(yPct > 81);

    if (draggingItem.kind === 'text') {
      setTextOverlays((prev) =>
        prev.map((t) => (t.id === draggingItem.id ? { ...t, x: xPct, y: yPct } : t))
      );
    } else if (draggingItem.kind === 'sticker') {
      setStickers((prev) =>
        prev.map((s) => (s.id === draggingItem.id ? { ...s, x: xPct, y: yPct } : s))
      );
    } else if (draggingItem.kind === 'mention') {
      setMentions((prev) =>
        prev.map((m) => (m.uid === draggingItem.id ? { ...m, x: xPct, y: yPct } : m))
      );
    }
  };

  const handleStudioPointerUp = () => {
    if (!draggingItem) return;
    if (isOverTrash) {
      if (draggingItem.kind === 'text') {
        setTextOverlays((prev) => prev.filter((t) => t.id !== draggingItem.id));
      } else if (draggingItem.kind === 'sticker') {
        setStickers((prev) => prev.filter((s) => s.id !== draggingItem.id));
      } else if (draggingItem.kind === 'mention') {
        setMentions((prev) => prev.filter((m) => m.uid !== draggingItem.id));
      }
    }
    setDraggingItem(null);
    setIsOverTrash(false);
  };

  const handleAttemptClose = () => {
    const hasUnsavedWork = Boolean(
      previewUrl.trim() ||
        caption.trim() ||
        pollQuestion.trim() ||
        selectedMusic ||
        selectedTemplate ||
        textOverlays.length > 0 ||
        stickers.length > 0 ||
        mentions.length > 0 ||
        drawStrokes.length > 0
    );
    if (hasUnsavedWork) {
      setShowExitPrompt(true);
    } else {
      stopCameraStream();
      stopAnyActiveMusicPreview();
      onClose();
    }
  };

  const handlePublishStory = async (targetAudience: StoryAudience) => {
    if (!profile) {
      setErrorMessage(isAr ? 'يجب تسجيل الدخول لنشر قصة' : 'You must be signed in to post a story');
      return;
    }
    if (!previewUrl) {
      setErrorMessage(isAr ? 'يرجى اختيار أو التقاط صورة أو فيديو لقصتك' : 'Please select or capture photo/video for your story');
      return;
    }

    if (targetAudience === 'close_friends' && closeFriends.length === 0) {
      setSelectedAudience('close_friends');
      setUserPickerMode('close_friends');
      return;
    }

    try {
      setErrorMessage(null);
      setIsProcessing(true);

      let finalMediaUrl = previewUrl;
      if (mediaType === 'image') {
        const sourceToCompress = rawSourceUrl || previewUrl;
        finalMediaUrl = await composeStoryMediaForPublish({
          sourceUrl: sourceToCompress,
          filterCss: activeFilterCss,
          strokes: drawStrokes,
        });
      }

      const pollData = showPollBuilder && pollQuestion.trim() ? {
        question: pollQuestion.trim(),
        optionA: pollOptionA.trim() || (isAr ? 'نعم' : 'Yes'),
        optionB: pollOptionB.trim() || (isAr ? 'لا' : 'No')
      } : undefined;

      const musicData = selectedMusic ? {
        title: selectedMusic.titleAr || selectedMusic.title,
        artist: selectedMusic.artist,
        genre: selectedMusic.genreLabelAr || selectedMusic.genre,
      } : undefined;

      const templateData = selectedTemplate ? {
        id: selectedTemplate.id,
        name: selectedTemplate.nameAr || selectedTemplate.name,
        prompt: customTemplatePrompt || selectedTemplate.promptAr || selectedTemplate.prompt,
      } : undefined;

      await createStory(
        profile,
        finalMediaUrl,
        mediaType,
        caption,
        pollData,
        musicData,
        templateData,
        undefined,
        {
          audience: targetAudience,
          closeFriendIds:
            targetAudience === 'close_friends'
              ? closeFriends.map((f) => f.friendId)
              : undefined,
          allowReplies,
          filterId: mediaType === 'video' ? selectedFilter : undefined,
          textOverlays,
          stickers,
          mentions,
          partnership: partnership || undefined,
        }
      );

      if (activeDraftId) {
        deleteStoryDraft(profile.uid, activeDraftId);
      }

      stopCameraStream();
      stopAnyActiveMusicPreview();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Story upload failed:', err);
      setErrorMessage(err.message || (isAr ? 'فشل نشر القصة. يرجى المحاولة مجدداً.' : 'Failed to publish story.'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Combine sample items, recent uploads, and saved drafts for the gallery grid
  const allGalleryItems = useMemo(() => {
    let items = [...recentUploads, ...SAMPLE_GALLERY_ITEMS];
    if (mediaFilter === 'photos') items = items.filter((i) => i.type === 'image');
    if (mediaFilter === 'videos') items = items.filter((i) => i.type === 'video');
    return items;
  }, [recentUploads, mediaFilter]);

  // Filtered Music Tracks
  const filteredMusicTracks = useMemo(() => {
    return MUSIC_TRACKS.filter((track) => {
      const matchGenre = musicFilterGenre === 'all' || track.genre === musicFilterGenre;
      const queryLower = musicSearchQuery.toLowerCase().trim();
      const matchQuery = !queryLower ||
        track.title.toLowerCase().includes(queryLower) ||
        track.titleAr.toLowerCase().includes(queryLower) ||
        track.artist.toLowerCase().includes(queryLower);
      return matchGenre && matchQuery;
    });
  }, [musicSearchQuery, musicFilterGenre]);

  return (
    <div className="fixed inset-0 z-[120] h-[100dvh] bg-black text-white flex flex-col overflow-hidden pt-safe pb-safe animate-in fade-in duration-200">
      {/* Hidden file & camera inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
          }
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
          }
        }}
      />

      {/* =========================================================================
          SCREEN 1: GALLERY & QUICK ACTION CARDS ("إضافة إلى القصة" - Screenshot 1)
         ========================================================================= */}
      {screenMode === 'gallery' && (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Top Bar matching Screenshot 1 */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0 border-b border-white/10">
            {/* Camera Settings Button (Gear Icon) */}
            <button
              type="button"
              onClick={() => setShowCameraSettings(true)}
              aria-label={isAr ? 'إعدادات الكاميرا' : 'Camera Settings'}
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white/90 hover:text-white transition-colors"
            >
              <SettingsIcon size={22} />
            </button>

            {/* Center Title */}
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
              {isAr ? 'إضافة إلى القصة' : 'Add to Story'}
            </h2>

            {/* Close Button (X) */}
            <button
              type="button"
              onClick={handleAttemptClose}
              aria-label={isAr ? 'إغلاق' : 'Close'}
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white/90 hover:text-white transition-colors"
            >
              <X size={22} />
            </button>
          </div>

          {/* Quick Action Feature Cards matching Screenshot 1 (Templates, Music, Collage) */}
          <div className="px-4 py-3 shrink-0">
            <div className="grid grid-cols-3 gap-2.5">
              {/* Card 1: القوالب (Templates / Add Yours) */}
              <button
                type="button"
                onClick={() => setShowTemplatesDrawer(true)}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 transition-all active:scale-95 group text-center"
              >
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-500 via-pink-500 to-rose-500 flex items-center justify-center text-white shadow-md mb-2 group-hover:scale-105 transition-transform">
                  <div className="flex -space-x-1 rtl:space-x-reverse">
                    <span className="w-3.5 h-3.5 rounded-full bg-white/90 text-purple-700 text-[8px] flex items-center justify-center font-bold">✨</span>
                    <span className="w-3.5 h-3.5 rounded-full bg-amber-400 text-slate-900 text-[8px] flex items-center justify-center font-bold">🔥</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-white leading-tight">
                  {isAr ? 'القوالب' : 'Templates'}
                </span>
                <span className="text-[10px] text-white/50 mt-0.5">
                  {isAr ? 'أضف خاصتك' : 'Add Yours'}
                </span>
              </button>

              {/* Card 2: موسيقى (Music) */}
              <button
                type="button"
                onClick={() => setShowMusicDrawer(true)}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 transition-all active:scale-95 group text-center"
              >
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-md mb-2 group-hover:scale-105 transition-transform">
                  <Music size={22} className="stroke-[2.2]" />
                </div>
                <span className="text-xs font-bold text-white leading-tight">
                  {isAr ? 'موسيقى' : 'Music'}
                </span>
                <span className="text-[10px] text-white/50 mt-0.5">
                  {isAr ? 'مقاطع صوتية' : 'Soundtracks'}
                </span>
              </button>

              {/* Card 3: منشور مجمع (Collage / Layout) */}
              <button
                type="button"
                onClick={() => {
                  setCollageSlots({});
                  setScreenMode('collage');
                }}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 transition-all active:scale-95 group text-center"
              >
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md mb-2 group-hover:scale-105 transition-transform">
                  <LayoutGrid size={22} className="stroke-[2.2]" />
                </div>
                <span className="text-xs font-bold text-white leading-tight">
                  {isAr ? 'منشور مجمع' : 'Collage'}
                </span>
                <span className="text-[10px] text-white/50 mt-0.5">
                  {isAr ? 'دمج صور' : 'Layout Grid'}
                </span>
              </button>
            </div>
          </div>

          {/* Media Bar matching Screenshot 1 (Dropdown "الأحدث v" & Multi-select "تحديد") */}
          <div className="px-4 py-2 flex items-center justify-between shrink-0 relative">
            {/* "الأحدث v" Dropdown Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="flex items-center gap-1.5 text-sm font-bold text-white hover:text-white/80 transition-colors py-1 pe-2"
              >
                <span>
                  {mediaFilter === 'all'
                    ? isAr ? 'الأحدث' : 'Recents'
                    : mediaFilter === 'photos'
                    ? isAr ? 'الصور' : 'Photos'
                    : mediaFilter === 'videos'
                    ? isAr ? 'مقاطع الفيديو' : 'Videos'
                    : mediaFilter === 'favorites'
                    ? isAr ? 'المفضلة' : 'Favorites'
                    : isAr ? 'مسودات القصص' : 'Drafts'}
                </span>
                <ChevronDown size={16} className={`transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showFilterDropdown && (
                <div className="absolute top-full start-0 mt-1 w-44 bg-slate-900 border border-white/20 rounded-2xl p-1.5 shadow-2xl z-30 space-y-0.5 animate-in fade-in">
                  <button
                    type="button"
                    onClick={() => {
                      setMediaFilter('all');
                      setShowFilterDropdown(false);
                    }}
                    className={`w-full text-start px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between ${
                      mediaFilter === 'all' ? 'bg-purple-600 text-white' : 'hover:bg-white/10 text-white/80'
                    }`}
                  >
                    <span>{isAr ? 'الأحدث' : 'Recents'}</span>
                    {mediaFilter === 'all' && <Check size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMediaFilter('photos');
                      setShowFilterDropdown(false);
                    }}
                    className={`w-full text-start px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between ${
                      mediaFilter === 'photos' ? 'bg-purple-600 text-white' : 'hover:bg-white/10 text-white/80'
                    }`}
                  >
                    <span>{isAr ? 'الصور' : 'Photos'}</span>
                    {mediaFilter === 'photos' && <Check size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMediaFilter('videos');
                      setShowFilterDropdown(false);
                    }}
                    className={`w-full text-start px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between ${
                      mediaFilter === 'videos' ? 'bg-purple-600 text-white' : 'hover:bg-white/10 text-white/80'
                    }`}
                  >
                    <span>{isAr ? 'مقاطع الفيديو' : 'Videos'}</span>
                    {mediaFilter === 'videos' && <Check size={14} />}
                  </button>
                  {savedDrafts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowDraftsList(true);
                        setShowFilterDropdown(false);
                      }}
                      className="w-full text-start px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between text-amber-400 hover:bg-white/10"
                    >
                      <span>{isAr ? `المسودات (${savedDrafts.length})` : `Drafts (${savedDrafts.length})`}</span>
                      <Bookmark size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* "تحديد" (Multi-Select) Button matching Screenshot 1 */}
            <button
              type="button"
              onClick={() => {
                setIsMultiSelectMode(!isMultiSelectMode);
                if (isMultiSelectMode) setSelectedGalleryItemIds([]);
              }}
              className={`h-8 px-3 rounded-full flex items-center gap-1.5 text-xs font-bold transition-all ${
                isMultiSelectMode
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <Layers size={14} />
              <span>{isAr ? 'تحديد' : 'Select'}</span>
              {selectedGalleryItemIds.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-white text-blue-600 text-[10px] font-extrabold flex items-center justify-center ms-0.5">
                  {selectedGalleryItemIds.length}
                </span>
              )}
            </button>
          </div>

          {/* Media Grid with prominent Camera Tile (#1) */}
          <div className="flex-1 overflow-y-auto px-4 pb-20">
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {/* Tile 1: الكاميرا (Camera shortcut tile matching Screenshot 1) */}
              <button
                type="button"
                onClick={handleOpenLiveCamera}
                className="relative aspect-square rounded-2xl bg-white/10 hover:bg-white/15 border-2 border-white/20 flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 group overflow-hidden"
              >
                <div className="w-12 h-12 rounded-full bg-white/15 group-hover:bg-white/25 flex items-center justify-center text-white transition-transform group-hover:scale-110 shadow-lg">
                  <Camera size={26} className="stroke-[2.2]" />
                </div>
                <span className="text-xs font-bold text-white tracking-wide">
                  {isAr ? 'الكاميرا' : 'Camera'}
                </span>
              </button>

              {/* Upload from Device button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative aspect-square rounded-2xl bg-white/5 hover:bg-white/10 border border-dashed border-white/20 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 group text-center p-2"
              >
                <div className="w-9 h-9 rounded-full bg-purple-600/30 text-purple-400 flex items-center justify-center">
                  <Upload size={18} />
                </div>
                <span className="text-[11px] font-semibold text-white/90 leading-tight">
                  {isAr ? 'رفع من الجهاز' : 'Upload File'}
                </span>
              </button>

              {/* Gallery Photos & Videos */}
              {allGalleryItems.map((item) => {
                const isSelected = selectedGalleryItemIds.includes(item.url);
                const selectIndex = selectedGalleryItemIds.indexOf(item.url);

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectGalleryItem(item.url, item.type)}
                    className="relative aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-white/10 cursor-pointer group transition-all"
                  >
                    <img
                      src={item.url}
                      alt="Gallery media"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                    />

                    {/* Multi-select check bubble */}
                    {isMultiSelectMode && (
                      <div className="absolute top-2 end-2 z-10">
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all shadow-md ${
                            isSelected
                              ? 'bg-blue-600 border-white text-white'
                              : 'bg-black/40 border-white/80 text-transparent'
                          }`}
                        >
                          {isSelected && selectIndex + 1}
                        </div>
                      </div>
                    )}

                    {/* Video Duration Badge */}
                    {item.type === 'video' && (
                      <div className="absolute bottom-1.5 end-1.5 bg-black/70 backdrop-blur-sm text-white px-1.5 py-0.5 rounded text-[9px] font-mono flex items-center gap-1">
                        <Film size={9} />
                        <span>0:15</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Multi-select action bar when items are selected */}
          {isMultiSelectMode && selectedGalleryItemIds.length > 0 && (
            <div className="fixed bottom-4 inset-x-4 z-40 max-w-lg mx-auto bg-slate-900/95 backdrop-blur-md border border-white/20 rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom-3">
              <span className="text-xs font-bold text-white">
                {isAr
                  ? `تم تحديد ${selectedGalleryItemIds.length} عنصر`
                  : `${selectedGalleryItemIds.length} items selected`}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const newSlots: { [index: number]: string } = {};
                    selectedGalleryItemIds.slice(0, 4).forEach((url, i) => {
                      newSlots[i] = url;
                    });
                    setCollageSlots(newSlots);
                    setCollageLayout(selectedGalleryItemIds.length === 2 ? 'split-v' : selectedGalleryItemIds.length === 3 ? 'grid-3' : 'grid-4');
                    setScreenMode('collage');
                  }}
                  className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-rose-600 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 active:scale-95"
                >
                  <LayoutGrid size={14} />
                  <span>{isAr ? 'إنشاء منشور مجمع' : 'Create Collage'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleSelectGalleryItem(selectedGalleryItemIds[0]);
                  }}
                  className="px-3 py-2 bg-white text-slate-900 text-xs font-bold rounded-xl shadow-md active:scale-95"
                >
                  {isAr ? 'متابعة' : 'Next'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          SCREEN 2: LIVE CAMERA MODE (Aligning Toolbar Left/Right per Settings!)
         ========================================================================= */}
      {screenMode === 'camera' && (
        <div className="flex-1 relative bg-black flex flex-col justify-between overflow-hidden">
          {/* Live Video Feed */}
          <div className="absolute inset-0">
            <video
              ref={liveCameraVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraFacing === 'user' ? 'scale-x-[-1]' : ''}`}
            />
          </div>

          {/* Grid lines overlay if enabled */}
          {showGridOverlay && (
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none z-10 border border-white/20">
              <div className="border border-white/15" />
              <div className="border border-white/15" />
              <div className="border border-white/15" />
              <div className="border border-white/15" />
              <div className="border border-white/15" />
              <div className="border border-white/15" />
              <div className="border border-white/15" />
              <div className="border border-white/15" />
              <div className="border border-white/15" />
            </div>
          )}

          {/* Flash Simulation overlay */}
          {isFlashActive && (
            <div className="absolute inset-0 bg-white/70 pointer-events-none z-20 animate-out fade-out duration-300" />
          )}

          {/* Countdown timer overlay */}
          {countdownSeconds !== null && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-30 pointer-events-none">
              <span className="text-8xl font-black text-white animate-ping">
                {countdownSeconds}
              </span>
            </div>
          )}

          {/* Top Bar in Camera Mode */}
          <div className="relative z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
            {/* Close camera and back to gallery */}
            <button
              type="button"
              onClick={() => {
                stopCameraStream();
                setScreenMode(activeCollageSlot !== null ? 'collage' : 'gallery');
              }}
              className="w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors"
            >
              <X size={22} />
            </button>

            {/* Flash & Grid quick switches */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFlashActive(!isFlashActive)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isFlashActive ? 'bg-amber-400 text-slate-900 font-bold' : 'bg-black/40 text-white'
                }`}
                title={isAr ? 'الفلاش' : 'Flash'}
              >
                <Zap size={18} />
              </button>

              <button
                type="button"
                onClick={() => setCameraTimer((prev) => (prev === 0 ? 3 : prev === 3 ? 10 : 0))}
                className={`h-10 px-3 rounded-full flex items-center gap-1 text-xs font-bold transition-colors ${
                  cameraTimer > 0 ? 'bg-amber-400 text-slate-900' : 'bg-black/40 text-white'
                }`}
                title={isAr ? 'المؤقت الذاتي' : 'Self Timer'}
              >
                <Timer size={16} />
                {cameraTimer > 0 && <span>{cameraTimer}s</span>}
              </button>
            </div>

            {/* Gear Icon to open Camera Settings (Screenshot 2) */}
            <button
              type="button"
              onClick={() => setShowCameraSettings(true)}
              className="w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors"
              title={isAr ? 'إعدادات الكاميرا' : 'Camera Settings'}
            >
              <SettingsIcon size={20} />
            </button>
          </div>

          {/* FLOATING CAMERA TOOLBAR (ALIGNED LEFT OR RIGHT PER SCREENSHOT 2 SETTING!) */}
          <div
            className={`absolute top-24 z-20 flex flex-col gap-3 p-2 bg-black/45 backdrop-blur-md rounded-2xl border border-white/15 ${
              cameraSettings.toolsPosition === 'right' ? 'end-4' : 'start-4'
            }`}
          >
            {/* Flip Camera */}
            <button
              type="button"
              onClick={handleFlipCamera}
              className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center text-white transition-colors"
              title={isAr ? 'تبديل الكاميرا' : 'Flip Camera'}
            >
              <RefreshCw size={20} />
            </button>

            {/* Grid overlay */}
            <button
              type="button"
              onClick={() => setShowGridOverlay(!showGridOverlay)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                showGridOverlay ? 'bg-purple-600 text-white' : 'hover:bg-white/10 text-white'
              }`}
              title={isAr ? 'خطوط الشبكة' : 'Grid lines'}
            >
              <Grid size={20} />
            </button>

            {/* Templates shortcut */}
            <button
              type="button"
              onClick={() => setShowTemplatesDrawer(true)}
              className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center text-purple-400 transition-colors"
              title={isAr ? 'القوالب' : 'Templates'}
            >
              <Sparkles size={20} />
            </button>

            {/* Music shortcut */}
            <button
              type="button"
              onClick={() => setShowMusicDrawer(true)}
              className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center text-rose-400 transition-colors"
              title={isAr ? 'موسيقى' : 'Music'}
            >
              <Music size={20} />
            </button>

            {/* Collage shortcut */}
            <button
              type="button"
              onClick={() => {
                stopCameraStream();
                setScreenMode('collage');
              }}
              className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center text-blue-400 transition-colors"
              title={isAr ? 'منشور مجمع' : 'Collage'}
            >
              <LayoutGrid size={20} />
            </button>
          </div>

          {/* Bottom Shutter & Controls */}
          <div className="relative z-20 p-6 flex items-center justify-around bg-gradient-to-t from-black/80 to-transparent">
            {/* Gallery Thumbnail Shortcut */}
            <button
              type="button"
              onClick={() => {
                stopCameraStream();
                setScreenMode('gallery');
              }}
              className="w-12 h-12 rounded-xl overflow-hidden border-2 border-white/60 bg-white/10 flex items-center justify-center"
            >
              {allGalleryItems[0] ? (
                <img src={allGalleryItems[0].url} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon size={20} />
              )}
            </button>

            {/* Capture Shutter Button */}
            <button
              type="button"
              onClick={handleCapturePhoto}
              className="w-20 h-20 rounded-full border-4 border-white p-1 flex items-center justify-center active:scale-90 transition-transform shadow-2xl"
            >
              <div className="w-full h-full rounded-full bg-white hover:bg-slate-200 transition-colors shadow-inner" />
            </button>

            {/* Flip Camera */}
            <button
              type="button"
              onClick={handleFlipCamera}
              className="w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 active:scale-95 transition-all"
            >
              <RefreshCw size={22} />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 3: COLLAGE / LAYOUT BUILDER ("منشور مجمع")
         ========================================================================= */}
      {screenMode === 'collage' && (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
          {/* Top Bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
            <button
              type="button"
              onClick={() => setScreenMode('gallery')}
              className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center"
            >
              <X size={20} />
            </button>

            <h3 className="font-bold text-sm text-white">
              {isAr ? 'منشور مجمع (Layout)' : 'Story Collage'}
            </h3>

            <button
              type="button"
              onClick={handleGenerateCollage}
              className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-rose-600 text-white rounded-xl text-xs font-bold shadow-md active:scale-95"
            >
              {isAr ? 'متابعة' : 'Next'}
            </button>
          </div>

          {/* Layout Options bar */}
          <div className="px-4 py-2.5 flex items-center justify-center gap-3 shrink-0 border-b border-white/5 bg-white/5">
            <button
              type="button"
              onClick={() => setCollageLayout('split-v')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                collageLayout === 'split-v' ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/70'
              }`}
            >
              <span>{isAr ? 'عمودي 2' : '2 Vertical'}</span>
            </button>

            <button
              type="button"
              onClick={() => setCollageLayout('split-h')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                collageLayout === 'split-h' ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/70'
              }`}
            >
              <span>{isAr ? 'أفقي 2' : '2 Horizontal'}</span>
            </button>

            <button
              type="button"
              onClick={() => setCollageLayout('grid-3')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                collageLayout === 'grid-3' ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/70'
              }`}
            >
              <span>{isAr ? '3 صور' : '3 Grid'}</span>
            </button>

            <button
              type="button"
              onClick={() => setCollageLayout('grid-4')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                collageLayout === 'grid-4' ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/70'
              }`}
            >
              <span>{isAr ? '4 صور (2×2)' : '4 Grid'}</span>
            </button>
          </div>

          {/* Interactive Collage Canvas */}
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
            <div className="relative aspect-[9/16] h-full max-h-[500px] w-auto rounded-3xl overflow-hidden bg-slate-900 border-2 border-white/20 p-2 shadow-2xl">
              {collageLayout === 'split-v' && (
                <div className="grid grid-cols-2 gap-2 h-full">
                  {[0, 1].map((slotIndex) => (
                    <div
                      key={slotIndex}
                      onClick={() => {
                        setActiveCollageSlot(slotIndex);
                        setScreenMode('gallery');
                      }}
                      className="relative h-full rounded-2xl overflow-hidden bg-white/5 border border-dashed border-white/30 flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition-colors"
                    >
                      {collageSlots[slotIndex] ? (
                        <img src={collageSlots[slotIndex]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-white/60">
                          <Plus size={24} />
                          <span className="text-[10px] font-bold">{isAr ? 'اختر صورة' : 'Add Photo'}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {collageLayout === 'split-h' && (
                <div className="grid grid-rows-2 gap-2 h-full">
                  {[0, 1].map((slotIndex) => (
                    <div
                      key={slotIndex}
                      onClick={() => {
                        setActiveCollageSlot(slotIndex);
                        setScreenMode('gallery');
                      }}
                      className="relative w-full rounded-2xl overflow-hidden bg-white/5 border border-dashed border-white/30 flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition-colors"
                    >
                      {collageSlots[slotIndex] ? (
                        <img src={collageSlots[slotIndex]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-white/60">
                          <Plus size={24} />
                          <span className="text-[10px] font-bold">{isAr ? 'اختر صورة' : 'Add Photo'}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {collageLayout === 'grid-3' && (
                <div className="flex flex-col gap-2 h-full">
                  <div
                    onClick={() => {
                      setActiveCollageSlot(0);
                      setScreenMode('gallery');
                    }}
                    className="relative flex-1 rounded-2xl overflow-hidden bg-white/5 border border-dashed border-white/30 flex flex-col items-center justify-center cursor-pointer hover:bg-white/10"
                  >
                    {collageSlots[0] ? (
                      <img src={collageSlots[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-white/60">
                        <Plus size={24} />
                        <span className="text-[10px] font-bold">{isAr ? 'الصورة الرئيسية' : 'Main Photo'}</span>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 h-[42%]">
                    {[1, 2].map((slotIndex) => (
                      <div
                        key={slotIndex}
                        onClick={() => {
                          setActiveCollageSlot(slotIndex);
                          setScreenMode('gallery');
                        }}
                        className="relative h-full rounded-2xl overflow-hidden bg-white/5 border border-dashed border-white/30 flex flex-col items-center justify-center cursor-pointer hover:bg-white/10"
                      >
                        {collageSlots[slotIndex] ? (
                          <img src={collageSlots[slotIndex]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Plus size={20} className="text-white/60" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {collageLayout === 'grid-4' && (
                <div className="grid grid-cols-2 grid-rows-2 gap-2 h-full">
                  {[0, 1, 2, 3].map((slotIndex) => (
                    <div
                      key={slotIndex}
                      onClick={() => {
                        setActiveCollageSlot(slotIndex);
                        setScreenMode('gallery');
                      }}
                      className="relative h-full rounded-2xl overflow-hidden bg-white/5 border border-dashed border-white/30 flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition-colors"
                    >
                      {collageSlots[slotIndex] ? (
                        <img src={collageSlots[slotIndex]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-white/60">
                          <Plus size={20} />
                          <span className="text-[10px] font-bold">{isAr ? 'إضافة' : 'Add'}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 4: FULL-SCREEN STORY STUDIO EDITOR (Matches Screenshot Layout)
         ========================================================================= */}
      {screenMode === 'editor' && (
        <div className="flex-1 flex items-center justify-center bg-black sm:p-3 overflow-hidden">
          <div
            ref={studioCanvasRef}
            onPointerMove={handleStudioPointerMove}
            onPointerUp={handleStudioPointerUp}
            onPointerCancel={handleStudioPointerUp}
            className="relative w-full sm:max-w-[440px] h-full sm:h-[94dvh] sm:max-h-[860px] sm:rounded-3xl overflow-hidden bg-black shadow-2xl border-0 sm:border sm:border-white/15 flex flex-col justify-between select-none"
          >
            {/* 1. Background Full-Screen Story Media */}
            <div className="absolute inset-0 bg-black">
              {mediaType === 'video' ? (
                <video
                  ref={videoRef}
                  src={previewUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ filter: activeFilterCss }}
                />
              ) : (
                <img
                  src={rawSourceUrl || previewUrl}
                  alt="Story studio preview"
                  draggable={false}
                  className="w-full h-full object-cover"
                  style={{ filter: activeFilterCss }}
                />
              )}
              {/* Top & Bottom subtle legibility vignettes */}
              <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />
            </div>

            {/* 2. Freehand Brush Drawing Canvas Layer */}
            <canvas
              ref={drawCanvasRef}
              width={360}
              height={640}
              onPointerDown={handleDrawPointerDown}
              onPointerMove={handleDrawPointerMove}
              onPointerUp={handleDrawPointerUp}
              onPointerCancel={handleDrawPointerUp}
              className={`absolute inset-0 w-full h-full z-10 touch-none ${
                isDrawingMode ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'
              }`}
            />

            {/* 3. Interactive Canvas Overlays Layer (Text, Stickers, Mentions, Music, Poll, Template) */}
            <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
              {/* Music Soundtrack Pill */}
              {selectedMusic && (
                <div
                  className="absolute top-16 start-4 pointer-events-auto bg-black/65 backdrop-blur-md rounded-full py-1.5 px-3 border border-white/25 flex items-center gap-2 shadow-lg max-w-[65%] cursor-pointer"
                  onClick={() => setShowMusicDrawer(true)}
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shrink-0 animate-spin [animation-duration:4s]">
                    <Music size={11} />
                  </div>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="text-[10px] font-bold text-white truncate">
                      {selectedMusic.titleAr || selectedMusic.title}
                    </p>
                    <p className="text-[8px] text-white/70 truncate">{selectedMusic.artist}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMusic(null);
                    }}
                    className="p-0.5 text-white/70 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Partnership Tag Pill */}
              {partnership && (partnership.isPaid || partnership.partnerUsername) && (
                <button
                  type="button"
                  onClick={() => setUserPickerMode('partner')}
                  className="absolute top-4 start-1/2 -translate-x-1/2 pointer-events-auto px-3 py-1 rounded-full bg-black/65 backdrop-blur-md border border-white/20 text-[11px] font-bold text-white flex items-center gap-1.5 shadow-lg whitespace-nowrap"
                >
                  <UserCheck size={12} className="text-indigo-400" />
                  <span>
                    {partnership.partnerUsername
                      ? isAr
                        ? `شراكة مع @${partnership.partnerUsername}`
                        : `Partnered with @${partnership.partnerUsername}`
                      : isAr
                      ? 'شراكة مدفوعة'
                      : 'Paid Partnership'}
                  </span>
                </button>
              )}

              {/* Draggable Text Overlays */}
              {textOverlays.map((item) => {
                const bg =
                  item.bgStyle === 'solid'
                    ? item.color === '#ffffff'
                      ? '#0f172a'
                      : item.color
                    : item.bgStyle === 'translucent'
                    ? 'rgba(0,0,0,0.62)'
                    : 'transparent';
                const txtColor = item.bgStyle === 'solid' && item.color !== '#ffffff' ? '#ffffff' : item.color;
                return (
                  <div
                    key={item.id}
                    style={{
                      left: `${item.x}%`,
                      top: `${item.y}%`,
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: bg,
                      color: txtColor,
                      textShadow:
                        item.fontStyle === 'neon'
                          ? `0 0 12px ${item.color}`
                          : item.bgStyle === 'outline'
                          ? '0 2px 6px rgba(0,0,0,0.95)'
                          : '0 1px 4px rgba(0,0,0,0.5)',
                    }}
                    onPointerDown={(e) => {
                      if (isDrawingMode) return;
                      e.stopPropagation();
                      setDraggingItem({ kind: 'text', id: item.id, moved: false });
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!draggingItem?.moved) {
                        setEditingTextOverlay(item);
                        setShowTextModal(true);
                      }
                    }}
                    className={`absolute pointer-events-auto cursor-grab active:cursor-grabbing px-3.5 py-1.5 rounded-2xl text-lg sm:text-xl text-center max-w-[78%] whitespace-pre-wrap break-words touch-none select-none ${getTextOverlayStyleClasses(
                      item
                    )}`}
                  >
                    {item.text}
                  </div>
                );
              })}

              {/* Draggable Stickers */}
              {stickers.map((stk) => (
                <div
                  key={stk.id}
                  style={{
                    left: `${stk.x}%`,
                    top: `${stk.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  onPointerDown={(e) => {
                    if (isDrawingMode) return;
                    e.stopPropagation();
                    setDraggingItem({ kind: 'sticker', id: stk.id, moved: false });
                  }}
                  className="absolute pointer-events-auto cursor-grab active:cursor-grabbing touch-none select-none group"
                >
                  {stk.type === 'emoji' ? (
                    <span className="text-4xl sm:text-5xl drop-shadow-xl block">{stk.value}</span>
                  ) : (
                    <div className="px-3 py-1.5 rounded-xl bg-white/95 text-slate-900 text-xs font-extrabold shadow-xl flex items-center gap-1.5 whitespace-nowrap">
                      {stk.type === 'location' && <MapPin size={13} className="text-emerald-600" />}
                      {stk.type === 'time' && <Clock size={13} className="text-sky-600" />}
                      {stk.type === 'mood' && <Sparkles size={13} className="text-purple-600" />}
                      <span>{stk.value}</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Draggable @Mentions */}
              {mentions.map((m) => (
                <div
                  key={m.uid}
                  style={{
                    left: `${m.x}%`,
                    top: `${m.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  onPointerDown={(e) => {
                    if (isDrawingMode) return;
                    e.stopPropagation();
                    setDraggingItem({ kind: 'mention', id: m.uid, moved: false });
                  }}
                  className="absolute pointer-events-auto cursor-grab active:cursor-grabbing touch-none select-none px-3 py-1.5 rounded-full bg-slate-950/85 backdrop-blur-md border border-white/30 text-white text-xs font-extrabold shadow-xl flex items-center gap-1"
                >
                  <AtSign size={12} className="text-amber-400" />
                  <span>{m.username}</span>
                </div>
              ))}

              {/* Template Sticker Preview */}
              {selectedTemplate && (
                <div
                  className="absolute bottom-40 inset-x-16 pointer-events-auto bg-white/20 backdrop-blur-lg rounded-2xl p-2.5 border border-white/30 text-white shadow-2xl space-y-1 text-center"
                  onClick={() => setShowTemplatesDrawer(true)}
                >
                  <div className="flex items-center justify-between text-purple-200 text-[9px] font-extrabold uppercase">
                    <span className="flex items-center gap-1">
                      <Sparkles size={11} />
                      {isAr ? 'أضف خاصتك' : 'Add Yours'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTemplate(null);
                      }}
                      className="text-white/70 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <p className="text-[11px] font-bold text-white leading-snug drop-shadow-sm">
                    {customTemplatePrompt || selectedTemplate.promptAr || selectedTemplate.prompt}
                  </p>
                </div>
              )}

              {/* Interactive Poll Preview */}
              {showPollBuilder && (
                <div className="absolute top-1/3 inset-x-14 pointer-events-auto bg-slate-900/90 backdrop-blur-md rounded-2xl p-3 shadow-xl border border-white/20 text-white space-y-2">
                  <div className="flex items-center justify-between text-purple-400 text-[10px] font-bold uppercase">
                    <span className="flex items-center gap-1">
                      <PollIcon size={12} />
                      <span>{isAr ? 'استطلاع تفاعلي' : 'Poll'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPollBuilder(false)}
                      className="text-white/60 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={80}
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder={isAr ? 'اكتب سؤال الاستطلاع...' : 'Ask a question...'}
                    className="w-full bg-white/10 text-white placeholder-white/40 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none"
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      maxLength={30}
                      value={pollOptionA}
                      onChange={(e) => setPollOptionA(e.target.value)}
                      className="bg-white/15 rounded-lg px-2 py-1 text-[11px] font-semibold text-white focus:outline-none text-center"
                    />
                    <input
                      type="text"
                      maxLength={30}
                      value={pollOptionB}
                      onChange={(e) => setPollOptionB(e.target.value)}
                      className="bg-white/15 rounded-lg px-2 py-1 text-[11px] font-semibold text-white focus:outline-none text-center"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 4. Drag-to-Trash Drop Zone */}
            {draggingItem && (
              <div className="absolute bottom-24 inset-x-0 z-40 flex justify-center pointer-events-none animate-in fade-in">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all shadow-2xl ${
                    isOverTrash
                      ? 'bg-red-600 border-white scale-125 text-white'
                      : 'bg-black/75 border-white/50 text-white/80'
                  }`}
                >
                  <Trash2 size={20} />
                </div>
              </div>
            )}

            {/* 5. Toast / Error Pill */}
            {(draftToast || errorMessage) && (
              <div className="absolute top-16 inset-x-4 z-50 flex justify-center pointer-events-none">
                <div
                  className={`px-3.5 py-2 rounded-2xl text-xs font-bold shadow-xl backdrop-blur-md flex items-center gap-2 ${
                    errorMessage
                      ? 'bg-red-950/90 border border-red-500/50 text-red-200'
                      : 'bg-slate-900/90 border border-purple-400/40 text-white'
                  }`}
                >
                  {errorMessage ? <AlertCircle size={14} /> : <CheckCircle2 size={14} className="text-emerald-400" />}
                  <span>{errorMessage || draftToast}</span>
                </div>
              </div>
            )}

            {/* 6. FREEHAND DRAWING TOOLBAR OVERLAY (when "رسم" is active) */}
            {isDrawingMode ? (
              <>
                {/* Top Drawing Controls */}
                <div className="relative z-30 flex items-center justify-between px-4 pt-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDrawStrokes((prev) => prev.slice(0, -1))}
                      disabled={drawStrokes.length === 0}
                      className="h-9 px-3 rounded-full bg-black/65 backdrop-blur-md border border-white/20 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-40"
                    >
                      <Undo2 size={14} />
                      <span>{isAr ? 'تراجع' : 'Undo'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrawStrokes([])}
                      disabled={drawStrokes.length === 0}
                      className="h-9 px-3 rounded-full bg-black/65 backdrop-blur-md border border-white/20 text-rose-300 text-xs font-bold disabled:opacity-40"
                    >
                      {isAr ? 'مسح' : 'Clear'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsDrawingMode(false)}
                    className="h-9 px-4 rounded-full bg-white text-slate-900 text-xs font-extrabold shadow-lg"
                  >
                    {isAr ? 'تم' : 'Done'}
                  </button>
                </div>

                {/* Bottom Brush Sizes, Glow, Eraser & Color Palette */}
                <div className="relative z-30 p-4 space-y-3 bg-gradient-to-t from-black/90 to-transparent">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-full border border-white/15">
                      {[4, 8, 14].map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => {
                            setIsBrushEraser(false);
                            setActiveBrushWidth(w);
                          }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            !isBrushEraser && activeBrushWidth === w ? 'bg-white text-slate-900' : 'text-white'
                          }`}
                        >
                          <span
                            className="rounded-full bg-current"
                            style={{ width: Math.min(14, w + 2), height: Math.min(14, w + 2) }}
                          />
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsBrushEraser(false);
                          setIsBrushGlow(!isBrushGlow);
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                          isBrushGlow && !isBrushEraser
                            ? 'bg-purple-600 border-purple-400 text-white'
                            : 'bg-black/60 border-white/20 text-white/80'
                        }`}
                      >
                        ✨ {isAr ? 'نيون' : 'Neon'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsBrushEraser(!isBrushEraser)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${
                          isBrushEraser
                            ? 'bg-white border-white text-slate-900'
                            : 'bg-black/60 border-white/20 text-white/80'
                        }`}
                      >
                        <Eraser size={13} />
                        <span>{isAr ? 'ممحاة' : 'Eraser'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2.5 overflow-x-auto py-1 no-scrollbar">
                    {[
                      '#ffffff',
                      '#0f172a',
                      '#ef4444',
                      '#f59e0b',
                      '#22c55e',
                      '#3b82f6',
                      '#a855f7',
                      '#ec4899',
                    ].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setIsBrushEraser(false);
                          setActiveBrushColor(c);
                        }}
                        style={{ backgroundColor: c }}
                        className={`w-7 h-7 rounded-full border-2 shrink-0 transition-transform ${
                          !isBrushEraser && activeBrushColor === c
                            ? 'border-white scale-125 shadow-lg'
                            : 'border-white/40'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              /* =================================================================
                 NORMAL STUDIO TOOLBAR + BOTTOM PUBLISH BAR (Matches Screenshot!)
                 ================================================================= */
              <>
                {/* Top Corner Back Arrow Button */}
                <div className="relative z-30 flex items-start justify-between px-3.5 pt-3.5 pointer-events-none">
                  {/* Left/Start spacer or Audience status badge */}
                  <div className="pointer-events-auto">
                    {!allowReplies && (
                      <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[10px] font-semibold text-white/80">
                        {isAr ? 'الردود متوقفة' : 'Replies Off'}
                      </span>
                    )}
                  </div>

                  {/* Circular Back Arrow matching top-right button in screenshot */}
                  <button
                    type="button"
                    onClick={() => setScreenMode('gallery')}
                    aria-label={isAr ? 'رجوع' : 'Back'}
                    className="pointer-events-auto w-11 h-11 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur-md border border-white/15 flex items-center justify-center text-white shadow-lg transition-transform active:scale-95"
                  >
                    {isAr ? <ArrowRight size={22} /> : <ArrowLeft size={22} />}
                  </button>
                </div>

                {/* Vertical Floating Tool Rail (Exact Match to Screenshot!) */}
                <div
                  className={`absolute top-4 z-30 flex flex-col gap-2.5 ${
                    cameraSettings.toolsPosition === 'right'
                      ? 'end-3.5 items-end'
                      : 'start-3.5 items-start'
                  }`}
                >
                  {/* 1. النص (Text - Aa) */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTextOverlay(null);
                      setShowTextModal(true);
                    }}
                    className="flex items-center gap-2.5 group"
                  >
                    <span className="w-11 h-11 rounded-full bg-black/55 group-hover:bg-black/80 backdrop-blur-md border border-white/15 flex items-center justify-center text-white font-bold text-sm shadow-lg transition-transform group-active:scale-90">
                      Aa
                    </span>
                    {toolbarExpanded && (
                      <span className="text-xs font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                        {isAr ? 'النص' : 'Text'}
                      </span>
                    )}
                  </button>

                  {/* 2. ملصقات (Stickers) */}
                  <button
                    type="button"
                    onClick={() => setShowStickersDrawer(true)}
                    className="flex items-center gap-2.5 group"
                  >
                    <span className="w-11 h-11 rounded-full bg-black/55 group-hover:bg-black/80 backdrop-blur-md border border-white/15 flex items-center justify-center text-white shadow-lg transition-transform group-active:scale-90">
                      <Smile size={20} />
                    </span>
                    {toolbarExpanded && (
                      <span className="text-xs font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                        {isAr ? 'ملصقات' : 'Stickers'}
                      </span>
                    )}
                  </button>

                  {/* 3. الموسيقى (Music) */}
                  <button
                    type="button"
                    onClick={() => setShowMusicDrawer(true)}
                    className="flex items-center gap-2.5 group"
                  >
                    <span
                      className={`w-11 h-11 rounded-full backdrop-blur-md border flex items-center justify-center shadow-lg transition-transform group-active:scale-90 ${
                        selectedMusic
                          ? 'bg-rose-600/85 border-rose-400 text-white'
                          : 'bg-black/55 group-hover:bg-black/80 border-white/15 text-white'
                      }`}
                    >
                      <Music size={20} />
                    </span>
                    {toolbarExpanded && (
                      <span className="text-xs font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                        {isAr ? 'الموسيقى' : 'Music'}
                      </span>
                    )}
                  </button>

                  {/* 4. تأثيرات (Effects / Filters) */}
                  <button
                    type="button"
                    onClick={() => setShowEffectsDrawer(true)}
                    className="flex items-center gap-2.5 group"
                  >
                    <span
                      className={`w-11 h-11 rounded-full backdrop-blur-md border flex items-center justify-center shadow-lg transition-transform group-active:scale-90 ${
                        hasFilterAdjustments
                          ? 'bg-purple-600/85 border-purple-400 text-white'
                          : 'bg-black/55 group-hover:bg-black/80 border-white/15 text-white'
                      }`}
                    >
                      <Sparkles size={20} />
                    </span>
                    {toolbarExpanded && (
                      <span className="text-xs font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                        {isAr ? 'تأثيرات' : 'Effects'}
                      </span>
                    )}
                  </button>

                  {/* 5-10 Expanded Tools */}
                  {toolbarExpanded && (
                    <>
                      {/* 5. حفظ (Bookmark / Save Draft) */}
                      <button
                        type="button"
                        onClick={() => handleSaveDraft(false)}
                        className="flex items-center gap-2.5 group"
                      >
                        <span className="w-11 h-11 rounded-full bg-black/55 group-hover:bg-black/80 backdrop-blur-md border border-white/15 flex items-center justify-center text-white shadow-lg transition-transform group-active:scale-90">
                          <Bookmark size={19} />
                        </span>
                        <span className="text-xs font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                          {isAr ? 'حفظ' : 'Save Draft'}
                        </span>
                      </button>

                      {/* 6. ذكر (@ Mention) */}
                      <button
                        type="button"
                        onClick={() => setUserPickerMode('mention')}
                        className="flex items-center gap-2.5 group"
                      >
                        <span
                          className={`w-11 h-11 rounded-full backdrop-blur-md border flex items-center justify-center shadow-lg transition-transform group-active:scale-90 ${
                            mentions.length > 0
                              ? 'bg-amber-500/85 border-amber-300 text-white'
                              : 'bg-black/55 group-hover:bg-black/80 border-white/15 text-white'
                          }`}
                        >
                          <AtSign size={19} />
                        </span>
                        <span className="text-xs font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                          {isAr ? 'ذكر' : 'Mention'}
                        </span>
                      </button>

                      {/* 7. رسم (Draw / Brush) */}
                      <button
                        type="button"
                        onClick={() => setIsDrawingMode(true)}
                        className="flex items-center gap-2.5 group"
                      >
                        <span
                          className={`w-11 h-11 rounded-full backdrop-blur-md border flex items-center justify-center shadow-lg transition-transform group-active:scale-90 ${
                            drawStrokes.length > 0
                              ? 'bg-sky-600/85 border-sky-400 text-white'
                              : 'bg-black/55 group-hover:bg-black/80 border-white/15 text-white'
                          }`}
                        >
                          <PenTool size={19} />
                        </span>
                        <span className="text-xs font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                          {isAr ? 'رسم' : 'Draw'}
                        </span>
                      </button>

                      {/* 8. حفظ / تنزيل (Download to Device) */}
                      <button
                        type="button"
                        disabled={isExporting}
                        onClick={handleDownloadStoryToDevice}
                        className="flex items-center gap-2.5 group disabled:opacity-50"
                      >
                        <span className="w-11 h-11 rounded-full bg-black/55 group-hover:bg-black/80 backdrop-blur-md border border-white/15 flex items-center justify-center text-white shadow-lg transition-transform group-active:scale-90">
                          {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={19} />}
                        </span>
                        <span className="text-xs font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                          {isAr ? 'حفظ' : 'Download'}
                        </span>
                      </button>

                      {/* 9. شراكة (Partnership / Collab) */}
                      <button
                        type="button"
                        onClick={() => setUserPickerMode('partner')}
                        className="flex items-center gap-2.5 group"
                      >
                        <span
                          className={`w-11 h-11 rounded-full backdrop-blur-md border flex items-center justify-center shadow-lg transition-transform group-active:scale-90 ${
                            partnership
                              ? 'bg-indigo-600/85 border-indigo-400 text-white'
                              : 'bg-black/55 group-hover:bg-black/80 border-white/15 text-white'
                          }`}
                        >
                          <UserCheck size={19} />
                        </span>
                        <span className="text-xs font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                          {isAr ? 'شراكة' : 'Partner'}
                        </span>
                      </button>

                      {/* 10. المزيد (More Options ...) */}
                      <button
                        type="button"
                        onClick={() => setShowMoreOptions(true)}
                        className="flex items-center gap-2.5 group"
                      >
                        <span className="w-11 h-11 rounded-full bg-black/55 group-hover:bg-black/80 backdrop-blur-md border border-white/15 flex items-center justify-center text-white shadow-lg transition-transform group-active:scale-90">
                          <MoreHorizontal size={20} />
                        </span>
                        <span className="text-xs font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                          {isAr ? 'المزيد' : 'More'}
                        </span>
                      </button>
                    </>
                  )}

                  {/* Collapse / Expand Chevron Pill (^) */}
                  <button
                    type="button"
                    onClick={() => setToolbarExpanded(!toolbarExpanded)}
                    aria-label={toolbarExpanded ? 'Collapse tools' : 'Expand tools'}
                    className="w-11 h-7 rounded-full bg-black/55 hover:bg-black/80 backdrop-blur-md border border-white/15 flex items-center justify-center text-white shadow-lg transition-all active:scale-90"
                  >
                    {toolbarExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {/* Bottom Caption Input & Publish Bar (Exact Match to Screenshot!) */}
                <div className="relative z-30 px-3 pb-4 pt-2 space-y-2.5">
                  {/* Caption Input ("إضافة شرح توضيحي...") */}
                  <div className="space-y-1.5">
                    {isCaptionFocused && (
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar bg-black/65 backdrop-blur-md rounded-full px-3 py-1 border border-white/10">
                        {EMOJI_SHORTCUTS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleAddEmoji(emoji)}
                            className="p-0.5 text-base hover:scale-125 transition-transform"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                    <input
                      type="text"
                      maxLength={220}
                      value={caption}
                      onFocus={() => setIsCaptionFocused(true)}
                      onBlur={() => setIsCaptionFocused(false)}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder={isAr ? 'إضافة شرح توضيحي...' : 'Add a caption...'}
                      className="w-full bg-transparent hover:bg-black/35 focus:bg-black/65 text-white placeholder-white/75 rounded-2xl px-3.5 py-2 text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-white/30 transition-all"
                    />
                  </div>

                  {/* Bottom Action Row: Your Story | Close Friends | Blue/Indigo Publish Arrow */}
                  <div className="flex items-center gap-2">
                    {/* Your Story Pill ("قصتك") */}
                    <button
                      type="button"
                      disabled={loading || isProcessing || !previewUrl}
                      onClick={() => {
                        setSelectedAudience('everyone');
                        handlePublishStory('everyone');
                      }}
                      className="flex-1 min-h-[46px] px-3 py-2 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/15 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50"
                    >
                      <div className="w-6 h-6 rounded-full overflow-hidden border border-white/60 shrink-0">
                        <UserAvatar
                          src={profile?.photoURL}
                          username={profile?.username}
                          iconSize={12}
                        />
                      </div>
                      <span className="truncate">{isAr ? 'قصتك' : 'Your Story'}</span>
                    </button>

                    {/* Close Friends Pill ("الأصدقاء المقربون" with Green Star) */}
                    <div className="flex-1 flex items-center rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/15 shadow-lg overflow-hidden">
                      <button
                        type="button"
                        disabled={loading || isProcessing || !previewUrl}
                        onClick={() => {
                          setSelectedAudience('close_friends');
                          handlePublishStory('close_friends');
                        }}
                        className="flex-1 min-h-[46px] px-2.5 py-2 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 min-w-0"
                      >
                        <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-sm">
                          <Star size={11} fill="currentColor" />
                        </span>
                        <span className="truncate">
                          {isAr ? 'الأصدقاء المقربون' : 'Close Friends'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserPickerMode('close_friends')}
                        title={isAr ? 'إدارة قائمة الأصدقاء المقربين' : 'Manage Close Friends'}
                        className="h-[46px] px-2 border-s border-white/10 text-[10px] font-extrabold text-emerald-300 hover:bg-white/10 tabular-nums shrink-0"
                      >
                        {closeFriends.length}
                      </button>
                    </div>

                    {/* Circular Blue/Indigo Quick Share / Send Arrow Button */}
                    <button
                      type="button"
                      disabled={loading || isProcessing || !previewUrl}
                      onClick={() => handlePublishStory(selectedAudience)}
                      aria-label={isAr ? 'نشر القصة' : 'Publish Story'}
                      className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-xl active:scale-90 transition-all shrink-0 disabled:opacity-50"
                    >
                      {loading || isProcessing ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : isAr ? (
                        <ChevronLeft size={24} strokeWidth={2.5} />
                      ) : (
                        <ChevronLeft size={24} strokeWidth={2.5} className="rotate-180" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Studio Interactive Modals & Drawers */}
      <StoryTextModal
        isOpen={showTextModal}
        isAr={isAr}
        editingItem={editingTextOverlay}
        onClose={() => {
          setShowTextModal(false);
          setEditingTextOverlay(null);
        }}
        onSave={(savedOverlay) => {
          setTextOverlays((prev) => {
            const exists = prev.some((t) => t.id === savedOverlay.id);
            return exists
              ? prev.map((t) => (t.id === savedOverlay.id ? savedOverlay : t))
              : [...prev, savedOverlay];
          });
        }}
        onDelete={(id) => setTextOverlays((prev) => prev.filter((t) => t.id !== id))}
      />

      <StoryStickersDrawer
        isOpen={showStickersDrawer}
        isAr={isAr}
        onClose={() => setShowStickersDrawer(false)}
        onAddSticker={(sticker) => setStickers((prev) => [...prev, sticker])}
        onOpenPoll={() => setShowPollBuilder(true)}
        onOpenTemplates={() => setShowTemplatesDrawer(true)}
        onOpenMention={() => setUserPickerMode('mention')}
      />

      <StoryEffectsDrawer
        isOpen={showEffectsDrawer}
        isAr={isAr}
        selectedFilter={selectedFilter}
        brightness={brightness}
        contrast={contrast}
        isMonochrome={isMonochrome}
        onSelectPreset={handleSelectPreset}
        onBrightnessChange={setBrightness}
        onContrastChange={setContrast}
        onReset={handleResetFilters}
        onClose={() => setShowEffectsDrawer(false)}
      />

      <StoryUserPickerModal
        mode={userPickerMode}
        isAr={isAr}
        closeFriends={closeFriends}
        partnership={partnership}
        onClose={() => setUserPickerMode(null)}
        onSelectMention={(picked) => {
          setMentions((prev) => {
            if (prev.some((m) => m.uid === picked.uid)) return prev;
            return [
              ...prev,
              {
                uid: picked.uid,
                username: picked.username,
                photoURL: picked.photoURL,
                x: 42 + Math.round(Math.random() * 18),
                y: 35 + Math.round(Math.random() * 20),
              },
            ];
          });
        }}
        onSavePartnership={(next) => setPartnership(next)}
        onToggleCloseFriend={handleToggleCloseFriend}
        onPublishToCloseFriends={() => {
          setSelectedAudience('close_friends');
          handlePublishStory('close_friends');
        }}
      />

      <StoryMoreOptionsSheet
        isOpen={showMoreOptions}
        isAr={isAr}
        allowReplies={allowReplies}
        closeFriendsCount={closeFriends.length}
        onToggleAllowReplies={() => setAllowReplies((prev) => !prev)}
        onOpenCloseFriends={() => setUserPickerMode('close_friends')}
        onOpenPoll={() => setShowPollBuilder(true)}
        onOpenTemplates={() => setShowTemplatesDrawer(true)}
        onOpenCollage={() => setScreenMode('collage')}
        onClose={() => setShowMoreOptions(false)}
      />

      {/* =========================================================================
          DRAWER 1: MUSIC PICKER ("موسيقى" from Screenshot 1)
         ========================================================================= */}
      {showMusicDrawer && (
        <div className="fixed inset-0 z-[135] bg-black/80 backdrop-blur-md flex flex-col justify-end animate-in fade-in">
          <div className="bg-slate-900 border-t border-white/15 rounded-t-3xl max-h-[85dvh] pb-safe flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white">
                  <Music size={16} />
                </div>
                <h3 className="text-base font-bold text-white">
                  {isAr ? 'اختر مقطعاً صوتياً للقصة' : 'Select Music for Story'}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  stopAnyActiveMusicPreview();
                  setShowMusicDrawer(false);
                }}
                className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/70"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-4 pb-2 shrink-0">
              <div className="relative">
                <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  value={musicSearchQuery}
                  onChange={(e) => setMusicSearchQuery(e.target.value)}
                  placeholder={isAr ? 'ابحث عن أغنية، فنان، أو نوع موسيقي...' : 'Search music or artist...'}
                  className="w-full bg-white/10 text-white placeholder-white/40 ps-9 pe-4 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Genre Chips */}
              <div className="flex gap-2 overflow-x-auto pt-3 pb-1 no-scrollbar">
                {[
                  { id: 'all', label: isAr ? 'الكل' : 'All' },
                  { id: 'trending', label: isAr ? 'الرائج' : 'Trending' },
                  { id: 'arabic', label: isAr ? 'عربي' : 'Arabic' },
                  { id: 'chill', label: isAr ? 'روقان & لو-فاي' : 'Chill Lofi' },
                  { id: 'upbeat', label: isAr ? 'حماسي' : 'Upbeat' },
                  { id: 'acoustic', label: isAr ? 'أكوستيك' : 'Acoustic' },
                ].map((genre) => (
                  <button
                    key={genre.id}
                    type="button"
                    onClick={() => setMusicFilterGenre(genre.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                      musicFilterGenre === genre.id ? 'bg-white text-slate-900 font-bold' : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    {genre.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tracks List */}
            <div className="flex-1 overflow-y-auto px-4 py-2 divide-y divide-white/5 space-y-1">
              {filteredMusicTracks.map((track) => {
                const isPlaying = playingPreviewTrackId === track.id;
                const isSelected = selectedMusic?.id === track.id;

                return (
                  <div
                    key={track.id}
                    className="flex items-center justify-between py-3 group cursor-pointer hover:bg-white/5 px-2 rounded-xl transition-colors"
                    onClick={() => handleSelectMusicTrack(track)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Album Art Cover with play button */}
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${track.coverGradient} flex items-center justify-center text-white shadow-md shrink-0 relative overflow-hidden`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTogglePlayMusic(track);
                        }}
                      >
                        {isPlaying ? (
                          <div className="flex items-center gap-0.5">
                            <span className="w-1 h-3.5 bg-white rounded-full animate-pulse" />
                            <span className="w-1 h-5 bg-white rounded-full animate-pulse [animation-delay:150ms]" />
                            <span className="w-1 h-2.5 bg-white rounded-full animate-pulse [animation-delay:300ms]" />
                          </div>
                        ) : (
                          <Play size={18} className="fill-white" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">
                          {isAr ? track.titleAr : track.title}
                        </p>
                        <p className="text-[11px] text-white/60 truncate mt-0.5">
                          {track.artist} • {track.genreLabelAr}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ps-2">
                      <span className="text-[10px] text-white/50 font-mono">
                        0:{track.duration}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectMusicTrack(track);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-rose-600 text-white'
                            : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                      >
                        {isSelected ? (isAr ? 'تم الاختيار' : 'Selected') : (isAr ? 'استخدام' : 'Use')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DRAWER 2: TEMPLATES PICKER ("القوالب" from Screenshot 1)
         ========================================================================= */}
      {showTemplatesDrawer && (
        <div className="fixed inset-0 z-[135] bg-black/80 backdrop-blur-md flex flex-col justify-end animate-in fade-in">
          <div className="bg-slate-900 border-t border-white/15 rounded-t-3xl max-h-[85dvh] pb-safe flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-500 via-pink-500 to-rose-500 flex items-center justify-center text-white">
                  <Sparkles size={16} />
                </div>
                <h3 className="text-base font-bold text-white">
                  {isAr ? 'قوالب القصة (أضف خاصتك)' : 'Story Templates (Add Yours)'}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setShowTemplatesDrawer(false)}
                className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/70"
              >
                <X size={18} />
              </button>
            </div>

            {/* Templates List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {STORY_TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.id}
                  onClick={() => handleSelectTemplate(tmpl)}
                  className={`p-4 rounded-2xl bg-gradient-to-r ${tmpl.bgGradient} border border-white/15 hover:border-white/30 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] space-y-2.5`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-400/30">
                      {tmpl.categoryLabelAr}
                    </span>
                    <span className="text-[10px] text-white/60 font-mono">
                      {tmpl.sampleParticipantCount.toLocaleString()}+ {isAr ? 'مشارك' : 'joined'}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-white leading-snug">
                    {isAr ? tmpl.promptAr : tmpl.prompt}
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex -space-x-1.5 rtl:space-x-reverse overflow-hidden">
                      <div className="w-5 h-5 rounded-full bg-purple-500 border border-white text-[8px] flex items-center justify-center font-bold">✨</div>
                      <div className="w-5 h-5 rounded-full bg-rose-500 border border-white text-[8px] flex items-center justify-center font-bold">📸</div>
                      <div className="w-5 h-5 rounded-full bg-amber-500 border border-white text-[8px] flex items-center justify-center font-bold">🔥</div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectTemplate(tmpl);
                      }}
                      className="px-3 py-1.5 bg-white text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
                    >
                      {isAr ? 'استخدام القالب' : 'Use Template'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: CAMERA SETTINGS (Full Replica of Screenshot 2!)
         ========================================================================= */}
      <CameraSettingsModal
        isOpen={showCameraSettings}
        onClose={() => {
          setShowCameraSettings(false);
          setCameraSettings(getCameraSettings());
        }}
        onOpenStory={() => {
          setShowCameraSettings(false);
          handleOpenLiveCamera();
        }}
        onOpenReels={() => {
          setShowCameraSettings(false);
          stopCameraStream();
          onClose();
          if (onOpenReels) {
            onOpenReels();
          } else {
            window.dispatchEvent(new CustomEvent('instavibe:switch-view', { detail: 'reels' }));
          }
        }}
        onOpenLive={() => {
          setShowCameraSettings(false);
          stopCameraStream();
          onClose();
          if (onOpenLive) {
            onOpenLive();
          } else {
            window.dispatchEvent(new CustomEvent('instavibe:switch-view', { detail: 'live' }));
          }
        }}
      />

      {/* =========================================================================
          MODAL 2: EXIT & SAVE DRAFT CONFIRMATION
         ========================================================================= */}
      {showExitPrompt && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div
            className="w-full max-w-xs bg-slate-900 rounded-3xl p-5 shadow-2xl border border-white/15 text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-purple-900/40 text-purple-400 mx-auto flex items-center justify-center border border-purple-500/30">
              <Bookmark size={22} />
            </div>

            <div>
              <h4 className="font-bold text-white text-sm">
                {isAr ? 'حفظ القصة كمسودة؟' : 'Save Story as Draft?'}
              </h4>
              <p className="text-xs text-white/60 mt-1">
                {isAr
                  ? 'لم تقم بمشاركة قصتك بعد. يمكنك حفظها كمسودة لتعديلها لاحقاً.'
                  : 'You haven\'t shared your story yet. Save it to finish later.'}
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => handleSaveDraft(true)}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Bookmark size={14} />
                <span>{isAr ? 'حفظ المسودة والخروج' : 'Save Draft & Exit'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitPrompt(false);
                  stopCameraStream();
                  stopAnyActiveMusicPreview();
                  onClose();
                }}
                className="w-full py-2 text-xs font-semibold text-rose-400 hover:bg-rose-950/40 rounded-xl transition-colors"
              >
                {isAr ? 'تجاهل القصة' : 'Discard Story'}
              </button>
              <button
                type="button"
                onClick={() => setShowExitPrompt(false)}
                className="w-full py-2 text-xs font-semibold text-white/50 hover:bg-white/10 rounded-xl transition-colors"
              >
                {isAr ? 'متابعة التعديل' : 'Keep Editing'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
