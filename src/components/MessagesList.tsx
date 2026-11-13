import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Search, MessageSquare, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function MessagesList({ onSelectConversation }: { onSelectConversation: (id: string) => void }) {
  const { user, blockedUsers, language, t } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const convs = await Promise.all(
          snapshot.docs.map(async (convDoc) => {
            const data = convDoc.data();
            const otherId = data.participantIds?.find((id: string) => id !== user.uid);
            if (!otherId || blockedUsers.includes(otherId)) return null;

            const demoCreators: Record<string, { username: string; photoURL: string }> = {
              creator_sophia: { username: 'sophia.travels', photoURL: '/src/assets/images/avatar_woman_1794501562592.jpg' },
              creator_alex: { username: 'alex.roasts', photoURL: '/src/assets/images/avatar_man_1794501560820.jpg' },
              creator_leo: { username: 'leo_visuals', photoURL: '/src/assets/images/city_night_1794501562076.jpg' },
              creator_elena: { username: 'elena.lifestyle', photoURL: '/src/assets/images/beach_lifestyle_1794501561335.jpg' },
            };
            const fallbackUser = demoCreators[otherId] || {
              username: language === 'ar' ? 'مستخدم' : 'User',
              photoURL: '/placeholder-avatar.jpg',
            };

            try {
              const userSnap = await getDoc(doc(db, 'users', otherId));
              return {
                id: convDoc.id,
                ...data,
                otherUser: userSnap.exists() ? userSnap.data() : { uid: otherId, ...fallbackUser },
              };
            } catch {
              return {
                id: convDoc.id,
                ...data,
                otherUser: { uid: otherId, ...fallbackUser },
              };
            }
          })
        );
        const sortedConvs = convs
          .filter((c): c is any => c !== null)
          .sort((a, b) => {
            const ta = a.updatedAt?.toMillis?.() ?? a.lastMessageAt?.toMillis?.() ?? 0;
            const tb = b.updatedAt?.toMillis?.() ?? b.lastMessageAt?.toMillis?.() ?? 0;
            return tb - ta;
          });
        setConversations(sortedConvs);
        setLoading(false);
      },
      (error) => {
        console.warn('Conversations listener error:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user, blockedUsers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  const filteredConversations = conversations.filter((conv) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      conv.otherUser?.username?.toLowerCase().includes(term) ||
      conv.otherUser?.fullName?.toLowerCase().includes(term) ||
      conv.lastMessage?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800">
        <h2 className="text-xl font-bold mb-4">{t('messages')}</h2>
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={language === 'ar' ? 'ابحث في الرسائل...' : 'Search messages...'}
            className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl py-2 ps-10 pe-4 text-sm focus:outline-none"
          />
          <Search className="absolute start-3 top-2.5 text-slate-400" size={16} />
        </div>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[calc(100vh-250px)] overflow-y-auto no-scrollbar">
        {filteredConversations.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare size={32} className="text-slate-400" />
            </div>
            <p className="text-slate-500 font-medium">
              {language === 'ar' ? 'لا توجد رسائل بعد' : 'No messages yet'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {language === 'ar'
                ? 'ابدأ محادثة من الملف الشخصي لأي مستخدم أو من المنشورات.'
                : 'Start a conversation from a user profile or post.'}
            </p>
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <button
              key={conv.id}
              type="button"
              onClick={() => onSelectConversation(conv.id)}
              className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-start"
            >
              <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-200 shrink-0">
                <img
                  src={conv.otherUser?.photoURL || '/placeholder-avatar.jpg'}
                  alt={conv.otherUser?.username || ''}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1 gap-2">
                  <h4 className="font-bold text-sm truncate">{conv.otherUser?.username}</h4>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">
                    {conv.lastMessageAt?.toDate
                      ? formatDistanceToNow(conv.lastMessageAt.toDate(), {
                          addSuffix: true,
                          locale: language === 'ar' ? ar : undefined,
                        })
                      : ''}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate">
                  {conv.lastMessage || (language === 'ar' ? 'محادثة جديدة' : 'New conversation')}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
