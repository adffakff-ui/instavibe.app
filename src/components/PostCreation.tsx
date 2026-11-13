import React, { useState, useEffect } from 'react';
import { Image, Film, X, Send, Loader2, Bookmark, Trash2, ArrowRight, CheckCircle2, Edit3 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import { useFirestore } from '../hooks/useFirestore';
import { PostDraft, getSavedPostDrafts, savePostDraft, deletePostDraft } from '../utils/postDrafts';
import UserAvatar from './UserAvatar';

export default function PostCreation({
  onClose,
  defaultMediaType = 'image',
}: {
  onClose?: () => void;
  defaultMediaType?: 'image' | 'video';
}) {
  const { profile, language } = useAuth();
  const { createPost, loading } = useFirestore();

  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [savedDrafts, setSavedDrafts] = useState<PostDraft[]>([]);
  const [showDraftsList, setShowDraftsList] = useState<boolean>(false);
  const [draftToast, setDraftToast] = useState<string | null>(null);

  const [caption, setCaption] = useState('');
  const [mediaURL, setMediaURL] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>(defaultMediaType);

  // Load saved drafts on mount
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

  const loadDraft = (draft: PostDraft) => {
    setActiveDraftId(draft.id);
    setMediaURL(draft.mediaURL);
    setMediaType(draft.mediaType);
    setCaption(draft.caption || '');
    setShowDraftsList(false);
    const timeAgo = formatDistanceToNow(draft.updatedAt, { addSuffix: true, locale: language === 'ar' ? ar : undefined });
    setDraftToast(language === 'ar' ? `تم استئناف المسودة من ${timeAgo}` : `Resumed draft from ${timeAgo}`);
    setTimeout(() => setDraftToast(null), 3000);
  };

  const handleSaveDraft = () => {
    if (!profile) return;
    if (!mediaURL.trim() && !caption.trim()) {
      return;
    }

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
      setDraftToast(
        language === 'ar'
          ? 'تم حفظ المسودة بنجاح! يمكنك العودة وتعديلها لاحقاً.'
          : 'Draft saved successfully! You can resume editing later.'
      );
      setTimeout(() => setDraftToast(null), 3000);
    }
  };

  const handleDeleteDraftItem = (draftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile) return;
    deletePostDraft(profile.uid, draftId);
    if (activeDraftId === draftId) {
      setActiveDraftId(null);
    }
    refreshDrafts();
  };

  const handleMediaUrlChange = (val: string) => {
    setMediaURL(val);
    if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(val.trim())) {
      setMediaType('video');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !mediaURL.trim()) return;

    await createPost(profile, mediaURL.trim(), mediaType, caption);

    if (activeDraftId) {
      deletePostDraft(profile.uid, activeDraftId);
    }

    setCaption('');
    setMediaURL('');
    setMediaType(defaultMediaType);
    if (onClose) onClose();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xl mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700">
            <UserAvatar
              src={profile?.photoURL}
              username={profile?.username}
              iconSize={18}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-900 dark:text-white">{profile?.username}</span>
              {activeDraftId && (
                <span className="text-[10px] bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-semibold px-2 py-0.5 rounded-full">
                  {language === 'ar' ? 'مسودة' : 'Draft'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {showDraftsList
                ? (language === 'ar' ? 'مسودات المنشورات المحفوظة' : 'Saved Post Drafts')
                : (language === 'ar' ? 'إنشاء منشور جديد' : 'Creating a new post')}
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
              <span>{language === 'ar' ? `المسودات (${savedDrafts.length})` : `Drafts (${savedDrafts.length})`}</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {draftToast && (
        <div className="mb-4 p-2.5 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-xl text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} className="text-green-500 shrink-0" />
          <span className="flex-1">{draftToast}</span>
        </div>
      )}

      {showDraftsList ? (
        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {language === 'ar' ? `مسوداتك المحفوظة (${savedDrafts.length})` : `Saved Post Drafts (${savedDrafts.length})`}
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
                    <img src={draft.mediaURL} alt="Thumbnail" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {draft.caption || (language === 'ar' ? 'منشور بدون وصف' : 'Untitled post draft')}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {formatDistanceToNow(draft.updatedAt, { addSuffix: true, locale: language === 'ar' ? ar : undefined })}
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
                  <ArrowRight size={16} className={`text-purple-600 ${language === 'ar' ? 'rotate-180' : ''}`} />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveDraftId(null);
              setMediaURL('');
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
          <textarea
            placeholder={language === 'ar' ? 'بماذا تفكر؟ أضف وصفاً أو #وسوماً...' : "What's on your mind?"}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700 resize-none h-24"
          />

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setMediaType('image')}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  mediaType === 'image'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Image size={14} />
                <span>{language === 'ar' ? 'صورة' : 'Photo'}</span>
              </button>
              <button
                type="button"
                onClick={() => setMediaType('video')}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  mediaType === 'video'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Film size={14} />
                <span>{language === 'ar' ? 'فيديو' : 'Video'}</span>
              </button>
            </div>

            <div className="flex-1 relative">
              <input
                type="text"
                placeholder={
                  mediaType === 'video'
                    ? (language === 'ar' ? 'الصق رابط الفيديو (MP4 / WebM)...' : 'Paste video URL (MP4 / WebM)...')
                    : (language === 'ar' ? 'الصق رابط الصورة هنا...' : 'Paste image URL here...')
                }
                value={mediaURL}
                onChange={(e) => handleMediaUrlChange(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl py-3 pe-4 ps-10 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700"
              />
              {mediaType === 'video' ? (
                <Film className="absolute start-3 top-3 text-slate-400" size={18} />
              ) : (
                <Image className="absolute start-3 top-3 text-slate-400" size={18} />
              )}
            </div>
          </div>

          {mediaURL && (
            <div className="aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 relative group">
              {mediaType === 'video' ? (
                <video
                  src={mediaURL}
                  muted
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-full object-cover bg-black"
                />
              ) : (
                <img src={mediaURL} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              )}
              <button
                type="button"
                onClick={() => setMediaURL('')}
                className="absolute top-2 end-2 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={!mediaURL.trim() && !caption.trim()}
              className="px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-40"
            >
              <Bookmark size={16} />
              <span>{language === 'ar' ? 'حفظ كمسودة' : 'Save as Draft'}</span>
            </button>

            <button
              type="submit"
              disabled={loading || !mediaURL.trim()}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-md shadow-purple-500/20"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              <span>{language === 'ar' ? 'نشر المنشور' : 'Share Post'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
