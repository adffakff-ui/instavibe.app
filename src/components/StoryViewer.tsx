import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Volume2, 
  VolumeX, 
  Pause, 
  Send, 
  Clock, 
  Heart,
  Check,
  BarChart2,
  Archive,
  Eye,
  Users,
  Sparkles,
  Music,
  Star,
  AtSign,
  MapPin,
  UserCheck,
  Share2,
  TrendingUp,
  MoreVertical,
  Bot,
  Plus,
  MessageSquareOff
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { collection, doc, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useFirestore } from '../hooks/useFirestore';
import {
  EmojiBurstEvent,
  EmojiBurstOverlay,
  StoryReactionSummaryPill,
  StoryReactionTray,
  createEmojiBurstEvent,
} from './StoryReactionTray';
import { REACTION_MAP, ReactionType, normalizeReaction } from '../utils/reactions';
import UserAvatar from './UserAvatar';
import { MUSIC_TRACKS, playMusicPreview } from '../utils/musicTracks';
import {
  CloseFriendUser,
  StoryAudience,
  StoryMention,
  StoryPartnership,
  StoryPromotion,
  StorySticker,
  StoryTextOverlay,
} from '../types/story';
import { exportFullStoryImage, getFilterCssById } from '../utils/storyEffects';
import { StoryUserPickerModal, getTextOverlayStyleClasses } from './StoryStudioDrawers';
import {
  StoryAiLabelSheet,
  StoryCaptionEditSheet,
  StoryHighlightsPickerModal,
  StoryOwnerMoreSheet,
  StoryPartnershipSheet,
  StoryPromoteSheet,
  StorySendDrawer,
  StorySettingsModal,
  StoryShareSheet,
} from './StoryOwnerModals';

export interface StoryPoll {
  question: string;
  optionA: string;
  optionB: string;
  votesA: number;
  votesB: number;
  voters?: Record<string, string>;
}

export interface StoryReactionEntry {
  userId: string;
  username?: string;
  userPhotoURL?: string;
  reaction: ReactionType;
}

export interface StoryViewerEntry {
  viewerId: string;
  username?: string;
  userPhotoURL?: string;
  viewedAt?: any;
}

export interface StoryItem {
  id: string;
  authorId: string;
  authorUsername: string;
  authorPhotoURL?: string;
  mediaURL: string;
  mediaType?: 'image' | 'video';
  caption?: string;
  likesCount?: number;
  reactionCounts?: Record<string, number>;
  viewsCount?: number;
  tapsForwardCount?: number;
  tapsBackCount?: number;
  repliesCount?: number;
  poll?: StoryPoll;
  music?: {
    title: string;
    artist: string;
    genre?: string;
  };
  template?: {
    id: string;
    name: string;
    prompt: string;
  };
  collage?: {
    count: number;
    style: string;
  };
  audience?: StoryAudience;
  closeFriendIds?: string[];
  allowReplies?: boolean;
  allowComments?: boolean;
  aiLabel?: boolean;
  promoted?: StoryPromotion | null;
  filterId?: string;
  textOverlays?: StoryTextOverlay[];
  stickers?: StorySticker[];
  mentions?: StoryMention[];
  partnership?: StoryPartnership;
  createdAt: any;
  expiresAt?: string;
}

export interface StoryUserGroup {
  authorId: string;
  authorUsername: string;
  authorPhotoURL?: string;
  stories: StoryItem[];
}

interface StoryViewerProps {
  stories?: StoryItem[];
  storyGroups?: StoryUserGroup[];
  initialGroupIndex?: number;
  initialIndex?: number;
  isArchiveMode?: boolean;
  onClose: () => void;
  onStoryDeleted?: (storyId: string) => void;
  onStoryArchived?: (storyId: string) => void;
  onStoryViewed?: (storyId: string) => void;
}

