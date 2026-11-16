import React, { useEffect, useRef, useState } from 'react';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { Heart, MessageCircle, Sparkles, UserPlus, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { REACTION_MAP, isValidReactionType } from '../utils/reactions';
import UserAvatar from './UserAvatar';

export interface LiveToastNotification {
  id: string;
  senderId: string;
  senderUsername: string;
  senderPhotoURL?: string;
  type: 'like' | 'follow' | 'message' | 'comment';
  postId?: string | null;
  text?: string;
  read?: boolean;
}

interface NotificationToastProps {
  onOpenProfile?: (uid: string) => void;
  onOpenNotifications?: () => void;
  onOpenMessages?: () => void;
  onOpenPost?: (postId: string) => void;
}

export function isStoryReplyNotification(notif: { type?: string; text?: string }): {
  isStoryReply: boolean;
  replyBody: string;
} {
  const text = typeof notif.text === 'string' ? notif.text : '';
  if (notif.type === 'message') {
    if (text.startsWith('رد على القصة:')) {
      return {
        isStoryReply: true,
        replyBody: text.replace(/^رد على القصة:\s*/, '').replace(/^"|"$/g, ''),
      };
    }
    if (text.startsWith('Replied to story:')) {
      return {
        isStoryReply: true,
        replyBody: text.replace(/^Replied to story:\s*/, '').replace(/^"|"$/g, ''),
      };
    }
  }
  return { isStoryReply: false, replyBody: text };
}

export default function NotificationToast({
  onOpenProfile,
  onOpenNotifications,
  onOpenMessages,
  onOpenPost,
}: NotificationToastProps) {
  const { user, isFirebaseAuthenticated, blockedUsers, language } = useAuth();
  const isAr = language === 'ar';

  const [toasts, setToasts] = useState<LiveToastNotification[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismissToast = (id: string) => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  };

  useEffect(() => {
    seenIdsRef.current.clear();
    initializedRef.current = false;
    setToasts([]);
    Object.values(timersRef.current).forEach((t) => clearTimeout(t));
    timersRef.current = {};

    if (!user || !isFirebaseAuthenticated) return;

    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(12)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!initializedRef.current) {
          snapshot.docs.forEach((d) => seenIdsRef.current.add(d.id));
          initializedRef.current = true;
          return;
        }

        const freshToasts: LiveToastNotification[] = [];
        snapshot.docChanges().forEach((change) => {
          if (change.type !== 'added') return;
          const docId = change.doc.id;
          if (seenIdsRef.current.has(docId)) return;
          seenIdsRef.current.add(docId);

          const data = change.doc.data() as any;
          if (!data || data.read === true) return;
          if (data.silent === true || data.type === 'story_expiring') return;
          if (!data.senderId || data.senderId === user.uid) return;
          if (blockedUsers.includes(data.senderId)) return;

          freshToasts.push({
            id: docId,
            senderId: data.senderId,
            senderUsername: data.senderUsername || (isAr ? 'مستخدم' : 'User'),
            senderPhotoURL: data.senderPhotoURL || '',
            type: data.type,
            postId: data.postId || null,
            text: data.text || '',
            read: Boolean(data.read),
          });
        });

        if (freshToasts.length === 0) return;

        setToasts((prev) => {
          const next = [...freshToasts, ...prev].slice(0, 3);
          return next;
        });

        freshToasts.forEach((toastItem) => {
          timersRef.current[toastItem.id] = setTimeout(() => {
            dismissToast(toastItem.id);
          }, 5500);
        });
      },
      (err) => {
        console.warn('Live notification toast listener notice:', err);
      }
    );

    return () => {
      unsubscribe();
      Object.values(timersRef.current).forEach((t) => clearTimeout(t));
      timersRef.current = {};
    };
  }, [user?.uid, isFirebaseAuthenticated, blockedUsers, isAr]);

  const handleToastClick = async (toast: LiveToastNotification) => {
    dismissToast(toast.id);
    if (user) {
      updateDoc(doc(db, 'users', user.uid, 'notifications', toast.id), {
        read: true,
      }).catch(() => {});
    }

    if (toast.type === 'message') {
      onOpenMessages?.();
      return;
    }
    if ((toast.type === 'like' || toast.type === 'comment') && toast.postId && onOpenPost) {
      onOpenPost(toast.postId);
      return;
    }
    if (toast.type === 'follow' && toast.senderId && onOpenProfile) {
      onOpenProfile(toast.senderId);
      return;
    }
    onOpenNotifications?.();
  };

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-16 md:top-20 end-3 sm:end-5 z-[140] flex flex-col gap-2.5 w-[calc(100vw-1.5rem)] max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => {
        const storyReplyInfo = isStoryReplyNotification(toast);

        let badgeIcon: React.ReactNode = <Heart size={12} className="text-white fill-white" />;
        let badgeBg = 'bg-rose-500';
        let titleText = '';
        let previewText = '';

        if (toast.type === 'like') {
          if (toast.text === 'liked your comment') {
            titleText = isAr ? 'أعجب بتعليقك' : 'liked your comment';
          } else if (typeof toast.text === 'string' && toast.text.startsWith('story_reaction:')) {
            const raw = toast.text.split(':')[1];
            const emoji = isValidReactionType(raw) ? REACTION_MAP[raw].emoji : '❤️';
            titleText = isAr ? `تفاعل (${emoji}) مع قصتك` : `reacted ${emoji} to your story`;
            badgeBg = 'bg-purple-600';
            badgeIcon = <Sparkles size={12} className="text-white" />;
          } else if (typeof toast.text === 'string' && toast.text.startsWith('post_reaction:')) {
            const raw = toast.text.split(':')[1];
            const emoji = raw && raw !== 'heart' && isValidReactionType(raw) ? REACTION_MAP[raw].emoji : null;
            titleText = emoji
              ? isAr
                ? `تفاعل (${emoji}) مع منشورك`
                : `reacted ${emoji} to your post`
              : isAr
              ? 'أعجب بمنشورك'
              : 'liked your post';
          } else {
            titleText = isAr ? 'أعجب بمنشورك' : 'liked your post';
          }
        } else if (storyReplyInfo.isStoryReply) {
          badgeBg = 'bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600';
          badgeIcon = <Sparkles size={12} className="text-white" />;
          titleText = isAr ? 'رد على قصتك' : 'replied to your story';
          previewText = storyReplyInfo.replyBody;
        } else if (toast.type === 'message') {
          badgeBg = 'bg-emerald-500';
          badgeIcon = <MessageCircle size={12} className="text-white" />;
          titleText = isAr ? 'أرسل لك رسالة' : 'sent you a message';
          previewText = toast.text || '';
        } else if (toast.type === 'comment') {
          badgeBg = 'bg-indigo-500';
          badgeIcon = <MessageCircle size={12} className="text-white" />;
          titleText = isAr ? 'علّق على منشورك' : 'commented on your post';
          previewText = toast.text || '';
        } else if (toast.type === 'follow') {
          badgeBg = 'bg-blue-500';
          badgeIcon = <UserPlus size={12} className="text-white" />;
          titleText = isAr ? 'بدأ بمتابعتك' : 'started following you';
        }

        return (
          <div
            key={toast.id}
            role="button"
            tabIndex={0}
            onClick={() => handleToastClick(toast)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleToastClick(toast);
              }
            }}
            className="pointer-events-auto group bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-2xl flex items-start gap-3 cursor-pointer hover:border-purple-400 dark:hover:border-purple-600 transition-all animate-in fade-in slide-in-from-top-3"
          >
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                <UserAvatar
                  src={toast.senderPhotoURL}
                  username={toast.senderUsername}
                  iconSize={18}
                />
              </div>
              <span
                className={`absolute -bottom-0.5 -end-0.5 w-5 h-5 rounded-full ${badgeBg} border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-sm`}
              >
                {badgeIcon}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                  {toast.senderUsername}
                </p>
                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 shrink-0">
                  {isAr ? 'الآن' : 'Now'}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200 mt-0.5 leading-snug">
                {titleText}
              </p>
              {previewText && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  “{previewText}”
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dismissToast(toast.id);
              }}
              aria-label={isAr ? 'إغلاق الإشعار' : 'Dismiss notification'}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
