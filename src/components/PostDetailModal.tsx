import { useEffect } from 'react';
import { X } from 'lucide-react';
import Post from './Post';
import { useAuth } from '../context/AuthContext';

export default function PostDetailModal({
  post,
  onClose,
  onOpenChat,
  onOpenProfile,
  onSelectTag,
  onPostDeleted,
}: {
  post: any | null;
  onClose: () => void;
  onOpenChat?: (convId: string) => void;
  onOpenProfile?: (uid: string) => void;
  onSelectTag?: (tag: string) => void;
  onPostDeleted?: (postId: string) => void;
}) {
  const { language } = useAuth();

  useEffect(() => {
    if (!post) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [post, onClose]);

  if (!post) return null;

  return (
    <div
      className="fixed inset-0 z-[125] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={language === 'ar' ? 'تفاصيل المنشور' : 'Post details'}
    >
      <div
        className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto no-scrollbar rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-950 shadow-2xl border border-slate-200 dark:border-slate-800 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            {language === 'ar' ? 'تفاصيل المنشور' : 'Post'}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-2 sm:p-4">
          <Post
            post={post}
            onOpenChat={(convId) => {
              onClose();
              onOpenChat?.(convId);
            }}
            onOpenProfile={(uid) => {
              onClose();
              onOpenProfile?.(uid);
            }}
            onSelectTag={(tag) => {
              onClose();
              onSelectTag?.(tag);
            }}
            onPostDeleted={(postId) => {
              onPostDeleted?.(postId);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
