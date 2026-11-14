import { useEffect } from 'react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export interface UseBlockedConversationListenerOptions {
  selectedConversationId: string | null;
  setSelectedConversationId: (id: string | null) => void;
  currentUserId?: string | null;
  blockedUsers: string[];
}

/**
 * Listens for user block events and automatically clears any active selectedConversationId
 * state if the blocked user is a participant, effectively removing them from the UI
 * in the direct messaging system.
 */
export function useBlockedConversationListener({
  selectedConversationId,
  setSelectedConversationId,
  currentUserId,
  blockedUsers,
}: UseBlockedConversationListenerOptions) {
  // 1. Reactive check whenever blockedUsers or selectedConversationId changes
  useEffect(() => {
    if (!selectedConversationId) return;

    // Check by canonical conversation ID format: participantA_participantB
    if (blockedUsers.length > 0) {
      const parts = selectedConversationId.split('_');
      const isParticipantBlocked = blockedUsers.some((blockedId) => parts.includes(blockedId));
      if (isParticipantBlocked) {
        setSelectedConversationId(null);
        return;
      }
    }
  }, [selectedConversationId, blockedUsers, setSelectedConversationId]);

  // 2. Real-time Firestore snapshot listener on active conversation document
  useEffect(() => {
    if (!selectedConversationId || !auth.currentUser) return;

    const convRef = doc(db, 'conversations', selectedConversationId);
    const unsubscribe = onSnapshot(
      convRef,
      (snapshot) => {
        // If the conversation document is deleted or doesn't exist (e.g. wiped upon blocking)
        if (!snapshot.exists()) {
          setSelectedConversationId(null);
          return;
        }

        const data = snapshot.data();
        const participantIds: string[] = data?.participantIds || [];

        // Check if any participant is currently in the blockedUsers list
        const containsBlockedUser = participantIds.some((pId) =>
          blockedUsers.includes(pId) && pId !== currentUserId
        );

        if (containsBlockedUser) {
          setSelectedConversationId(null);
        }
      },
      (err) => {
        console.warn('Blocked conversation listener notice:', err);
      }
    );

    return () => unsubscribe();
  }, [selectedConversationId, blockedUsers, currentUserId, setSelectedConversationId]);

  // 3. Custom event listener for instant block notifications across components
  useEffect(() => {
    const handleUserBlockedEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ blockerId?: string; blockedUserId: string }>;
      const blockedUserId = customEvent.detail?.blockedUserId;

      if (!blockedUserId || !selectedConversationId) return;

      // Check if blockedUserId is part of the active conversation
      const parts = selectedConversationId.split('_');
      if (parts.includes(blockedUserId)) {
        setSelectedConversationId(null);
        return;
      }

      if (!auth.currentUser) return;

      // Check against Firestore document asynchronously if non-canonical ID
      getDoc(doc(db, 'conversations', selectedConversationId))
        .then((snap) => {
          if (!snap.exists()) {
            setSelectedConversationId(null);
            return;
          }
          const participantIds = snap.data()?.participantIds || [];
          if (participantIds.includes(blockedUserId)) {
            setSelectedConversationId(null);
          }
        })
        .catch((err) => {
          console.warn('Error verifying blocked participant:', err);
        });
    };

    window.addEventListener('instavibe:user-blocked', handleUserBlockedEvent);
    return () => {
      window.removeEventListener('instavibe:user-blocked', handleUserBlockedEvent);
    };
  }, [selectedConversationId, setSelectedConversationId]);
}
