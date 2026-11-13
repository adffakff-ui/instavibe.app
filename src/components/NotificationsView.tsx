import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Heart, UserPlus, MessageSquare, Loader2, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { REACTION_MAP, isValidReactionType } from '../utils/reactions';
import UserAvatar from './UserAvatar';
import FollowButton from './FollowButton';

export default function NotificationsView({
  onOpenProfile,
}: {
  onOpenProfile?: (uid: string) => void;
}) {
  const { user, blockedUsers, language } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifs = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((n: any) => !blockedUsers.includes(n.senderId));
        setNotifications(notifs);
        setLoading(false);
      },
      (error) => {
        console.warn('Notifications listener error:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user, blockedUsers]);

  const markAsRead = async (notificationId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'notifications', notificationId), {
        read: true
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user || markingAll) return;
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    setMarkingAll(true);
    try {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        batch.update(doc(db, 'users', user.uid, 'notifications', n.id), { read: true });
      });
      await batch.commit();
    } catch (error) {
      console.error('Error marking all notifications read:', error);
    } finally {
      setMarkingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold">
            {language === 'ar' ? 'الإعجابات والإشعارات' : 'Notifications'}
          </h2>
          {unreadCount > 0 && (
            <span className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              {unreadCount}
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            disabled={markingAll}
            onClick={markAllAsRead}
            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {markingAll ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
            <span>{language === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all read'}</span>
          </button>
        )}
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[calc(100vh-200px)] overflow-y-auto no-scrollbar">
        {notifications.length === 0 ? (
          <div className="p-20 text-center">
            <Heart size={48} className="mx-auto mb-4 text-slate-200 dark:text-slate-800" />
            <p className="text-slate-500 font-medium">
              {language === 'ar' ? 'لا توجد إشعارات أو إعجابات بعد' : 'No notifications yet'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {language === 'ar'
                ? 'ستظهر هنا الإعجابات والتعليقات والمتابعات الجديدة.'
                : 'Activities related to you will appear here.'}
            </p>
          </div>
        ) : (
          notifications.map((notif) => (
            <button
              key={notif.id}
              type="button"
              onClick={() => {
                if (!notif.read) markAsRead(notif.id);
                if (notif.senderId) onOpenProfile?.(notif.senderId);
              }}
              className={`w-full text-start flex items-center gap-4 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer ${
                notif.read ? 'opacity-80' : 'bg-slate-50/70 dark:bg-slate-800/30'
              }`}
            >
              <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                <UserAvatar src={notif.senderPhotoURL} username={notif.senderUsername} iconSize={18} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-900 dark:text-slate-100">
                  <span className="font-bold">{notif.senderUsername}</span>{' '}
                  {notif.type === 'like' && (() => {
                    if (notif.text === 'liked your comment') {
                      return language === 'ar' ? 'أعجب بتعليقك.' : 'liked your comment.';
                    }
                    if (typeof notif.text === 'string' && notif.text.startsWith('story_reaction:')) {
                      const raw = notif.text.split(':')[1];
                      const emoji = isValidReactionType(raw) ? REACTION_MAP[raw].emoji : '❤️';
                      return language === 'ar'
                        ? `تفاعل (${emoji}) مع قصتك.`
                        : `reacted ${emoji} to your story.`;
                    }
                    if (typeof notif.text === 'string' && notif.text.startsWith('post_reaction:')) {
                      const raw = notif.text.split(':')[1];
                      if (raw !== 'heart' && isValidReactionType(raw)) {
                        return language === 'ar'
                          ? `تفاعل (${REACTION_MAP[raw].emoji}) مع منشورك.`
                          : `reacted ${REACTION_MAP[raw].emoji} to your post.`;
                      }
                    }
                    return language === 'ar' ? 'أعجب بمنشورك.' : 'liked your post.';
                  })()}
                  {notif.type === 'follow' && (language === 'ar' ? 'بدأ بمتابعتك.' : 'started following you.')}
                  {notif.type === 'comment' && (language === 'ar' ? `علّق: ${notif.text}` : `commented: ${notif.text}`)}
                  {notif.type === 'message' && (language === 'ar' ? `أرسل لك رسالة: ${notif.text}` : `sent you a message: ${notif.text}`)}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {notif.createdAt?.toDate
                    ? formatDistanceToNow(notif.createdAt.toDate(), {
                        addSuffix: true,
                        locale: language === 'ar' ? ar : undefined,
                      })
                    : language === 'ar'
                    ? 'الآن'
                    : 'just now'}
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {notif.type === 'follow' && notif.senderId && (
                  <FollowButton targetUserId={notif.senderId} variant="compact" />
                )}
                {notif.type === 'like' && (() => {
                  if (typeof notif.text === 'string' && (notif.text.startsWith('story_reaction:') || notif.text.startsWith('post_reaction:'))) {
                    const raw = notif.text.split(':')[1];
                    if (raw && raw !== 'heart' && isValidReactionType(raw)) {
                      return <span className="text-lg leading-none">{REACTION_MAP[raw].emoji}</span>;
                    }
                  }
                  return <Heart size={16} className="text-red-500 fill-red-500" />;
                })()}
                {notif.type === 'follow' && <UserPlus size={16} className="text-blue-500" />}
                {notif.type === 'message' && <MessageSquare size={16} className="text-emerald-500" />}
                {notif.type === 'comment' && <MessageSquare size={16} className="text-slate-400" />}
              </div>

              {!notif.read && (
                <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
