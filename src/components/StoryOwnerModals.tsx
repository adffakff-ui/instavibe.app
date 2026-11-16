import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  History,
  Check,
  Search,
  Send,
  Sparkles,
  Share2,
  Copy,
  ExternalLink,
  TrendingUp,
  Briefcase,
  UserCheck,
  Settings as SettingsIcon,
  MessageSquareOff,
  MessageSquare,
  Download,
  Archive,
  Trash2,
  Plus,
  Loader2,
  Star,
  Globe,
  Bot,
  LayoutGrid,
} from 'lucide-react';
import { collection, getDocs, limit, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useFirestore } from '../hooks/useFirestore';
import UserAvatar from './UserAvatar';
import { StoryPartnership, StoryPromotion, StorySettings } from '../types/story';
import { getStorySettings, saveStorySettingsLocally } from '../utils/storySettings';

/* ============================================================================
   1. OWNER "MORE" BOTTOM SHEET ("المزيد" - matches Screenshot 1)
   ============================================================================ */
interface StoryOwnerMoreSheetProps {
  isOpen: boolean;
  isAr: boolean;
  isArchiveMode: boolean;
  mediaType?: 'image' | 'video';
  commentsEnabled: boolean;
  aiLabelEnabled: boolean;
  hasPartnership: boolean;
  archiving: boolean;
  onClose: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onSaveMedia: () => void;
  onOpenSend: () => void;
  onOpenHighlights: () => void;
  onOpenPartnership: () => void;
  onOpenAiLabel: () => void;
  onOpenShare: () => void;
  onOpenStorySettings: () => void;
  onToggleComments: () => void;
}

const ARCHIVE_HINT_DISMISSED_KEY = 'instavibe_story_archive_hint_dismissed';

