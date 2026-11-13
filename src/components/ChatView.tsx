import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useFirestore } from '../hooks/useFirestore';
import { ArrowLeft, Image as ImageIcon, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function ChatView({ conversationId, onBack }: { conversationId: string, onBack: () => void }) {
  const { user, profile, language } = useAuth();
  const { sendMessage } = useFirestore();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [otherUser, setOtherUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sendingMedia, setSendingMedia] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!conversationId || !user) return;

    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (error) => {
        console.warn('Chat messages listener error:', error);
        setLoading(false);
      }
    );

    const fetchOtherUser = async () => {
      try {
        const convSnap = await getDoc(doc(db, 'conversations', conversationId));
        if (convSnap.exists()) {
          const participantIds = convSnap.data().participantIds || [];
          const otherId = participantIds.find((id: string) => id !== user.uid);
          if (otherId) {
            const userSnap = await getDoc(doc(db, 'users', otherId));
            if (userSnap.exists()) {
              setOtherUser(userSnap.data());
            } else {
              const demoCreators: Record<string, { username: string; photoURL: string }> = {
                creator_sophia: { username: 'sophia.travels', photoURL: '/src/assets/images/avatar_woman_1794501562592.jpg' },
                creator_alex: { username: 'alex.roasts', photoURL: '/src/assets/images/avatar_man_1794501560820.jpg' },
                creator_leo: { username: 'leo_visuals', photoURL: '/src/assets/images/city_night_1794501562076.jpg' },
                creator_elena: { username: 'elena.lifestyle', photoURL: '/src/assets/images/beach_lifestyle_1794501561335.jpg' },
              };
              const fallback = demoCreators[otherId];
              setOtherUser({
                uid: otherId,
                username: fallback?.username || (language === 'ar' ? 'مستخدم' : 'User'),
                photoURL: fallback?.photoURL || '/placeholder-avatar.jpg',
              });
            }
          }
        }
      } catch (err) {
        console.warn('Error loading conversation participant:', err);
      }
    };
    fetchOtherUser();

    return unsubscribe;
  }, [conversationId, user, language]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user || !otherUser || !profile) return;
    const text = inputText;
    setInputText('');
    await sendMessage(conversationId, user.uid, text, otherUser.uid, profile);
  };

  const handleSendImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user || !otherUser || !profile || !file.type.startsWith('image/')) return;

    setSendingMedia(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = new Image();
          img.onload = () => {
            const maxDim = 720;
            let { width, height } = img;
            if (width > maxDim || height > maxDim) {
              const ratio = Math.min(maxDim / width, maxDim / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Canvas error'));
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.78));
          };
          img.onerror = () => reject(new Error('Invalid image'));
          img.src = ev.target?.result as string;
        };
        reader.onerror = () => reject(new Error('Read failed'));
        reader.readAsDataURL(file);
      });

      await sendMessage(conversationId, user.uid, '', otherUser.uid, profile, dataUrl, 'image');
    } catch (err) {
      console.error('Failed to send chat image:', err);
    } finally {
      setSendingMedia(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center py-20">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-100px)] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={onBack}
          aria-label={language === 'ar' ? 'رجوع' : 'Back'}
          className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors"
        >
          <ArrowLeft size={20} className={language === 'ar' ? 'rotate-180' : ''} />
        </button>
        <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 shrink-0">
          <img
            src={otherUser?.photoURL || '/placeholder-avatar.jpg'}
            alt={otherUser?.username || ''}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div>
          <h3 className="font-bold text-sm">{otherUser?.username}</h3>
          <p className="text-[10px] text-emerald-500 font-medium">
            {language === 'ar' ? 'نشط الآن' : 'Active Now'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {messages.map((msg) => {
          const isOwn = msg.senderId === user?.uid;
          return (
            <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  isOwn
                    ? 'bg-slate-900 text-white rounded-ee-none'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-es-none'
                }`}
              >
                {msg.mediaURL && (
                  <img
                    src={msg.mediaURL}
                    alt=""
                    className="rounded-xl mb-1.5 max-h-60 object-cover"
                    referrerPolicy="no-referrer"
                  />
                )}
                {msg.text && <span>{msg.text}</span>}
                <div className={`text-[9px] mt-1 opacity-60 ${isOwn ? 'text-end' : 'text-start'}`}>
                  {msg.createdAt?.toDate
                    ? formatDistanceToNow(msg.createdAt.toDate(), {
                        addSuffix: false,
                        locale: language === 'ar' ? ar : undefined,
                      })
                    : language === 'ar'
                    ? 'الآن'
                    : 'just now'}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleSendImage}
          className="hidden"
        />
        <button
          type="button"
          disabled={sendingMedia}
          onClick={() => imageInputRef.current?.click()}
          aria-label={language === 'ar' ? 'إرسال صورة' : 'Send image'}
          title={language === 'ar' ? 'إرسال صورة' : 'Send image'}
          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors disabled:opacity-50"
        >
          {sendingMedia ? <Loader2 size={20} className="animate-spin" /> : <ImageIcon size={20} />}
        </button>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={language === 'ar' ? 'اكتب رسالة...' : 'Message...'}
          className="flex-1 bg-slate-50 dark:bg-slate-800 rounded-full px-4 py-2 text-sm focus:outline-none"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="px-3 py-2 text-blue-500 font-bold text-sm disabled:opacity-50"
        >
          {language === 'ar' ? 'إرسال' : 'Send'}
        </button>
      </form>
    </div>
  );
}
