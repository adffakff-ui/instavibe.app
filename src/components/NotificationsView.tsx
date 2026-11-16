import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, writeBatch, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useFirestore } from '../hooks/useFirestore';
import {
  Heart,
  MessageSquare,
  Loader2,
  CheckCheck,
  Sparkles,
  Settings,
  Bell,
  Sliders,
  Clock,
  BellOff,
  Trash2,
  CheckCircle2,
  Play,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { REACTION_MAP, isValidReactionType } from '../utils/reactions';
import { isStoryReplyNotification } from './NotificationToast';
import UserAvatar from './UserAvatar';
import FollowButton from './FollowButton';
import StoryViewer, { StoryItem, StoryUserGroup } from './StoryViewer';

type NotifFilter = 'all' | 'following' | 'comments' | 'likes';

export default function NotificationsView({
  onOpenProfile,
  onOpenPost,
}: {
  onOpenProfile?: (uid: string) => void;
  onOpenPost?: (postId: string) => void;
}) {
  const { user, isFirebaseAuthenticated, blockedUsers, language } = useAuth();
  const { keepExpiringStory, deleteExpiringStoryNow } = useFirestore();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeStories, setActiveStories] = useState<StoryItem[]>([]);
  const [viewingStoryGroup, setViewingStoryGroup] = useState<StoryUserGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [processingStoryNotifId, setProcessingStoryNotifId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<NotifFilter>('all');
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Notification preferences state
  const [notifPrefs, setNotifPrefs] = useState({
    likes: true,
    comments: true,
    follows: true,
    messages: true,
    reminders: true,
  });

  useEffect(() => {
    if (!user || !isFirebaseAuthenticated) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifs = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
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
  }, [user, isFirebaseAuthenticated, blockedUsers]);

  // Listen to active unexpired stories so story rings only appear on users who actually have active stories
  useEffect(() => {
    if (!user || !isFirebaseAuthenticated) {
      setActiveStories([]);
      return;
    }

    const qStories = query(
      collection(db, 'stories'),
      orderBy('createdAt', 'desc'),
      limit(60)
    );

    const unsubscribe = onSnapshot(
      qStories,
      (snapshot) => {
        const now = Date.now();
        const valid: StoryItem[] = [];
        snapshot.docs.forEach((d) => {
          const data = d.data() as any;
          if (blockedUsers.includes(data.authorId)) return;
          if (data.audience === 'close_friends') {
            const isAuthor = data.authorId === user.uid;
            const isAllowedFriend =
              Array.isArray(data.closeFriendIds) && data.closeFriendIds.includes(user.uid);
            if (!isAuthor && !isAllowedFriend) return;
          }
          if (data.expiresAt) {
            const expMs = new Date(data.expiresAt).getTime();
            if (!Number.isNaN(expMs) && expMs <= now) return;
          }
          valid.push({
            id: d.id,
            authorId: data.authorId,
            authorUsername: data.authorUsername || 'User',
            authorPhotoURL: data.authorPhotoURL || '',
            mediaURL: data.mediaURL,
            mediaType: data.mediaType || 'image',
            caption: data.caption || '',
            likesCount: typeof data.likesCount === 'number' ? data.likesCount : 0,
            viewsCount: typeof data.viewsCount === 'number' ? data.viewsCount : 0,
            tapsForwardCount: typeof data.tapsForwardCount === 'number' ? data.tapsForwardCount : 0,
            tapsBackCount: typeof data.tapsBackCount === 'number' ? data.tapsBackCount : 0,
            repliesCount: typeof data.repliesCount === 'number' ? data.repliesCount : 0,
            reactionCounts: data.reactionCounts || {},
            poll: data.poll,
            music: data.music,
            template: data.template,
            collage: data.collage,
            audience: data.audience,
            closeFriendIds: Array.isArray(data.closeFriendIds) ? data.closeFriendIds : undefined,
            allowReplies: typeof data.allowReplies === 'boolean' ? data.allowReplies : true,
            allowComments: typeof data.allowComments === 'boolean' ? data.allowComments : undefined,
            aiLabel: Boolean(data.aiLabel),
            filterId: data.filterId,
            textOverlays: Array.isArray(data.textOverlays) ? data.textOverlays : undefined,
            stickers: Array.isArray(data.stickers) ? data.stickers : undefined,
            mentions: Array.isArray(data.mentions) ? data.mentions : undefined,
            partnership: data.partnership,
            promoted: data.promoted,
            createdAt: data.createdAt,
            expiresAt: data.expiresAt,
          });
        });
        setActiveStories(valid);
      },
      (err) => {
        console.warn('Notifications stories listener notice:', err);
      }
    );

    return unsubscribe;
  }, [user, isFirebaseAuthenticated, blockedUsers]);

  const activeStoriesByAuthor = useMemo(() => {
    return activeStories.reduce<Record<string, StoryItem[]>>((acc, story) => {
      if (!acc[story.authorId]) acc[story.authorId] = [];
      acc[story.authorId].push(story);
      return acc;
    }, {});
  }, [activeStories]);

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

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'following') return n.type === 'follow';
    if (activeFilter === 'comments') return n.type === 'comment';
    if (activeFilter === 'likes') return n.type === 'like';
    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filters: { key: NotifFilter; labelAr: string; labelEn: string }[] = [
    { key: 'all', labelAr: 'الكل', labelEn: 'All' },
    { key: 'following', labelAr: 'المتابعات', labelEn: 'Following' },
    { key: 'comments', labelAr: 'التعليقات', labelEn: 'Comments' },
    { key: 'likes', labelAr: 'الإعجابات', labelEn: 'Likes' },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm max-w-2xl mx-auto">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            {language === 'ar' ? 'الإشعارات' : 'Notifications'}
          </h2>
          {unreadCount > 0 && (
            <span className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-full bg-rose-500 text-white shadow-sm">
              {unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
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

          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            aria-label={language === 'ar' ? 'إعدادات الإشعارات' : 'Notification Settings'}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title={language === 'ar' ? 'إعدادات الإشعارات' : 'Notification Settings'}
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Instagram Filter Pills Bar */}
      <div className="flex items-center gap-2 p-3 border-b border-slate-100 dark:border-slate-800 overflow-x-auto no-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
        {filters.map((f) => {
          const isActive = activeFilter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setActiveFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                isActive
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {language === 'ar' ? f.labelAr : f.labelEn}
            </button>
          );
        })}
      </div>

      {/* Notifications List */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[calc(100dvh-15.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] overflow-y-auto no-scrollbar">
        {filteredNotifications.length === 0 ? (
          <div className="p-20 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center mx-auto">
              <Bell size={28} />
            </div>
            <p className="text-slate-800 dark:text-slate-200 font-bold text-sm">
              {language === 'ar' ? 'لا توجد إشعارات جديدة' : 'No notifications found'}
            </p>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              {language === 'ar'
                ? 'ستظهر هنا التفاعلات، الإعجابات، التعليقات ومتابعات الأصدقاء فور حدوثها.'
                : 'Likes, comments, follows and interactions will show up here.'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            if (notif.type === 'story_expiring') {
              const matchedActiveStory = notif.storyId
                ? activeStories.find((s) => s.id === notif.storyId)
                : undefined;
              const expMs = notif.expiresAt ? new Date(notif.expiresAt).getTime() : NaN;
              const remainingMs = !Number.isNaN(expMs) ? expMs - Date.now() : 0;
              const remHours = Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60)));
              const remMinutes = Math.max(0, Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60)));
              const isStillLive = remainingMs > 0;
              const isBusy = processingStoryNotifId === notif.id;

              return (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (!notif.read) markAsRead(notif.id);
                  }}
                  className={`w-full text-start flex items-start gap-3.5 p-4 transition-colors ${
                    notif.read
                      ? 'bg-white dark:bg-slate-900 opacity-95'
                      : 'bg-amber-50/40 dark:bg-amber-950/15'
                  }`}
                >
                  {/* Story Thumbnail Preview */}
                  <button
                    type="button"
                    disabled={!matchedActiveStory}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!notif.read) markAsRead(notif.id);
                      if (matchedActiveStory) {
                        setViewingStoryGroup({
                          authorId: matchedActiveStory.authorId,
                          authorUsername: matchedActiveStory.authorUsername,
                          authorPhotoURL: matchedActiveStory.authorPhotoURL || '',
                          stories: [matchedActiveStory],
                        });
                      }
                    }}
                    className={`relative w-12 h-16 rounded-xl overflow-hidden bg-slate-900 border-2 shrink-0 shadow-sm ${
                      notif.actionTaken === 'kept'
                        ? 'border-emerald-500'
                        : notif.actionTaken === 'deleted'
                        ? 'border-slate-300 dark:border-slate-700 opacity-60'
                        : 'border-amber-400'
                    } ${matchedActiveStory ? 'cursor-pointer hover:scale-105 transition-transform' : 'cursor-default'}`}
                    title={
                      matchedActiveStory
                        ? language === 'ar'
                          ? 'معاينة القصة'
                          : 'Preview story'
                        : undefined
                    }
                  >
                    {notif.storyMediaURL ? (
                      notif.storyMediaType === 'video' ? (
                        <>
                          <video
                            src={notif.storyMediaURL}
                            muted
                            playsInline
                            preload="metadata"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/25 flex items-center justify-center text-white">
                            <Play size={12} fill="currentColor" />
                          </div>
                        </>
                      ) : (
                        <img
                          src={notif.storyMediaURL}
                          alt="Story"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-amber-400">
                        <Clock size={18} />
                      </div>
                    )}
                    <span className="absolute -bottom-0.5 -end-0.5 w-5 h-5 rounded-full bg-amber-500 text-white border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-sm">
                      <Clock size={10} />
                    </span>
                  </button>

                  {/* Body + Keep / Delete Actions */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                            <BellOff size={10} className="text-amber-500" />
                            <span>{language === 'ar' ? 'إشعار صامت' : 'Silent'}</span>
                          </span>
                          {!notif.actionTaken && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold tabular-nums">
                              <Clock size={10} />
                              <span>
                                {isStillLive
                                  ? language === 'ar'
                                    ? remHours > 0
                                      ? `متبقي ${remHours}س ${remMinutes}د`
                                      : `متبقي ${remMinutes}د`
                                    : remHours > 0
                                    ? `${remHours}h ${remMinutes}m left`
                                    : `${remMinutes}m left`
                                  : language === 'ar'
                                  ? 'قربت على الأرشفة'
                                  : 'Moving to archive'}
                              </span>
                            </span>
                          )}
                        </div>

                        <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug pt-0.5">
                          {language === 'ar'
                            ? 'قصتك النشطة على وشك الانتقال إلى الأرشيف خلال ساعتين.'
                            : 'Your live story is about to move to the archive in under 2 hours.'}
                        </p>

                        {notif.text && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                            “{notif.text}”
                          </p>
                        )}
                      </div>

                      {!notif.read && (
                        <div className="w-2.5 h-2.5 bg-amber-500 rounded-full shrink-0 mt-1 shadow-sm" />
                      )}
                    </div>

                    {/* Action Buttons or Handled Confirmation */}
                    {notif.actionTaken === 'kept' ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                        <CheckCircle2 size={13} />
                        <span>
                          {language === 'ar'
                            ? 'تم الإبقاء على القصة نشطة (+24 ساعة)'
                            : 'Kept live (+24 hours)'}
                        </span>
                      </div>
                    ) : notif.actionTaken === 'deleted' ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold">
                        <Trash2 size={13} className="text-rose-500" />
                        <span>
                          {language === 'ar' ? 'تم حذف القصة' : 'Story deleted'}
                        </span>
                      </div>
                    ) : (
                      <div
                        className="flex flex-wrap items-center gap-2 pt-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={async () => {
                            if (!user || isBusy) return;
                            setProcessingStoryNotifId(notif.id);
                            try {
                              await keepExpiringStory(
                                user.uid,
                                notif.id,
                                notif.storyId,
                                notif.expiresAt
                              );
                            } finally {
                              setProcessingStoryNotifId(null);
                            }
                          }}
                          className="min-h-[34px] px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                        >
                          {isBusy ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={13} />
                          )}
                          <span>{language === 'ar' ? 'الإبقاء عليها' : 'Keep it'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={async () => {
                            if (!user || isBusy) return;
                            setProcessingStoryNotifId(notif.id);
                            try {
                              await deleteExpiringStoryNow(user.uid, notif.id, notif.storyId);
                            } finally {
                              setProcessingStoryNotifId(null);
                            }
                          }}
                          className="min-h-[34px] px-3.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                        >
                          <Trash2 size={13} />
                          <span>{language === 'ar' ? 'حذف الآن' : 'Delete now'}</span>
                        </button>
                      </div>
                    )}

                    <p className="text-[11px] text-slate-400 font-medium">
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
                </div>
              );
            }

            const senderStories = notif.senderId ? (activeStoriesByAuthor[notif.senderId] || []) : [];
            const hasActiveStory = senderStories.length > 0;

            return (
              <div
                key={notif.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (!notif.read) markAsRead(notif.id);
                  if (notif.postId && onOpenPost) {
                    onOpenPost(notif.postId);
                  } else if (notif.senderId) {
                    onOpenProfile?.(notif.senderId);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    if (!notif.read) markAsRead(notif.id);
                    if (notif.postId && onOpenPost) {
                      onOpenPost(notif.postId);
                    } else if (notif.senderId) {
                      onOpenProfile?.(notif.senderId);
                    }
                  }
                }}
                className={`w-full text-start flex items-center gap-3.5 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer ${
                  notif.read ? 'opacity-90' : 'bg-slate-50/80 dark:bg-slate-800/40'
                }`}
              >
                {/* Avatar: Only show gradient Story ring if the sender actually has active stories */}
                {hasActiveStory ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!notif.read) markAsRead(notif.id);
                      setViewingStoryGroup({
                        authorId: notif.senderId,
                        authorUsername: notif.senderUsername || 'User',
                        authorPhotoURL: notif.senderPhotoURL || '',
                        stories: senderStories,
                      });
                    }}
                    title={language === 'ar' ? 'عرض القصة النشطة' : 'View active story'}
                    aria-label={language === 'ar' ? `عرض قصة ${notif.senderUsername}` : `View ${notif.senderUsername}'s story`}
                    className={`w-12 h-12 rounded-full overflow-hidden p-[2.5px] shrink-0 shadow-sm hover:scale-105 active:scale-95 transition-transform ${
                      senderStories.some((s) => s.audience === 'close_friends')
                        ? 'bg-gradient-to-tr from-emerald-400 via-green-500 to-teal-500'
                        : 'bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600'
                    }`}
                  >
                    <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-slate-900 border-2 border-white dark:border-slate-900">
                      <UserAvatar src={notif.senderPhotoURL} username={notif.senderUsername} iconSize={18} />
                    </div>
                  </button>
                ) : (
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0">
                    <UserAvatar src={notif.senderPhotoURL} username={notif.senderUsername} iconSize={18} />
                  </div>
                )}

                {/* Message Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-slate-900 dark:text-slate-100 leading-snug">
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
                      return language === 'ar' ? 'أعجب بمنشورك أو ريلز الخاص بك.' : 'liked your post or reel.';
                    })()}
                    {notif.type === 'follow' && (language === 'ar' ? 'بدأ بمتابعتك.' : 'started following you.')}
                    {notif.type === 'comment' && (language === 'ar' ? `علّق: ${notif.text}` : `commented: ${notif.text}`)}
                    {notif.type === 'message' && (() => {
                      const storyReply = isStoryReplyNotification(notif);
                      if (storyReply.isStoryReply) {
                        return language === 'ar'
                          ? `رد على قصتك: "${storyReply.replyBody}"`
                          : `replied to your story: "${storyReply.replyBody}"`;
                      }
                      return language === 'ar' ? `أرسل لك رسالة: ${notif.text}` : `sent you a message: ${notif.text}`;
                    })()}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
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

                {/* Action Button or Thumbnail */}
                <div className="shrink-0 flex items-center gap-2">
                  {notif.type === 'follow' && notif.senderId && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <FollowButton targetUserId={notif.senderId} variant="primary" />
                    </div>
                  )}
                  {notif.type === 'like' && (() => {
                    if (typeof notif.text === 'string' && (notif.text.startsWith('story_reaction:') || notif.text.startsWith('post_reaction:'))) {
                      const raw = notif.text.split(':')[1];
                      if (raw && raw !== 'heart' && isValidReactionType(raw)) {
                        return <span className="text-xl leading-none">{REACTION_MAP[raw].emoji}</span>;
                      }
                    }
                    return <Heart size={18} className="text-rose-500 fill-rose-500" />;
                  })()}
                  {notif.type === 'message' && (
                    isStoryReplyNotification(notif).isStoryReply ? (
                      <Sparkles size={18} className="text-purple-500" />
                    ) : (
                      <MessageSquare size={18} className="text-emerald-500" />
                    )
                  )}
                  {notif.type === 'comment' && <MessageSquare size={18} className="text-slate-400" />}

                  {!notif.read && (
                    <div className="w-2.5 h-2.5 bg-rose-500 rounded-full shrink-0 shadow-sm" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Story Viewer Modal when clicking an avatar with an active story */}
      {viewingStoryGroup && (
        <StoryViewer
          storyGroups={[viewingStoryGroup]}
          initialGroupIndex={0}
          onClose={() => setViewingStoryGroup(null)}
        />
      )}

      {/* Notification Settings Modal */}
      {showSettingsModal && (
        <div
          className="fixed inset-0 z-[150] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[85dvh] pb-safe sm:pb-0 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
              <div className="flex items-center gap-2">
                <Sliders size={18} className="text-purple-600" />
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  {language === 'ar' ? 'إعدادات الإشعارات' : 'Notification Settings'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 no-scrollbar text-xs">
              <div className="space-y-4">
                <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                  {language === 'ar' ? 'التفاعلات معك' : 'Interactions with you'}
                </p>

                {[
                  { key: 'likes', labelAr: 'تسجيلات الإعجاب والتفاعلات', labelEn: 'Likes and reactions' },
                  { key: 'comments', labelAr: 'التعليقات والردود', labelEn: 'Comments and replies' },
                  { key: 'follows', labelAr: 'المتابعون والطلبات', labelEn: 'Followers and requests' },
                  { key: 'messages', labelAr: 'الرسائل والردود على القصص', labelEn: 'Messages and story replies' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between py-1">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {language === 'ar' ? item.labelAr : item.labelEn}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(notifPrefs as any)[item.key]}
                        onChange={(e) => setNotifPrefs({ ...notifPrefs, [item.key]: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-4">
                <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                  {language === 'ar' ? 'تحديثات تهمك' : 'Updates for you'}
                </p>

                <div className="flex items-center justify-between py-1">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {language === 'ar' ? 'محتوى قد يعجبك ومنشورات مقترحة' : 'Suggested content & posts'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked={true}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors shadow-sm"
                >
                  {language === 'ar' ? 'تم الحفظ' : 'Done'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
