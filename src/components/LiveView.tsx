import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Radio,
  Video,
  VideoOff,
  Mic,
  MicOff,
  MonitorUp,
  RefreshCw,
  Users,
  Heart,
  MessageCircle,
  MessageSquareOff,
  Pin,
  PinOff,
  Trash2,
  Send,
  Volume2,
  VolumeX,
  X,
  Play,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  Wifi,
  Clock,
  Camera,
  SplitSquareHorizontal,
  Search,
  UserMinus,
  Smile,
  ChevronDown,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useFirestore } from '../hooks/useFirestore';
import UserAvatar from './UserAvatar';
import FollowButton from './FollowButton';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const CATEGORIES = [
  { id: 'general', ar: 'عام', en: 'General' },
  { id: 'tech', ar: 'تقنية', en: 'Tech' },
  { id: 'gaming', ar: 'ألعاب', en: 'Gaming' },
  { id: 'music', ar: 'موسيقى', en: 'Music' },
  { id: 'travel', ar: 'سفر', en: 'Travel' },
  { id: 'cooking', ar: 'طبخ', en: 'Cooking' },
  { id: 'sports', ar: 'رياضة', en: 'Sports' },
];

type ReactionKey = 'heart' | 'fire' | 'clap' | 'laugh' | 'love' | 'wow' | 'party' | 'sparkles';
type SignalChannel = 'host' | 'guest';

const REACTION_ITEMS: { key: ReactionKey; symbol: string; ar: string; en: string }[] = [
  { key: 'heart', symbol: '❤️', ar: 'قلب', en: 'Heart' },
  { key: 'fire', symbol: '🔥', ar: 'نار', en: 'Fire' },
  { key: 'clap', symbol: '👏', ar: 'تصفيق', en: 'Clap' },
  { key: 'laugh', symbol: '😂', ar: 'ضحك', en: 'Laugh' },
  { key: 'love', symbol: '😍', ar: 'إعجاب', en: 'Love' },
  { key: 'wow', symbol: '😮', ar: 'انبهار', en: 'Wow' },
  { key: 'party', symbol: '🎉', ar: 'احتفال', en: 'Celebrate' },
  { key: 'sparkles', symbol: '✨', ar: 'تألق', en: 'Sparkles' },
];

const REACTION_SYMBOL_MAP: Record<ReactionKey, string> = REACTION_ITEMS.reduce(
  (acc, item) => {
    acc[item.key] = item.symbol;
    return acc;
  },
  {} as Record<ReactionKey, string>
);

interface FloatingReaction {
  localId: string;
  emoji: ReactionKey;
  leftPct: number;
  sway: boolean;
  scale: number;
}

interface LiveStreamDoc {
  id: string;
  hostId: string;
  hostUsername: string;
  hostPhotoURL?: string;
  title: string;
  category: string;
  thumbnailURL?: string;
  status: 'live' | 'ended';
  allowComments: boolean;
  pinnedMessage?: string;
  likesCount?: number;
  commentsCount?: number;
  peakViewers?: number;
  guestId?: string | null;
  guestUsername?: string | null;
  guestPhotoURL?: string | null;
  guestStatus?: 'none' | 'invited' | 'active';
  guestCamEnabled?: boolean;
  guestMicEnabled?: boolean;
  startedAt?: any;
  endedAt?: any;
}

interface LiveCommentDoc {
  id: string;
  streamId: string;
  userId: string;
  username: string;
  userPhotoURL?: string;
  text: string;
  createdAt?: any;
}

interface LiveViewerDoc {
  id: string;
  streamId: string;
  userId: string;
  username: string;
  photoURL?: string;
  lastSeen: number;
}

interface GuestRequestDoc {
  id: string;
  streamId: string;
  userId: string;
  username: string;
  photoURL?: string;
  createdAt?: any;
}

function formatDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hrs > 0) return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  return `${pad(mins)}:${pad(secs)}`;
}

function ReactionIcon({ emoji, size = 24 }: { emoji: ReactionKey; size?: number }) {
  const symbol = REACTION_SYMBOL_MAP[emoji] || '❤️';
  return (
    <span
      role="img"
      aria-hidden="true"
      className="leading-none select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
      style={{ fontSize: `${size}px` }}
    >
      {symbol}
    </span>
  );
}

