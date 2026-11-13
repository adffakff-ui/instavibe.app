import React, { useState } from 'react';
import { Image, Film, X, Send, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFirestore } from '../hooks/useFirestore';

export default function PostCreation({
  onClose,
  defaultMediaType = 'image',
}: {
  onClose?: () => void;
  defaultMediaType?: 'image' | 'video';
}) {
  const { profile, language } = useAuth();
  const { createPost, loading } = useFirestore();
  const [caption, setCaption] = useState('');
  const [mediaURL, setMediaURL] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>(defaultMediaType);

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
    setCaption('');
    setMediaURL('');
    setMediaType(defaultMediaType);
    if (onClose) onClose();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 shrink-0">
          <img
            src={profile?.photoURL || '/placeholder-avatar.jpg'}
            alt={profile?.username || ''}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm">{profile?.username}</span>
          <p className="text-xs text-slate-500">
            {language === 'ar' ? 'إنشاء منشور جديد' : 'Creating a new post'}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        )}
      </div>

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

        <button
          type="submit"
          disabled={loading || !mediaURL.trim()}
          className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
          {language === 'ar' ? 'نشر المنشور' : 'Share Post'}
        </button>
      </form>
    </div>
  );
}
