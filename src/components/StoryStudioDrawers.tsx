import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Check,
  Search,
  MapPin,
  Clock,
  Smile,
  BarChart2,
  Sparkles,
  AtSign,
  Users,
  MessageCircle,
  LayoutGrid,
  Star,
  RotateCcw,
  Sliders,
  Trash2,
  UserCheck,
  Briefcase,
} from 'lucide-react';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import UserAvatar from './UserAvatar';
import {
  CloseFriendUser,
  StoryPartnership,
  StorySticker,
  StoryTextBgStyle,
  StoryTextFontStyle,
  StoryTextOverlay,
} from '../types/story';
import { STORY_FILTER_PRESETS } from '../utils/storyEffects';

const TEXT_COLORS = [
  '#ffffff',
  '#0f172a',
  '#f43f5e',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#a855f7',
  '#ec4899',
];

const TEXT_FONTS: { id: StoryTextFontStyle; labelAr: string; labelEn: string }[] = [
  { id: 'modern', labelAr: 'حديث', labelEn: 'Modern' },
  { id: 'classic', labelAr: 'كلاسيك', labelEn: 'Classic' },
  { id: 'neon', labelAr: 'نيون', labelEn: 'Neon' },
  { id: 'typewriter', labelAr: 'آلة كاتبة', labelEn: 'Type' },
  { id: 'bold', labelAr: 'عريض', labelEn: 'Strong' },
];

const TEXT_BG_STYLES: { id: StoryTextBgStyle; labelAr: string; labelEn: string }[] = [
  { id: 'none', labelAr: 'شفاف', labelEn: 'Clear' },
  { id: 'translucent', labelAr: 'داكن', labelEn: 'Glass' },
  { id: 'solid', labelAr: 'ممتلئ', labelEn: 'Fill' },
  { id: 'outline', labelAr: 'محدد', labelEn: 'Outline' },
];

export function getTextOverlayStyleClasses(item: Pick<StoryTextOverlay, 'fontStyle' | 'bgStyle'>) {
  const fontClass =
    item.fontStyle === 'classic'
      ? 'font-serif'
      : item.fontStyle === 'typewriter'
      ? 'font-mono tracking-tight'
      : item.fontStyle === 'bold'
      ? 'font-black tracking-wide'
      : item.fontStyle === 'neon'
      ? 'font-extrabold tracking-wide'
      : 'font-bold';
  return fontClass;
}

/* ============================================================================
   1. TEXT OVERLAY EDITOR MODAL
   ============================================================================ */
interface StoryTextModalProps {
  isOpen: boolean;
  isAr: boolean;
  editingItem: StoryTextOverlay | null;
  onClose: () => void;
  onSave: (overlay: StoryTextOverlay) => void;
  onDelete?: (id: string) => void;
}

