import { useEffect, useRef } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const MAX_TIMEOUT_MS = 2147483647;

interface TrackedStory {
  id: string;
  mediaURL: string;
  mediaType?: 'image' | 'video';
  caption?: string;
  expiresAt?: string;
}

/**
 * Monitors the authenticated user's live stories and creates a silent
 * notification 2 hours before a story is scheduled to move to the archive,
 * letting the user choose "Keep it" or "Delete now" in Notifications.
 */
export function useStoryExpiryMonitor() {
  const { user, profile, isFirebaseAuthenticated } = useAuth();
  const inFlightRef = useRef<Set<string>>(new Set());
  const sentForExpiryRef = useRef<Map<string, string>>(new Map());
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const clearScheduledTimers = () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };

    if (!user || !isFirebaseAuthenticated) {
      clearScheduledTimers();
      inFlightRef.current.clear();
      sentForExpiryRef.current.clear();
      return;
    }

    const triggerSilentExpiryNotice = async (story: TrackedStory) => {
      if (!story.id || !story.expiresAt) return;

      const lastTriggeredExpiry = sentForExpiryRef.current.get(story.id);
      if (lastTriggeredExpiry === story.expiresAt) return;
      if (inFlightRef.current.has(story.id)) return;

      const notifId = `story_expiring_${story.id}`;
      const notifRef = doc(db, 'users', user.uid, 'notifications', notifId);

      inFlightRef.current.add(story.id);
      try {
        const existingSnap = await getDoc(notifRef);
        if (existingSnap.exists()) {
          const existingData = existingSnap.data() as any;
          // Same expiration cycle already notified -> do not duplicate
          if (existingData?.expiresAt === story.expiresAt || existingData?.actionTaken === 'deleted') {
            sentForExpiryRef.current.set(story.id, story.expiresAt);
            return;
          }
          // Previous cycle was kept (+24h) and now entering final 2h again -> replace old cycle doc
          await deleteDoc(notifRef);
        }

        await setDoc(notifRef, {
          recipientId: user.uid,
          senderId: user.uid,
          senderUsername: (profile?.username || user.displayName || 'InstaVibe').slice(0, 50),
          senderPhotoURL: (profile?.photoURL || user.photoURL || '').slice(0, 900000),
          type: 'story_expiring',
          storyId: story.id,
          storyMediaURL: (story.mediaURL || '').slice(0, 900000),
          storyMediaType: story.mediaType === 'video' ? 'video' : 'image',
          expiresAt: String(story.expiresAt).slice(0, 64),
          silent: true,
          text: (story.caption || '').slice(0, 300),
          read: false,
          createdAt: serverTimestamp(),
        });

        sentForExpiryRef.current.set(story.id, story.expiresAt);
      } catch (error) {
        console.warn('Silent story expiry notification check notice:', error);
      } finally {
        inFlightRef.current.delete(story.id);
      }
    };

    const storiesQ = query(collection(db, 'stories'), where('authorId', '==', user.uid));
    let latestStories: TrackedStory[] = [];

    const evaluateStories = () => {
      clearScheduledTimers();
      const now = Date.now();

      latestStories.forEach((story) => {
        if (!story.expiresAt) return;
        const expiresMs = new Date(story.expiresAt).getTime();
        if (Number.isNaN(expiresMs)) return;

        const remainingMs = expiresMs - now;
        if (remainingMs <= 0) {
          // Already expired and moved to archive
          return;
        }

        if (remainingMs <= TWO_HOURS_MS) {
          void triggerSilentExpiryNotice(story);
        } else {
          // Schedule exact trigger for T - 2 hours
          const delayMs = Math.min(remainingMs - TWO_HOURS_MS + 250, MAX_TIMEOUT_MS);
          const timer = setTimeout(() => {
            void triggerSilentExpiryNotice(story);
          }, delayMs);
          timersRef.current.push(timer);
        }
      });
    };

    const unsubscribe = onSnapshot(
      storiesQ,
      (snapshot) => {
        latestStories = snapshot.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            mediaURL: data.mediaURL || '',
            mediaType: data.mediaType === 'video' ? 'video' : 'image',
            caption: data.caption || '',
            expiresAt: data.expiresAt,
          };
        });
        evaluateStories();
      },
      (error) => {
        console.warn('Story expiry monitor listener notice:', error);
      }
    );

    const interval = setInterval(evaluateStories, 60 * 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
      clearScheduledTimers();
    };
  }, [user?.uid, isFirebaseAuthenticated, profile?.username, profile?.photoURL]);
}