export function StoryOwnerMoreSheet({
  isOpen,
  isAr,
  isArchiveMode,
  mediaType = 'image',
  commentsEnabled,
  aiLabelEnabled,
  hasPartnership,
  archiving,
  onClose,
  onDelete,
  onArchive,
  onSaveMedia,
  onOpenSend,
  onOpenHighlights,
  onOpenPartnership,
  onOpenAiLabel,
  onOpenShare,
  onOpenStorySettings,
  onToggleComments,
}: StoryOwnerMoreSheetProps) {
  const [hintDismissed, setHintDismissed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(ARCHIVE_HINT_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (!isOpen) return null;

  const dismissHint = () => {
    setHintDismissed(true);
    try {
      window.localStorage.setItem(ARCHIVE_HINT_DISMISSED_KEY, '1');
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/75 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-150"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-[440px] mx-auto bg-neutral-900 border-t border-white/10 rounded-t-3xl pb-5 pt-2.5 px-4 max-h-[88vh] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-200 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="w-10 h-1 rounded-full bg-white/30 mx-auto mb-3" />

        {/* Dismissable Active-Story Archive Notice Banner (from Screenshot 1) */}
        {!isArchiveMode && !hintDismissed && (
          <div className="flex items-center justify-between gap-3 py-3 border-b border-white/10 mb-1">
            <div className="flex items-center gap-3 min-w-0">
              <History size={20} className="text-white/90 shrink-0" />
              <p className="text-[13px] font-medium text-white leading-snug">
                {isAr
                  ? 'يمكنك أرشفة القصص وقت نشاطها.'
                  : 'You can archive stories while they are active.'}
              </p>
            </div>
            <button
              type="button"
              onClick={dismissHint}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              aria-label={isAr ? 'إغلاق التنبيه' : 'Dismiss'}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Menu Rows */}
        <div className="divide-y divide-white/5">
          {/* Delete */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onDelete();
            }}
            className="w-full min-h-[48px] px-2 py-3 flex items-center justify-between text-start text-[15px] font-semibold text-rose-500 hover:bg-white/5 rounded-xl transition-colors"
          >
            <span>{isAr ? 'حذف' : 'Delete'}</span>
            <Trash2 size={17} className="text-rose-500/80 shrink-0" />
          </button>

          {/* Archive (only while active) */}
          {!isArchiveMode && (
            <button
              type="button"
              disabled={archiving}
              onClick={() => {
                onClose();
                onArchive();
              }}
              className="w-full min-h-[48px] px-2 py-3 flex items-center justify-between text-start text-[15px] font-medium text-white hover:bg-white/5 rounded-xl transition-colors disabled:opacity-50"
            >
              <span>{isAr ? 'أرشفة' : 'Archive'}</span>
              {archiving ? (
                <Loader2 size={17} className="animate-spin text-white/60 shrink-0" />
              ) : (
                <Archive size={17} className="text-white/50 shrink-0" />
              )}
            </button>
          )}

          {/* Save Photo / Video */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSaveMedia();
            }}
            className="w-full min-h-[48px] px-2 py-3 flex items-center justify-between text-start text-[15px] font-medium text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <span>
              {mediaType === 'video'
                ? isAr
                  ? 'حفظ الفيديو'
                  : 'Save video'
                : isAr
                ? 'حفظ الصورة'
                : 'Save photo'}
            </span>
            <Download size={17} className="text-white/50 shrink-0" />
          </button>

          {/* Send */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSend();
            }}
            className="w-full min-h-[48px] px-2 py-3 flex items-center justify-between text-start text-[15px] font-medium text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <span>{isAr ? 'إرسال' : 'Send'}</span>
            <Send size={16} className="text-white/50 shrink-0" />
          </button>

          {/* Story Highlights */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenHighlights();
            }}
            className="w-full min-h-[48px] px-2 py-3 flex items-center justify-between text-start text-[15px] font-medium text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <span>{isAr ? 'أبرز القصص' : 'Highlights'}</span>
            <Sparkles size={16} className="text-white/50 shrink-0" />
          </button>

          {/* Partnership Label & Ads */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenPartnership();
            }}
            className="w-full min-h-[48px] px-2 py-3 flex items-center justify-between text-start text-[15px] font-medium text-white hover:bg-white/5 rounded-xl transition-colors gap-3"
          >
            <div className="min-w-0">
              <span className="block truncate">
                {isAr ? 'تسمية الشراكة وإعلانات الشراكة' : 'Partnership label & ads'}
              </span>
              {hasPartnership && (
                <span className="text-[11px] text-indigo-400 font-medium">
                  {isAr ? 'مفعّلة' : 'Active'}
                </span>
              )}
            </div>
            <Briefcase size={16} className="text-white/50 shrink-0" />
          </button>

          {/* Edit AI Label */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAiLabel();
            }}
            className="w-full min-h-[48px] px-2 py-3 flex items-center justify-between text-start text-[15px] font-medium text-white hover:bg-white/5 rounded-xl transition-colors gap-3"
          >
            <div className="min-w-0">
              <span className="block truncate">
                {isAr ? 'تعديل تسمية الذكاء الاصطناعي' : 'Edit AI label'}
              </span>
              {aiLabelEnabled && (
                <span className="text-[11px] text-sky-400 font-medium">
                  {isAr ? 'مُضاف للقصة' : 'Enabled'}
                </span>
              )}
            </div>
            <Bot size={17} className="text-white/50 shrink-0" />
          </button>

          {/* Share */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenShare();
            }}
            className="w-full min-h-[48px] px-2 py-3 flex items-center justify-between text-start text-[15px] font-medium text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <span>{isAr ? 'مشاركة' : 'Share'}</span>
            <Share2 size={16} className="text-white/50 shrink-0" />
          </button>

          {/* Go to Story Settings */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenStorySettings();
            }}
            className="w-full min-h-[48px] px-2 py-3 flex items-center justify-between text-start text-[15px] font-medium text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <span>{isAr ? 'انتقال إلى إعدادات القصص' : 'Story settings'}</span>
            <SettingsIcon size={16} className="text-white/50 shrink-0" />
          </button>

          {/* Turn Off / On Comments */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onToggleComments();
            }}
            className="w-full min-h-[48px] px-2 py-3 flex items-center justify-between text-start text-[15px] font-medium text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <span>
              {commentsEnabled
                ? isAr
                  ? 'إيقاف تشغيل التعليقات'
                  : 'Turn off comments'
                : isAr
                ? 'تشغيل التعليقات'
                : 'Turn on comments'}
            </span>
            {commentsEnabled ? (
              <MessageSquareOff size={17} className="text-white/50 shrink-0" />
            ) : (
              <MessageSquare size={17} className="text-emerald-400 shrink-0" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   2. SEND STORY VIA DIRECT MESSAGE DRAWER ("إرسال")
   ============================================================================ */
interface StorySendDrawerProps {
  isOpen: boolean;
  isAr: boolean;
  storyMediaURL: string;
  storyMediaType?: 'image' | 'video';
  storyCaption?: string;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export function StorySendDrawer({
  isOpen,
  isAr,
  storyMediaURL,
  storyMediaType = 'image',
  storyCaption,
  onClose,
  onToast,
}: StorySendDrawerProps) {
  const { user, profile, blockedUsers } = useAuth();
  const { getOrCreateConversation, sendMessage } = useFirestore();
  const [usersList, setUsersList] = useState<{ uid: string; username: string; fullName?: string; photoURL?: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingUid, setSendingUid] = useState<string | null>(null);
  const [sentUids, setSentUids] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    setSearchTerm('');
    setSentUids(new Set());
    let active = true;
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db, 'users'), limit(50)));
        if (!active) return;
        const list = snap.docs
          .map((d) => {
            const data = d.data() as any;
            return {
              uid: d.id,
              username: data.username || 'user',
              fullName: data.fullName || '',
              photoURL: data.photoURL || '',
            };
          })
          .filter((u) => u.uid !== user?.uid && !blockedUsers.includes(u.uid));
        setUsersList(list);
      } catch (err) {
        console.warn('Could not load recipients for story send:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchUsers();
    return () => {
      active = false;
    };
  }, [isOpen, user?.uid, blockedUsers]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return usersList;
    return usersList.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.fullName && u.fullName.toLowerCase().includes(q))
    );
  }, [usersList, searchTerm]);

  if (!isOpen) return null;

  const handleSendToUser = async (target: { uid: string; username: string }) => {
    if (!user || sendingUid) return;
    setSendingUid(target.uid);
    try {
      const convId = await getOrCreateConversation(user.uid, target.uid);
      if (convId) {
        const noteText = storyCaption?.trim()
          ? isAr
            ? `شارك قصة: "${storyCaption.trim()}"`
            : `Shared a story: "${storyCaption.trim()}"`
          : isAr
          ? 'شارك معك قصة'
          : 'Shared a story with you';
        await sendMessage(
          convId,
          user.uid,
          noteText,
          target.uid,
          profile || { uid: user.uid, username: 'user', photoURL: '' },
          storyMediaURL,
          storyMediaType
        );
        setSentUids((prev) => new Set(prev).add(target.uid));
        onToast(
          isAr ? `تم إرسال القصة إلى @${target.username}` : `Sent story to @${target.username}`
        );
      }
    } catch (err) {
      console.error('Failed to send story in DM:', err);
    } finally {
      setSendingUid(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-[440px] mx-auto bg-neutral-900 border-t border-white/15 rounded-t-3xl max-h-[82vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/30 mx-auto mt-2.5" />
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-bold text-white">
            {isAr ? 'إرسال القصة إلى...' : 'Send story to...'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] rounded-full hover:bg-white/10 flex items-center justify-center text-white/70"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 pb-2">
          <div className="relative">
            <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isAr ? 'ابحث عن صديق للإرسال...' : 'Search people...'}
              className="w-full bg-white/10 text-white placeholder-white/40 ps-9 pe-4 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-5 space-y-1.5">
          {loading ? (
            <div className="py-10 text-center text-xs text-white/50">
              {isAr ? 'جاري تحميل الحسابات...' : 'Loading people...'}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-white/50">
              {isAr ? 'لا توجد حسابات مطابقة' : 'No matching accounts'}
            </div>
          ) : (
            filtered.map((item) => {
              const isSent = sentUids.has(item.uid);
              const isSending = sendingUid === item.uid;
              return (
                <div
                  key={item.uid}
                  className="flex items-center justify-between p-2 rounded-2xl hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-white/15 shrink-0">
                      <UserAvatar src={item.photoURL} username={item.username} iconSize={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">@{item.username}</p>
                      {item.fullName && (
                        <p className="text-[11px] text-white/50 truncate">{item.fullName}</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isSent || isSending}
                    onClick={() => handleSendToUser(item)}
                    className={`min-h-[38px] px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      isSent
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-purple-600 hover:bg-purple-500 text-white active:scale-95'
                    }`}
                  >
                    {isSending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : isSent ? (
                      <>
                        <Check size={14} />
                        <span>{isAr ? 'تم الإرسال' : 'Sent'}</span>
                      </>
                    ) : (
                      <>
                        <Send size={13} />
                        <span>{isAr ? 'إرسال' : 'Send'}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   3. STORY HIGHLIGHTS PICKER MODAL ("أبرز القصص")
   ============================================================================ */
interface StoryHighlightsPickerModalProps {
  isOpen: boolean;
  isAr: boolean;
  storyId: string;
  storyMediaURL: string;
  storyMediaType?: 'image' | 'video';
  onClose: () => void;
  onToast: (msg: string) => void;
}

export function StoryHighlightsPickerModal({
  isOpen,
  isAr,
  storyId,
  storyMediaURL,
  storyMediaType = 'image',
  onClose,
  onToast,
}: StoryHighlightsPickerModalProps) {
  const { user, profile } = useAuth();
  const { createHighlightAlbum, addStoryToHighlightAlbum, removeStoryFromHighlightAlbum } =
    useFirestore();
  const [albums, setAlbums] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [busyAlbumId, setBusyAlbumId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isOpen || !user?.uid) return;
    const unsub = onSnapshot(
      collection(db, 'users', user.uid, 'highlights'),
      (snap) => {
        setAlbums(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => console.warn('Highlight albums listener notice:', err)
    );
    return unsub;
  }, [isOpen, user?.uid]);

  if (!isOpen || !user) return null;

  const handleToggleAlbum = async (album: any) => {
    const storyIds: string[] = Array.isArray(album.storyIds) ? album.storyIds : [];
    const exists = storyIds.includes(storyId);
    setBusyAlbumId(album.id);
    try {
      if (exists) {
        await removeStoryFromHighlightAlbum(user.uid, album.id, storyId);
        onToast(
          isAr ? `تمت الإزالة من "${album.title}"` : `Removed from "${album.title}"`
        );
      } else {
        await addStoryToHighlightAlbum(user.uid, album.id, storyId);
        onToast(
          isAr ? `تمت الإضافة إلى "${album.title}"` : `Added to "${album.title}"`
        );
      }
    } catch (err) {
      console.error('Failed to update highlight album:', err);
    } finally {
      setBusyAlbumId(null);
    }
  };

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title || creating) return;
    setCreating(true);
    try {
      const coverURL =
        storyMediaType !== 'video' ? storyMediaURL : profile?.photoURL || '';
      await createHighlightAlbum(user.uid, title.slice(0, 50), coverURL, [storyId]);
      setNewTitle('');
      onToast(
        isAr ? `تم إنشاء ألبوم "${title}" وإضافة القصة` : `Created Highlight "${title}"`
      );
    } catch (err) {
      console.error('Failed to create highlight album:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-[440px] mx-auto bg-neutral-900 border-t border-white/15 rounded-t-3xl p-4 space-y-4 max-h-[82vh] flex flex-col animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/30 mx-auto -mt-1" />
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={17} className="text-amber-400" />
            <h3 className="text-sm font-bold text-white">
              {isAr ? 'إضافة إلى أبرز القصص' : 'Add to Story Highlights'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] rounded-full hover:bg-white/10 flex items-center justify-center text-white/70"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Create New Highlight Album */}
        <form onSubmit={handleCreateAlbum} className="flex items-center gap-2">
          <input
            type="text"
            value={newTitle}
            maxLength={50}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={isAr ? 'اسم ألبوم أبرز قصص جديد...' : 'New highlight name...'}
            className="flex-1 bg-white/10 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <button
            type="submit"
            disabled={!newTitle.trim() || creating}
            className="min-h-[42px] px-4 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />}
            <span>{isAr ? 'إنشاء' : 'Create'}</span>
          </button>
        </form>

        {/* Existing Highlight Albums */}
        <div className="flex-1 overflow-y-auto space-y-2 pb-2">
          {albums.length === 0 ? (
            <div className="py-8 text-center text-xs text-white/50">
              {isAr
                ? 'لا توجد ألبومات أبرز قصص بعد — أنشئ أول ألبوم بالأعلى!'
                : 'No highlight albums yet — create your first highlight above.'}
            </div>
          ) : (
            albums.map((album) => {
              const storyIds: string[] = Array.isArray(album.storyIds) ? album.storyIds : [];
              const included = storyIds.includes(storyId);
              const busy = busyAlbumId === album.id;
              return (
                <button
                  key={album.id}
                  type="button"
                  disabled={busy}
                  onClick={() => handleToggleAlbum(album)}
                  className="w-full p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-between transition-colors text-start"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-full overflow-hidden border border-white/20 bg-slate-800 shrink-0">
                      {album.coverImageURL ? (
                        <img
                          src={album.coverImageURL}
                          alt={album.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/50">
                          <Sparkles size={16} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{album.title}</p>
                      <p className="text-[11px] text-white/50 tabular-nums">
                        {storyIds.length} {isAr ? 'قصص' : 'stories'}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center border transition-colors ${
                      included
                        ? 'bg-purple-600 border-purple-400 text-white'
                        : 'border-white/30 text-transparent'
                    }`}
                  >
                    {busy ? <Loader2 size={13} className="animate-spin text-white" /> : <Check size={14} strokeWidth={3} />}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   4. PARTNERSHIP LABEL & ADS SHEET ("تسمية الشراكة وإعلانات الشراكة")
   ============================================================================ */
interface StoryPartnershipSheetProps {
  isOpen: boolean;
  isAr: boolean;
  partnership?: StoryPartnership | null;
  onSave: (next: StoryPartnership | null, isNewPartner: boolean) => Promise<void>;
  onClose: () => void;
}

export function StoryPartnershipSheet({
  isOpen,
  isAr,
  partnership,
  onSave,
  onClose,
}: StoryPartnershipSheetProps) {
  const { user, blockedUsers } = useAuth();
  const [isPaid, setIsPaid] = useState(Boolean(partnership?.isPaid));
  const [allowAds, setAllowAds] = useState(Boolean(partnership?.allowAds));
  const [partnerId, setPartnerId] = useState<string | undefined>(partnership?.partnerId);
  const [partnerUsername, setPartnerUsername] = useState<string | undefined>(partnership?.partnerUsername);
  const [searchTerm, setSearchTerm] = useState('');
  const [usersList, setUsersList] = useState<{ uid: string; username: string; fullName?: string; photoURL?: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsPaid(Boolean(partnership?.isPaid));
    setAllowAds(Boolean(partnership?.allowAds));
    setPartnerId(partnership?.partnerId);
    setPartnerUsername(partnership?.partnerUsername);
    setSearchTerm('');

    let active = true;
    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        const snap = await getDocs(query(collection(db, 'users'), limit(40)));
        if (!active) return;
        setUsersList(
          snap.docs
            .map((d) => {
              const data = d.data() as any;
              return {
                uid: d.id,
                username: data.username || 'user',
                fullName: data.fullName || '',
                photoURL: data.photoURL || '',
              };
            })
            .filter((u) => u.uid !== user?.uid && !blockedUsers.includes(u.uid))
        );
      } catch (err) {
        console.warn('Could not load partner candidates:', err);
      } finally {
        if (active) setLoadingUsers(false);
      }
    };
    loadUsers();
    return () => {
      active = false;
    };
  }, [isOpen, partnership, user?.uid, blockedUsers]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return usersList;
    return usersList.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.fullName && u.fullName.toLowerCase().includes(q))
    );
  }, [usersList, searchTerm]);

  if (!isOpen) return null;

  const handleApply = async () => {
    setSaving(true);
    try {
      const next: StoryPartnership | null =
        isPaid || allowAds || partnerUsername
          ? {
              isPaid,
              allowAds,
              ...(partnerId ? { partnerId } : {}),
              ...(partnerUsername ? { partnerUsername } : {}),
            }
          : null;
      const isNewPartner = Boolean(partnerId && partnerId !== partnership?.partnerId);
      await onSave(next, isNewPartner);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-[440px] mx-auto bg-neutral-900 border-t border-white/15 rounded-t-3xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] space-y-3 max-h-[85dvh] flex flex-col animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/30 mx-auto -mt-1" />
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Briefcase size={17} className="text-indigo-400" />
            <h3 className="text-sm font-bold text-white">
              {isAr ? 'تسمية الشراكة وإعلانات الشراكة' : 'Partnership label & ads'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] rounded-full hover:bg-white/10 flex items-center justify-center text-white/70"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Paid Partnership Toggle */}
        <div className="flex items-center justify-between gap-3 py-2 border-b border-white/10">
          <div>
            <p className="text-xs font-bold text-white">
              {isAr ? 'إضافة تسمية "شراكة مدفوعة"' : 'Add Paid Partnership label'}
            </p>
            <p className="text-[11px] text-white/55">
              {isAr
                ? 'توضيح وجود تعاون تجاري أو رعاية مدفوعة'
                : 'Disclose branded content or paid sponsorship'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsPaid((v) => !v)}
            className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
              isPaid ? 'bg-indigo-500' : 'bg-white/20'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                isPaid ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Partnership Ads Toggle */}
        <div className="flex items-center justify-between gap-3 py-2 border-b border-white/10">
          <div>
            <p className="text-xs font-bold text-white">
              {isAr ? 'السماح بإعلانات الشراكة' : 'Allow partnership ads'}
            </p>
            <p className="text-[11px] text-white/55">
              {isAr
                ? 'تمكين الشريك التجاري من ترويج هذه القصة كإعلان'
                : 'Let your tagged brand partner boost this story as an ad'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAllowAds((v) => !v)}
            className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
              allowAds ? 'bg-indigo-500' : 'bg-white/20'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                allowAds ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Selected Partner */}
        {partnerUsername && (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-indigo-500/15 border border-indigo-400/30 text-xs text-indigo-200">
            <span>
              {isAr ? `الشريك المحدد: @${partnerUsername}` : `Partner: @${partnerUsername}`}
            </span>
            <button
              type="button"
              onClick={() => {
                setPartnerId(undefined);
                setPartnerUsername(undefined);
              }}
              className="text-rose-300 hover:text-rose-200 font-bold"
            >
              {isAr ? 'إزالة' : 'Remove'}
            </button>
          </div>
        )}

        {/* Partner Search */}
        <div className="relative">
          <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isAr ? 'ابحث لاختيار شريك العلامة التجارية...' : 'Search partner username...'}
            className="w-full bg-white/10 text-white placeholder-white/40 ps-9 pe-4 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 min-h-[120px] max-h-[200px]">
          {loadingUsers ? (
            <div className="py-6 text-center text-xs text-white/50">
              {isAr ? 'جاري التحميل...' : 'Loading...'}
            </div>
          ) : (
            filtered.map((item) => {
              const selected = partnerId === item.uid;
              return (
                <button
                  key={item.uid}
                  type="button"
                  onClick={() => {
                    setPartnerId(item.uid);
                    setPartnerUsername(item.username);
                    setIsPaid(true);
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/10 text-start transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full overflow-hidden border border-white/15 shrink-0">
                      <UserAvatar src={item.photoURL} username={item.username} iconSize={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">@{item.username}</p>
                      {item.fullName && (
                        <p className="text-[11px] text-white/50 truncate">{item.fullName}</p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-xl text-[11px] font-bold ${
                      selected ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/80'
                    }`}
                  >
                    {selected ? (isAr ? 'محدد' : 'Selected') : isAr ? 'اختيار' : 'Select'}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={handleApply}
          className="w-full min-h-[46px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          <span>{isAr ? 'حفظ إعدادات الشراكة' : 'Save Partnership Settings'}</span>
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
   5. AI LABEL SHEET ("تعديل تسمية الذكاء الاصطناعي")
   ============================================================================ */
interface StoryAiLabelSheetProps {
  isOpen: boolean;
  isAr: boolean;
  enabled: boolean;
  onToggle: (next: boolean) => Promise<void>;
  onClose: () => void;
}

export function StoryAiLabelSheet({
  isOpen,
  isAr,
  enabled,
  onToggle,
  onClose,
}: StoryAiLabelSheetProps) {
  const [localEnabled, setLocalEnabled] = useState(enabled);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setLocalEnabled(enabled);
  }, [isOpen, enabled]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onToggle(localEnabled);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-[440px] mx-auto bg-neutral-900 border-t border-white/15 rounded-t-3xl p-4 space-y-4 animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/30 mx-auto -mt-1" />
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-sky-400" />
            <h3 className="text-sm font-bold text-white">
              {isAr ? 'تعديل تسمية الذكاء الاصطناعي' : 'Edit AI label'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] rounded-full hover:bg-white/10 flex items-center justify-center text-white/70"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 py-2">
          <div>
            <p className="text-sm font-bold text-white">
              {isAr ? 'إضافة تسمية الذكاء الاصطناعي' : 'Add AI info label'}
            </p>
            <p className="text-xs text-white/60 leading-relaxed mt-1">
              {isAr
                ? 'أخبر المشاهدين إذا كانت هذه القصة مُنشأة أو معدّلة بشكل جوهري باستخدام أدوات الذكاء الاصطناعي.'
                : 'Let viewers know when a story was created or substantially edited with generative AI tools.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLocalEnabled((v) => !v)}
            className={`w-12 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
              localEnabled ? 'bg-sky-500' : 'bg-white/20'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                localEnabled ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="w-full min-h-[46px] rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          <span>{isAr ? 'حفظ التغييرات' : 'Save'}</span>
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
   6. SHARE STORY SHEET ("مشاركة" / "مشاركة على واتساب وفيسبوك")
   ============================================================================ */
interface StoryShareSheetProps {
  isOpen: boolean;
  isAr: boolean;
  storyId: string;
  storyMediaURL: string;
  storyMediaType?: 'image' | 'video';
  storyCaption?: string;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export function StoryShareSheet({
  isOpen,
  isAr,
  storyId,
  storyMediaURL,
  storyMediaType = 'image',
  storyCaption,
  onClose,
  onToast,
}: StoryShareSheetProps) {
  const { profile } = useAuth();
  const { createPost } = useFirestore();
  const [sharingPost, setSharingPost] = useState(false);

  if (!isOpen) return null;

  const shareUrl = `${window.location.origin}/?story=${encodeURIComponent(storyId)}`;
  const shareText = storyCaption?.trim()
    ? `${storyCaption.trim()} — InstaVibe`
    : isAr
    ? 'شاهد هذه القصة على InstaVibe'
    : 'Check out this story on InstaVibe';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      onToast(isAr ? 'تم نسخ رابط القصة' : 'Story link copied');
      onClose();
    } catch {
      onToast(shareUrl);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'InstaVibe Story',
          text: shareText,
          url: shareUrl,
        });
        onClose();
        return;
      } catch {
        // Fallback to copy
      }
    }
    await handleCopyLink();
  };

  const handleWhatsAppShare = () => {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
    const link = document.createElement('a');
    link.href = waUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
    onToast(isAr ? 'جاري فتح واتساب للمشاركة...' : 'Opening WhatsApp...');
    onClose();
  };

  const handleFacebookShare = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    const link = document.createElement('a');
    link.href = fbUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
    onToast(isAr ? 'جاري فتح فيسبوك للمشاركة...' : 'Opening Facebook...');
    onClose();
  };

  const handleShareAsPost = async () => {
    if (!profile || sharingPost) return;
    setSharingPost(true);
    try {
      await createPost(profile, storyMediaURL, storyMediaType, storyCaption || '');
      onToast(isAr ? 'تمت مشاركة القصة كمنشور في صفحتك!' : 'Shared story as a Feed post!');
      onClose();
    } catch (err) {
      console.error('Failed to share story as post:', err);
    } finally {
      setSharingPost(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-[440px] mx-auto bg-neutral-900 border-t border-white/15 rounded-t-3xl p-4 space-y-2 animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/30 mx-auto -mt-1 mb-1" />
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Share2 size={17} className="text-purple-400" />
            <h3 className="text-sm font-bold text-white">
              {isAr ? 'مشاركة القصة' : 'Share story'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] rounded-full hover:bg-white/10 flex items-center justify-center text-white/70"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="divide-y divide-white/5">
          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="w-full min-h-[48px] px-2 py-3 flex items-center justify-between text-start text-sm font-semibold text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <span>{isAr ? 'مشاركة على واتساب (WhatsApp)' : 'Share on WhatsApp'}</span>
            <ExternalLink size={16} className="text-emerald-400 shrink-0" />
          </button>

          <button
            type="button"
            onClick={handleFacebookShare}
            className="w-full min-h-[48px] px-2 py-3 flex items-center justify-between text-start text-sm font-semibold text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <span>{isAr ? 'مشاركة على فيسبوك (Facebook)' : 'Share on Facebook'}</span>
            <Globe size={16} className="text-blue-400 shrink-0" />
          </button>

          <button
            type="button"
            disabled={sharingPost}
            onClick={handleShareAsPost}
            className="w-full min-h-[48px] px-2 py-3 flex items-center justify-between text-start text-sm font-semibold text-white hover:bg-white/5 rounded-xl transition-colors disabled:opacity-50"
          >
            <span>{isAr ? 'نشر كمنشور في ملفك الشخصي' : 'Share as a Feed Post'}</span>
            {sharingPost ? (
              <Loader2 size={16} className="animate-spin text-purple-400 shrink-0" />
            ) : (
              <LayoutGrid size={16} className="text-purple-400 shrink-0" />
            )}
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full min-h-[48px] px-2 py-3 flex items-center justify-between text-start text-sm font-semibold text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <span>{isAr ? 'نسخ الرابط' : 'Copy link'}</span>
            <Copy size={16} className="text-white/60 shrink-0" />
          </button>

          <button
            type="button"
            onClick={handleNativeShare}
            className="w-full min-h-[48px] px-2 py-3 flex items-center justify-between text-start text-sm font-semibold text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <span>{isAr ? 'مشاركة عبر التطبيقات...' : 'Share via...'}</span>
            <Share2 size={16} className="text-white/60 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   7. PROMOTE STORY SHEET ("ترويج")
   ============================================================================ */
interface StoryPromoteSheetProps {
  isOpen: boolean;
  isAr: boolean;
  promoted?: StoryPromotion | null;
  onSavePromotion: (next: StoryPromotion | null) => Promise<void>;
  onClose: () => void;
}

export function StoryPromoteSheet({
  isOpen,
  isAr,
  promoted,
  onSavePromotion,
  onClose,
}: StoryPromoteSheetProps) {
  const [goal, setGoal] = useState<'profile_visits' | 'messages' | 'engagement'>(
    promoted?.goal || 'profile_visits'
  );
  const [dailyBudget, setDailyBudget] = useState<number>(promoted?.dailyBudget || 10);
  const [durationDays, setDurationDays] = useState<number>(promoted?.durationDays || 5);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setGoal(promoted?.goal || 'profile_visits');
      setDailyBudget(promoted?.dailyBudget || 10);
      setDurationDays(promoted?.durationDays || 5);
    }
  }, [isOpen, promoted]);

  if (!isOpen) return null;

  const minReach = Math.round(dailyBudget * durationDays * 140);
  const maxReach = Math.round(dailyBudget * durationDays * 320);

  const handleActivate = async () => {
    setSaving(true);
    try {
      await onSavePromotion({
        isPromoted: true,
        goal,
        dailyBudget,
        durationDays,
        promotedAt: new Date().toISOString(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleStopPromotion = async () => {
    setSaving(true);
    try {
      await onSavePromotion(null);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-[440px] mx-auto bg-neutral-900 border-t border-white/15 rounded-t-3xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] space-y-4 max-h-[85dvh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/30 mx-auto -mt-1" />
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-purple-400" />
            <h3 className="text-sm font-bold text-white">
              {isAr ? 'ترويج القصة' : 'Boost & Promote Story'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] rounded-full hover:bg-white/10 flex items-center justify-center text-white/70"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Goal selection */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-white/70">
            {isAr ? 'اختر هدف الترويج' : 'Select Goal'}
          </p>
          <div className="grid grid-cols-1 gap-2">
            {[
              {
                id: 'profile_visits' as const,
                ar: 'المزيد من زيارات الملف الشخصي',
                en: 'More profile visits',
              },
              {
                id: 'messages' as const,
                ar: 'المزيد من الرسائل المباشرة',
                en: 'More direct messages',
              },
              {
                id: 'engagement' as const,
                ar: 'المزيد من التفاعلات والمشاهدات',
                en: 'More story views & reactions',
              },
            ].map((item) => {
              const active = goal === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setGoal(item.id)}
                  className={`min-h-[44px] px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-colors ${
                    active
                      ? 'bg-purple-600/20 border-purple-500 text-white'
                      : 'bg-white/5 border-white/10 text-white/75 hover:bg-white/10'
                  }`}
                >
                  <span>{isAr ? item.ar : item.en}</span>
                  {active && <Check size={15} className="text-purple-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Daily Budget & Duration */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/70 block">
              {isAr ? 'الميزانية اليومية' : 'Daily Budget'}
            </label>
            <div className="flex gap-1.5">
              {[5, 10, 25].map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setDailyBudget(b)}
                  className={`flex-1 min-h-[38px] rounded-xl text-xs font-bold tabular-nums border ${
                    dailyBudget === b
                      ? 'bg-purple-600 border-purple-400 text-white'
                      : 'bg-white/5 border-white/10 text-white/75'
                  }`}
                >
                  ${b}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/70 block">
              {isAr ? 'المدة (أيام)' : 'Duration (days)'}
            </label>
            <div className="flex gap-1.5">
              {[3, 5, 7].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDurationDays(d)}
                  className={`flex-1 min-h-[38px] rounded-xl text-xs font-bold tabular-nums border ${
                    durationDays === d
                      ? 'bg-purple-600 border-purple-400 text-white'
                      : 'bg-white/5 border-white/10 text-white/75'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Estimated Reach */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-white/60">
              {isAr ? 'الوصول التقديري' : 'Estimated Reach'}
            </p>
            <p className="text-sm font-extrabold text-white tabular-nums mt-0.5">
              {minReach.toLocaleString()} – {maxReach.toLocaleString()}{' '}
              <span className="text-xs font-medium text-white/60">
                {isAr ? 'مشاهدة' : 'accounts'}
              </span>
            </p>
          </div>
          <div className="text-end">
            <p className="text-[11px] text-white/60">{isAr ? 'الإجمالي' : 'Total'}</p>
            <p className="text-sm font-extrabold text-purple-300 tabular-nums mt-0.5">
              ${dailyBudget * durationDays}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          {promoted?.isPromoted && (
            <button
              type="button"
              disabled={saving}
              onClick={handleStopPromotion}
              className="min-h-[46px] px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold"
            >
              {isAr ? 'إيقاف الترويج' : 'Pause Boost'}
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={handleActivate}
            className="flex-1 min-h-[46px] rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <TrendingUp size={16} />}
            <span>
              {promoted?.isPromoted
                ? isAr
                  ? 'تحديث الترويج'
                  : 'Update Boost'
                : isAr
                ? 'ترويج القصة الآن'
                : 'Boost Story Now'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   8. STORY SETTINGS MODAL ("انتقال إلى إعدادات القصص")
   ============================================================================ */
interface StorySettingsModalProps {
  isOpen: boolean;
  isAr: boolean;
  onOpenCloseFriends?: () => void;
  onClose: () => void;
  onToast?: (msg: string) => void;
}

export function StorySettingsModal({
  isOpen,
  isAr,
  onOpenCloseFriends,
  onClose,
  onToast,
}: StorySettingsModalProps) {
  const { user, profile } = useAuth();
  const { saveUserStorySettings } = useFirestore();
  const [settings, setSettings] = useState<StorySettings>(() =>
    getStorySettings(user?.uid, profile?.storySettings)
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSettings(getStorySettings(user?.uid, profile?.storySettings));
    }
  }, [isOpen, user?.uid, profile?.storySettings]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      saveStorySettingsLocally(user?.uid, settings);
      if (user?.uid) {
        await saveUserStorySettings(user.uid, settings);
      }
      window.dispatchEvent(new CustomEvent('instavibe:story-settings-updated', { detail: settings }));
      onToast?.(isAr ? 'تم حفظ إعدادات القصص' : 'Story settings saved');
      onClose();
    } catch (err) {
      console.error('Failed to save story settings:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-[440px] mx-auto bg-neutral-900 border-t border-white/15 rounded-t-3xl p-4 space-y-4 max-h-[86vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/30 mx-auto -mt-1" />
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <SettingsIcon size={17} className="text-purple-400" />
            <h3 className="text-sm font-bold text-white">
              {isAr ? 'إعدادات القصص' : 'Story settings'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] rounded-full hover:bg-white/10 flex items-center justify-center text-white/70"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Default Audience */}
        <div className="space-y-2 border-b border-white/10 pb-3">
          <p className="text-xs font-bold text-white">
            {isAr ? 'الجمهور الافتراضي للقصص الجديدة' : 'Default story audience'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSettings((s) => ({ ...s, defaultAudience: 'everyone' }))}
              className={`min-h-[42px] px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                settings.defaultAudience === 'everyone'
                  ? 'bg-purple-600/25 border-purple-500 text-white'
                  : 'bg-white/5 border-white/10 text-white/70'
              }`}
            >
              <Globe size={14} />
              <span>{isAr ? 'الجميع' : 'Everyone'}</span>
            </button>
            <button
              type="button"
              onClick={() => setSettings((s) => ({ ...s, defaultAudience: 'close_friends' }))}
              className={`min-h-[42px] px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                settings.defaultAudience === 'close_friends'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                  : 'bg-white/5 border-white/10 text-white/70'
              }`}
            >
              <Star size={14} fill="currentColor" />
              <span>{isAr ? 'الأصدقاء المقربون' : 'Close Friends'}</span>
            </button>
          </div>
          {onOpenCloseFriends && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCloseFriends();
              }}
              className="text-xs font-semibold text-emerald-400 hover:underline flex items-center gap-1 pt-1"
            >
              <UserCheck size={13} />
              <span>{isAr ? 'إدارة قائمة الأصدقاء المقربين' : 'Edit Close Friends list'}</span>
            </button>
          )}
        </div>

        {/* Reply / Comment Permissions */}
        <div className="space-y-2 border-b border-white/10 pb-3">
          <p className="text-xs font-bold text-white">
            {isAr ? 'السماح بالردود والتعليقات على القصص' : 'Allow message replies & comments'}
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'everyone' as const, ar: 'الجميع', en: 'Everyone' },
              { id: 'followers' as const, ar: 'المتابعون فقط', en: 'Followers' },
              { id: 'off' as const, ar: 'إيقاف', en: 'Off' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSettings((s) => ({ ...s, repliesPermission: opt.id }))}
                className={`min-h-[40px] px-2 rounded-xl border text-xs font-semibold transition-colors ${
                  settings.repliesPermission === opt.id
                    ? 'bg-purple-600/25 border-purple-500 text-white'
                    : 'bg-white/5 border-white/10 text-white/70'
                }`}
              >
                {isAr ? opt.ar : opt.en}
              </button>
            ))}
          </div>
        </div>

        {/* Toggle rows */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-white">
                {isAr ? 'حفظ القصة في الأرشيف تلقائياً' : 'Save story to Archive automatically'}
              </p>
              <p className="text-[11px] text-white/50">
                {isAr
                  ? 'حفظ القصص المنتهية في أرشيفك الخاص تلقائياً'
                  : 'Automatically move expired stories to your private archive'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSettings((s) => ({ ...s, autoSaveArchive: !s.autoSaveArchive }))}
              className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
                settings.autoSaveArchive ? 'bg-purple-600' : 'bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.autoSaveArchive ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-white">
                {isAr ? 'السماح بإعادة المشاركة في الرسائل' : 'Allow sharing to messages'}
              </p>
              <p className="text-[11px] text-white/50">
                {isAr
                  ? 'السماح للمتابعين بإرسال قصتك في الرسائل الخاصة'
                  : 'Let others forward your story in direct messages'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSettings((s) => ({ ...s, allowStorySharing: !s.allowStorySharing }))}
              className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
                settings.allowStorySharing ? 'bg-purple-600' : 'bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.allowStorySharing ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-white">
                {isAr ? 'السماح بالمشاركة الخارجية (واتساب وفيسبوك)' : 'Allow sharing to WhatsApp & Facebook'}
              </p>
              <p className="text-[11px] text-white/50">
                {isAr
                  ? 'تفعيل المشاركة السريعة عبر التطبيقات الخارجية'
                  : 'Enable quick sharing outside InstaVibe'}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setSettings((s) => ({ ...s, allowExternalSharing: !s.allowExternalSharing }))
              }
              className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
                settings.allowExternalSharing ? 'bg-purple-600' : 'bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.allowExternalSharing ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="w-full min-h-[46px] rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          <span>{isAr ? 'حفظ الإعدادات' : 'Save Story Settings'}</span>
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
   9. OWNER CAPTION EDIT SHEET ("اكتب شيئًا...")
   ============================================================================ */
interface StoryCaptionEditSheetProps {
  isOpen: boolean;
  isAr: boolean;
  initialCaption: string;
  onSave: (nextCaption: string) => Promise<void>;
  onClose: () => void;
}

export function StoryCaptionEditSheet({
  isOpen,
  isAr,
  initialCaption,
  onSave,
  onClose,
}: StoryCaptionEditSheetProps) {
  const [caption, setCaption] = useState(initialCaption);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setCaption(initialCaption);
  }, [isOpen, initialCaption]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(caption);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[440px] mx-auto bg-neutral-900 border-t border-white/15 rounded-t-3xl p-4 space-y-3 animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/30 mx-auto -mt-1" />
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">
            {isAr ? 'إضافة شرح أو نص للقصة' : 'Add story caption'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] rounded-full hover:bg-white/10 flex items-center justify-center text-white/70"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <textarea
          autoFocus
          rows={3}
          maxLength={1000}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={isAr ? 'اكتب شيئًا...' : 'Write something...'}
          className="w-full bg-white/10 border border-white/15 rounded-2xl p-3 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
        />

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-4 rounded-xl bg-white/10 text-white text-xs font-bold"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[42px] px-5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            <span>{isAr ? 'حفظ' : 'Save'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