export function StoryTextModal({
  isOpen,
  isAr,
  editingItem,
  onClose,
  onSave,
  onDelete,
}: StoryTextModalProps) {
  const [text, setText] = useState('');
  const [color, setColor] = useState('#ffffff');
  const [fontStyle, setFontStyle] = useState<StoryTextFontStyle>('modern');
  const [bgStyle, setBgStyle] = useState<StoryTextBgStyle>('translucent');

  useEffect(() => {
    if (isOpen) {
      if (editingItem) {
        setText(editingItem.text);
        setColor(editingItem.color || '#ffffff');
        setFontStyle(editingItem.fontStyle || 'modern');
        setBgStyle(editingItem.bgStyle || 'translucent');
      } else {
        setText('');
        setColor('#ffffff');
        setFontStyle('modern');
        setBgStyle('translucent');
      }
    }
  }, [isOpen, editingItem]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      if (editingItem && onDelete) onDelete(editingItem.id);
      onClose();
      return;
    }
    onSave({
      id: editingItem?.id || `txt_${Date.now()}`,
      text: trimmed.slice(0, 220),
      x: editingItem?.x ?? 50,
      y: editingItem?.y ?? 42,
      color,
      bgStyle,
      fontStyle,
      scale: editingItem?.scale ?? 1,
    });
    onClose();
  };

  const previewBg =
    bgStyle === 'solid'
      ? color === '#ffffff'
        ? '#0f172a'
        : color
      : bgStyle === 'translucent'
      ? 'rgba(0,0,0,0.62)'
      : 'transparent';

  const previewTextColor = bgStyle === 'solid' && color !== '#ffffff' ? '#ffffff' : color;

  return (
    <div
      className="fixed inset-0 z-[145] bg-black/80 backdrop-blur-md flex flex-col justify-between p-4 animate-in fade-in"
      onClick={onClose}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {editingItem && onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete(editingItem.id);
                onClose();
              }}
              className="px-3 py-1.5 rounded-full bg-red-600/80 hover:bg-red-600 text-white text-xs font-bold flex items-center gap-1"
            >
              <Trash2 size={14} />
              <span>{isAr ? 'حذف' : 'Delete'}</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          className="px-5 py-2 rounded-full bg-white text-slate-900 text-xs font-extrabold shadow-lg active:scale-95"
        >
          {isAr ? 'تم' : 'Done'}
        </button>
      </div>

      {/* Live Text Input Area */}
      <div
        className="flex-1 flex flex-col items-center justify-center gap-4 px-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="max-w-[92%] rounded-2xl px-4 py-2 transition-all"
          style={{
            backgroundColor: previewBg,
            boxShadow:
              fontStyle === 'neon'
                ? `0 0 18px ${color}80`
                : bgStyle === 'outline'
                ? '0 2px 12px rgba(0,0,0,0.6)'
                : undefined,
          }}
        >
          <textarea
            autoFocus
            rows={3}
            maxLength={220}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={isAr ? 'اكتب شيئاً على قصتك...' : 'Type something...'}
            style={{
              color: previewTextColor,
              textShadow:
                fontStyle === 'neon'
                  ? `0 0 12px ${color}`
                  : bgStyle === 'outline'
                  ? '0 2px 6px rgba(0,0,0,0.95)'
                  : '0 1px 4px rgba(0,0,0,0.5)',
            }}
            className={`w-full min-w-[240px] bg-transparent text-center text-xl sm:text-2xl placeholder-white/40 focus:outline-none resize-none ${getTextOverlayStyleClasses(
              { fontStyle, bgStyle }
            )}`}
          />
        </div>
      </div>

      {/* Bottom Controls: Fonts, Background Style, Colors */}
      <div className="space-y-3 pb-2" onClick={(e) => e.stopPropagation()}>
        {/* Font Styles */}
        <div className="flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar">
          {TEXT_FONTS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFontStyle(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                fontStyle === f.id ? 'bg-white text-slate-900' : 'bg-white/15 text-white'
              }`}
            >
              {isAr ? f.labelAr : f.labelEn}
            </button>
          ))}
        </div>

        {/* Background Styles */}
        <div className="flex items-center justify-center gap-1.5">
          {TEXT_BG_STYLES.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBgStyle(b.id)}
              className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-all ${
                bgStyle === b.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              {isAr ? b.labelAr : b.labelEn}
            </button>
          ))}
        </div>

        {/* Color Swatches */}
        <div className="flex items-center justify-center gap-2.5 pt-1">
          {TEXT_COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              onClick={() => setColor(swatch)}
              style={{ backgroundColor: swatch }}
              className={`w-7 h-7 rounded-full border-2 transition-transform ${
                color === swatch ? 'border-white scale-125 shadow-lg' : 'border-white/40'
              }`}
              aria-label={swatch}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   2. STICKERS DRAWER (Emoji, Location, Time, Mood, Poll, Add Yours)
   ============================================================================ */
const STICKER_EMOJIS = [
  '🔥', '❤️', '✨', '😍', '🎉', '💯',
  '🌙', '☀️', '☕', '🌸', '🚀', '👑',
  '🫶', '🎵', '📸', '⚡', '🌴', '💎',
];

const QUICK_LOCATIONS_AR = ['الرياض', 'جدة', 'دبي', 'القاهرة', 'صنعاء', 'عمّان', 'الدوحة', 'الكويت'];
const QUICK_LOCATIONS_EN = ['Riyadh', 'Jeddah', 'Dubai', 'Cairo', 'Sanaa', 'Amman', 'Doha', 'Kuwait'];

const MOOD_PRESETS = [
  { ar: 'مزاج رائق ☕', en: 'Chill Vibes ☕' },
  { ar: 'طاقة عالية ⚡', en: 'High Energy ⚡' },
  { ar: 'وقت الإنجاز 💻', en: 'Focus Mode 💻' },
  { ar: 'إجازة وسفر ✈️', en: 'Travel Mode ✈️' },
  { ar: 'امتنان وسعادة ✨', en: 'Grateful ✨' },
];

interface StoryStickersDrawerProps {
  isOpen: boolean;
  isAr: boolean;
  onClose: () => void;
  onAddSticker: (sticker: StorySticker) => void;
  onOpenPoll: () => void;
  onOpenTemplates: () => void;
  onOpenMention: () => void;
}

export function StoryStickersDrawer({
  isOpen,
  isAr,
  onClose,
  onAddSticker,
  onOpenPoll,
  onOpenTemplates,
  onOpenMention,
}: StoryStickersDrawerProps) {
  const [customLocation, setCustomLocation] = useState('');
  const [showLocationBox, setShowLocationBox] = useState(false);

  if (!isOpen) return null;

  const dropSticker = (type: StorySticker['type'], value: string, label?: string) => {
    const jitterX = 38 + Math.round(Math.random() * 24);
    const jitterY = 34 + Math.round(Math.random() * 24);
    onAddSticker({
      id: `stk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      value,
      label,
      x: jitterX,
      y: jitterY,
    });
    onClose();
  };

  const currentTimeStr = new Date().toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const locations = isAr ? QUICK_LOCATIONS_AR : QUICK_LOCATIONS_EN;

  return (
    <div
      className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-md flex flex-col justify-end animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border-t border-white/15 rounded-t-3xl max-h-[82vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white">
              <Smile size={16} />
            </div>
            <h3 className="text-base font-bold text-white">
              {isAr ? 'ملصقات القصة' : 'Story Stickers'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/70"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Interactive Action Stickers */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setShowLocationBox(!showLocationBox)}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 flex items-center gap-2 text-start transition-colors"
            >
              <MapPin size={18} className="text-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-white">{isAr ? 'الموقع' : 'Location'}</span>
            </button>

            <button
              type="button"
              onClick={() => dropSticker('time', currentTimeStr)}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 flex items-center gap-2 text-start transition-colors"
            >
              <Clock size={18} className="text-sky-400 shrink-0" />
              <span className="text-xs font-bold text-white">
                {isAr ? `الوقت (${currentTimeStr})` : `Time (${currentTimeStr})`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenMention();
              }}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 flex items-center gap-2 text-start transition-colors"
            >
              <AtSign size={18} className="text-amber-400 shrink-0" />
              <span className="text-xs font-bold text-white">{isAr ? 'ذكر صديق' : 'Mention'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenPoll();
              }}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 flex items-center gap-2 text-start transition-colors"
            >
              <BarChart2 size={18} className="text-purple-400 shrink-0" />
              <span className="text-xs font-bold text-white">{isAr ? 'استطلاع رأي' : 'Poll'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenTemplates();
              }}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 flex items-center gap-2 text-start transition-colors"
            >
              <Sparkles size={18} className="text-pink-400 shrink-0" />
              <span className="text-xs font-bold text-white">{isAr ? 'أضف خاصتك' : 'Add Yours'}</span>
            </button>
          </div>

          {/* Location Picker Box */}
          {showLocationBox && (
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/15 space-y-3 animate-in fade-in">
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={40}
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  placeholder={isAr ? 'اكتب اسم المدينة أو المكان...' : 'Enter city or place...'}
                  className="flex-1 bg-white/10 text-white placeholder-white/40 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
                <button
                  type="button"
                  disabled={!customLocation.trim()}
                  onClick={() => dropSticker('location', customLocation.trim())}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold disabled:opacity-40"
                >
                  {isAr ? 'إضافة' : 'Add'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {locations.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => dropSticker('location', loc)}
                    className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-emerald-500/30 text-white text-[11px] font-semibold"
                  >
                    📍 {loc}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mood / Vibe Chips */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-white/60">{isAr ? 'الحالة والمزاج' : 'Mood & Status'}</p>
            <div className="flex flex-wrap gap-2">
              {MOOD_PRESETS.map((m) => (
                <button
                  key={m.en}
                  type="button"
                  onClick={() => dropSticker('mood', isAr ? m.ar : m.en)}
                  className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-semibold text-white"
                >
                  {isAr ? m.ar : m.en}
                </button>
              ))}
            </div>
          </div>

          {/* Emoji Stickers */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-white/60">{isAr ? 'ملصقات إيموجي' : 'Emoji Stickers'}</p>
            <div className="grid grid-cols-6 gap-2">
              {STICKER_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => dropSticker('emoji', emoji)}
                  className="aspect-square rounded-2xl bg-white/5 hover:bg-white/15 flex items-center justify-center text-2xl active:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   3. EFFECTS & FILTERS DRAWER ("تأثيرات")
   ============================================================================ */
interface StoryEffectsDrawerProps {
  isOpen: boolean;
  isAr: boolean;
  selectedFilter: string;
  brightness: number;
  contrast: number;
  isMonochrome: boolean;
  onSelectPreset: (id: string) => void;
  onBrightnessChange: (v: number) => void;
  onContrastChange: (v: number) => void;
  onReset: () => void;
  onClose: () => void;
}

export function StoryEffectsDrawer({
  isOpen,
  isAr,
  selectedFilter,
  brightness,
  contrast,
  isMonochrome,
  onSelectPreset,
  onBrightnessChange,
  onContrastChange,
  onReset,
  onClose,
}: StoryEffectsDrawerProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[140] bg-black/50 flex flex-col justify-end animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900/95 backdrop-blur-xl border-t border-white/15 rounded-t-3xl p-4 space-y-4 animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-purple-400" />
            <h3 className="text-sm font-bold text-white">
              {isAr ? 'التأثيرات والفلاتر البصرية' : 'Visual Effects & Filters'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-purple-300 flex items-center gap-1"
            >
              <RotateCcw size={12} />
              <span>{isAr ? 'إعادة ضبط' : 'Reset'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-white text-slate-900 text-xs font-bold"
            >
              {isAr ? 'تم' : 'Done'}
            </button>
          </div>
        </div>

        {/* Presets Carousel */}
        <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
          {STORY_FILTER_PRESETS.map((preset) => {
            const active = selectedFilter === preset.id || (preset.id === 'bw' && isMonochrome);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectPreset(preset.id)}
                className="flex flex-col items-center gap-1.5 shrink-0"
              >
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${preset.swatch} flex items-center justify-center border-2 transition-all ${
                    active ? 'border-white scale-105 shadow-lg' : 'border-white/15 opacity-80'
                  }`}
                >
                  {active && <Check size={18} className="text-white drop-shadow" />}
                </div>
                <span className={`text-[11px] font-semibold ${active ? 'text-white' : 'text-white/60'}`}>
                  {isAr ? preset.nameAr : preset.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Fine Adjustments */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="bg-white/5 rounded-2xl p-3 space-y-1.5">
            <div className="flex justify-between text-[11px] font-semibold text-white/80">
              <span>{isAr ? 'السطوع' : 'Brightness'}</span>
              <span className="font-mono tabular-nums">{brightness}%</span>
            </div>
            <input
              type="range"
              min={60}
              max={150}
              value={brightness}
              onChange={(e) => onBrightnessChange(Number(e.target.value))}
              className="w-full accent-purple-500"
            />
          </div>

          <div className="bg-white/5 rounded-2xl p-3 space-y-1.5">
            <div className="flex justify-between text-[11px] font-semibold text-white/80">
              <span>{isAr ? 'التباين' : 'Contrast'}</span>
              <span className="font-mono tabular-nums">{contrast}%</span>
            </div>
            <input
              type="range"
              min={60}
              max={160}
              value={contrast}
              onChange={(e) => onContrastChange(Number(e.target.value))}
              className="w-full accent-purple-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   4. USER PICKER MODAL (Mentions "@ذكر", Partnership "شراكة", Close Friends)
   ============================================================================ */
interface StoryUserPickerModalProps {
  mode: 'mention' | 'partner' | 'close_friends' | null;
  isAr: boolean;
  closeFriends: CloseFriendUser[];
  partnership: StoryPartnership | null;
  onClose: () => void;
  onSelectMention: (user: { uid: string; username: string; photoURL?: string }) => void;
  onSavePartnership: (p: StoryPartnership | null) => void;
  onToggleCloseFriend: (user: { uid: string; username: string; photoURL?: string }, isAdding: boolean) => void;
  onPublishToCloseFriends?: () => void;
}

export function StoryUserPickerModal({
  mode,
  isAr,
  closeFriends,
  partnership,
  onClose,
  onSelectMention,
  onSavePartnership,
  onToggleCloseFriend,
  onPublishToCloseFriends,
}: StoryUserPickerModalProps) {
  const { user, blockedUsers } = useAuth();
  const [usersList, setUsersList] = useState<{ uid: string; username: string; fullName?: string; photoURL?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPaidPartner, setIsPaidPartner] = useState(Boolean(partnership?.isPaid));

  useEffect(() => {
    if (!mode) return;
    setIsPaidPartner(Boolean(partnership?.isPaid));
    setSearchTerm('');
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
        console.warn('Could not load users for picker:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchUsers();
    return () => {
      active = false;
    };
  }, [mode, user?.uid, blockedUsers]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return usersList;
    return usersList.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.fullName && u.fullName.toLowerCase().includes(q))
    );
  }, [usersList, searchTerm]);

  if (!mode) return null;

  const closeFriendSet = new Set(closeFriends.map((f) => f.friendId));

  const title =
    mode === 'mention'
      ? isAr
        ? 'ذكر حساب في القصة (@)'
        : 'Mention Someone (@)'
      : mode === 'partner'
      ? isAr
        ? 'شراكة وتعاون في القصة'
        : 'Story Partnership & Collab'
      : isAr
      ? 'قائمة الأصدقاء المقربين'
      : 'Close Friends List';

  return (
    <div
      className="fixed inset-0 z-[145] bg-black/80 backdrop-blur-md flex flex-col justify-end animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border-t border-white/15 rounded-t-3xl max-h-[82vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center text-white ${
                mode === 'close_friends'
                  ? 'bg-emerald-500'
                  : mode === 'partner'
                  ? 'bg-indigo-600'
                  : 'bg-amber-500'
              }`}
            >
              {mode === 'close_friends' ? (
                <Star size={16} fill="currentColor" />
              ) : mode === 'partner' ? (
                <Briefcase size={16} />
              ) : (
                <AtSign size={16} />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{title}</h3>
              {mode === 'close_friends' && (
                <p className="text-[11px] text-emerald-400 font-medium">
                  {isAr
                    ? `${closeFriends.length} في قائمة الأصدقاء المقربين`
                    : `${closeFriends.length} people in Close Friends`}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/70"
          >
            <X size={18} />
          </button>
        </div>

        {/* Paid Partnership Toggle when mode === 'partner' */}
        {mode === 'partner' && (
          <div className="px-4 pt-3 space-y-2">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white">
                  {isAr ? 'إظهار تسمية "شراكة مدفوعة"' : 'Add "Paid Partnership" label'}
                </p>
                <p className="text-[10px] text-white/50">
                  {isAr
                    ? 'إعلام المشاهدين بأن القصة برعاية أو تعاون تجاري'
                    : 'Let viewers know this story includes a sponsored collaboration'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !isPaidPartner;
                  setIsPaidPartner(next);
                  onSavePartnership(
                    next || partnership?.partnerUsername
                      ? {
                          isPaid: next,
                          partnerId: partnership?.partnerId,
                          partnerUsername: partnership?.partnerUsername,
                        }
                      : null
                  );
                }}
                className={`w-11 h-6 rounded-full transition-colors p-0.5 ${
                  isPaidPartner ? 'bg-indigo-500' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    isPaidPartner ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {partnership?.partnerUsername && (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-xs text-indigo-200">
                <span>
                  {isAr
                    ? `الشريك المختار: @${partnership.partnerUsername}`
                    : `Selected Partner: @${partnership.partnerUsername}`}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onSavePartnership(isPaidPartner ? { isPaid: true } : null)
                  }
                  className="text-rose-300 hover:text-rose-200 font-bold"
                >
                  {isAr ? 'إزالة' : 'Remove'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Search Input */}
        <div className="p-4 pb-2">
          <div className="relative">
            <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isAr ? 'ابحث عن مستخدم...' : 'Search username...'}
              className="w-full bg-white/10 text-white placeholder-white/40 ps-9 pe-4 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
          {loading ? (
            <div className="py-10 text-center text-xs text-white/50">
              {isAr ? 'جاري تحميل الحسابات...' : 'Loading accounts...'}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-white/50">
              {isAr ? 'لم يتم العثور على حسابات مطابقة' : 'No matching accounts found'}
            </div>
          ) : (
            filtered.map((item) => {
              const isCloseFriend = closeFriendSet.has(item.uid);
              const isCurrentPartner = partnership?.partnerId === item.uid;
              return (
                <button
                  key={item.uid}
                  type="button"
                  onClick={() => {
                    if (mode === 'mention') {
                      onSelectMention(item);
                      onClose();
                    } else if (mode === 'partner') {
                      onSavePartnership({
                        isPaid: isPaidPartner,
                        partnerId: item.uid,
                        partnerUsername: item.username,
                      });
                      onClose();
                    } else {
                      onToggleCloseFriend(item, !isCloseFriend);
                    }
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-white/10 transition-colors text-start"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20 shrink-0">
                      <UserAvatar src={item.photoURL} username={item.username} iconSize={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">@{item.username}</p>
                      {item.fullName && (
                        <p className="text-[11px] text-white/50 truncate">{item.fullName}</p>
                      )}
                    </div>
                  </div>

                  {mode === 'close_friends' ? (
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center border transition-colors ${
                        isCloseFriend
                          ? 'bg-emerald-500 border-emerald-400 text-white'
                          : 'border-white/30 text-transparent'
                      }`}
                    >
                      <Check size={14} strokeWidth={3} />
                    </span>
                  ) : mode === 'partner' ? (
                    <span
                      className={`px-3 py-1 rounded-xl text-[11px] font-bold ${
                        isCurrentPartner
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/10 text-white/80'
                      }`}
                    >
                      {isCurrentPartner ? (isAr ? 'محدد' : 'Selected') : isAr ? 'اختيار' : 'Select'}
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-xl bg-white/10 text-[11px] font-bold text-white">
                      {isAr ? 'إشارة @' : 'Tag @'}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer for Close Friends */}
        {mode === 'close_friends' && (
          <div className="p-4 border-t border-white/10 flex items-center gap-2 bg-slate-950/80">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white/10 text-white text-xs font-bold"
            >
              {isAr ? 'حفظ القائمة' : 'Save List'}
            </button>
            {onPublishToCloseFriends && closeFriends.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onPublishToCloseFriends();
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold flex items-center justify-center gap-1.5"
              >
                <Star size={14} fill="currentColor" />
                <span>{isAr ? 'نشر للمقربين الآن' : 'Share to Close Friends'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
   5. MORE OPTIONS SHEET ("المزيد")
   ============================================================================ */
interface StoryMoreOptionsSheetProps {
  isOpen: boolean;
  isAr: boolean;
  allowReplies: boolean;
  closeFriendsCount: number;
  onToggleAllowReplies: () => void;
  onOpenCloseFriends: () => void;
  onOpenPoll: () => void;
  onOpenTemplates: () => void;
  onOpenCollage: () => void;
  onClose: () => void;
}

export function StoryMoreOptionsSheet({
  isOpen,
  isAr,
  allowReplies,
  closeFriendsCount,
  onToggleAllowReplies,
  onOpenCloseFriends,
  onOpenPoll,
  onOpenTemplates,
  onOpenCollage,
  onClose,
}: StoryMoreOptionsSheetProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[145] bg-black/75 backdrop-blur-md flex flex-col justify-end animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border-t border-white/15 rounded-t-3xl p-4 space-y-2 animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <h3 className="text-sm font-bold text-white">
            {isAr ? 'خيارات إضافية للقصة' : 'More Story Options'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/70"
          >
            <X size={18} />
          </button>
        </div>

        {/* Allow Replies Toggle */}
        <button
          type="button"
          onClick={onToggleAllowReplies}
          className="w-full p-3 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-between text-start transition-colors"
        >
          <div className="flex items-center gap-3">
            <MessageCircle size={18} className="text-purple-400" />
            <div>
              <p className="text-xs font-bold text-white">
                {isAr ? 'السماح بالردود والتفاعلات' : 'Allow Replies & Reactions'}
              </p>
              <p className="text-[10px] text-white/50">
                {allowReplies
                  ? isAr
                    ? 'يمكن للمشاهدين إرسال ردود وتفاعلات'
                    : 'Viewers can reply and react'
                  : isAr
                  ? 'تم إيقاف الردود على هذه القصة'
                  : 'Replies are turned off'}
              </p>
            </div>
          </div>
          <div
            className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
              allowReplies ? 'bg-purple-600' : 'bg-white/20'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                allowReplies ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
              }`}
            />
          </div>
        </button>

        {/* Manage Close Friends */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenCloseFriends();
          }}
          className="w-full p-3 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-between text-start transition-colors"
        >
          <div className="flex items-center gap-3">
            <UserCheck size={18} className="text-emerald-400" />
            <div>
              <p className="text-xs font-bold text-white">
                {isAr ? 'تعديل قائمة الأصدقاء المقربين' : 'Manage Close Friends'}
              </p>
              <p className="text-[10px] text-white/50">
                {isAr ? `${closeFriendsCount} أشخاص في القائمة` : `${closeFriendsCount} people selected`}
              </p>
            </div>
          </div>
          <Star size={16} className="text-emerald-400" fill="currentColor" />
        </button>

        {/* Poll Sticker */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenPoll();
          }}
          className="w-full p-3 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center gap-3 text-start transition-colors"
        >
          <BarChart2 size={18} className="text-amber-400" />
          <span className="text-xs font-bold text-white">
            {isAr ? 'إضافة أو تعديل استطلاع رأي' : 'Add / Edit Story Poll'}
          </span>
        </button>

        {/* Templates */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenTemplates();
          }}
          className="w-full p-3 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center gap-3 text-start transition-colors"
        >
          <Sparkles size={18} className="text-pink-400" />
          <span className="text-xs font-bold text-white">
            {isAr ? 'إضافة قالب "أضف خاصتك"' : 'Add "Add Yours" Template'}
          </span>
        </button>

        {/* Collage */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenCollage();
          }}
          className="w-full p-3 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center gap-3 text-start transition-colors"
        >
          <LayoutGrid size={18} className="text-sky-400" />
          <span className="text-xs font-bold text-white">
            {isAr ? 'تحويل إلى منشور مجمع (Layout)' : 'Switch to Collage Layout'}
          </span>
        </button>
      </div>
    </div>
  );
}