export default function StoryViewer({
  stories: initialStories,
  storyGroups,
  initialGroupIndex = 0,
  initialIndex = 0,
  isArchiveMode = false,
  onClose,
  onStoryDeleted,
  onStoryArchived,
  onStoryViewed,
}: StoryViewerProps) {
  const { user, profile, isFirebaseAuthenticated, language } = useAuth();
  const { 
    deleteStory, 
    archiveStory, 
    voteStoryPoll, 
    reactToStory, 
    removeStoryReaction, 
    recordStoryView,
    recordStoryTap,
    recordStoryReply,
    toggleStoryComments,
    toggleStoryAiLabel,
    updateStoryPartnership,
    updateStoryMentions,
    updateStoryPromotion,
    updateStoryCaption,
    addCloseFriend,
    removeCloseFriend,
    getOrCreateConversation, 
    sendMessage 
  } = useFirestore();

  // Normalize input into an array of user story groups
  const groups: StoryUserGroup[] = useMemo(() => {
    if (storyGroups && storyGroups.length > 0) {
      return storyGroups.filter((g) => g.stories && g.stories.length > 0);
    }
    if (initialStories && initialStories.length > 0) {
      return [{
        authorId: initialStories[0].authorId,
        authorUsername: initialStories[0].authorUsername,
        authorPhotoURL: initialStories[0].authorPhotoURL,
        stories: initialStories,
      }];
    }
    return [];
  }, [storyGroups, initialStories]);

  // Current user group state (for continuous sequence across all users)
  const [currentGroupIndex, setCurrentGroupIndex] = useState(() => 
    Math.min(Math.max(0, initialGroupIndex), Math.max(0, groups.length - 1))
  );

  const currentGroup = groups[currentGroupIndex] || groups[0];
  const [activeStories, setActiveStories] = useState<StoryItem[]>(currentGroup?.stories || []);
  
  // Index of story within current user's stories
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.min(Math.max(0, initialIndex), Math.max(0, (currentGroup?.stories?.length || 1) - 1))
  );

  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [replySent, setReplySent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Story reaction & burst states
  const [storyReactions, setStoryReactions] = useState<StoryReactionEntry[]>([]);
  const [storyViewers, setStoryViewers] = useState<StoryViewerEntry[]>([]);
  const [showViewersSheet, setShowViewersSheet] = useState(false);
  const [viewersSheetTab, setViewersSheetTab] = useState<'viewers' | 'reactions'>('viewers');

  // Owner bottom bar & "More" menu modal states
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [showSendDrawer, setShowSendDrawer] = useState(false);
  const [showHighlightsPicker, setShowHighlightsPicker] = useState(false);
  const [showPartnershipSheet, setShowPartnershipSheet] = useState(false);
  const [showAiLabelSheet, setShowAiLabelSheet] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showPromoteSheet, setShowPromoteSheet] = useState(false);
  const [showStorySettings, setShowStorySettings] = useState(false);
  const [showCaptionEditor, setShowCaptionEditor] = useState(false);
  const [ownerUserPickerMode, setOwnerUserPickerMode] = useState<'mention' | 'close_friends' | null>(null);
  const [closeFriendsList, setCloseFriendsList] = useState<CloseFriendUser[]>([]);
  const [ownerToast, setOwnerToast] = useState<string | null>(null);

  const [bursts, setBursts] = useState<EmojiBurstEvent[]>([]);
  const [heartPopping, setHeartPopping] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaCanvasRef = useRef<HTMLDivElement>(null);
  const progressTimerRef = useRef<any>(null);
  const lastTapRef = useRef<number>(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordedViewsRef = useRef<Set<string>>(new Set());

  // Update active group stories when group index changes
  useEffect(() => {
    if (currentGroup) {
      setActiveStories(currentGroup.stories);
      setCurrentIndex(0);
      setProgress(0);
      setReplySent(false);
    }
  }, [currentGroupIndex, groups]);

  const currentStory = activeStories[currentIndex];
  const isOwner = Boolean(user && currentStory && currentStory.authorId === user.uid);
  const commentsEnabled =
    currentStory?.allowReplies !== false && currentStory?.allowComments !== false;
  const anyOverlayOpen =
    showViewersSheet ||
    confirmDelete ||
    showMoreSheet ||
    showSendDrawer ||
    showHighlightsPicker ||
    showPartnershipSheet ||
    showAiLabelSheet ||
    showShareSheet ||
    showPromoteSheet ||
    showStorySettings ||
    showCaptionEditor ||
    Boolean(ownerUserPickerMode);

  const showOwnerToast = (msg: string) => {
    setOwnerToast(msg);
    setTimeout(() => setOwnerToast(null), 2800);
  };

  // Next and previous groups for sequential previews
  const nextGroup = currentGroupIndex < groups.length - 1 ? groups[currentGroupIndex + 1] : null;
  const prevGroup = currentGroupIndex > 0 ? groups[currentGroupIndex - 1] : null;

  // Record story view automatically
  useEffect(() => {
    if (!currentStory?.id || !user || !isFirebaseAuthenticated) return;
    
    // Notify parent component asynchronously
    if (onStoryViewed) {
      setTimeout(() => onStoryViewed(currentStory.id), 0);
    }

    // Record view in Firestore once per story per session
    if (!recordedViewsRef.current.has(currentStory.id)) {
      recordedViewsRef.current.add(currentStory.id);
      recordStoryView(currentStory.id, user.uid, {
        username: profile?.username || 'user',
        photoURL: profile?.photoURL || '',
      });
    }
  }, [currentStory?.id, user, isFirebaseAuthenticated]);

  // Expiration format helper
  const getExpiresRemaining = (expiresAtStr?: string) => {
    if (!expiresAtStr) return null;
    try {
      const expires = new Date(expiresAtStr).getTime();
      const diffMs = expires - Date.now();
      if (diffMs <= 0) {
        return { text: language === 'ar' ? 'انتهت الصلاحية' : 'Expired', isUrgent: true };
      }
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      if (diffHours <= 0) {
        return { 
          text: language === 'ar' ? `متبقي ${diffMinutes} دقيقة` : `${diffMinutes}m left`, 
          isUrgent: true 
        };
      }
      if (diffHours === 1) {
        return { 
          text: language === 'ar' ? 'متبقي ساعة واحدة' : '1h left', 
          isUrgent: true 
        };
      }
      return { 
        text: language === 'ar' ? `متبقي ${diffHours} س` : `${diffHours}h left`, 
        isUrgent: diffHours <= 2 
      };
    } catch {
      return null;
    }
  };

  // Sequence navigation: Next story or next user group
  const handleNext = (fromTap: boolean = false) => {
    if (fromTap && !isArchiveMode && user && currentStory?.id) {
      recordStoryTap(currentStory.id, 'forward');
    }
    if (currentIndex < activeStories.length - 1) {
      // Advance to next story of same user
      setCurrentIndex((prev) => prev + 1);
      setProgress(0);
      setReplySent(false);
    } else if (currentGroupIndex < groups.length - 1) {
      // Seamlessly advance to NEXT user's story sequence!
      setCurrentGroupIndex((prev) => prev + 1);
      setCurrentIndex(0);
      setProgress(0);
      setReplySent(false);
    } else {
      // Reached the very end of all stories across all users
      onClose();
    }
  };

  // Sequence navigation: Previous story or previous user group
  const handlePrev = (fromTap: boolean = false) => {
    if (fromTap && !isArchiveMode && user && currentStory?.id) {
      recordStoryTap(currentStory.id, 'back');
    }
    if (currentIndex > 0) {
      // Go to previous story of same user
      setCurrentIndex((prev) => prev - 1);
      setProgress(0);
      setReplySent(false);
    } else if (currentGroupIndex > 0) {
      // Go back to PREVIOUS user's last story
      const targetPrevGroup = groups[currentGroupIndex - 1];
      const targetIndex = Math.max(0, (targetPrevGroup?.stories?.length || 1) - 1);
      setCurrentGroupIndex((prev) => prev - 1);
      setCurrentIndex(targetIndex);
      setProgress(0);
      setReplySent(false);
    }
  };

  // Cleanup tap timer on unmount
  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    };
  }, []);

  // Real-time story reactions listener
  useEffect(() => {
    if (!currentStory?.id || !user || !isFirebaseAuthenticated) {
      setStoryReactions([]);
      return;
    }

    const reactionsRef = query(
      collection(db, 'stories', currentStory.id, 'reactions'),
      where('storyId', '==', currentStory.id)
    );
    const unsub = onSnapshot(
      reactionsRef,
      (snap) => {
        const list: StoryReactionEntry[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            userId: d.id,
            username: data.username,
            userPhotoURL: data.userPhotoURL,
            reaction: normalizeReaction(data.reaction, 'heart'),
          };
        });
        setStoryReactions(list);
      },
      (err) => console.warn('Story reactions listener notice:', err)
    );

    return unsub;
  }, [currentStory?.id, user, isFirebaseAuthenticated]);

  // Real-time story viewers listener (active for story author or insight checks)
  useEffect(() => {
    if (!isOwner || !currentStory?.id || !isFirebaseAuthenticated) {
      setStoryViewers([]);
      return;
    }

    const viewersRef = query(
      collection(db, 'stories', currentStory.id, 'viewers'),
      orderBy('viewedAt', 'desc'),
      limit(100)
    );
    const unsub = onSnapshot(
      viewersRef,
      (snap) => {
        const list: StoryViewerEntry[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            viewerId: d.id,
            username: data.username,
            userPhotoURL: data.userPhotoURL,
            viewedAt: data.viewedAt,
          };
        });
        setStoryViewers(list);
      },
      (err) => console.warn('Story viewers listener notice:', err)
    );

    return unsub;
  }, [currentStory?.id, isOwner, isFirebaseAuthenticated]);

  // Real-time listener on the story document so reactionCounts & likesCount saved on the story stay synced
  useEffect(() => {
    const storyId = currentStory?.id;
    if (!storyId || !user || !isFirebaseAuthenticated) return;

    const storyDocRef = doc(db, 'stories', storyId);
    const unsub = onSnapshot(
      storyDocRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as any;
        setActiveStories((prev) =>
          prev.map((item) =>
            item.id === storyId
              ? {
                  ...item,
                  likesCount: typeof data.likesCount === 'number' ? data.likesCount : item.likesCount,
                  reactionCounts:
                    data.reactionCounts && typeof data.reactionCounts === 'object'
                      ? data.reactionCounts
                      : item.reactionCounts,
                  viewsCount: typeof data.viewsCount === 'number' ? data.viewsCount : item.viewsCount,
                  repliesCount: typeof data.repliesCount === 'number' ? data.repliesCount : item.repliesCount,
                }
              : item
          )
        );
      },
      (err) => console.warn('Story doc reaction sync listener notice:', err)
    );

    return unsub;
  }, [currentStory?.id, user, isFirebaseAuthenticated]);

  // Real-time listener for Close Friends (for owner Story Settings / Close Friends picker)
  useEffect(() => {
    if (!isOwner || !user?.uid || !isFirebaseAuthenticated) {
      setCloseFriendsList([]);
      return;
    }
    const unsub = onSnapshot(
      collection(db, 'users', user.uid, 'closeFriends'),
      (snap) => {
        setCloseFriendsList(
          snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              friendId: d.id,
              username: data.username || 'user',
              photoURL: data.photoURL || '',
            };
          })
        );
      },
      (err) => console.warn('Close friends listener notice:', err)
    );
    return unsub;
  }, [isOwner, user?.uid, isFirebaseAuthenticated]);

  // Progress Bar Timer for Images / Fallback
  useEffect(() => {
    setProgress(0);
    setConfirmDelete(false);

    if (!currentStory) return;

    // For video, we handle progress via onTimeUpdate
    if (currentStory.mediaType === 'video') {
      return;
    }

    const DURATION_MS = 5000;
    const INTERVAL_MS = 50;
    const STEP = (INTERVAL_MS / DURATION_MS) * 100;

    progressTimerRef.current = setInterval(() => {
      if (isPaused || anyOverlayOpen) return;

      setProgress((prev) => {
        if (prev >= 100) {
          handleNext(false);
          return 0;
        }
        return prev + STEP;
      });
    }, INTERVAL_MS);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [currentIndex, currentStory, currentGroupIndex, isPaused, anyOverlayOpen, activeStories.length]);

  // Video Time Update Handler
  const handleVideoTimeUpdate = () => {
    if (!videoRef.current) return;
    const duration = videoRef.current.duration;
    const currentTime = videoRef.current.currentTime;
    if (duration > 0) {
      const pct = (currentTime / duration) * 100;
      setProgress(pct);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showMoreSheet) setShowMoreSheet(false);
        else if (showSendDrawer) setShowSendDrawer(false);
        else if (showHighlightsPicker) setShowHighlightsPicker(false);
        else if (showPartnershipSheet) setShowPartnershipSheet(false);
        else if (showAiLabelSheet) setShowAiLabelSheet(false);
        else if (showShareSheet) setShowShareSheet(false);
        else if (showPromoteSheet) setShowPromoteSheet(false);
        else if (showStorySettings) setShowStorySettings(false);
        else if (showCaptionEditor) setShowCaptionEditor(false);
        else if (ownerUserPickerMode) setOwnerUserPickerMode(null);
        else if (showViewersSheet) setShowViewersSheet(false);
        else onClose();
      }
      if (anyOverlayOpen) return;
      if (e.key === 'ArrowRight') {
        if (language === 'ar') handlePrev(true);
        else handleNext(true);
      }
      if (e.key === 'ArrowLeft') {
        if (language === 'ar') handleNext(true);
        else handlePrev(true);
      }
      if (e.key === ' ') {
        e.preventDefault();
        setIsPaused((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentIndex,
    currentGroupIndex,
    activeStories.length,
    anyOverlayOpen,
    showViewersSheet,
    showMoreSheet,
    showSendDrawer,
    showHighlightsPicker,
    showPartnershipSheet,
    showAiLabelSheet,
    showShareSheet,
    showPromoteSheet,
    showStorySettings,
    showCaptionEditor,
    ownerUserPickerMode,
  ]);

  // Pause / Resume Video
  useEffect(() => {
    if (videoRef.current && currentStory?.mediaType === 'video') {
      if (isPaused || anyOverlayOpen) {
        videoRef.current.pause();
        setIsVideoPlaying(false);
      } else {
        videoRef.current.play().catch(() => {});
        setIsVideoPlaying(true);
      }
    }
  }, [isPaused, anyOverlayOpen, currentStory]);

  const handleArchiveCurrentStory = async () => {
    if (!currentStory || !isOwner || archiving) return;
    const storyIdToArchive = currentStory.id;
    setArchiving(true);
    try {
      await archiveStory(storyIdToArchive);
      if (onStoryArchived) {
        setTimeout(() => onStoryArchived(storyIdToArchive), 0);
      }
      const updated = activeStories.filter((s) => s.id !== storyIdToArchive);
      if (updated.length === 0) {
        handleNext();
      } else {
        setActiveStories(updated);
        setCurrentIndex((prev) => Math.min(prev, updated.length - 1));
        setProgress(0);
      }
    } catch (err) {
      console.error('Failed to archive story:', err);
    } finally {
      setArchiving(false);
    }
  };

  const handleDeleteCurrentStory = async () => {
    if (!currentStory || !isOwner) return;
    const storyIdToDelete = currentStory.id;

    try {
      await deleteStory(storyIdToDelete);
      if (onStoryDeleted) {
        setTimeout(() => onStoryDeleted(storyIdToDelete), 0);
      }

      const updated = activeStories.filter((s) => s.id !== storyIdToDelete);
      if (updated.length === 0) {
        handleNext();
      } else {
        setActiveStories(updated);
        setCurrentIndex((prev) => Math.min(prev, updated.length - 1));
        setProgress(0);
      }
    } catch (err) {
      console.error('Failed to delete story:', err);
    }
  };

  const handleSaveCurrentStoryMedia = async () => {
    if (!currentStory) return;
    try {
      let downloadHref = currentStory.mediaURL;
      const isVideo = currentStory.mediaType === 'video';

      if (!isVideo) {
        try {
          downloadHref = await exportFullStoryImage({
            sourceUrl: currentStory.mediaURL,
            filterCss: getFilterCssById(currentStory.filterId),
            strokes: [],
            textOverlays: currentStory.textOverlays || [],
            stickers: currentStory.stickers || [],
            mentions: currentStory.mentions || [],
            partnership: currentStory.partnership || null,
            caption: currentStory.caption,
          });
        } catch {
          downloadHref = currentStory.mediaURL;
        }
      }

      const a = document.createElement('a');
      a.href = downloadHref;
      a.download = `instavibe-story-${currentStory.id}.${isVideo ? 'mp4' : 'jpg'}`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showOwnerToast(
        language === 'ar' ? 'تم حفظ القصة على جهازك' : 'Story saved to your device'
      );
    } catch (err) {
      console.error('Failed to save story media:', err);
      showOwnerToast(language === 'ar' ? 'تعذر حفظ الملف' : 'Could not save media');
    }
  };

  const patchLocalCurrentStory = (patch: Partial<StoryItem>) => {
    setActiveStories((prev) =>
      prev.map((s, idx) => (idx === currentIndex ? { ...s, ...patch } : s))
    );
  };

  const handleToggleCommentsOnCurrent = async () => {
    if (!currentStory || !isOwner) return;
    const nextEnabled = !commentsEnabled;
    patchLocalCurrentStory({ allowReplies: nextEnabled, allowComments: nextEnabled });
    try {
      await toggleStoryComments(currentStory.id, nextEnabled);
      showOwnerToast(
        nextEnabled
          ? language === 'ar'
            ? 'تم تشغيل التعليقات والردود'
            : 'Comments turned on'
          : language === 'ar'
          ? 'تم إيقاف تشغيل التعليقات والردود'
          : 'Comments turned off'
      );
    } catch (err) {
      console.error('Failed to toggle comments:', err);
    }
  };

  const handleToggleAiLabelOnCurrent = async (next: boolean) => {
    if (!currentStory || !isOwner) return;
    patchLocalCurrentStory({ aiLabel: next });
    await toggleStoryAiLabel(currentStory.id, next);
    showOwnerToast(
      next
        ? language === 'ar'
          ? 'تمت إضافة تسمية الذكاء الاصطناعي'
          : 'AI label added'
        : language === 'ar'
        ? 'تمت إزالة تسمية الذكاء الاصطناعي'
        : 'AI label removed'
    );
  };

  const handleSavePartnershipOnCurrent = async (
    next: StoryPartnership | null,
    isNewPartner: boolean
  ) => {
    if (!currentStory || !isOwner) return;
    patchLocalCurrentStory({ partnership: next || undefined });
    await updateStoryPartnership(
      currentStory.id,
      next,
      profile || (user ? { uid: user.uid, username: 'user', photoURL: '' } : undefined),
      isNewPartner
    );
    showOwnerToast(
      language === 'ar' ? 'تم تحديث إعدادات الشراكة' : 'Partnership settings updated'
    );
  };

  const handleAddLiveMention = async (target: {
    uid: string;
    username: string;
    photoURL?: string;
  }) => {
    if (!currentStory || !isOwner) return;
    const existing = currentStory.mentions || [];
    if (existing.some((m) => m.uid === target.uid)) {
      showOwnerToast(
        language === 'ar'
          ? `@${target.username} مذكور بالفعل في هذه القصة`
          : `@${target.username} is already mentioned`
      );
      return;
    }
    const offset = (existing.length % 4) * 10;
    const newMention: StoryMention = {
      uid: target.uid,
      username: target.username,
      photoURL: target.photoURL || '',
      x: 50,
      y: Math.min(82, 42 + offset),
    };
    const nextMentions = [...existing, newMention];
    patchLocalCurrentStory({ mentions: nextMentions });
    await updateStoryMentions(
      currentStory.id,
      nextMentions,
      target.uid,
      profile || (user ? { uid: user.uid, username: 'user', photoURL: '' } : undefined)
    );
    showOwnerToast(
      language === 'ar' ? `تم ذكر @${target.username} في القصة` : `Mentioned @${target.username}`
    );
  };

  const handleSavePromotionOnCurrent = async (next: StoryPromotion | null) => {
    if (!currentStory || !isOwner) return;
    patchLocalCurrentStory({ promoted: next });
    await updateStoryPromotion(currentStory.id, next);
    showOwnerToast(
      next
        ? language === 'ar'
          ? 'تم تفعيل ترويج القصة بنجاح!'
          : 'Story boost activated!'
        : language === 'ar'
        ? 'تم إيقاف ترويج القصة'
        : 'Story boost paused'
    );
  };

  const handleSaveCaptionOnCurrent = async (nextCaption: string) => {
    if (!currentStory || !isOwner) return;
    const trimmed = nextCaption.trim();
    patchLocalCurrentStory({ caption: trimmed });
    await updateStoryCaption(currentStory.id, trimmed);
    showOwnerToast(
      language === 'ar' ? 'تم تحديث نص القصة' : 'Story caption updated'
    );
  };

  const handleVotePoll = async (choice: 'A' | 'B') => {
    if (!user || !currentStory || !currentStory.poll) return;

    try {
      await voteStoryPoll(currentStory.id, user.uid, choice, currentStory.poll);
      
      const updatedPoll = { ...currentStory.poll };
      const voters = updatedPoll.voters || {};
      const prevChoice = voters[user.uid];

      if (prevChoice !== choice) {
        if (prevChoice === 'A') updatedPoll.votesA = Math.max(0, updatedPoll.votesA - 1);
        if (prevChoice === 'B') updatedPoll.votesB = Math.max(0, updatedPoll.votesB - 1);

        if (choice === 'A') updatedPoll.votesA += 1;
        if (choice === 'B') updatedPoll.votesB += 1;

        voters[user.uid] = choice;
        updatedPoll.voters = voters;

        const updatedStories = [...activeStories];
        updatedStories[currentIndex] = {
          ...currentStory,
          poll: updatedPoll,
        };
        setActiveStories(updatedStories);
      }
    } catch (err) {
      console.error('Failed to vote on poll:', err);
    }
  };

  const spawnBurst = (
    emoji: string,
    x: number = 50,
    y: number = 82,
    direction: 'fountain' | 'radial' = 'fountain'
  ) => {
    const burstEvent = createEmojiBurstEvent(emoji, x, y, direction);
    setBursts((prev) => [...prev, burstEvent]);
    setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b.id !== burstEvent.id));
    }, 1050);
  };

  const getBurstCoordsFromButton = (buttonEl?: HTMLButtonElement | null): { x: number; y: number } => {
    if (!buttonEl || !mediaCanvasRef.current) {
      return { x: 50, y: 84 };
    }
    const canvasRect = mediaCanvasRef.current.getBoundingClientRect();
    const btnRect = buttonEl.getBoundingClientRect();
    if (canvasRect.width <= 0) {
      return { x: 50, y: 84 };
    }
    const btnCenterX = btnRect.left + btnRect.width / 2;
    const xPct = ((btnCenterX - canvasRect.left) / canvasRect.width) * 100;
    return {
      x: Math.min(90, Math.max(10, xPct)),
      y: 86,
    };
  };

  const currentUserReaction: ReactionType | null =
    storyReactions.find((r) => r.userId === user?.uid)?.reaction ?? null;

  const derivedReactionCounts: Record<string, number> = (() => {
    if (storyReactions.length > 0) {
      return storyReactions.reduce((acc, item) => {
        acc[item.reaction] = (acc[item.reaction] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    }
    return currentStory?.reactionCounts || {};
  })();

  const totalStoryReactionsCount =
    storyReactions.length > 0
      ? storyReactions.length
      : currentStory?.likesCount ||
        Object.values(derivedReactionCounts).reduce((sum, n) => sum + (typeof n === 'number' ? n : 0), 0);

  const totalViewsCount = Math.max(
    currentStory?.viewsCount || 0,
    storyViewers.length
  );

  const applyStoryReaction = async (
    reaction: ReactionType,
    options?: {
      keepExisting?: boolean;
      burstCoords?: { x: number; y: number };
      triggerEl?: HTMLButtonElement | null;
    }
  ) => {
    if (!user || !currentStory) return;
    const prev = currentUserReaction;

    if (options?.keepExisting && prev) {
      if (options.burstCoords) {
        spawnBurst(REACTION_MAP[prev].emoji, options.burstCoords.x, options.burstCoords.y, 'radial');
      }
      return;
    }

    if (prev === reaction) {
      // Optimistically update story document counts & user reaction when toggling off
      const nextCounts: Record<string, number> = { ...(currentStory.reactionCounts || derivedReactionCounts) };
      if (typeof nextCounts[prev] === 'number' && nextCounts[prev] > 0) {
        const decremented = nextCounts[prev] - 1;
        if (decremented > 0) nextCounts[prev] = decremented;
        else delete nextCounts[prev];
      }
      patchLocalCurrentStory({
        likesCount: Math.max(0, (currentStory.likesCount ?? totalStoryReactionsCount) - 1),
        reactionCounts: nextCounts,
      });
      setStoryReactions((list) => list.filter((item) => item.userId !== user.uid));
      await removeStoryReaction(currentStory.id, user.uid);
      return;
    }

    // Record / switch reaction & trigger celebratory burst animation
    const emoji = REACTION_MAP[reaction].emoji;
    if (options?.burstCoords) {
      spawnBurst(emoji, options.burstCoords.x, options.burstCoords.y, 'radial');
    } else {
      const origin = getBurstCoordsFromButton(options?.triggerEl);
      spawnBurst(emoji, origin.x, origin.y, 'fountain');
    }

    if (reaction === 'heart') {
      setHeartPopping(true);
      setTimeout(() => setHeartPopping(false), 360);
    }

    // Optimistically sync both story document reactionCounts & reactions list
    const nextCounts: Record<string, number> = { ...(currentStory.reactionCounts || derivedReactionCounts) };
    if (prev && typeof nextCounts[prev] === 'number' && nextCounts[prev] > 0) {
      const decremented = nextCounts[prev] - 1;
      if (decremented > 0) nextCounts[prev] = decremented;
      else delete nextCounts[prev];
    }
    nextCounts[reaction] = (nextCounts[reaction] || 0) + 1;
    const nextLikesCount = prev
      ? Math.max(1, currentStory.likesCount ?? totalStoryReactionsCount)
      : (currentStory.likesCount ?? totalStoryReactionsCount) + 1;

    patchLocalCurrentStory({
      likesCount: nextLikesCount,
      reactionCounts: nextCounts,
    });

    setStoryReactions((list) => {
      const filtered = list.filter((item) => item.userId !== user.uid);
      return [
        ...filtered,
        {
          userId: user.uid,
          username: profile?.username || 'user',
          userPhotoURL: profile?.photoURL || '',
          reaction,
        },
      ];
    });

    await reactToStory(
      currentStory.id,
      user.uid,
      currentStory.authorId,
      profile || { uid: user.uid, username: language === 'ar' ? 'مستخدم' : 'User', photoURL: '' },
      reaction
    );
  };

  const handleZoneTap = (direction: 'prev' | 'next', e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const now = Date.now();
    const rect = mediaCanvasRef.current?.getBoundingClientRect();
    const x = rect ? ((e.clientX - rect.left) / rect.width) * 100 : 50;
    const y = rect ? ((e.clientY - rect.top) / rect.height) * 100 : 50;

    // Double-tap to heart
    if (now - lastTapRef.current < 280) {
      lastTapRef.current = 0;
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      applyStoryReaction('heart', { keepExisting: true, burstCoords: { x, y } });
      return;
    }

    lastTapRef.current = now;
    if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    singleTapTimerRef.current = setTimeout(() => {
      singleTapTimerRef.current = null;
      if (direction === 'prev') {
        handlePrev(true);
      } else {
        handleNext(true);
      }
    }, 220);
  };

  const handleSendReply = async (textToSend?: string) => {
    const content = textToSend || replyText;
    if (!content.trim() || !user || !currentStory) return;

    try {
      const convId = await getOrCreateConversation(user.uid, currentStory.authorId);
      if (convId) {
        await sendMessage(
          convId,
          user.uid,
          language === 'ar' ? `رد على القصة: "${content}"` : `Replied to story: "${content}"`,
          currentStory.authorId,
          profile || { uid: user.uid, username: language === 'ar' ? 'مستخدم' : 'Anonymous' }
        );
        if (!isArchiveMode) {
          recordStoryReply(currentStory.id);
        }
        setReplyText('');
        setReplySent(true);
        setTimeout(() => setReplySent(false), 2500);
      }
    } catch (err) {
      console.error('Failed to reply to story:', err);
    }
  };

  if (!currentStory) return null;

  const expiresInfo = getExpiresRemaining(currentStory.expiresAt);
  const userVote = user && currentStory.poll?.voters ? currentStory.poll.voters[user.uid] : null;
  const totalVotes = (currentStory.poll?.votesA || 0) + (currentStory.poll?.votesB || 0);
  const pctA = totalVotes > 0 ? Math.round(((currentStory.poll?.votesA || 0) / totalVotes) * 100) : 50;
  const pctB = totalVotes > 0 ? 100 - pctA : 50;

  return (
    <div className="fixed inset-0 z-[130] h-[100dvh] bg-black sm:bg-black/90 backdrop-blur-md flex items-center justify-center sm:p-4 select-none">
      {/* Blurred background ambiance */}
      {currentStory.mediaType !== 'video' && (
        <div className="absolute inset-0 opacity-40 blur-3xl overflow-hidden pointer-events-none scale-125">
          <img src={currentStory.mediaURL} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Main Story Container (Edge-to-edge on mobile, 9:16 Aspect Ratio on desktop/tablet) */}
      <div 
        className="relative w-full sm:max-w-[420px] h-full sm:h-[92dvh] sm:max-h-[820px] sm:aspect-[9/16] bg-slate-950 rounded-none sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col border-0 sm:border sm:border-white/10 pt-safe pb-safe sm:pt-0 sm:pb-0"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Top Segmented Progress Bars & Multi-user Sequence Header */}
        <div className="absolute top-2.5 inset-x-3 flex flex-col gap-1 z-30">
          <div className="flex items-center justify-between text-[10px] font-semibold text-white/85 px-0.5">
            <div className="flex items-center gap-1.5 drop-shadow-sm">
              <span className="bg-white/20 backdrop-blur-md px-1.5 py-0.5 rounded-full font-medium">
                {language === 'ar'
                  ? `المقطع ${currentIndex + 1} / ${activeStories.length}`
                  : `Segment ${currentIndex + 1} / ${activeStories.length}`}
              </span>
              {groups.length > 1 && (
                <span className="text-white/60 font-normal">
                  • {language === 'ar' ? `حساب ${currentGroupIndex + 1} من ${groups.length}` : `User ${currentGroupIndex + 1} of ${groups.length}`}
                </span>
              )}
            </div>
            
            {/* Countdown seconds for active story */}
            <span className="drop-shadow-sm font-mono tabular-nums text-white/80">
              {language === 'ar'
                ? `متبقي ${Math.max(0, Math.round(5 - (progress / 100) * 5))} ث`
                : `${Math.max(0, Math.round(5 - (progress / 100) * 5))}s`}
            </span>
          </div>

          {/* Segmented Line for Active User's Stories */}
          <div className="flex gap-1.5" dir="ltr">
            {activeStories.map((_, idx) => {
              const isCurrent = idx === currentIndex;
              const isPast = idx < currentIndex;
              return (
                <div 
                  key={idx} 
                  className={`h-1.5 flex-1 rounded-full overflow-hidden backdrop-blur-md transition-all ${
                    isCurrent ? 'bg-white/40 ring-1 ring-white/50' : 'bg-white/20'
                  }`}
                >
                  <div 
                    className="h-full bg-gradient-to-r from-white via-slate-100 to-white transition-all ease-linear shadow-sm"
                    style={{ 
                      width: isCurrent ? `${progress}%` : isPast ? '100%' : '0%' 
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Story Header */}
        <div className="absolute top-12 inset-x-3 flex items-center justify-between z-30 pointer-events-auto">
          <div className="flex items-center gap-2.5">
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full ring-2 ring-gradient-to-tr ring-purple-500 overflow-hidden bg-slate-800 shadow-md">
                <UserAvatar
                  src={currentStory.authorPhotoURL}
                  username={currentStory.authorUsername}
                  iconSize={18}
                />
              </div>
              {isOwner && !isArchiveMode && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                    window.dispatchEvent(new CustomEvent('instavibe:open-story-creation'));
                  }}
                  className="absolute -bottom-0.5 -end-0.5 w-[18px] h-[18px] rounded-full bg-slate-900 text-white border-2 border-slate-950 flex items-center justify-center hover:bg-purple-600 transition-colors shadow"
                  title={language === 'ar' ? 'إضافة قصة جديدة' : 'Add another story'}
                  aria-label={language === 'ar' ? 'إضافة قصة جديدة' : 'Add another story'}
                >
                  <Plus size={10} strokeWidth={3} />
                </button>
              )}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-white text-xs font-bold drop-shadow-sm truncate max-w-[130px]">
                  {currentStory.authorUsername}
                </span>
                <span className="text-white/60 text-[10px]">
                  {currentStory.createdAt?.toDate 
                    ? formatDistanceToNow(currentStory.createdAt.toDate(), { addSuffix: false, locale: language === 'ar' ? ar : undefined }) 
                    : (language === 'ar' ? 'الآن' : 'just now')}
                </span>
                {currentStory.audience === 'close_friends' && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-extrabold shadow-sm"
                    title={language === 'ar' ? 'للأصدقاء المقربين فقط' : 'Close Friends only'}
                  >
                    <Star size={9} fill="currentColor" />
                    <span>{language === 'ar' ? 'الأصدقاء المقربون' : 'Close Friends'}</span>
                  </span>
                )}
              </div>
              
              {/* Expiration, AI Label, Promoted, or Archive Metadata */}
              <div className="flex items-center gap-2 flex-wrap">
                {isArchiveMode ? (
                  <div className="flex items-center gap-1 text-[10px] text-purple-300 font-semibold">
                    <Archive size={10} />
                    <span>
                      {currentStory.createdAt?.toDate
                        ? format(currentStory.createdAt.toDate(), 'd MMM yyyy', {
                            locale: language === 'ar' ? ar : undefined,
                          })
                        : (language === 'ar' ? 'قصة مؤرشفة' : 'Archived')}
                    </span>
                  </div>
                ) : (
                  expiresInfo && (
                    <div className={`flex items-center gap-1 text-[10px] font-medium ${
                      expiresInfo.isUrgent ? 'text-amber-300' : 'text-slate-300'
                    }`}>
                      <Clock size={10} />
                      <span>{expiresInfo.text}</span>
                    </div>
                  )
                )}

                {currentStory.aiLabel && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-sky-300 font-semibold">
                    <Bot size={10} />
                    <span>{language === 'ar' ? 'معلومات الذكاء الاصطناعي' : 'AI info'}</span>
                  </span>
                )}

                {isOwner && currentStory.promoted?.isPromoted && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-purple-300 font-semibold">
                    <TrendingUp size={10} />
                    <span>{language === 'ar' ? 'مروّجة' : 'Promoted'}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons in header */}
          <div className="flex items-center gap-1">
            {currentStory.mediaType === 'video' && (
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted(!isMuted);
                }} 
                className="p-2 text-white/90 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                title={isMuted ? (language === 'ar' ? 'إلغاء الكتم' : 'Unmute') : (language === 'ar' ? 'كتم الصوت' : 'Mute')}
              >
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            )}

            {isOwner && !isArchiveMode && (
              <button
                type="button"
                disabled={archiving}
                onClick={(e) => {
                  e.stopPropagation();
                  handleArchiveCurrentStory();
                }}
                className="p-2 text-white/80 hover:text-purple-300 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
                title={language === 'ar' ? 'نقل إلى الأرشيف الآن' : 'Move to Archive now'}
              >
                <Archive size={17} />
              </button>
            )}

            {isOwner && (
              <div className="relative">
                {confirmDelete ? (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 bg-red-600/90 text-white rounded-full px-2 py-1 text-[11px] font-semibold shadow-lg"
                  >
                    <span>{language === 'ar' ? 'حذف؟' : 'Delete?'}</span>
                    <button 
                      onClick={handleDeleteCurrentStory} 
                      className="p-1 hover:bg-black/30 rounded-full"
                      title={language === 'ar' ? 'تأكيد الحذف' : 'Confirm delete'}
                    >
                      <Check size={14} />
                    </button>
                    <button 
                      onClick={() => setConfirmDelete(false)} 
                      className="p-1 hover:bg-black/30 rounded-full"
                      title={language === 'ar' ? 'إلغاء' : 'Cancel'}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(true);
                    }}
                    className="p-2 text-white/80 hover:text-red-400 hover:bg-white/10 rounded-full transition-colors"
                    title={language === 'ar' ? 'حذف القصة' : 'Delete story'}
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            )}

            {/* Close Story */}
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }} 
              className="p-2 text-white hover:bg-white/15 rounded-full transition-colors"
              aria-label="Close stories"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Media Canvas Area */}
        <div
          ref={mediaCanvasRef}
          className="flex-1 relative bg-black flex items-center justify-center overflow-hidden"
        >
          <EmojiBurstOverlay bursts={bursts} />

          {/* Live Story Reactions Summary Pill on Canvas */}
          {totalStoryReactionsCount > 0 && (
            <div className="absolute bottom-3 start-3 z-20">
              <StoryReactionSummaryPill
                reactionCounts={derivedReactionCounts}
                totalCount={totalStoryReactionsCount}
                language={language}
                onClick={
                  isOwner
                    ? () => {
                        setViewersSheetTab('reactions');
                        setShowViewersSheet(true);
                      }
                    : undefined
                }
              />
            </div>
          )}

          {currentStory.mediaType === 'video' ? (
            <video
              ref={videoRef}
              src={currentStory.mediaURL}
              autoPlay
              playsInline
              muted={isMuted}
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={() => handleNext(false)}
              style={{
                filter: currentStory.filterId && currentStory.filterId !== 'none'
                  ? getFilterCssById(currentStory.filterId)
                  : undefined,
              }}
              className="w-full h-full object-cover"
            />
          ) : (
            <img 
              src={currentStory.mediaURL} 
              alt="Story" 
              className="w-full h-full object-cover" 
              draggable={false}
            />
          )}

          {/* PARTNERSHIP TAG OVERLAY */}
          {currentStory.partnership &&
            (currentStory.partnership.isPaid || currentStory.partnership.partnerUsername) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentStory.partnership?.partnerId) {
                    window.dispatchEvent(
                      new CustomEvent('instavibe:open-profile', {
                        detail: currentStory.partnership.partnerId,
                      })
                    );
                    onClose();
                  }
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                className="absolute top-24 end-3 z-20 pointer-events-auto px-3 py-1 rounded-full bg-black/65 backdrop-blur-md border border-white/20 text-[11px] font-bold text-white flex items-center gap-1.5 shadow-lg hover:bg-black/80 transition-colors"
              >
                <UserCheck size={12} className="text-indigo-400" />
                <span>
                  {currentStory.partnership.partnerUsername
                    ? language === 'ar'
                      ? `شراكة مع @${currentStory.partnership.partnerUsername}`
                      : `Partnered with @${currentStory.partnership.partnerUsername}`
                    : language === 'ar'
                    ? 'شراكة مدفوعة'
                    : 'Paid Partnership'}
                </span>
              </button>
            )}

          {/* RICH TEXT OVERLAYS */}
          {Array.isArray(currentStory.textOverlays) &&
            currentStory.textOverlays.map((item) => {
              const bg =
                item.bgStyle === 'solid'
                  ? item.color === '#ffffff'
                    ? '#0f172a'
                    : item.color
                  : item.bgStyle === 'translucent'
                  ? 'rgba(0,0,0,0.62)'
                  : 'transparent';
              const txtColor =
                item.bgStyle === 'solid' && item.color !== '#ffffff' ? '#ffffff' : item.color;
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
                  className={`absolute z-20 pointer-events-none px-3.5 py-1.5 rounded-2xl text-lg sm:text-xl text-center max-w-[78%] whitespace-pre-wrap break-words select-none ${getTextOverlayStyleClasses(
                    item
                  )}`}
                >
                  {item.text}
                </div>
              );
            })}

          {/* STICKERS OVERLAYS */}
          {Array.isArray(currentStory.stickers) &&
            currentStory.stickers.map((stk) => (
              <div
                key={stk.id}
                style={{
                  left: `${stk.x}%`,
                  top: `${stk.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute z-20 pointer-events-none select-none"
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

          {/* CLICKABLE @MENTIONS OVERLAYS */}
          {Array.isArray(currentStory.mentions) &&
            currentStory.mentions.map((m) => (
              <button
                key={m.uid}
                type="button"
                style={{
                  left: `${m.x}%`,
                  top: `${m.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent('instavibe:open-profile', { detail: m.uid }));
                  onClose();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                className="absolute z-20 pointer-events-auto px-3 py-1.5 rounded-full bg-slate-950/85 hover:bg-slate-900 backdrop-blur-md border border-white/30 text-white text-xs font-extrabold shadow-xl flex items-center gap-1 active:scale-95 transition-transform"
              >
                <AtSign size={12} className="text-amber-400" />
                <span>{m.username}</span>
              </button>
            ))}

          {/* INTERACTIVE POLL STICKER OVERLAY */}
          {currentStory.poll && (
            <div 
              className="absolute top-1/3 inset-x-4 z-20 pointer-events-auto bg-slate-900/85 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-white/20 text-white space-y-3"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
                <BarChart2 size={14} />
                <span>{language === 'ar' ? 'استطلاع القصة' : 'Story Poll'}</span>
                <span className="text-[10px] text-white/50 ms-auto font-normal font-mono tabular-nums">
                  {totalVotes}{' '}
                  {language === 'ar'
                    ? (totalVotes === 1 ? 'صوت' : 'أصوات')
                    : (totalVotes === 1 ? 'vote' : 'votes')}
                </span>
              </div>

              <h4 className="font-bold text-sm text-white leading-snug">
                {currentStory.poll.question}
              </h4>

              <div className="space-y-2 pt-1">
                {/* Option A */}
                <button
                  type="button"
                  onClick={() => handleVotePoll('A')}
                  className={`relative w-full overflow-hidden rounded-xl p-3 text-start transition-all border ${
                    userVote === 'A'
                      ? 'bg-purple-600/40 border-purple-400 text-white font-bold'
                      : 'bg-white/10 hover:bg-white/20 border-white/15 text-white'
                  }`}
                >
                  <div 
                    className="absolute inset-0 bg-purple-500/30 transition-all ease-out" 
                    style={{ width: `${pctA}%` }} 
                  />
                  <div className="relative flex items-center justify-between text-xs font-semibold z-10">
                    <span className="flex items-center gap-1.5">
                      {userVote === 'A' && <Check size={14} className="text-purple-300" />}
                      {currentStory.poll.optionA}
                    </span>
                    <span className="font-mono text-xs font-bold tabular-nums">{pctA}%</span>
                  </div>
                </button>

                {/* Option B */}
                <button
                  type="button"
                  onClick={() => handleVotePoll('B')}
                  className={`relative w-full overflow-hidden rounded-xl p-3 text-start transition-all border ${
                    userVote === 'B'
                      ? 'bg-purple-600/40 border-purple-400 text-white font-bold'
                      : 'bg-white/10 hover:bg-white/20 border-white/15 text-white'
                  }`}
                >
                  <div 
                    className="absolute inset-0 bg-purple-500/30 transition-all ease-out" 
                    style={{ width: `${pctB}%` }} 
                  />
                  <div className="relative flex items-center justify-between text-xs font-semibold z-10">
                    <span className="flex items-center gap-1.5">
                      {userVote === 'B' && <Check size={14} className="text-purple-300" />}
                      {currentStory.poll.optionB}
                    </span>
                    <span className="font-mono text-xs font-bold">{pctB}%</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* MUSIC SOUNDTRACK STICKER OVERLAY */}
          {currentStory.music && (
            <div
              className="absolute top-20 start-4 z-20 pointer-events-auto bg-black/60 backdrop-blur-md rounded-full py-1.5 px-3 border border-white/25 flex items-center gap-2 shadow-lg max-w-[80%]"
              onClick={(e) => {
                e.stopPropagation();
                const matched = MUSIC_TRACKS.find(t => t.title === currentStory.music?.title || t.titleAr === currentStory.music?.title);
                if (matched) {
                  playMusicPreview(matched);
                }
              }}
            >
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-sm animate-spin [animation-duration:4s]">
                <Music size={11} />
              </div>
              <div className="min-w-0 flex-1 leading-tight pe-1">
                <p className="text-[11px] font-bold text-white truncate">
                  {currentStory.music.title}
                </p>
                <p className="text-[9px] text-white/70 truncate">
                  {currentStory.music.artist}
                </p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0 opacity-80">
                <span className="w-0.5 h-2.5 bg-white rounded-full animate-pulse" />
                <span className="w-0.5 h-4 bg-white rounded-full animate-pulse [animation-delay:150ms]" />
                <span className="w-0.5 h-2 bg-white rounded-full animate-pulse [animation-delay:300ms]" />
              </div>
            </div>
          )}

          {/* TEMPLATE (ADD YOURS) STICKER OVERLAY */}
          {currentStory.template && (
            <div
              className="absolute bottom-28 inset-x-5 z-20 pointer-events-auto bg-white/20 dark:bg-black/50 backdrop-blur-lg rounded-2xl p-3 border border-white/30 text-white shadow-2xl space-y-1.5 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-center gap-1.5 text-purple-300 text-[10px] font-extrabold uppercase tracking-wider">
                <Sparkles size={12} />
                <span>{language === 'ar' ? 'أضف خاصتك • قالب القصة' : 'Add Yours • Story Template'}</span>
              </div>
              <p className="text-xs font-bold text-white leading-snug drop-shadow-sm">
                {currentStory.template.prompt || currentStory.template.name}
              </p>
              <div className="flex items-center justify-center gap-1 pt-0.5">
                <div className="flex -space-x-1.5 rtl:space-x-reverse overflow-hidden">
                  <div className="w-4 h-4 rounded-full bg-purple-500 border border-white text-[7px] flex items-center justify-center font-bold">✨</div>
                  <div className="w-4 h-4 rounded-full bg-rose-500 border border-white text-[7px] flex items-center justify-center font-bold">📸</div>
                  <div className="w-4 h-4 rounded-full bg-amber-500 border border-white text-[7px] flex items-center justify-center font-bold">🔥</div>
                </div>
                <span className="text-[10px] text-white/80 font-medium">
                  {language === 'ar' ? 'شارك في القالب' : 'Join this template'}
                </span>
              </div>
            </div>
          )}

          {/* Pause Indicator overlay when holding */}
          {isPaused && !showViewersSheet && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-3 bg-black/60 backdrop-blur-md rounded-full text-white pointer-events-none z-20">
              <Pause size={24} />
            </div>
          )}

          {/* Previous / Next Interactive Tap Zones (single-tap nav, double-tap like) */}
          <div className="absolute inset-0 flex z-10">
            <div 
              className="w-1/3 h-full cursor-pointer" 
              onClick={(e) => handleZoneTap('prev', e)} 
              title={language === 'ar' ? 'القصة السابقة (نقر مزدوج للإعجاب)' : 'Previous story (double-tap to like)'}
            />
            <div 
              className="w-2/3 h-full cursor-pointer" 
              onClick={(e) => handleZoneTap('next', e)} 
              title={language === 'ar' ? 'القصة التالية (نقر مزدوج للإعجاب)' : 'Next story (double-tap to like)'}
            />
          </div>

          {/* Desktop Navigation Chevrons */}
          {(currentGroupIndex > 0 || currentIndex > 0) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev(true);
              }}
              className="hidden sm:flex absolute start-3 top-1/2 -translate-y-1/2 p-2.5 bg-black/50 hover:bg-black/80 text-white rounded-full transition-all z-20 backdrop-blur-sm border border-white/15 hover:scale-105"
              title={language === 'ar' ? 'السابق' : 'Previous'}
            >
              {language === 'ar' ? <ChevronRight size={22} /> : <ChevronLeft size={22} />}
            </button>
          )}

          {(currentGroupIndex < groups.length - 1 || currentIndex < activeStories.length - 1) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNext(true);
              }}
              className="hidden sm:flex absolute end-3 top-1/2 -translate-y-1/2 p-2.5 bg-black/50 hover:bg-black/80 text-white rounded-full transition-all z-20 backdrop-blur-sm border border-white/15 hover:scale-105 group"
              title={
                currentIndex === activeStories.length - 1 && nextGroup
                  ? (language === 'ar' ? `الانتقال إلى قصة ${nextGroup.authorUsername}` : `Next user: ${nextGroup.authorUsername}`)
                  : (language === 'ar' ? 'التالي' : 'Next')
              }
            >
              {language === 'ar' ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
            </button>
          )}
        </div>

        {/* Bottom Area: Caption + Owner Story Toolbar / Viewer Reply & Reactions */}
        <div 
          className="relative z-30 p-3.5 sm:p-4 bg-gradient-to-t from-black/95 via-black/80 to-transparent space-y-2.5 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {/* Action Feedback Toast */}
          {ownerToast && (
            <div className="mx-auto w-fit px-3.5 py-1.5 rounded-full bg-white text-slate-900 text-xs font-bold shadow-xl animate-in fade-in slide-in-from-bottom-2">
              {ownerToast}
            </div>
          )}

          {/* Caption Display or Owner Inline Caption Prompt ("اكتب شيئًا...") */}
          {currentStory.caption ? (
            isOwner ? (
              <button
                type="button"
                onClick={() => setShowCaptionEditor(true)}
                className="w-full bg-black/50 hover:bg-black/65 backdrop-blur-md border border-white/10 rounded-2xl p-2.5 text-center transition-colors"
                title={language === 'ar' ? 'تعديل الشرح' : 'Edit caption'}
              >
                <p className="text-white text-xs font-medium leading-relaxed drop-shadow">
                  {currentStory.caption}
                </p>
              </button>
            ) : (
              <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl p-2.5 text-center">
                <p className="text-white text-xs font-medium leading-relaxed drop-shadow">
                  {currentStory.caption}
                </p>
              </div>
            )
          ) : isOwner && !isArchiveMode ? (
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => setShowCaptionEditor(true)}
                className="text-xs font-medium text-white/60 hover:text-white transition-colors py-1"
              >
                {language === 'ar' ? 'اكتب شيئًا...' : 'Write something...'}
              </button>
              {!commentsEnabled && (
                <span className="inline-flex items-center gap-1 text-[11px] text-white/50">
                  <MessageSquareOff size={12} />
                  <span>{language === 'ar' ? 'التعليقات متوقفة' : 'Comments off'}</span>
                </span>
              )}
            </div>
          ) : null}

          {/* Owner Story Bottom Action Bar (matches Screenshot 2: Activity, Share to, WA/FB Share, Promote, Mention, More) */}
          {isOwner && (
            <div className="space-y-1.5 pt-0.5">
              <div className="grid grid-cols-6 gap-1 border-t border-white/10 pt-2">
                {/* 1. Activity (النشاط) */}
                <button
                  type="button"
                  onClick={() => {
                    setViewersSheetTab('viewers');
                    setShowViewersSheet(true);
                  }}
                  className="relative min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/10 text-white transition-colors px-0.5"
                  title={language === 'ar' ? 'عرض المشاهدات والنشاط' : 'Story activity'}
                >
                  <div className="relative">
                    <UserCheck size={20} />
                    {(totalViewsCount > 0 || totalStoryReactionsCount > 0) && (
                      <span className="absolute -top-1.5 -end-2.5 min-w-[16px] h-4 px-1 rounded-full bg-purple-600 text-white text-[9px] font-bold tabular-nums flex items-center justify-center">
                        {totalViewsCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold truncate max-w-full">
                    {language === 'ar' ? 'النشاط' : 'Activity'}
                  </span>
                </button>

                {/* 2. Share to... (مشاركة على...) */}
                <button
                  type="button"
                  onClick={() => setShowShareSheet(true)}
                  className="min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/10 text-white transition-colors px-0.5"
                  title={language === 'ar' ? 'مشاركة القصة' : 'Share story'}
                >
                  <Share2 size={20} />
                  <span className="text-[10px] font-semibold truncate max-w-full">
                    {language === 'ar' ? 'مشاركة على...' : 'Share to...'}
                  </span>
                </button>

                {/* 3. Share on WhatsApp / Facebook (مشاركة على...) */}
                <button
                  type="button"
                  onClick={() => setShowShareSheet(true)}
                  className="min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/10 text-white transition-colors px-0.5"
                  title={language === 'ar' ? 'مشاركة على واتساب وفيسبوك' : 'Share on WhatsApp & Facebook'}
                >
                  <svg
                    width="24"
                    height="20"
                    viewBox="0 0 28 20"
                    fill="none"
                    aria-hidden="true"
                    className="shrink-0"
                  >
                    <circle cx="9.5" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.7" />
                    <path
                      d="M7.6 7.8c.2-.3.5-.3.7-.1l.8.9c.2.2.2.5 0 .7l-.4.4c.3.6.8 1.1 1.4 1.4l.4-.4c.2-.2.5-.2.7 0l.9.8c.2.2.2.5-.1.7-.5.4-1.2.5-1.8.2-1.4-.6-2.4-1.6-3-3-.3-.6-.2-1.3.4-1.6Z"
                      fill="currentColor"
                    />
                    <circle cx="19" cy="10" r="7" fill="#020617" stroke="currentColor" strokeWidth="1.7" />
                    <path
                      d="M19.8 10.6h1.2l.2-1.5h-1.4V8.2c0-.4.2-.7.8-.7h.7V6.2c-.3 0-.7-.1-1.1-.1-1.1 0-1.9.7-1.9 1.9v1.1H17v1.5h1.3V14h1.5v-3.4Z"
                      fill="currentColor"
                    />
                  </svg>
                  <span className="text-[10px] font-semibold truncate max-w-full">
                    {language === 'ar' ? 'مشاركة على...' : 'Social'}
                  </span>
                </button>

                {/* 4. Promote (ترويج) */}
                <button
                  type="button"
                  onClick={() => setShowPromoteSheet(true)}
                  className={`min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/10 transition-colors px-0.5 ${
                    currentStory.promoted?.isPromoted ? 'text-purple-400' : 'text-white'
                  }`}
                  title={language === 'ar' ? 'ترويج القصة' : 'Promote story'}
                >
                  <TrendingUp size={20} />
                  <span className="text-[10px] font-semibold truncate max-w-full">
                    {language === 'ar' ? 'ترويج' : 'Boost'}
                  </span>
                </button>

                {/* 5. Mention (ذكر) */}
                <button
                  type="button"
                  onClick={() => setOwnerUserPickerMode('mention')}
                  className="min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/10 text-white transition-colors px-0.5"
                  title={language === 'ar' ? 'ذكر شخص في القصة' : 'Mention someone'}
                >
                  <AtSign size={20} />
                  <span className="text-[10px] font-semibold truncate max-w-full">
                    {language === 'ar' ? 'ذكر' : 'Mention'}
                  </span>
                </button>

                {/* 6. More (المزيد) */}
                <button
                  type="button"
                  onClick={() => setShowMoreSheet(true)}
                  className="min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/10 text-white transition-colors px-0.5"
                  title={language === 'ar' ? 'المزيد من الخيارات' : 'More options'}
                >
                  <MoreVertical size={20} />
                  <span className="text-[10px] font-semibold truncate max-w-full">
                    {language === 'ar' ? 'المزيد' : 'More'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Reply & Reactions Bar (for viewers) */}
          {!isOwner && user && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {!commentsEnabled ? (
                  <div className="flex-1 bg-white/10 border border-white/15 rounded-full py-2.5 px-4 text-xs text-white/60 text-center font-medium">
                    {language === 'ar'
                      ? 'تم إيقاف التعليقات والردود على هذه القصة'
                      : 'Comments & replies are turned off for this story'}
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onFocus={() => setIsPaused(true)}
                      onBlur={() => setIsPaused(false)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendReply();
                      }}
                      placeholder={
                        language === 'ar'
                          ? `أرسل رسالة إلى ${currentStory.authorUsername}...`
                          : `Send message to ${currentStory.authorUsername}...`
                      }
                      className="flex-1 bg-white/15 border border-white/20 rounded-full py-2.5 px-4 text-xs text-white placeholder-white/60 focus:outline-none focus:ring-1 focus:ring-white focus:bg-white/25 transition-all"
                    />
                    {replyText.trim() && (
                      <button
                        type="button"
                        onClick={() => handleSendReply()}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center bg-white text-slate-900 rounded-full hover:bg-slate-100 transition-all active:scale-95 shrink-0 shadow-md"
                        title={language === 'ar' ? 'إرسال الرد' : 'Send reply'}
                        aria-label={language === 'ar' ? 'إرسال الرد' : 'Send reply'}
                      >
                        <Send size={16} />
                      </button>
                    )}
                  </>
                )}

                {/* Dedicated Persistent Story Like Button */}
                <button
                  type="button"
                  onClick={(e) =>
                    applyStoryReaction(currentUserReaction || 'heart', {
                      triggerEl: e.currentTarget,
                    })
                  }
                  aria-label={language === 'ar' ? 'إعجاب بالقصة' : 'Like story'}
                  aria-pressed={Boolean(currentUserReaction)}
                  className={`min-h-[40px] px-3.5 rounded-full border flex items-center gap-1.5 transition-all active:scale-90 shrink-0 ${
                    currentUserReaction
                      ? 'bg-rose-500/25 border-rose-400/70 text-rose-300'
                      : 'bg-white/15 hover:bg-white/25 border-white/20 text-white'
                  }`}
                >
                  {currentUserReaction && currentUserReaction !== 'heart' ? (
                    <span className={`text-lg leading-none ${heartPopping ? 'animate-emoji-tap' : ''}`}>
                      {REACTION_MAP[currentUserReaction].emoji}
                    </span>
                  ) : (
                    <Heart
                      size={18}
                      className={`${heartPopping ? 'animate-heart-pop' : ''} ${
                        currentUserReaction ? 'text-rose-500 fill-rose-500' : 'text-white'
                      }`}
                    />
                  )}
                  {totalStoryReactionsCount > 0 && (
                    <span className="text-[11px] font-bold tabular-nums text-white">
                      {totalStoryReactionsCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Emoji Reaction Tray (triggers burst animation & saves count to story doc) */}
              <StoryReactionTray
                selectedReaction={currentUserReaction}
                reactionCounts={derivedReactionCounts}
                language={language}
                onReact={(reaction, buttonEl) =>
                  applyStoryReaction(reaction, { triggerEl: buttonEl })
                }
              />

              {replySent && (
                <div className="text-center text-[11px] text-green-400 font-medium animate-in fade-in">
                  {language === 'ar'
                    ? `✓ تم إرسال الرد إلى ${currentStory.authorUsername}`
                    : `✓ Reply sent to ${currentStory.authorUsername}`}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Viewers & Activity Bottom Sheet (for Story Author) */}
        {showViewersSheet && (
          <div 
            className="absolute inset-x-0 bottom-0 top-24 z-40 bg-slate-950/95 backdrop-blur-xl rounded-t-3xl border-t border-white/20 p-4 flex flex-col animate-in slide-in-from-bottom duration-250"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle & Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-purple-400" />
                <h3 className="text-sm font-bold text-white">
                  {language === 'ar' ? 'نشاط القصة وتفاعلاتها' : 'Story Activity & Insights'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowViewersSheet(false)}
                className="p-1.5 text-white/70 hover:text-white rounded-full bg-white/10 hover:bg-white/20"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-3">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5 text-center">
                <span className="text-[10px] text-white/60 block font-medium">
                  {language === 'ar' ? 'إجمالي المشاهدات' : 'Total Views'}
                </span>
                <span className="text-lg font-black text-white tabular-nums">
                  {totalViewsCount}
                </span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5 text-center">
                <span className="text-[10px] text-white/60 block font-medium">
                  {language === 'ar' ? 'التفاعلات' : 'Likes / Reacts'}
                </span>
                <span className="text-lg font-black text-white tabular-nums">
                  {totalStoryReactionsCount}
                </span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5 text-center">
                <span className="text-[10px] text-white/60 block font-medium">
                  {language === 'ar' ? 'نقرات للأمام / خلف' : 'Taps Fwd / Back'}
                </span>
                <span className="text-base font-black text-white tabular-nums">
                  {currentStory.tapsForwardCount || 0} / {currentStory.tapsBackCount || 0}
                </span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5 text-center">
                <span className="text-[10px] text-white/60 block font-medium">
                  {language === 'ar' ? 'الردود' : 'Replies'}
                </span>
                <span className="text-lg font-black text-white tabular-nums">
                  {currentStory.repliesCount || 0}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex rounded-xl bg-white/10 p-1 mb-3">
              <button
                type="button"
                onClick={() => setViewersSheetTab('viewers')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  viewersSheetTab === 'viewers'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                {language === 'ar' ? `المشاهدون (${totalViewsCount})` : `Viewers (${totalViewsCount})`}
              </button>
              <button
                type="button"
                onClick={() => setViewersSheetTab('reactions')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  viewersSheetTab === 'reactions'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                {language === 'ar' ? `التفاعلات (${totalStoryReactionsCount})` : `Reactions (${totalStoryReactionsCount})`}
              </button>
            </div>

            {/* Tab Contents: Viewers List */}
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
              {viewersSheetTab === 'viewers' && (
                storyViewers.length === 0 ? (
                  <div className="py-8 text-center text-xs text-white/50 space-y-1">
                    <Eye size={24} className="mx-auto text-white/30 mb-2" />
                    <p>{language === 'ar' ? 'لا توجد مشاهدات مسجلة بعد' : 'No views recorded yet'}</p>
                    <p className="text-[10px] text-white/40">
                      {language === 'ar' ? 'ستظهر هنا حسابات المستخدمين الذين شاهدوا قصتك' : 'Users who view your story will appear here'}
                    </p>
                  </div>
                ) : (
                  storyViewers.map((viewer) => (
                    <div key={viewer.viewerId} className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20 shrink-0">
                          <UserAvatar
                            src={viewer.userPhotoURL}
                            username={viewer.username}
                            iconSize={14}
                          />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-white truncate">
                            {viewer.username || 'user'}
                          </span>
                          <span className="text-[10px] text-white/50">
                            {viewer.viewedAt?.toDate
                              ? formatDistanceToNow(viewer.viewedAt.toDate(), { addSuffix: true, locale: language === 'ar' ? ar : undefined })
                              : (language === 'ar' ? 'شوهد مؤخراً' : 'viewed recently')}
                          </span>
                        </div>
                      </div>
                      <Eye size={14} className="text-blue-400" />
                    </div>
                  ))
                )
              )}

              {/* Tab Contents: Reactions List */}
              {viewersSheetTab === 'reactions' && (
                storyReactions.length === 0 ? (
                  <div className="py-8 text-center text-xs text-white/50 space-y-1">
                    <Heart size={24} className="mx-auto text-white/30 mb-2" />
                    <p>{language === 'ar' ? 'لا توجد تفاعلات بعد' : 'No reactions yet'}</p>
                  </div>
                ) : (
                  storyReactions.map((entry) => (
                    <div key={entry.userId} className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20 shrink-0">
                          <UserAvatar
                            src={entry.userPhotoURL}
                            username={entry.username}
                            iconSize={14}
                          />
                        </div>
                        <span className="text-xs font-bold text-white truncate">
                          {entry.username || 'user'}
                        </span>
                      </div>
                      <span className="text-xl">{REACTION_MAP[entry.reaction].emoji}</span>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        )}

        {/* Owner "More" Bottom Sheet ("المزيد" — matches Screenshot 1) */}
        <StoryOwnerMoreSheet
          isOpen={showMoreSheet}
          isAr={language === 'ar'}
          isArchiveMode={isArchiveMode}
          mediaType={currentStory.mediaType}
          commentsEnabled={commentsEnabled}
          aiLabelEnabled={Boolean(currentStory.aiLabel)}
          hasPartnership={Boolean(
            currentStory.partnership?.isPaid ||
              currentStory.partnership?.allowAds ||
              currentStory.partnership?.partnerUsername
          )}
          archiving={archiving}
          onClose={() => setShowMoreSheet(false)}
          onDelete={() => setConfirmDelete(true)}
          onArchive={handleArchiveCurrentStory}
          onSaveMedia={handleSaveCurrentStoryMedia}
          onOpenSend={() => setShowSendDrawer(true)}
          onOpenHighlights={() => setShowHighlightsPicker(true)}
          onOpenPartnership={() => setShowPartnershipSheet(true)}
          onOpenAiLabel={() => setShowAiLabelSheet(true)}
          onOpenShare={() => setShowShareSheet(true)}
          onOpenStorySettings={() => setShowStorySettings(true)}
          onToggleComments={handleToggleCommentsOnCurrent}
        />

        {/* Send Story via Direct Message Drawer ("إرسال") */}
        <StorySendDrawer
          isOpen={showSendDrawer}
          isAr={language === 'ar'}
          storyMediaURL={currentStory.mediaURL}
          storyMediaType={currentStory.mediaType}
          storyCaption={currentStory.caption}
          onClose={() => setShowSendDrawer(false)}
          onToast={showOwnerToast}
        />

        {/* Add/Remove Story Highlights Picker ("أبرز القصص") */}
        <StoryHighlightsPickerModal
          isOpen={showHighlightsPicker}
          isAr={language === 'ar'}
          storyId={currentStory.id}
          storyMediaURL={currentStory.mediaURL}
          storyMediaType={currentStory.mediaType}
          onClose={() => setShowHighlightsPicker(false)}
          onToast={showOwnerToast}
        />

        {/* Partnership Label & Partnership Ads Sheet */}
        <StoryPartnershipSheet
          isOpen={showPartnershipSheet}
          isAr={language === 'ar'}
          partnership={currentStory.partnership || null}
          onSave={handleSavePartnershipOnCurrent}
          onClose={() => setShowPartnershipSheet(false)}
        />

        {/* AI Label Sheet */}
        <StoryAiLabelSheet
          isOpen={showAiLabelSheet}
          isAr={language === 'ar'}
          enabled={Boolean(currentStory.aiLabel)}
          onToggle={handleToggleAiLabelOnCurrent}
          onClose={() => setShowAiLabelSheet(false)}
        />

        {/* Share Story Sheet (Copy, Native Share, WhatsApp, Facebook, Post to Feed) */}
        <StoryShareSheet
          isOpen={showShareSheet}
          isAr={language === 'ar'}
          storyId={currentStory.id}
          storyMediaURL={currentStory.mediaURL}
          storyMediaType={currentStory.mediaType}
          storyCaption={currentStory.caption}
          onClose={() => setShowShareSheet(false)}
          onToast={showOwnerToast}
        />

        {/* Promote Story Sheet ("ترويج") */}
        <StoryPromoteSheet
          isOpen={showPromoteSheet}
          isAr={language === 'ar'}
          promoted={currentStory.promoted || null}
          onSavePromotion={handleSavePromotionOnCurrent}
          onClose={() => setShowPromoteSheet(false)}
        />

        {/* Story Settings Modal ("انتقال إلى إعدادات القصص") */}
        <StorySettingsModal
          isOpen={showStorySettings}
          isAr={language === 'ar'}
          onOpenCloseFriends={() => setOwnerUserPickerMode('close_friends')}
          onClose={() => setShowStorySettings(false)}
          onToast={showOwnerToast}
        />

        {/* Caption Inline Edit Sheet ("اكتب شيئًا...") */}
        <StoryCaptionEditSheet
          isOpen={showCaptionEditor}
          isAr={language === 'ar'}
          initialCaption={currentStory.caption || ''}
          onSave={handleSaveCaptionOnCurrent}
          onClose={() => setShowCaptionEditor(false)}
        />

        {/* Mention / Close Friends Picker for Live Story Owner */}
        <StoryUserPickerModal
          mode={ownerUserPickerMode}
          isAr={language === 'ar'}
          closeFriends={closeFriendsList}
          partnership={currentStory.partnership || null}
          onClose={() => setOwnerUserPickerMode(null)}
          onSelectMention={handleAddLiveMention}
          onSavePartnership={() => {}}
          onToggleCloseFriend={async (friend, isAdding) => {
            if (!user?.uid) return;
            if (isAdding) {
              await addCloseFriend(user.uid, friend);
            } else {
              await removeCloseFriend(user.uid, friend.uid);
            }
          }}
        />
      </div>
    </div>
  );
}