export default function LiveView({
  onOpenProfile,
  onOpenChat,
}: {
  onOpenProfile: (uid: string) => void;
  onOpenChat: (convId: string) => void;
}) {
  const { user, profile, blockedUsers, language, t } = useAuth();
  const { blockUser, getOrCreateConversation } = useFirestore();
  const isAr = language === 'ar';

  // Primary navigation mode within Live module
  const [mode, setMode] = useState<'hub' | 'setup' | 'broadcasting' | 'watching' | 'summary'>('hub');

  // Hub state
  const [activeStreams, setActiveStreams] = useState<LiveStreamDoc[]>([]);
  const [recentStreams, setRecentStreams] = useState<LiveStreamDoc[]>([]);
  const [loadingHub, setLoadingHub] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Setup & Local Broadcast Studio state (shared for Host and Active Guest)
  const [streamTitle, setStreamTitle] = useState('');
  const [streamCategory, setStreamCategory] = useState('general');
  const [allowCommentsSetup, setAllowCommentsSetup] = useState(true);
  const [sourceType, setSourceType] = useState<'camera' | 'screen' | 'audio'>('camera');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [camEnabled, setCamEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [mirrorPreview, setMirrorPreview] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [startingStream, setStartingStream] = useState(false);

  // Active Room (Shared for Broadcaster & Viewer)
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);
  const [currentStream, setCurrentStream] = useState<LiveStreamDoc | null>(null);
  const [comments, setComments] = useState<LiveCommentDoc[]>([]);
  const [viewers, setViewers] = useState<LiveViewerDoc[]>([]);
  const [guestRequests, setGuestRequests] = useState<GuestRequestDoc[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchableUsers, setSearchableUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [showReactionSidebar, setShowReactionSidebar] = useState(true);
  const [tappedEmoji, setTappedEmoji] = useState<ReactionKey | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [summaryData, setSummaryData] = useState<{
    title: string;
    duration: number;
    peakViewers: number;
    likesCount: number;
    commentsCount: number;
  } | null>(null);

  // Guest Invite / Co-Host state
  const [joiningAsGuest, setJoiningAsGuest] = useState(false);
  const [guestConnectionState, setGuestConnectionState] = useState<'idle' | 'connecting' | 'connected' | 'reconnecting'>('idle');

  // Viewer WebRTC state
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'reconnecting' | 'ended'>('connecting');
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  const isRemoteMutedRef = useRef(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [peerCount, setPeerCount] = useState(0);

  useEffect(() => {
    isRemoteMutedRef.current = isRemoteMuted;
  }, [isRemoteMuted]);

  // Refs for Media & WebRTC
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteHostVideoRef = useRef<HTMLVideoElement>(null);
  const remoteGuestVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRafRef = useRef<number | null>(null);

  // Outgoing WebRTC peers (when I am broadcasting either as 'host' or as 'guest')
  const outgoingPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const outgoingPendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // Incoming WebRTC peers
  const hostReceiverPeerRef = useRef<RTCPeerConnection | null>(null);
  const hostReceiverPendingRef = useRef<RTCIceCandidateInit[]>([]);
  const guestReceiverPeerRef = useRef<RTCPeerConnection | null>(null);
  const guestReceiverPendingRef = useRef<RTCIceCandidateInit[]>([]);

  const processedSignalIdsRef = useRef<Set<string>>(new Set());
  const seenReactionIdsRef = useRef<Set<string>>(new Set());
  const reactionTimeoutsRef = useRef<number[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const currentStreamIdRef = useRef<string | null>(null);
  const currentStreamRef = useRef<LiveStreamDoc | null>(null);
  const modeRef = useRef(mode);

  const isHost = Boolean(currentStream && (mode === 'broadcasting' || currentStream.hostId === user?.uid));
  const isActiveGuest = Boolean(
    currentStream &&
      !isHost &&
      currentStream.guestStatus === 'active' &&
      currentStream.guestId === user?.uid
  );
  const isInvitedGuest = Boolean(
    currentStream &&
      !isHost &&
      currentStream.guestStatus === 'invited' &&
      currentStream.guestId === user?.uid
  );
  const isSplitScreen = Boolean(
    currentStream && currentStream.guestStatus === 'active' && currentStream.guestId
  );

  useEffect(() => {
    currentStreamIdRef.current = currentStreamId;
  }, [currentStreamId]);

  useEffect(() => {
    currentStreamRef.current = currentStream;
  }, [currentStream]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const stopAudioMeter = useCallback(() => {
    if (analyserRafRef.current !== null) {
      cancelAnimationFrame(analyserRafRef.current);
      analyserRafRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const stopLocalMedia = useCallback(() => {
    stopAudioMeter();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  }, [stopAudioMeter]);

  const closeOutgoingPeers = useCallback(() => {
    outgoingPeersRef.current.forEach((pc) => pc.close());
    outgoingPeersRef.current.clear();
    outgoingPendingCandidatesRef.current.clear();
    setPeerCount(0);
  }, []);

  const closeGuestReceiverPeer = useCallback(() => {
    if (guestReceiverPeerRef.current) {
      guestReceiverPeerRef.current.close();
      guestReceiverPeerRef.current = null;
    }
    guestReceiverPendingRef.current = [];
    if (remoteGuestVideoRef.current) {
      remoteGuestVideoRef.current.srcObject = null;
    }
    setGuestConnectionState('idle');
  }, []);

  const closeAllPeerConnections = useCallback(() => {
    closeOutgoingPeers();
    if (hostReceiverPeerRef.current) {
      hostReceiverPeerRef.current.close();
      hostReceiverPeerRef.current = null;
    }
    hostReceiverPendingRef.current = [];
    if (remoteHostVideoRef.current) {
      remoteHostVideoRef.current.srcObject = null;
    }
    closeGuestReceiverPeer();
    processedSignalIdsRef.current.clear();
  }, [closeOutgoingPeers, closeGuestReceiverPeer]);

  const startAudioMeter = useCallback(
    (stream: MediaStream) => {
      stopAudioMeter();
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const avg = sum / data.length;
          setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
          analyserRafRef.current = requestAnimationFrame(tick);
        };
        analyserRafRef.current = requestAnimationFrame(tick);
      } catch {
        setAudioLevel(0);
      }
    },
    [stopAudioMeter]
  );

  const attachLocalStream = useCallback(
    (stream: MediaStream) => {
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setCamEnabled(stream.getVideoTracks().some((t) => t.enabled));
      setMicEnabled(stream.getAudioTracks().some((t) => t.enabled));
      startAudioMeter(stream);

      // Dynamically replace tracks for all active WebRTC receivers
      outgoingPeersRef.current.forEach((pc) => {
        const senders = pc.getSenders();
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        const videoSender = senders.find((s) => s.track?.kind === 'video');
        if (videoSender && videoTrack) {
          videoSender.replaceTrack(videoTrack).catch(() => {});
        } else if (!videoSender && videoTrack) {
          pc.addTrack(videoTrack, stream);
        }
        const audioSender = senders.find((s) => s.track?.kind === 'audio');
        if (audioSender && audioTrack) {
          audioSender.replaceTrack(audioTrack).catch(() => {});
        } else if (!audioSender && audioTrack) {
          pc.addTrack(audioTrack, stream);
        }
      });
    },
    [startAudioMeter]
  );

  const initMediaSource = useCallback(
    async (targetSource: 'camera' | 'screen' | 'audio', targetFacing: 'user' | 'environment' = facingMode) => {
      setMediaError(null);
      stopLocalMedia();

      if (!navigator.mediaDevices) {
        setMediaError(
          isAr
            ? 'المتصفح الحالي لا يدعم الوصول إلى الكاميرا أو الميكروفون عبر هذه البيئة.'
            : 'Your browser does not support media device capture in this environment.'
        );
        return null;
      }

      try {
        let stream: MediaStream;
        if (targetSource === 'screen') {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: { ideal: 30 } },
            audio: true,
          });
          if (displayStream.getAudioTracks().length === 0) {
            try {
              const micStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true },
              });
              micStream.getAudioTracks().forEach((t) => displayStream.addTrack(t));
            } catch {
              // Screen share works even without mic
            }
          }
          displayStream.getVideoTracks()[0]?.addEventListener('ended', () => {
            if (modeRef.current === 'setup' || modeRef.current === 'broadcasting') {
              setSourceType('camera');
              initMediaSource('camera', targetFacing);
            }
          });
          stream = displayStream;
        } else if (targetSource === 'audio') {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
          });
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: targetFacing,
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
            },
          });
        }
        setSourceType(targetSource);
        attachLocalStream(stream);
        return stream;
      } catch (err: any) {
        const name = err?.name || '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setMediaError(
            isAr
              ? 'تم رفض إذن الكاميرا أو الميكروفون. يمكنك تفعيل الإذن من شريط المتصفح أو اختيار مشاركة الشاشة.'
              : 'Camera/microphone permission was denied. Allow access in your browser bar or switch to Screen Share.'
          );
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setMediaError(
            isAr
              ? 'لم يتم العثور على كاميرا متصلة. يمكنك البدء بمشاركة الشاشة أو الصوت فقط.'
              : 'No camera device detected. You can stream using Screen Share or Audio-only mode.'
          );
        } else {
          setMediaError(
            isAr
              ? 'تعذر تشغيل الكاميرا حالياً. جرّب إعادة المحاولة أو استخدام مشاركة الشاشة.'
              : 'Could not initialize media device. Try again or use Screen Share.'
          );
        }
        return null;
      }
    },
    [attachLocalStream, facingMode, isAr, stopLocalMedia]
  );

  // Re-attach localStream when <video> element mounts or switches between single & split-screen
  useEffect(() => {
    if ((mode === 'setup' || mode === 'broadcasting' || isActiveGuest) && localVideoRef.current && localStreamRef.current) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    }
  }, [mode, isActiveGuest, isSplitScreen]);

  // ---------------------------------------------------------------------------
  // 1. Hub Listener: Active & Recent Live Streams
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;
    const qActive = query(collection(db, 'liveStreams'), where('status', '==', 'live'));
    const unsubActive = onSnapshot(
      qActive,
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as LiveStreamDoc))
          .filter((s) => !blockedUsers.includes(s.hostId))
          .sort((a, b) => (b.startedAt?.toMillis?.() ?? 0) - (a.startedAt?.toMillis?.() ?? 0));
        setActiveStreams(list);
        setLoadingHub(false);
      },
      (err) => {
        console.warn('Active live streams listener notice:', err);
        setLoadingHub(false);
      }
    );

    const qRecent = query(collection(db, 'liveStreams'), where('status', '==', 'ended'));
    const unsubRecent = onSnapshot(
      qRecent,
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as LiveStreamDoc))
          .filter((s) => !blockedUsers.includes(s.hostId))
          .sort((a, b) => (b.startedAt?.toMillis?.() ?? 0) - (a.startedAt?.toMillis?.() ?? 0))
          .slice(0, 6);
        setRecentStreams(list);
      },
      (err) => console.warn('Recent streams listener notice:', err)
    );

    return () => {
      unsubActive();
      unsubRecent();
    };
  }, [user, blockedUsers]);

  // Streams where current user is currently invited as guest (shown in Hub!)
  const myPendingInvites = useMemo(
    () => activeStreams.filter((s) => user && s.guestId === user.uid && s.guestStatus === 'invited'),
    [activeStreams, user]
  );

  // Load users for Host's Invite Guest Modal
  useEffect(() => {
    if (!showInviteModal || !user) return;
    let cancelled = false;
    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const snap = await getDocs(query(collection(db, 'users'), limit(40)));
        if (cancelled) return;
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((u: any) => u.uid !== user.uid && !blockedUsers.includes(u.uid));
        setSearchableUsers(list);
      } catch (err) {
        console.warn('Users fetch notice:', err);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    };
    fetchUsers();
    return () => {
      cancelled = true;
    };
  }, [showInviteModal, user, blockedUsers]);

  // ---------------------------------------------------------------------------
  // 2. Room Listeners (Stream Doc, Comments, Viewers, Reactions, GuestRequests)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      reactionTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      reactionTimeoutsRef.current = [];
    };
  }, []);

  const spawnFloatingReaction = useCallback(
    (emoji: ReactionKey) => {
      const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const baseRange = isAr ? 8 + Math.random() * 44 : 46 + Math.random() * 42;
      const leftPct = Math.round(baseRange);
      const sway = Math.random() > 0.5;
      const scale = Number((0.95 + Math.random() * 0.3).toFixed(2));
      setFloatingReactions((prev) => [...prev.slice(-28), { localId, emoji, leftPct, sway, scale }]);
      const timerId = window.setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((item) => item.localId !== localId));
        reactionTimeoutsRef.current = reactionTimeoutsRef.current.filter((tId) => tId !== timerId);
      }, 2550);
      reactionTimeoutsRef.current.push(timerId);
    },
    [isAr]
  );

  useEffect(() => {
    if (!currentStreamId || !user || (mode !== 'broadcasting' && mode !== 'watching')) return;

    const streamRef = doc(db, 'liveStreams', currentStreamId);
    const unsubStream = onSnapshot(
      streamRef,
      (snap) => {
        if (!snap.exists()) {
          if (mode === 'watching') {
            setConnectionState('ended');
          }
          return;
        }
        const data = { id: snap.id, ...snap.data() } as LiveStreamDoc;
        setCurrentStream(data);
        if (mode === 'watching' && data.status === 'ended') {
          setConnectionState('ended');
          stopLocalMedia();
          closeAllPeerConnections();
        }
      },
      (err) => console.warn('Current stream listener notice:', err)
    );

    const qComments = query(
      collection(db, 'liveStreams', currentStreamId, 'comments'),
      orderBy('createdAt', 'asc')
    );
    const unsubComments = onSnapshot(
      qComments,
      (snap) => {
        setComments(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as LiveCommentDoc))
            .filter((c) => !blockedUsers.includes(c.userId))
        );
      },
      (err) => console.warn('Live comments listener notice:', err)
    );

    const unsubViewers = onSnapshot(
      collection(db, 'liveStreams', currentStreamId, 'viewers'),
      (snap) => {
        const now = Date.now();
        const active = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as LiveViewerDoc))
          .filter((v) => now - (v.lastSeen || 0) < 90000);
        setViewers(active);
      },
      (err) => console.warn('Live viewers listener notice:', err)
    );

    const unsubRequests = onSnapshot(
      collection(db, 'liveStreams', currentStreamId, 'guestRequests'),
      (snap) => {
        setGuestRequests(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as GuestRequestDoc))
            .filter((r) => !blockedUsers.includes(r.userId))
        );
      },
      (err) => console.warn('Guest requests listener notice:', err)
    );

    seenReactionIdsRef.current.clear();
    let initialReactionsLoaded = false;
    const unsubReactions = onSnapshot(
      collection(db, 'liveStreams', currentStreamId, 'reactions'),
      (snap) => {
        if (!initialReactionsLoaded) {
          snap.docs.forEach((d) => seenReactionIdsRef.current.add(d.id));
          initialReactionsLoaded = true;
          return;
        }
        snap.docChanges().forEach((change) => {
          if (change.type === 'added' && !seenReactionIdsRef.current.has(change.doc.id)) {
            seenReactionIdsRef.current.add(change.doc.id);
            const data = change.doc.data();
            if (data.userId !== user.uid) {
              spawnFloatingReaction((data.emoji || 'heart') as ReactionKey);
            }
          }
        });
      },
      (err) => console.warn('Live reactions listener notice:', err)
    );

    return () => {
      unsubStream();
      unsubComments();
      unsubViewers();
      unsubRequests();
      unsubReactions();
    };
  }, [currentStreamId, user, mode, blockedUsers, closeAllPeerConnections, stopLocalMedia, spawnFloatingReaction]);

  // If the host removes the guest while I am active guest, clean up my local media/outgoing peers immediately
  useEffect(() => {
    if (mode === 'watching' && currentStream && currentStream.guestId !== user?.uid) {
      if (localStreamRef.current) {
        stopLocalMedia();
      }
      if (outgoingPeersRef.current.size > 0) {
        closeOutgoingPeers();
      }
    }
  }, [mode, currentStream?.guestId, currentStream?.guestStatus, user?.uid, stopLocalMedia, closeOutgoingPeers]);

  // Auto-scroll chat when new comments arrive
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  // Live duration elapsed timer
  useEffect(() => {
    if (mode !== 'broadcasting' && mode !== 'watching') {
      setElapsedSeconds(0);
      return;
    }
    const updateElapsed = () => {
      const startedMs = currentStream?.startedAt?.toMillis?.();
      if (startedMs) {
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedMs) / 1000)));
      } else {
        setElapsedSeconds((prev) => prev + 1);
      }
    };
    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [mode, currentStream?.startedAt]);

  // Track Peak Viewers automatically while live
  useEffect(() => {
    if (mode !== 'broadcasting' || !currentStreamId || !currentStream) return;
    if (viewers.length > (currentStream.peakViewers || 0)) {
      updateDoc(doc(db, 'liveStreams', currentStreamId), {
        peakViewers: viewers.length,
      }).catch(() => {});
    }
  }, [mode, currentStreamId, viewers.length, currentStream]);

  // ---------------------------------------------------------------------------
  // 3. WebRTC Connection Helpers (Channel-Separated: 'host' & 'guest')
  // ---------------------------------------------------------------------------
  const sendSignal = useCallback(
    async (streamId: string, toUid: string, channel: SignalChannel, payload: Record<string, any>) => {
      if (!user) return;
      try {
        await addDoc(collection(db, 'liveStreams', streamId, 'signals'), {
          streamId,
          fromUid: user.uid,
          toUid,
          channel,
          ...payload,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('sendSignal error:', err);
      }
    },
    [user]
  );

  // Create outgoing WebRTC offer for a peer subscribing to my broadcast ('host' or 'guest' channel)
  const createOutgoingOffer = useCallback(
    async (streamId: string, subscriberUid: string, channel: SignalChannel) => {
      const existingPc = outgoingPeersRef.current.get(subscriberUid);
      if (existingPc) {
        existingPc.close();
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);
      outgoingPeersRef.current.set(subscriberUid, pc);
      outgoingPendingCandidatesRef.current.set(subscriberUid, []);
      setPeerCount(outgoingPeersRef.current.size);

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(streamId, subscriberUid, channel, {
            type: 'candidate',
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          outgoingPeersRef.current.delete(subscriberUid);
          setPeerCount(outgoingPeersRef.current.size);
        }
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignal(streamId, subscriberUid, channel, {
          type: 'offer',
          sdp: offer.sdp || '',
          sdpType: offer.type,
        });
      } catch (err) {
        console.warn('Create outgoing offer error:', err);
      }
    },
    [sendSignal]
  );

  // Subscribe to Host video/audio stream ('host' channel)
  const connectToHostStream = useCallback(
    (stream: LiveStreamDoc) => {
      if (!user) return;
      if (hostReceiverPeerRef.current) {
        hostReceiverPeerRef.current.close();
      }
      hostReceiverPendingRef.current = [];
      setConnectionState('connecting');
      setAutoplayBlocked(false);

      const pc = new RTCPeerConnection(RTC_CONFIG);
      hostReceiverPeerRef.current = pc;

      pc.ontrack = (event) => {
        const videoEl = remoteHostVideoRef.current;
        if (!videoEl) return;
        const incomingStream = event.streams[0] || new MediaStream([event.track]);
        if (videoEl.srcObject !== incomingStream) {
          videoEl.srcObject = incomingStream;
        }
        videoEl.muted = isRemoteMutedRef.current;
        videoEl
          .play()
          .then(() => {
            setConnectionState('connected');
            setAutoplayBlocked(false);
          })
          .catch(() => {
            videoEl.muted = true;
            setIsRemoteMuted(true);
            setAutoplayBlocked(true);
            videoEl.play().then(() => setConnectionState('connected')).catch(() => {});
          });
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(stream.id, stream.hostId, 'host', {
            type: 'candidate',
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setConnectionState('connected');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setConnectionState('reconnecting');
        }
      };

      sendSignal(stream.id, stream.hostId, 'host', { type: 'join' });
    },
    [user, sendSignal]
  );

  // Subscribe to Active Guest video/audio stream ('guest' channel)
  const connectToGuestStream = useCallback(
    (stream: LiveStreamDoc) => {
      if (!user || !stream.guestId || stream.guestId === user.uid) return;
      if (guestReceiverPeerRef.current) {
        guestReceiverPeerRef.current.close();
      }
      guestReceiverPendingRef.current = [];
      setGuestConnectionState('connecting');

      const pc = new RTCPeerConnection(RTC_CONFIG);
      guestReceiverPeerRef.current = pc;

      pc.ontrack = (event) => {
        const videoEl = remoteGuestVideoRef.current;
        if (!videoEl) return;
        const incomingStream = event.streams[0] || new MediaStream([event.track]);
        if (videoEl.srcObject !== incomingStream) {
          videoEl.srcObject = incomingStream;
        }
        videoEl.muted = isRemoteMutedRef.current;
        videoEl
          .play()
          .then(() => {
            setGuestConnectionState('connected');
          })
          .catch(() => {
            videoEl.muted = true;
            setIsRemoteMuted(true);
            setAutoplayBlocked(true);
            videoEl.play().then(() => setGuestConnectionState('connected')).catch(() => {});
          });
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && stream.guestId) {
          sendSignal(stream.id, stream.guestId, 'guest', {
            type: 'candidate',
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setGuestConnectionState('connected');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setGuestConnectionState('reconnecting');
        }
      };

      sendSignal(stream.id, stream.guestId, 'guest', { type: 'join' });
    },
    [user, sendSignal]
  );

  // Subscribe/Unsubscribe to Guest stream whenever an active co-host joins or leaves!
  useEffect(() => {
    if (!currentStreamId || !currentStream || !user || (mode !== 'broadcasting' && mode !== 'watching')) return;

    if (currentStream.guestStatus === 'active' && currentStream.guestId && currentStream.guestId !== user.uid) {
      connectToGuestStream(currentStream);
      return () => {
        if (currentStream.guestId) {
          sendSignal(currentStreamId, currentStream.guestId, 'guest', { type: 'leave' });
        }
        closeGuestReceiverPeer();
      };
    } else {
      closeGuestReceiverPeer();
    }
  }, [
    mode,
    currentStreamId,
    currentStream?.guestStatus,
    currentStream?.guestId,
    user,
    connectToGuestStream,
    closeGuestReceiverPeer,
    sendSignal,
  ]);

  // Viewer Presence + Subscribe to Host Stream when watching
  useEffect(() => {
    if (mode !== 'watching' || !currentStreamId || !currentStream?.hostId || !user || !profile) return;

    const viewerRef = doc(db, 'liveStreams', currentStreamId, 'viewers', user.uid);
    setDoc(viewerRef, {
      streamId: currentStreamId,
      userId: user.uid,
      username: profile.username || 'User',
      photoURL: profile.photoURL || '',
      joinedAt: serverTimestamp(),
      lastSeen: Date.now(),
    }).catch((err) => console.warn('Viewer presence join notice:', err));

    const heartbeat = setInterval(() => {
      updateDoc(viewerRef, { lastSeen: Date.now() }).catch(() => {});
    }, 20000);

    connectToHostStream(currentStream);

    return () => {
      clearInterval(heartbeat);
      deleteDoc(viewerRef).catch(() => {});
      sendSignal(currentStreamId, currentStream.hostId, 'host', { type: 'leave' });
      if (hostReceiverPeerRef.current) {
        hostReceiverPeerRef.current.close();
        hostReceiverPeerRef.current = null;
      }
    };
  }, [mode, currentStreamId, currentStream?.hostId, user, profile, connectToHostStream, sendSignal]);

  // Unified Incoming Signaling Listener (handles BOTH outgoing broadcast & incoming channels cleanly)
  useEffect(() => {
    if (!currentStreamId || !user || (mode !== 'broadcasting' && mode !== 'watching')) return;

    const myBroadcastChannel: SignalChannel | null = isHost ? 'host' : isActiveGuest ? 'guest' : null;

    const qSignals = query(
      collection(db, 'liveStreams', currentStreamId, 'signals'),
      where('toUid', '==', user.uid)
    );

    const unsubSignals = onSnapshot(
      qSignals,
      (snap) => {
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));

        docs.forEach(async (sig) => {
          if (processedSignalIdsRef.current.has(sig.id)) return;
          processedSignalIdsRef.current.add(sig.id);

          const fromUid = sig.fromUid as string;
          const channel: SignalChannel = sig.channel === 'guest' ? 'guest' : 'host';
          if (!fromUid || fromUid === user.uid) return;

          // A. Signals addressed to ME as a Broadcaster ('host' or 'guest' channel)
          if (myBroadcastChannel && channel === myBroadcastChannel) {
            if (sig.type === 'join') {
              await createOutgoingOffer(currentStreamId, fromUid, myBroadcastChannel);
            } else if (sig.type === 'answer' && sig.sdp) {
              const pc = outgoingPeersRef.current.get(fromUid);
              if (pc && pc.signalingState !== 'stable') {
                try {
                  await pc.setRemoteDescription(
                    new RTCSessionDescription({ type: (sig.sdpType || 'answer') as RTCSdpType, sdp: sig.sdp })
                  );
                  const queued = outgoingPendingCandidatesRef.current.get(fromUid) || [];
                  for (const cand of queued) {
                    await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
                  }
                  outgoingPendingCandidatesRef.current.set(fromUid, []);
                } catch (err) {
                  console.warn('Broadcaster setRemoteDescription error:', err);
                }
              }
            } else if (sig.type === 'candidate' && sig.candidate) {
              const pc = outgoingPeersRef.current.get(fromUid);
              if (pc) {
                if (pc.remoteDescription) {
                  await pc.addIceCandidate(new RTCIceCandidate(sig.candidate)).catch(() => {});
                } else {
                  const list = outgoingPendingCandidatesRef.current.get(fromUid) || [];
                  list.push(sig.candidate);
                  outgoingPendingCandidatesRef.current.set(fromUid, list);
                }
              }
            } else if (sig.type === 'leave') {
              const pc = outgoingPeersRef.current.get(fromUid);
              if (pc) {
                pc.close();
                outgoingPeersRef.current.delete(fromUid);
                setPeerCount(outgoingPeersRef.current.size);
              }
            }
          } else {
            // B. Signals addressed to ME as a Receiver (either 'host' channel or 'guest' channel)
            const targetPc = channel === 'guest' ? guestReceiverPeerRef.current : hostReceiverPeerRef.current;
            const pendingQueue = channel === 'guest' ? guestReceiverPendingRef : hostReceiverPendingRef;

            if (targetPc) {
              if (sig.type === 'offer' && sig.sdp) {
                try {
                  await targetPc.setRemoteDescription(
                    new RTCSessionDescription({ type: (sig.sdpType || 'offer') as RTCSdpType, sdp: sig.sdp })
                  );
                  for (const cand of pendingQueue.current) {
                    await targetPc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
                  }
                  pendingQueue.current = [];

                  const answer = await targetPc.createAnswer();
                  await targetPc.setLocalDescription(answer);
                  await sendSignal(currentStreamId, fromUid, channel, {
                    type: 'answer',
                    sdp: answer.sdp || '',
                    sdpType: answer.type,
                  });
                } catch (err) {
                  console.warn('Receiver answer error:', err);
                }
              } else if (sig.type === 'candidate' && sig.candidate) {
                if (targetPc.remoteDescription) {
                  await targetPc.addIceCandidate(new RTCIceCandidate(sig.candidate)).catch(() => {});
                } else {
                  pendingQueue.current.push(sig.candidate);
                }
              }
            }
          }

          deleteDoc(doc(db, 'liveStreams', currentStreamId, 'signals', sig.id)).catch(() => {});
        });
      },
      (err) => console.warn('Signals listener notice:', err)
    );

    return unsubSignals;
  }, [currentStreamId, user, mode, isHost, isActiveGuest, createOutgoingOffer, sendSignal]);

  // Cleanup on unmount or tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      const sid = currentStreamIdRef.current;
      const stream = currentStreamRef.current;
      if (modeRef.current === 'broadcasting' && sid) {
        updateDoc(doc(db, 'liveStreams', sid), {
          status: 'ended',
          endedAt: serverTimestamp(),
        }).catch(() => {});
      } else if (sid && stream?.guestId === user?.uid && stream?.guestStatus !== 'none') {
        updateDoc(doc(db, 'liveStreams', sid), {
          guestId: null,
          guestUsername: null,
          guestPhotoURL: null,
          guestStatus: 'none',
        }).catch(() => {});
      }
      stopLocalMedia();
      closeAllPeerConnections();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [user?.uid, stopLocalMedia, closeAllPeerConnections]);

  // ---------------------------------------------------------------------------
  // 4. Actions: Broadcast Lifecycle, Guest Invite / Accept / Leave, Chat & React
  // ---------------------------------------------------------------------------
  const handleEnterSetup = () => {
    setSummaryData(null);
    setStreamTitle(
      profile?.username
        ? isAr
          ? `بث مباشر مع ${profile.username}`
          : `Live with ${profile.username}`
        : ''
    );
    setMode('setup');
    initMediaSource('camera', 'user');
  };

  const handleCancelSetup = () => {
    stopLocalMedia();
    setMode('hub');
  };

  const captureThumbnail = (): string => {
    const videoEl = localVideoRef.current;
    if (!videoEl || videoEl.readyState < 2 || !camEnabled || sourceType === 'audio') return '';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.65);
    } catch {
      return '';
    }
  };

  const handleGoLive = async () => {
    if (!user || !profile || !streamTitle.trim() || startingStream) return;
    setStartingStream(true);
    try {
      const streamRef = doc(collection(db, 'liveStreams'));
      const thumb = captureThumbnail();
      await setDoc(streamRef, {
        id: streamRef.id,
        hostId: user.uid,
        hostUsername: profile.username || 'User',
        hostPhotoURL: profile.photoURL || '',
        title: streamTitle.trim().slice(0, 120),
        category: streamCategory,
        thumbnailURL: thumb,
        status: 'live',
        allowComments: allowCommentsSetup,
        pinnedMessage: '',
        likesCount: 0,
        commentsCount: 0,
        peakViewers: 0,
        guestId: null,
        guestUsername: null,
        guestPhotoURL: null,
        guestStatus: 'none',
        guestCamEnabled: true,
        guestMicEnabled: true,
        startedAt: serverTimestamp(),
        endedAt: null,
      });
      setCurrentStreamId(streamRef.id);
      setMode('broadcasting');
    } catch (err) {
      console.error('Failed to start live stream:', err);
      setMediaError(
        isAr
          ? 'تعذر بدء البث المباشر. تحقق من الاتصال وأعد المحاولة.'
          : 'Could not start live stream. Check connection and retry.'
      );
    } finally {
      setStartingStream(false);
    }
  };

  const handleEndBroadcast = async () => {
    if (currentStreamId) {
      try {
        await updateDoc(doc(db, 'liveStreams', currentStreamId), {
          status: 'ended',
          endedAt: serverTimestamp(),
          peakViewers: Math.max(currentStream?.peakViewers || 0, viewers.length),
        });
      } catch (err) {
        console.warn('Error marking stream ended:', err);
      }
    }
    setSummaryData({
      title: currentStream?.title || streamTitle,
      duration: elapsedSeconds,
      peakViewers: Math.max(currentStream?.peakViewers || 0, viewers.length),
      likesCount: currentStream?.likesCount || 0,
      commentsCount: currentStream?.commentsCount || comments.length,
    });
    stopLocalMedia();
    closeAllPeerConnections();
    setCurrentStreamId(null);
    setCurrentStream(null);
    setMode('summary');
  };

  const handleWatchStream = (stream: LiveStreamDoc) => {
    setCurrentStream(stream);
    setCurrentStreamId(stream.id);
    setMode('watching');
  };

  const handleLeaveWatching = async () => {
    if (currentStreamId && user && currentStream?.guestId === user.uid) {
      await updateDoc(doc(db, 'liveStreams', currentStreamId), {
        guestId: null,
        guestUsername: null,
        guestPhotoURL: null,
        guestStatus: 'none',
      }).catch(() => {});
    }
    stopLocalMedia();
    closeAllPeerConnections();
    setCurrentStreamId(null);
    setCurrentStream(null);
    setMode('hub');
  };

  // Host Invites a Guest (from Active Viewers, Guest Requests, or Search)
  const handleInviteGuest = async (target: { userId?: string; uid?: string; username: string; photoURL?: string }) => {
    if (!currentStreamId || !isHost) return;
    const targetUid = target.uid || target.userId;
    if (!targetUid || targetUid === user?.uid) return;

    try {
      await updateDoc(doc(db, 'liveStreams', currentStreamId), {
        guestId: targetUid,
        guestUsername: target.username || 'User',
        guestPhotoURL: target.photoURL || '',
        guestStatus: 'invited',
        guestCamEnabled: true,
        guestMicEnabled: true,
      });
      await deleteDoc(doc(db, 'liveStreams', currentStreamId, 'guestRequests', targetUid)).catch(() => {});
      setShowInviteModal(false);
    } catch (err) {
      console.warn('Invite guest error:', err);
    }
  };

  const handleRemoveOrCancelGuest = async () => {
    if (!currentStreamId || !isHost) return;
    await updateDoc(doc(db, 'liveStreams', currentStreamId), {
      guestId: null,
      guestUsername: null,
      guestPhotoURL: null,
      guestStatus: 'none',
    }).catch(() => {});
    closeGuestReceiverPeer();
  };

  const handleDismissGuestRequest = async (requesterUid: string) => {
    if (!currentStreamId || !isHost) return;
    await deleteDoc(doc(db, 'liveStreams', currentStreamId, 'guestRequests', requesterUid)).catch(() => {});
  };

  // Viewer Requests to Co-Host
  const hasRequestedJoin = useMemo(
    () => Boolean(user && guestRequests.some((r) => r.userId === user.uid)),
    [user, guestRequests]
  );

  const handleToggleRequestToJoin = async () => {
    if (!currentStreamId || !user || !profile || isHost) return;
    const reqRef = doc(db, 'liveStreams', currentStreamId, 'guestRequests', user.uid);
    if (hasRequestedJoin) {
      await deleteDoc(reqRef).catch(() => {});
    } else {
      await setDoc(reqRef, {
        streamId: currentStreamId,
        userId: user.uid,
        username: profile.username || 'User',
        photoURL: profile.photoURL || '',
        createdAt: serverTimestamp(),
      }).catch((err) => console.warn('Request join notice:', err));
    }
  };

  // Invited Guest Accepts Invitation -> Starts Camera/Mic + Joins Split Screen
  const handleAcceptGuestInvite = async () => {
    if (!currentStreamId || !user || joiningAsGuest) return;
    setJoiningAsGuest(true);
    try {
      let stream = await initMediaSource('camera', 'user');
      if (!stream) {
        stream = await initMediaSource('audio');
      }
      const hasVideo = Boolean(stream && stream.getVideoTracks().some((t) => t.enabled));
      const hasAudio = Boolean(stream && stream.getAudioTracks().some((t) => t.enabled));

      await updateDoc(doc(db, 'liveStreams', currentStreamId), {
        guestId: user.uid,
        guestStatus: 'active',
        guestCamEnabled: hasVideo,
        guestMicEnabled: hasAudio,
      });
    } catch (err) {
      console.warn('Accept guest invite error:', err);
    } finally {
      setJoiningAsGuest(false);
    }
  };

  const handleDeclineGuestInvite = async () => {
    if (!currentStreamId || !user) return;
    await updateDoc(doc(db, 'liveStreams', currentStreamId), {
      guestId: null,
      guestUsername: null,
      guestPhotoURL: null,
      guestStatus: 'none',
    }).catch(() => {});
  };

  const handleLeaveCoHost = async () => {
    if (!currentStreamId || !user) return;
    stopLocalMedia();
    closeOutgoingPeers();
    await updateDoc(doc(db, 'liveStreams', currentStreamId), {
      guestId: null,
      guestUsername: null,
      guestPhotoURL: null,
      guestStatus: 'none',
    }).catch(() => {});
  };

  const toggleCam = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) return;
    const next = !camEnabled;
    videoTracks.forEach((t) => {
      t.enabled = next;
    });
    setCamEnabled(next);
    if (isActiveGuest && currentStreamId) {
      updateDoc(doc(db, 'liveStreams', currentStreamId), {
        guestCamEnabled: next,
      }).catch(() => {});
    }
  };

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;
    const next = !micEnabled;
    audioTracks.forEach((t) => {
      t.enabled = next;
    });
    setMicEnabled(next);
    if (isActiveGuest && currentStreamId) {
      updateDoc(doc(db, 'liveStreams', currentStreamId), {
        guestMicEnabled: next,
      }).catch(() => {});
    }
  };

  const handleFlipCamera = () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    setMirrorPreview(nextFacing === 'user');
    initMediaSource('camera', nextFacing);
  };

  const handleToggleCommentsAllowed = async () => {
    if (!currentStreamId || !currentStream || currentStream.hostId !== user?.uid) return;
    await updateDoc(doc(db, 'liveStreams', currentStreamId), {
      allowComments: !currentStream.allowComments,
    }).catch(() => {});
  };

  const handlePinComment = async (text: string) => {
    if (!currentStreamId || !currentStream || currentStream.hostId !== user?.uid) return;
    await updateDoc(doc(db, 'liveStreams', currentStreamId), {
      pinnedMessage: currentStream.pinnedMessage === text ? '' : text.slice(0, 300),
    }).catch(() => {});
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!currentStreamId) return;
    await deleteDoc(doc(db, 'liveStreams', currentStreamId, 'comments', commentId)).catch(() => {});
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !currentStreamId || !commentInput.trim()) return;
    if (currentStream && !currentStream.allowComments && currentStream.hostId !== user.uid) return;

    const text = commentInput.trim().slice(0, 300);
    setCommentInput('');
    try {
      await addDoc(collection(db, 'liveStreams', currentStreamId, 'comments'), {
        streamId: currentStreamId,
        userId: user.uid,
        username: profile.username || 'User',
        userPhotoURL: profile.photoURL || '',
        text,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'liveStreams', currentStreamId), {
        commentsCount: increment(1),
      });
    } catch (err) {
      console.warn('Send live comment notice:', err);
    }
  };

  const handleSendReaction = async (emoji: ReactionKey) => {
    if (!user || !currentStreamId) return;
    if (currentStream?.status !== 'live') return;
    setTappedEmoji(emoji);
    const resetId = window.setTimeout(() => {
      setTappedEmoji((prev) => (prev === emoji ? null : prev));
    }, 220);
    reactionTimeoutsRef.current.push(resetId);
    spawnFloatingReaction(emoji);
    try {
      await addDoc(collection(db, 'liveStreams', currentStreamId, 'reactions'), {
        streamId: currentStreamId,
        userId: user.uid,
        emoji,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'liveStreams', currentStreamId), {
        likesCount: increment(1),
      });
    } catch (err) {
      console.warn('Reaction notice:', err);
    }
  };

  const handleBlockViewer = async (viewerUid: string) => {
    if (!user || !currentStreamId || viewerUid === user.uid) return;
    await blockUser(user.uid, viewerUid);
    await deleteDoc(doc(db, 'liveStreams', currentStreamId, 'viewers', viewerUid)).catch(() => {});
    if (currentStream?.guestId === viewerUid) {
      await handleRemoveOrCancelGuest();
    }
    const pc = outgoingPeersRef.current.get(viewerUid);
    if (pc) {
      pc.close();
      outgoingPeersRef.current.delete(viewerUid);
      setPeerCount(outgoingPeersRef.current.size);
    }
  };

  const filteredActiveStreams = useMemo(() => {
    if (selectedCategory === 'all') return activeStreams;
    return activeStreams.filter((s) => s.category === selectedCategory);
  }, [activeStreams, selectedCategory]);

  const filteredInviteUsers = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    const viewerIds = new Set(viewers.map((v) => v.userId));
    return searchableUsers
      .filter((u) => !viewerIds.has(u.uid))
      .filter((u) => {
        if (!q) return true;
        return (
          (u.username || '').toLowerCase().includes(q) ||
          (u.fullName || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 12);
  }, [searchableUsers, viewers, userSearchQuery]);

  const getCategoryLabel = (catId: string) => {
    const found = CATEGORIES.find((c) => c.id === catId);
    return found ? (isAr ? found.ar : found.en) : catId;
  };

  // ===========================================================================
  // RENDER: SUMMARY VIEW AFTER ENDING STREAM
  // ===========================================================================
  if (mode === 'summary' && summaryData) {
    return (
      <div className="max-w-lg mx-auto py-8 animate-in fade-in">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              {isAr ? 'تم إنهاء البث المباشر' : 'Live Broadcast Ended'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{summaryData.title}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70">
              <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                {formatDuration(summaryData.duration)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {isAr ? 'المدة' : 'Duration'}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70">
              <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                {summaryData.peakViewers}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {isAr ? 'ذروة المشاهدين' : 'Peak Viewers'}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70">
              <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                {summaryData.likesCount}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {isAr ? 'الإعجابات' : 'Likes'}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70">
              <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                {summaryData.commentsCount}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {isAr ? 'التعليقات' : 'Comments'}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={handleEnterSetup}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Radio size={18} />
              <span>{isAr ? 'بث جديد' : 'Start Another Live'}</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('hub')}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-sm font-bold transition-colors"
            >
              {isAr ? 'العودة لقائمة البث' : 'Back to Live Hub'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // RENDER: PRE-LIVE SETUP STUDIO
  // ===========================================================================
  if (mode === 'setup') {
    return (
      <div className="max-w-5xl mx-auto pb-8 space-y-5 animate-in fade-in">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleCancelSetup}
            className="min-h-[44px] px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"
          >
            {isAr ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}
            <span>{isAr ? 'رجوع' : 'Back'}</span>
          </button>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Radio size={20} className="text-rose-500" />
            <span>{isAr ? 'استوديو إعداد البث المباشر' : 'Live Broadcast Setup'}</span>
          </h2>
          <div className="w-16" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 bg-slate-950 rounded-3xl overflow-hidden relative min-h-[340px] sm:min-h-[420px] flex flex-col justify-between border border-slate-800 shadow-xl">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover absolute inset-0 ${
                mirrorPreview && sourceType === 'camera' ? '-scale-x-100' : ''
              } ${!camEnabled || sourceType === 'audio' ? 'opacity-0' : 'opacity-100'}`}
            />

            {(!camEnabled || sourceType === 'audio' || mediaError) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white gap-4">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/25 bg-slate-800 flex items-center justify-center">
                  {profile?.photoURL ? (
                    <img
                      src={profile.photoURL}
                      alt={profile.username || ''}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Camera size={28} className="text-slate-400" />
                  )}
                </div>
                {mediaError ? (
                  <div className="max-w-sm space-y-3">
                    <p className="text-xs sm:text-sm text-rose-300 leading-relaxed">{mediaError}</p>
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => initMediaSource('camera', facingMode)}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white text-slate-900 text-xs font-bold hover:bg-slate-100"
                      >
                        {isAr ? 'إعادة طلب الإذن' : 'Retry Camera'}
                      </button>
                      <button
                        type="button"
                        onClick={() => initMediaSource('screen')}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/15 text-white text-xs font-bold hover:bg-white/25"
                      >
                        {isAr ? 'مشاركة الشاشة' : 'Share Screen'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-300">
                    {sourceType === 'audio'
                      ? isAr
                        ? 'وضع البث الصوتي فقط نشط'
                        : 'Audio-only broadcast active'
                      : isAr
                      ? 'الكاميرا متوقفة مؤقتاً'
                      : 'Camera is paused'}
                  </p>
                )}
              </div>
            )}

            <div className="relative z-10 p-4 flex items-center justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent">
              <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => initMediaSource('camera', facingMode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    sourceType === 'camera' ? 'bg-white text-slate-900' : 'text-white/80 hover:text-white'
                  }`}
                >
                  {isAr ? 'كاميرا' : 'Camera'}
                </button>
                <button
                  type="button"
                  onClick={() => initMediaSource('screen')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    sourceType === 'screen' ? 'bg-white text-slate-900' : 'text-white/80 hover:text-white'
                  }`}
                >
                  {isAr ? 'الشاشة' : 'Screen'}
                </button>
                <button
                  type="button"
                  onClick={() => initMediaSource('audio')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    sourceType === 'audio' ? 'bg-white text-slate-900' : 'text-white/80 hover:text-white'
                  }`}
                >
                  {isAr ? 'صوت فقط' : 'Audio'}
                </button>
              </div>

              <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-white">
                {micEnabled ? <Mic size={14} className="text-emerald-400" /> : <MicOff size={14} className="text-rose-400" />}
                <div className="w-16 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-75"
                    style={{ width: `${micEnabled ? audioLevel : 0}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="relative z-10 p-4 flex items-center justify-center gap-3 bg-gradient-to-t from-black/80 to-transparent">
              <button
                type="button"
                onClick={toggleMic}
                aria-label={micEnabled ? 'Mute mic' : 'Unmute mic'}
                className={`min-h-[44px] min-w-[44px] px-4 rounded-xl flex items-center gap-2 text-xs font-bold border transition-colors ${
                  micEnabled
                    ? 'bg-white/15 hover:bg-white/25 text-white border-white/20'
                    : 'bg-rose-600 text-white border-rose-500'
                }`}
              >
                {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
                <span>{micEnabled ? (isAr ? 'الميكروفون يعمل' : 'Mic On') : isAr ? 'مكتوم' : 'Muted'}</span>
              </button>

              {sourceType !== 'audio' && (
                <button
                  type="button"
                  onClick={toggleCam}
                  aria-label={camEnabled ? 'Turn off camera' : 'Turn on camera'}
                  className={`min-h-[44px] min-w-[44px] px-4 rounded-xl flex items-center gap-2 text-xs font-bold border transition-colors ${
                    camEnabled
                      ? 'bg-white/15 hover:bg-white/25 text-white border-white/20'
                      : 'bg-rose-600 text-white border-rose-500'
                  }`}
                >
                  {camEnabled ? <Video size={18} /> : <VideoOff size={18} />}
                  <span>{camEnabled ? (isAr ? 'الكاميرا تعمل' : 'Cam On') : isAr ? 'متوقفة' : 'Off'}</span>
                </button>
              )}

              {sourceType === 'camera' && (
                <button
                  type="button"
                  onClick={handleFlipCamera}
                  aria-label={isAr ? 'تبديل الكاميرا' : 'Flip camera'}
                  title={isAr ? 'تبديل الكاميرا' : 'Flip camera'}
                  className="min-h-[44px] min-w-[44px] rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 flex items-center justify-center transition-colors"
                >
                  <RefreshCw size={18} />
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex flex-col justify-between gap-5">
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
                  {isAr ? 'عنوان البث المباشر' : 'Broadcast Title'}
                </label>
                <input
                  type="text"
                  value={streamTitle}
                  maxLength={120}
                  onChange={(e) => setStreamTitle(e.target.value)}
                  placeholder={isAr ? 'عمّ يتحدث بثك اليوم؟' : 'What are you streaming today?'}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
                  {isAr ? 'التصنيف' : 'Category'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setStreamCategory(cat.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                        streamCategory === cat.id
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {isAr ? cat.ar : cat.en}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {isAr ? 'السماح بالتعليقات المباشرة' : 'Allow Live Comments'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {isAr ? 'يمكن للمشاهدين إرسال رسائل وتفاعلات' : 'Viewers can chat and react in real time'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAllowCommentsSetup((p) => !p)}
                  className={`w-12 h-7 rounded-full p-1 transition-colors flex items-center ${
                    allowCommentsSetup ? 'bg-rose-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                  aria-label={isAr ? 'تبديل التعليقات' : 'Toggle comments'}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm block" />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoLive}
              disabled={!streamTitle.trim() || startingStream}
              className="w-full min-h-[48px] px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 transition-all active:scale-[0.98]"
            >
              {startingStream ? <Loader2 size={18} className="animate-spin" /> : <Radio size={18} />}
              <span>{isAr ? 'ابدأ البث المباشر الآن' : 'Start Live Broadcast Now'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // RENDER: ACTIVE BROADCASTER OR VIEWER ROOM (WITH SPLIT-SCREEN CO-HOST)
  // ===========================================================================
  if ((mode === 'broadcasting' || mode === 'watching') && currentStream) {
    return (
      <div className="max-w-6xl mx-auto pb-8 animate-in fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Video Stage (Single Full-Screen OR Split-Screen Dual Pane) */}
          <div className="lg:col-span-7 xl:col-span-8 relative bg-black rounded-3xl overflow-hidden min-h-[550px] lg:h-[calc(100vh-130px)] flex flex-col justify-between border border-slate-800 shadow-2xl">
            {/* MEDIA SURFACE */}
            {isSplitScreen ? (
              <div className="absolute inset-0 grid grid-cols-1 grid-rows-2 sm:grid-cols-2 sm:grid-rows-1 gap-1.5 p-1.5 bg-slate-950">
                {/* Pane 1: Host */}
                <div className="relative rounded-2xl overflow-hidden bg-slate-900">
                  {isHost ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className={`w-full h-full object-cover ${
                        mirrorPreview && sourceType === 'camera' ? '-scale-x-100' : ''
                      } ${!camEnabled || sourceType === 'audio' ? 'opacity-0' : 'opacity-100'}`}
                    />
                  ) : (
                    <video
                      ref={remoteHostVideoRef}
                      autoPlay
                      muted={isRemoteMuted}
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  )}

                  {((isHost && (!camEnabled || sourceType === 'audio')) ||
                    (!isHost && connectionState !== 'connected')) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-slate-900 via-black to-slate-900 text-white gap-2.5">
                      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-rose-500/70 bg-slate-800">
                        <UserAvatar
                          src={currentStream.hostPhotoURL}
                          username={currentStream.hostUsername}
                          iconSize={26}
                        />
                      </div>
                      <span className="text-xs text-slate-300">
                        {isHost
                          ? sourceType === 'audio'
                            ? isAr
                              ? 'بث صوتي'
                              : 'Audio Only'
                            : isAr
                            ? 'الكاميرا متوقفة'
                            : 'Camera Off'
                          : connectionState === 'reconnecting'
                          ? isAr
                            ? 'إعادة الاتصال...'
                            : 'Reconnecting...'
                          : isAr
                          ? 'جاري الاتصال بالمضيف...'
                          : 'Connecting host...'}
                      </span>
                    </div>
                  )}

                  <div className="absolute bottom-2.5 start-2.5 px-2.5 py-1 rounded-lg bg-black/65 backdrop-blur-md text-white text-[11px] font-bold flex items-center gap-1.5 border border-white/10">
                    <span>@{currentStream.hostUsername}</span>
                    <span className="text-rose-400">· {isAr ? 'المضيف' : 'Host'}</span>
                  </div>
                </div>

                {/* Pane 2: Co-Host Guest */}
                <div className="relative rounded-2xl overflow-hidden bg-slate-900">
                  {isActiveGuest ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className={`w-full h-full object-cover ${
                        mirrorPreview && sourceType === 'camera' ? '-scale-x-100' : ''
                      } ${!camEnabled || sourceType === 'audio' ? 'opacity-0' : 'opacity-100'}`}
                    />
                  ) : (
                    <video
                      ref={remoteGuestVideoRef}
                      autoPlay
                      muted={isRemoteMuted}
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  )}

                  {((isActiveGuest && (!camEnabled || sourceType === 'audio')) ||
                    (!isActiveGuest &&
                      (guestConnectionState !== 'connected' || currentStream.guestCamEnabled === false))) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-purple-950/60 via-slate-950 to-slate-900 text-white gap-2.5">
                      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-purple-400/70 bg-slate-800">
                        <UserAvatar
                          src={currentStream.guestPhotoURL}
                          username={currentStream.guestUsername}
                          iconSize={26}
                        />
                      </div>
                      <span className="text-xs text-slate-300">
                        {isActiveGuest
                          ? sourceType === 'audio'
                            ? isAr
                              ? 'بث صوتي'
                              : 'Audio Only'
                            : isAr
                            ? 'الكاميرا متوقفة'
                            : 'Camera Off'
                          : currentStream.guestCamEnabled === false
                          ? isAr
                            ? 'كاميرا الضيف متوقفة'
                            : 'Guest camera off'
                          : guestConnectionState === 'connecting'
                          ? isAr
                            ? 'جاري ربط الضيف...'
                            : 'Connecting guest...'
                          : isAr
                          ? 'إعادة الاتصال بالضيف...'
                          : 'Reconnecting guest...'}
                      </span>
                    </div>
                  )}

                  <div className="absolute bottom-2.5 start-2.5 px-2.5 py-1 rounded-lg bg-black/65 backdrop-blur-md text-white text-[11px] font-bold flex items-center gap-1.5 border border-white/10">
                    <span>@{currentStream.guestUsername}</span>
                    <span className="text-purple-300">· {isAr ? 'ضيف' : 'Guest'}</span>
                  </div>

                  {isHost && (
                    <button
                      type="button"
                      onClick={handleRemoveOrCancelGuest}
                      aria-label={isAr ? 'إزالة الضيف' : 'Remove guest'}
                      title={isAr ? 'إزالة الضيف' : 'Remove guest'}
                      className="absolute top-2.5 end-2.5 min-h-[36px] px-2.5 rounded-xl bg-black/65 hover:bg-rose-600 text-white text-[11px] font-bold flex items-center gap-1 border border-white/15 transition-colors z-30"
                    >
                      <UserMinus size={13} />
                      <span>{isAr ? 'إزالة' : 'Remove'}</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {isHost ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`w-full h-full object-cover absolute inset-0 ${
                      mirrorPreview && sourceType === 'camera' ? '-scale-x-100' : ''
                    } ${!camEnabled || sourceType === 'audio' ? 'opacity-0' : 'opacity-100'}`}
                  />
                ) : (
                  <video
                    ref={remoteHostVideoRef}
                    autoPlay
                    muted={isRemoteMuted}
                    playsInline
                    className="w-full h-full object-cover absolute inset-0"
                  />
                )}

                {((isHost && (!camEnabled || sourceType === 'audio')) ||
                  (!isHost && connectionState !== 'connected')) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-slate-900 via-black to-slate-900 text-white gap-4">
                    <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-rose-500/70 bg-slate-800">
                      <UserAvatar
                        src={currentStream.hostPhotoURL}
                        username={currentStream.hostUsername}
                        iconSize={30}
                      />
                    </div>
                    {isHost ? (
                      <p className="text-sm font-medium text-slate-300">
                        {sourceType === 'audio'
                          ? isAr
                            ? 'بث صوتي مباشر قيد التشغيل'
                            : 'Live audio broadcast in progress'
                          : isAr
                          ? 'الكاميرا متوقفة مؤقتاً — الصوت مستمر'
                          : 'Camera paused — audio continues'}
                      </p>
                    ) : connectionState === 'ended' ? (
                      <div className="space-y-3">
                        <h3 className="text-xl font-bold">{isAr ? 'انتهى هذا البث المباشر' : 'This broadcast has ended'}</h3>
                        <button
                          type="button"
                          onClick={handleLeaveWatching}
                          className="min-h-[44px] px-5 py-2 rounded-xl bg-white text-slate-900 text-sm font-bold"
                        >
                          {isAr ? 'العودة لقائمة البث' : 'Back to Live Hub'}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <Loader2 size={26} className="animate-spin mx-auto text-rose-500" />
                        <p className="text-sm text-slate-300">
                          {connectionState === 'reconnecting'
                            ? isAr
                              ? 'إعادة الاتصال بالبث المباشر...'
                              : 'Reconnecting to live feed...'
                            : isAr
                            ? 'جاري الاتصال ببث المضيف...'
                            : 'Connecting to host stream...'}
                        </p>
                        <button
                          type="button"
                          onClick={() => connectToHostStream(currentStream)}
                          className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold text-white"
                        >
                          {isAr ? 'إعادة المحاولة' : 'Reconnect'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Floating Real-Time Reactions Layer */}
            <div className="absolute inset-x-0 bottom-20 top-16 pointer-events-none overflow-hidden z-20">
              {floatingReactions.map((r) => (
                <div
                  key={r.localId}
                  className={`absolute bottom-0 ${r.sway ? 'animate-live-float-sway' : 'animate-live-float'}`}
                  style={{ left: `${r.leftPct}%` }}
                >
                  <div
                    className="w-11 h-11 rounded-full bg-black/25 backdrop-blur-[2px] flex items-center justify-center shadow-lg"
                    style={{ transform: `scale(${r.scale})` }}
                  >
                    <ReactionIcon emoji={r.emoji} size={26} />
                  </div>
                </div>
              ))}
            </div>

            {/* Interactive Emoji Reaction Sidebar */}
            {currentStream.status === 'live' && connectionState !== 'ended' && (
              <aside
                aria-label={isAr ? 'شريط الرموز التعبيرية التفاعلية' : 'Interactive Emoji Reactions Sidebar'}
                className="absolute end-3 bottom-24 sm:bottom-28 z-30 flex flex-col items-center gap-1.5 max-h-[calc(100%-176px)]"
              >
                {showReactionSidebar ? (
                  <div className="bg-black/50 backdrop-blur-md border border-white/15 rounded-2xl p-1.5 shadow-2xl flex flex-col items-center gap-1 overflow-y-auto no-scrollbar">
                    {REACTION_ITEMS.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => handleSendReaction(item.key)}
                        aria-label={isAr ? `إرسال تفاعل ${item.ar}` : `Send ${item.en} reaction`}
                        title={isAr ? item.ar : item.en}
                        className={`min-h-[42px] min-w-[42px] sm:min-h-[44px] sm:min-w-[44px] rounded-xl flex items-center justify-center text-xl sm:text-[22px] leading-none hover:bg-white/15 active:scale-125 transition-transform duration-150 select-none ${
                          tappedEmoji === item.key ? 'animate-emoji-tap bg-white/20' : ''
                        }`}
                      >
                        {item.symbol}
                      </button>
                    ))}
                    <div className="w-6 h-px bg-white/15 my-0.5 shrink-0" />
                    <button
                      type="button"
                      onClick={() => setShowReactionSidebar(false)}
                      aria-label={isAr ? 'تصغير شريط الرموز' : 'Collapse reactions sidebar'}
                      title={isAr ? 'تصغير' : 'Collapse'}
                      className="min-h-[36px] min-w-[42px] sm:min-w-[44px] rounded-xl flex items-center justify-center text-white/75 hover:text-white hover:bg-white/15 transition-colors shrink-0"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowReactionSidebar(true)}
                    aria-label={isAr ? 'فتح شريط الرموز التعبيرية' : 'Open emoji reactions sidebar'}
                    title={isAr ? 'التفاعلات' : 'Reactions'}
                    className="min-h-[44px] min-w-[44px] rounded-2xl bg-black/55 hover:bg-black/75 backdrop-blur-md border border-white/15 text-white flex items-center justify-center shadow-xl transition-colors"
                  >
                    <Smile size={20} />
                  </button>
                )}
              </aside>
            )}

            {/* Top Overlay Scrim */}
            <div className="relative z-20 p-4 bg-gradient-to-b from-black/80 via-black/45 to-transparent flex items-start justify-between gap-3 pointer-events-none">
              <div className="flex items-center gap-2.5 min-w-0 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => {
                    if (!isHost) {
                      handleLeaveWatching();
                      onOpenProfile(currentStream.hostId);
                    }
                  }}
                  className="flex items-center gap-2.5 min-w-0 text-start"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-rose-500 shrink-0 bg-slate-800">
                    <UserAvatar
                      src={currentStream.hostPhotoURL}
                      username={currentStream.hostUsername}
                      iconSize={18}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white truncate">
                        @{currentStream.hostUsername}
                        {isSplitScreen && currentStream.guestUsername ? ` & @${currentStream.guestUsername}` : ''}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[11px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        <span>{isAr ? 'مباشر' : 'LIVE'}</span>
                      </span>
                    </div>
                    <p className="text-xs text-white/80 truncate">{currentStream.title}</p>
                  </div>
                </button>

                {!isHost && user && currentStream.hostId !== user.uid && (
                  <FollowButton targetUserId={currentStream.hostId} variant="overlay" />
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => setShowViewersModal(true)}
                  className="min-h-[38px] px-3 rounded-xl bg-black/55 hover:bg-black/75 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1.5 border border-white/15 tabular-nums"
                  title={isAr ? 'المشاهدون النشطون' : 'Active Viewers'}
                >
                  <Users size={15} />
                  <span>{viewers.length}</span>
                </button>

                <div className="hidden sm:flex min-h-[38px] px-3 rounded-xl bg-black/55 backdrop-blur-md text-white text-xs font-bold items-center gap-1.5 border border-white/15 tabular-nums">
                  <Clock size={14} />
                  <span>{formatDuration(elapsedSeconds)}</span>
                </div>

                {isHost ? (
                  <button
                    type="button"
                    onClick={handleEndBroadcast}
                    className="min-h-[40px] px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold whitespace-nowrap shadow-lg"
                  >
                    {isAr ? 'إنهاء البث' : 'End Live'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleLeaveWatching}
                    aria-label={isAr ? 'مغادرة البث' : 'Leave stream'}
                    className="min-h-[40px] min-w-[40px] rounded-xl bg-black/55 hover:bg-black/80 text-white flex items-center justify-center border border-white/15"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>

            {/* Invited Guest Interactive Overlay */}
            {isInvitedGuest && (
              <div className="relative z-30 mx-4 p-4 rounded-2xl bg-slate-900/95 border border-purple-500/50 backdrop-blur-lg text-white shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-purple-400 shrink-0">
                    <UserAvatar
                      src={currentStream.hostPhotoURL}
                      username={currentStream.hostUsername}
                      iconSize={18}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-bold">
                      {isAr
                        ? `دعاك @${currentStream.hostUsername} للبث المباشر المشترك!`
                        : `@${currentStream.hostUsername} invited you to co-host!`}
                    </div>
                    <div className="text-xs text-slate-300">
                      {isAr
                        ? 'عند القبول ستظهر في شاشة مقسمة مع المضيف'
                        : 'Accepting opens a split-screen broadcast with the host'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDeclineGuestInvite}
                    className="min-h-[40px] px-3.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold"
                  >
                    {isAr ? 'رفض' : 'Decline'}
                  </button>
                  <button
                    type="button"
                    onClick={handleAcceptGuestInvite}
                    disabled={joiningAsGuest}
                    className="min-h-[40px] px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-xs font-bold flex items-center gap-1.5"
                  >
                    {joiningAsGuest ? <Loader2 size={15} className="animate-spin" /> : <SplitSquareHorizontal size={15} />}
                    <span>{isAr ? 'قبول والانضمام' : 'Accept & Join'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Controls Scrim */}
            <div className="relative z-20 p-4 bg-gradient-to-t from-black/85 via-black/45 to-transparent space-y-3">
              {currentStream.pinnedMessage && (
                <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-amber-500/20 border border-amber-400/35 backdrop-blur-md text-white text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Pin size={14} className="text-amber-400 shrink-0" />
                    <span className="truncate font-medium">{currentStream.pinnedMessage}</span>
                  </div>
                  {isHost && (
                    <button
                      type="button"
                      onClick={() => handlePinComment('')}
                      className="text-amber-300 hover:text-white shrink-0"
                      aria-label={isAr ? 'إلغاء التثبيت' : 'Unpin'}
                    >
                      <PinOff size={14} />
                    </button>
                  )}
                </div>
              )}

              {isHost ? (
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={toggleMic}
                      aria-label={micEnabled ? 'Mute' : 'Unmute'}
                      className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center border transition-colors ${
                        micEnabled ? 'bg-white/15 text-white border-white/20' : 'bg-rose-600 text-white border-rose-500'
                      }`}
                    >
                      {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
                    </button>

                    <button
                      type="button"
                      onClick={toggleCam}
                      aria-label={camEnabled ? 'Camera off' : 'Camera on'}
                      className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center border transition-colors ${
                        camEnabled ? 'bg-white/15 text-white border-white/20' : 'bg-rose-600 text-white border-rose-500'
                      }`}
                    >
                      {camEnabled ? <Video size={18} /> : <VideoOff size={18} />}
                    </button>

                    <button
                      type="button"
                      onClick={() => initMediaSource(sourceType === 'screen' ? 'camera' : 'screen', facingMode)}
                      aria-label={isAr ? 'تبديل الكاميرا / مشاركة الشاشة' : 'Toggle screen share'}
                      title={isAr ? 'مشاركة الشاشة / الكاميرا' : 'Screen Share / Camera'}
                      className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center border transition-colors ${
                        sourceType === 'screen'
                          ? 'bg-purple-600 text-white border-purple-500'
                          : 'bg-white/15 text-white border-white/20 hover:bg-white/25'
                      }`}
                    >
                      <MonitorUp size={18} />
                    </button>

                    {sourceType === 'camera' && (
                      <button
                        type="button"
                        onClick={handleFlipCamera}
                        aria-label={isAr ? 'تبديل الكاميرا' : 'Flip camera'}
                        className="min-h-[44px] min-w-[44px] rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 flex items-center justify-center"
                      >
                        <RefreshCw size={18} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleToggleCommentsAllowed}
                      aria-label={currentStream.allowComments ? 'Disable comments' : 'Enable comments'}
                      title={currentStream.allowComments ? (isAr ? 'إيقاف التعليقات' : 'Disable comments') : isAr ? 'تفعيل التعليقات' : 'Enable comments'}
                      className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center border transition-colors ${
                        currentStream.allowComments
                          ? 'bg-white/15 text-white border-white/20'
                          : 'bg-amber-600 text-white border-amber-500'
                      }`}
                    >
                      {currentStream.allowComments ? <MessageCircle size={18} /> : <MessageSquareOff size={18} />}
                    </button>

                    {/* Host Guest Invite / Split-Screen Manager Button */}
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(true)}
                      className={`min-h-[44px] px-3.5 rounded-xl flex items-center gap-1.5 text-xs font-bold border transition-colors relative whitespace-nowrap ${
                        currentStream.guestStatus === 'active'
                          ? 'bg-purple-600 text-white border-purple-500'
                          : currentStream.guestStatus === 'invited'
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-white/15 hover:bg-white/25 text-white border-white/20'
                      }`}
                    >
                      <SplitSquareHorizontal size={17} />
                      <span>
                        {currentStream.guestStatus === 'active'
                          ? isAr
                            ? `مع @${currentStream.guestUsername}`
                            : `With @${currentStream.guestUsername}`
                          : currentStream.guestStatus === 'invited'
                          ? isAr
                            ? 'تمت الدعوة'
                            : 'Invited'
                          : isAr
                          ? 'دعوة ضيف'
                          : 'Invite Guest'}
                      </span>
                      {guestRequests.length > 0 && currentStream.guestStatus === 'none' && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-extrabold tabular-nums leading-none">
                          {guestRequests.length}
                        </span>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-3 text-white text-xs font-bold tabular-nums">
                    <span className="flex items-center gap-1.5 bg-black/45 px-3 py-2 rounded-xl border border-white/10">
                      <Wifi size={14} className="text-emerald-400" />
                      <span>{peerCount} P2P</span>
                    </span>
                    <span className="flex items-center gap-1.5 bg-black/45 px-3 py-2 rounded-xl border border-white/10">
                      <Heart size={14} className="text-rose-500 fill-rose-500" />
                      <span>{currentStream.likesCount || 0}</span>
                    </span>
                  </div>
                </div>
              ) : isActiveGuest ? (
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={toggleMic}
                      aria-label={micEnabled ? 'Mute' : 'Unmute'}
                      className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center border transition-colors ${
                        micEnabled ? 'bg-white/15 text-white border-white/20' : 'bg-rose-600 text-white border-rose-500'
                      }`}
                    >
                      {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
                    </button>

                    <button
                      type="button"
                      onClick={toggleCam}
                      aria-label={camEnabled ? 'Camera off' : 'Camera on'}
                      className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center border transition-colors ${
                        camEnabled ? 'bg-white/15 text-white border-white/20' : 'bg-rose-600 text-white border-rose-500'
                      }`}
                    >
                      {camEnabled ? <Video size={18} /> : <VideoOff size={18} />}
                    </button>

                    {sourceType === 'camera' && (
                      <button
                        type="button"
                        onClick={handleFlipCamera}
                        aria-label={isAr ? 'تبديل الكاميرا' : 'Flip camera'}
                        className="min-h-[44px] min-w-[44px] rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 flex items-center justify-center"
                      >
                        <RefreshCw size={18} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        const next = !isRemoteMuted;
                        setIsRemoteMuted(next);
                        if (remoteHostVideoRef.current) {
                          remoteHostVideoRef.current.muted = next;
                          remoteHostVideoRef.current.play().catch(() => {});
                        }
                      }}
                      className="min-h-[44px] min-w-[44px] rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 flex items-center justify-center"
                      aria-label={isRemoteMuted ? 'Unmute host' : 'Mute host'}
                    >
                      {isRemoteMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleLeaveCoHost}
                    className="min-h-[44px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <UserMinus size={16} />
                    <span>{isAr ? 'مغادرة البث المشترك' : 'Leave Co-Host'}</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !isRemoteMuted;
                        setIsRemoteMuted(next);
                        setAutoplayBlocked(false);
                        [remoteHostVideoRef.current, remoteGuestVideoRef.current].forEach((el) => {
                          if (el) {
                            el.muted = next;
                            el.play().catch(() => {});
                          }
                        });
                      }}
                      className={`min-h-[44px] px-3.5 rounded-xl flex items-center gap-2 text-xs font-bold border transition-colors ${
                        autoplayBlocked || isRemoteMuted
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-white/15 text-white border-white/20 hover:bg-white/25'
                      }`}
                    >
                      {isRemoteMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
                      <span>
                        {autoplayBlocked || isRemoteMuted
                          ? isAr
                            ? 'تفعيل الصوت'
                            : 'Tap to Unmute'
                          : isAr
                          ? 'الصوت يعمل'
                          : 'Sound On'}
                      </span>
                    </button>

                    {currentStream.guestStatus === 'none' && (
                      <button
                        type="button"
                        onClick={handleToggleRequestToJoin}
                        className={`min-h-[44px] px-3.5 rounded-xl flex items-center gap-1.5 text-xs font-bold border transition-colors whitespace-nowrap ${
                          hasRequestedJoin
                            ? 'bg-purple-600 text-white border-purple-500'
                            : 'bg-white/15 hover:bg-white/25 text-white border-white/20'
                        }`}
                      >
                        <SplitSquareHorizontal size={16} />
                        <span>
                          {hasRequestedJoin
                            ? isAr
                              ? 'تم إرسال الطلب'
                              : 'Requested'
                            : isAr
                            ? 'طلب مشاركة'
                            : 'Join Live'}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={async () => {
                        if (!user) return;
                        const convId = await getOrCreateConversation(user.uid, currentStream.hostId);
                        if (convId) {
                          await handleLeaveWatching();
                          onOpenChat(convId);
                        }
                      }}
                      className="min-h-[44px] px-3.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs font-bold flex items-center gap-1.5"
                    >
                      <Send size={15} />
                      <span className="hidden sm:inline">{t('message')}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-white text-xs font-bold tabular-nums bg-black/45 px-3 py-2 rounded-xl border border-white/10">
                    <Heart size={14} className="text-rose-500 fill-rose-500" />
                    <span>{currentStream.likesCount || 0}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live Chat Panel */}
          <div className="lg:col-span-5 xl:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col h-[420px] lg:h-[calc(100vh-130px)] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle size={18} className="text-rose-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {isAr ? 'الدردشة المباشرة' : 'Live Chat'}
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-400 tabular-nums">
                {currentStream.likesCount || 0} {t('likes')}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {comments.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 px-4 gap-2">
                  <MessageCircle size={26} className="opacity-40" />
                  <p className="text-xs">
                    {isAr
                      ? 'مرحباً بكم في البث المباشر! اكتب أول تعليق للتفاعل.'
                      : 'Welcome to the live chat! Say hello below.'}
                  </p>
                </div>
              ) : (
                comments.map((comment) => {
                  const canDelete = isHost || comment.userId === user?.uid;
                  const isPinned = currentStream.pinnedMessage === comment.text;
                  return (
                    <div key={comment.id} className="flex items-start justify-between gap-2.5 group text-sm">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0 mt-0.5">
                          <UserAvatar
                            src={comment.userPhotoURL}
                            username={comment.username}
                            iconSize={13}
                          />
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-xs text-slate-700 dark:text-slate-300 me-1.5">
                            {comment.username}
                            {comment.userId === currentStream.hostId && (
                              <span className="ms-1 text-[10px] text-rose-500 font-bold">
                                ({isAr ? 'المضيف' : 'Host'})
                              </span>
                            )}
                            {comment.userId === currentStream.guestId && currentStream.guestStatus === 'active' && (
                              <span className="ms-1 text-[10px] text-purple-500 font-bold">
                                ({isAr ? 'ضيف' : 'Guest'})
                              </span>
                            )}
                          </span>
                          <span className="text-xs sm:text-sm text-slate-900 dark:text-slate-100 break-words">
                            {comment.text}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {isHost && (
                          <button
                            type="button"
                            onClick={() => handlePinComment(comment.text)}
                            aria-label={isAr ? 'تثبيت التعليق' : 'Pin comment'}
                            className={`p-1.5 rounded-lg ${
                              isPinned ? 'text-amber-500' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                          >
                            <Pin size={13} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(comment.id)}
                            aria-label={isAr ? 'حذف' : 'Delete'}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {currentStream.allowComments || isHost ? (
              <form
                onSubmit={handleSendComment}
                className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-slate-50 dark:bg-slate-900"
              >
                <input
                  type="text"
                  maxLength={300}
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder={isAr ? 'اكتب تعليقاً مباشراً...' : 'Send a live message...'}
                  className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={!commentInput.trim()}
                  aria-label={t('post')}
                  className="min-h-[40px] min-w-[40px] px-3.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center disabled:opacity-40"
                >
                  <Send size={16} />
                </button>
              </form>
            ) : (
              <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-900">
                {isAr ? 'قام المضيف بإيقاف التعليقات في هذا البث' : 'Host has disabled comments'}
              </div>
            )}
          </div>
        </div>

        {/* Host Invite Guest Modal */}
        {showInviteModal && isHost && (
          <div
            className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
            onClick={() => setShowInviteModal(false)}
          >
            <div
              className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[80vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SplitSquareHorizontal size={18} className="text-purple-500" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    {isAr ? 'دعوة ضيف للبث المشترك' : 'Invite Co-Host Guest'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                {/* Current Guest Status */}
                {currentStream.guestId && currentStream.guestStatus !== 'none' && (
                  <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0">
                        <UserAvatar
                          src={currentStream.guestPhotoURL}
                          username={currentStream.guestUsername}
                          iconSize={16}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          @{currentStream.guestUsername}
                        </div>
                        <div className="text-[11px] text-purple-600 dark:text-purple-400">
                          {currentStream.guestStatus === 'active'
                            ? isAr
                              ? 'في البث المشترك الآن'
                              : 'Live in split screen'
                            : isAr
                            ? 'بانتظار قبول الدعوة...'
                            : 'Waiting for response...'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveOrCancelGuest}
                      className="min-h-[36px] px-3 rounded-xl bg-rose-600 text-white text-xs font-bold shrink-0"
                    >
                      {currentStream.guestStatus === 'active'
                        ? isAr
                          ? 'إزالة'
                          : 'Remove'
                        : isAr
                        ? 'إلغاء'
                        : 'Cancel'}
                    </button>
                  </div>
                )}

                {/* Incoming Requests from Viewers */}
                {guestRequests.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {isAr ? 'طلبات الانضمام للبث' : 'Join Requests'}
                    </div>
                    {guestRequests.map((req) => (
                      <div
                        key={req.id}
                        className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0">
                            <UserAvatar
                              src={req.photoURL}
                              username={req.username}
                              iconSize={16}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            @{req.username}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleInviteGuest(req)}
                            className="min-h-[36px] px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold"
                          >
                            {isAr ? 'دعوة' : 'Invite'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDismissGuestRequest(req.userId)}
                            className="min-h-[36px] min-w-[36px] rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Active Viewers Ready to Invite */}
                {viewers.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {isAr ? 'المشاهدون في البث' : 'Current Viewers'}
                    </div>
                    {viewers.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0">
                            <UserAvatar
                              src={v.photoURL}
                              username={v.username}
                              iconSize={16}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            @{v.username}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleInviteGuest(v)}
                          disabled={currentStream.guestId === v.userId && currentStream.guestStatus !== 'none'}
                          className="min-h-[36px] px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold disabled:opacity-40"
                        >
                          {currentStream.guestId === v.userId && currentStream.guestStatus !== 'none'
                            ? isAr
                              ? 'مدعو'
                              : 'Invited'
                            : isAr
                            ? 'دعوة'
                            : 'Invite'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Search All Users */}
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {isAr ? 'البحث عن مستخدم لدعوته' : 'Search Users to Invite'}
                  </div>
                  <div className="relative">
                    <Search size={15} className="absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
                    <input
                      type="text"
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      placeholder={isAr ? 'ابحث باسم المستخدم...' : 'Search by username...'}
                      className="w-full ps-9 pe-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  {loadingUsers ? (
                    <div className="py-4 flex justify-center">
                      <Loader2 size={18} className="animate-spin text-slate-400" />
                    </div>
                  ) : filteredInviteUsers.length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-400">
                      {isAr ? 'لا توجد نتائج مطابقة' : 'No matching users'}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {filteredInviteUsers.map((u) => (
                        <div
                          key={u.uid}
                          className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 gap-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0">
                              <UserAvatar
                                src={u.photoURL}
                                username={u.username}
                                iconSize={14}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                @{u.username}
                              </div>
                              {u.fullName && (
                                <div className="text-[11px] text-slate-400 truncate">{u.fullName}</div>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleInviteGuest(u)}
                            disabled={currentStream.guestId === u.uid && currentStream.guestStatus !== 'none'}
                            className="min-h-[34px] px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold disabled:opacity-40"
                          >
                            {currentStream.guestId === u.uid && currentStream.guestStatus !== 'none'
                              ? isAr
                                ? 'مدعو'
                                : 'Invited'
                              : isAr
                              ? 'دعوة'
                              : 'Invite'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Viewers & Moderation Modal */}
        {showViewersModal && (
          <div
            className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
            onClick={() => setShowViewersModal(false)}
          >
            <div
              className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[70vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {isAr ? `المشاهدون (${viewers.length})` : `Active Viewers (${viewers.length})`}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowViewersModal(false)}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-2">
                {viewers.length === 0 ? (
                  <p className="py-10 text-center text-xs text-slate-400">
                    {isAr ? 'لا يوجد مشاهدون آخرون حالياً' : 'No viewers joined yet'}
                  </p>
                ) : (
                  viewers.map((v) => (
                    <div key={v.id} className="flex items-center justify-between p-2.5 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0">
                          <UserAvatar
                            src={v.photoURL}
                            username={v.username}
                            iconSize={16}
                          />
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          @{v.username}
                        </span>
                      </div>
                      {isHost && v.userId !== user?.uid && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setShowViewersModal(false);
                              handleInviteGuest(v);
                            }}
                            className="min-h-[36px] px-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 text-xs font-bold flex items-center gap-1 hover:bg-purple-100"
                          >
                            <SplitSquareHorizontal size={13} />
                            <span>{isAr ? 'دعوة' : 'Invite'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBlockViewer(v.userId)}
                            className="min-h-[36px] px-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1 hover:bg-rose-100"
                          >
                            <ShieldAlert size={14} />
                            <span>{isAr ? 'حظر' : 'Block'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===========================================================================
  // RENDER: LIVE HUB (ACTIVE, PENDING INVITES, & RECENT BROADCASTS)
  // ===========================================================================
  return (
    <div className="space-y-6 pb-10 animate-in fade-in">
      {/* Pending Co-Host Invites Banner */}
      {myPendingInvites.length > 0 && (
        <div className="space-y-2.5">
          {myPendingInvites.map((invite) => (
            <div
              key={invite.id}
              className="p-4 rounded-2xl bg-purple-600 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/80 shrink-0 bg-purple-800">
                  <UserAvatar
                    src={invite.hostPhotoURL}
                    username={invite.hostUsername}
                    iconSize={18}
                  />
                </div>
                <div>
                  <div className="text-sm font-bold">
                    {isAr
                      ? `دعاك @${invite.hostUsername} للمشاركة في البث المباشر`
                      : `@${invite.hostUsername} invited you to co-host live`}
                  </div>
                  <div className="text-xs text-purple-100 truncate">{invite.title}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleWatchStream(invite)}
                className="min-h-[42px] px-4 rounded-xl bg-white text-purple-700 font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 hover:bg-purple-50"
              >
                <SplitSquareHorizontal size={16} />
                <span>{isAr ? 'دخول البث وقبول الدعوة' : 'Open & Respond'}</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Top Banner / CTA */}
      <div className="bg-slate-900 dark:bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
            <Radio size={16} />
            <span>{isAr ? 'البث المباشر التفاعلي' : 'Interactive Live Streaming'}</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            {isAr ? 'شارك لحظاتك على الهواء مباشرة' : 'Go Live With Your Community'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            {isAr
              ? 'بث عالي الوضوح بالكاميرا أو مشاركة الشاشة، مع إمكانية دعوة ضيف للبث المشترك بشاشة مقسمة ودردشة فورية.'
              : 'Stream via camera or screen share, invite a co-host for split-screen live broadcasts, and engage with real-time chat.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleEnterSetup}
          className="min-h-[48px] px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0 shadow-lg shadow-rose-600/25 transition-all active:scale-[0.98]"
        >
          <Radio size={18} />
          <span>{t('goLive')}</span>
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
            selectedCategory === 'all'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {isAr ? 'الكل' : 'All'} ({activeStreams.length})
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
              selectedCategory === cat.id
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {isAr ? cat.ar : cat.en}
          </button>
        ))}
      </div>

      {/* Active Broadcasts Grid */}
      <section className="space-y-3">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span>{isAr ? 'البثوث النشطة الآن' : 'Live Now'}</span>
          <span className="text-xs font-semibold text-slate-400 tabular-nums">({filteredActiveStreams.length})</span>
        </h3>

        {loadingHub ? (
          <div className="py-16 flex justify-center">
            <Loader2 size={28} className="animate-spin text-slate-400" />
          </div>
        ) : filteredActiveStreams.length === 0 ? (
          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center space-y-3">
            <Radio size={34} className="mx-auto text-slate-300 dark:text-slate-700" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {isAr ? 'لا يوجد بث مباشر نشط في هذا التصنيف حالياً' : 'No active live streams right now'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAr ? 'كن أول من يفتح بثاً مباشراً ويشارك لحظاته!' : 'Be the first to start a live broadcast!'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleEnterSetup}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold inline-flex items-center gap-2"
            >
              <Radio size={15} />
              <span>{t('goLive')}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredActiveStreams.map((stream) => (
              <div
                key={stream.id}
                onClick={() => handleWatchStream(stream)}
                className="group cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:border-rose-500/60 transition-colors"
              >
                <div className="relative aspect-video bg-slate-900 overflow-hidden">
                  {stream.thumbnailURL ? (
                    <img
                      src={stream.thumbnailURL}
                      alt={stream.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950">
                      <Radio size={34} className="text-rose-500" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30" />
                  <div className="absolute top-3 start-3 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold shadow">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      <span>{isAr ? 'مباشر' : 'LIVE'}</span>
                    </span>
                    {stream.guestStatus === 'active' && stream.guestUsername && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-600 text-white text-[10px] font-bold shadow">
                        <SplitSquareHorizontal size={11} />
                        <span>{isAr ? 'مشترك' : 'Co-Host'}</span>
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-3 end-3 w-9 h-9 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                    <Play size={16} className="fill-slate-900 ms-0.5" />
                  </div>
                </div>

                <div className="p-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0">
                    <UserAvatar
                      src={stream.hostPhotoURL}
                      username={stream.hostUsername}
                      iconSize={16}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">{stream.title}</h4>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                      <span>@{stream.hostUsername}</span>
                      {stream.guestStatus === 'active' && stream.guestUsername && (
                        <span>&amp; @{stream.guestUsername}</span>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>{getCategoryLabel(stream.category)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent Ended Broadcasts */}
      {recentStreams.length > 0 && (
        <section className="space-y-3 pt-2">
          <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300">
            {isAr ? 'بثوث انتهت مؤخراً' : 'Recent Broadcasts'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentStreams.map((stream) => (
              <div
                key={stream.id}
                onClick={() => onOpenProfile(stream.hostId)}
                className="cursor-pointer p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0">
                  <UserAvatar
                    src={stream.hostPhotoURL}
                    username={stream.hostUsername}
                    iconSize={18}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{stream.title}</div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>@{stream.hostUsername}</span>
                    <span aria-hidden="true">·</span>
                    <span>{stream.peakViewers || 0} {isAr ? 'مشاهد' : 'viewers'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{stream.likesCount || 0} {t('likes')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
