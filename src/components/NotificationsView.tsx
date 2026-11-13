import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Heart, UserPlus, MessageSquare, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function NotificationsView() {
  const { user, blockedUsers, language } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
          .filter((n: any) => !blockedUsers.includes(n.senderId)); // Filter blocked
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

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800">
        <h2 className="text-xl font-bold">
          {language === 'ar' ? 'الإعجابات والإشعارات' : 'Notifications'}
        </h2>
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
            <div 
              key={notif.id} 
              onMouseEnter={() => !notif.read && markAsRead(notif.id)}
              onClick={() => !notif.read && markAsRead(notif.id)}
              className={`flex items-center gap-4 p-4 transition-colors ${notif.read ? 'opacity-80' : 'bg-slate-50/50 dark:bg-slate-800/30'}`}
            >
              <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-200 shrink-0">
                <img src={notif.senderPhotoURL || '/placeholder-avatar.jpg'} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-bold">{notif.senderUsername}</span>{' '}
                  {notif.type === 'like' && (
                    notif.text === 'liked your comment'
                      ? (language === 'ar' ? 'أعجب بتعليقك.' : 'liked your comment.')
                      : (language === 'ar' ? 'أعجب بمنشورك.' : 'liked your post.')
                  )}
                  {notif.type === 'follow' && (language === 'ar' ? 'بدأ بمتابعتك.' : 'started following you.')}
                  {notif.type === 'comment' && (language === 'ar' ? `علّق: ${notif.text}` : `commented: ${notif.text}`)}
                  {notif.type === 'message' && (language === 'ar' ? `أرسل لك رسالة: ${notif.text}` : `sent you a message: ${notif.text}`)}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {notif.createdAt?.toDate ? formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true, locale: language === 'ar' ? ar : undefined }) : (language === 'ar' ? 'الآن' : 'just now')}
                </p>
              </div>

              <div className="shrink-0">
                {notif.type === 'like' && <Heart size={16} className="text-red-500 fill-red-500" />}
                {notif.type === 'follow' && <UserPlus size={16} className="text-blue-500" />}
                {notif.type === 'message' && <MessageSquare size={16} className="text-emerald-500" />}
                {notif.type === 'comment' && <MessageSquare size={16} className="text-slate-400" />}
              </div>
              
              {!notif.read && (
                <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
