import { useState } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  serverTimestamp,
  increment,
  setDoc,
  where,
  getDocs,
  runTransaction,
  arrayUnion
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, shouldThrow = false) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  if (shouldThrow) {
    throw new Error(JSON.stringify(errInfo));
  }
}

export function useFirestore() {
  const [loading, setLoading] = useState(false);

  const createPost = async (author: any, mediaURL: string, mediaType: 'image' | 'video', caption: string) => {
    setLoading(true);
    try {
      const cleanCaption = caption.slice(0, 2200);
      // Simple tag extraction from caption
      const tags = Array.from(
        new Set(cleanCaption.match(/#[a-z0-9_]+/gi)?.map(t => t.slice(1).toLowerCase()) || [])
      ).slice(0, 30);

      await addDoc(collection(db, 'posts'), {
        authorId: author.uid,
        authorUsername: author.username,
        authorPhotoURL: author.photoURL,
        mediaURL: mediaURL.slice(0, 1000),
        mediaType,
        caption: cleanCaption,
        tags,
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'posts');
    } finally {
      setLoading(false);
    }
  };

  const sendNotification = async (recipientId: string, sender: any, type: 'like' | 'follow' | 'message' | 'comment', postId?: string, text?: string) => {
    if (recipientId === sender.uid) return; // Don't notify self
    try {
      await addDoc(collection(db, 'users', recipientId, 'notifications'), {
        recipientId,
        senderId: sender.uid,
        senderUsername: sender.username,
        senderPhotoURL: sender.photoURL,
        type,
        postId: postId || null,
        text: text || '',
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Notification Error:', error);
    }
  };

  const likePost = async (postId: string, userId: string, postAuthorId: string, sender: any, postTags: string[] = []) => {
    try {
      const likeRef = doc(db, 'posts', postId, 'likes', userId);
      await setDoc(likeRef, {
        postId,
        userId,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'posts', postId), {
        likesCount: increment(1),
      });

      // Update user interests
      if (postTags.length > 0) {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentInterests = userSnap.data().interests || {};
          postTags.forEach(tag => {
            currentInterests[tag] = (currentInterests[tag] || 0) + 1;
          });
          await updateDoc(userRef, { interests: currentInterests });
        }
      }

      await sendNotification(postAuthorId, sender, 'like', postId);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `posts/${postId}/likes`);
    }
  };

  const unlikePost = async (postId: string, userId: string) => {
    try {
      await deleteDoc(doc(db, 'posts', postId, 'likes', userId));
      await updateDoc(doc(db, 'posts', postId), {
        likesCount: increment(-1),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `posts/${postId}/likes`);
    }
  };

  const addComment = async (postId: string, userId: string, username: string, photoURL: string, text: string, postAuthorId: string, sender: any) => {
    try {
      await addDoc(collection(db, 'posts', postId, 'comments'), {
        postId,
        userId,
        username,
        userPhotoURL: photoURL,
        text,
        likesCount: 0,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'posts', postId), {
        commentsCount: increment(1),
      });
      await sendNotification(postAuthorId, sender, 'comment', postId, text);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `posts/${postId}/comments`);
    }
  };

  const likeComment = async (postId: string, commentId: string, userId: string, commentAuthorId: string, sender: any) => {
    try {
      const likeRef = doc(db, 'posts', postId, 'comments', commentId, 'likes', userId);
      const commentRef = doc(db, 'posts', postId, 'comments', commentId);

      const didIncrement = await runTransaction(db, async (transaction) => {
        const likeSnap = await transaction.get(likeRef);
        const commentSnap = await transaction.get(commentRef);
        if (likeSnap.exists()) {
          return false;
        }
        const currentCount = commentSnap.exists() ? (commentSnap.data().likesCount || 0) : 0;
        transaction.set(likeRef, {
          postId,
          commentId,
          userId,
          createdAt: serverTimestamp(),
        });
        transaction.update(commentRef, {
          likesCount: currentCount + 1,
        });
        return true;
      });

      if (didIncrement) {
        await sendNotification(commentAuthorId, sender, 'like', postId, 'liked your comment');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `posts/${postId}/comments/${commentId}/likes/${userId}`);
      throw error;
    }
  };

  const unlikeComment = async (postId: string, commentId: string, userId: string) => {
    try {
      const likeRef = doc(db, 'posts', postId, 'comments', commentId, 'likes', userId);
      const commentRef = doc(db, 'posts', postId, 'comments', commentId);

      await runTransaction(db, async (transaction) => {
        const likeSnap = await transaction.get(likeRef);
        const commentSnap = await transaction.get(commentRef);
        if (!likeSnap.exists()) {
          return;
        }
        const currentCount = commentSnap.exists() ? (commentSnap.data().likesCount || 0) : 0;
        transaction.delete(likeRef);
        transaction.update(commentRef, {
          likesCount: Math.max(0, currentCount - 1),
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `posts/${postId}/comments/${commentId}/likes/${userId}`);
      throw error;
    }
  };

  const followUser = async (currentUserId: string, targetUserId: string, sender: any) => {
    try {
      // Add to following subcollection of current user
      await setDoc(doc(db, 'users', currentUserId, 'following', targetUserId), {
        followerId: currentUserId,
        followingId: targetUserId,
        createdAt: serverTimestamp(),
      });
      // Add to followers subcollection of target user
      await setDoc(doc(db, 'users', targetUserId, 'followers', currentUserId), {
        followerId: currentUserId,
        followingId: targetUserId,
        createdAt: serverTimestamp(),
      });
      await sendNotification(targetUserId, sender, 'follow');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${currentUserId}/following/${targetUserId}`);
    }
  };

  const unfollowUser = async (currentUserId: string, targetUserId: string) => {
    try {
      await deleteDoc(doc(db, 'users', currentUserId, 'following', targetUserId));
      await deleteDoc(doc(db, 'users', targetUserId, 'followers', currentUserId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${currentUserId}/following/${targetUserId}`);
    }
  };

  const getOrCreateConversation = async (userId1: string, userId2: string) => {
    if (!userId1 || !userId2 || userId1 === userId2) return null;
    const participantIds = [userId1, userId2].sort();
    const conversationId = participantIds.join('_');
    const convRef = doc(db, 'conversations', conversationId);

    let convExists = false;
    try {
      const convSnap = await getDoc(convRef);
      convExists = convSnap.exists();
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `conversations/${conversationId}`);
      return null;
    }

    if (!convExists) {
      try {
        await setDoc(convRef, {
          participantIds,
          updatedAt: serverTimestamp(),
          lastMessage: '',
          lastMessageAt: null
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `conversations/${conversationId}`);
        return null;
      }
    }

    return conversationId;
  };

  const sendMessage = async (conversationId: string, senderId: string, text: string, recipientId: string, sender: any, mediaURL?: string, mediaType?: 'image' | 'video') => {
    try {
      const cleanText = text.slice(0, 4000);
      const messageData: any = {
        conversationId,
        senderId,
        text: cleanText,
        createdAt: serverTimestamp(),
      };
      if (mediaURL) {
        messageData.mediaURL = mediaURL.slice(0, 900000);
        messageData.mediaType = mediaType;
      }

      const lastMessagePreview = (cleanText || (mediaType === 'image' ? 'Sent a photo' : 'Sent a video')).slice(0, 2000);

      await addDoc(collection(db, 'conversations', conversationId, 'messages'), messageData);
      await updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: lastMessagePreview,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await sendNotification(recipientId, sender, 'message', undefined, cleanText);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `conversations/${conversationId}/messages`);
    }
  };

  const blockUser = async (currentUserId: string, targetUserId: string) => {
    try {
      await setDoc(doc(db, 'users', currentUserId, 'blockedUsers', targetUserId), {
        blockerId: currentUserId,
        blockedId: targetUserId,
        createdAt: serverTimestamp(),
      });
      // Also unfollow automatically
      await deleteDoc(doc(db, 'users', currentUserId, 'following', targetUserId));
      await deleteDoc(doc(db, 'users', targetUserId, 'followers', currentUserId));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${currentUserId}/blockedUsers/${targetUserId}`);
    }
  };

  const unblockUser = async (currentUserId: string, targetUserId: string) => {
    try {
      await deleteDoc(doc(db, 'users', currentUserId, 'blockedUsers', targetUserId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${currentUserId}/blockedUsers/${targetUserId}`);
    }
  };

  const createStory = async (author: any, mediaURL: string, mediaType: 'image' | 'video' = 'image', caption: string = '', poll?: any) => {
    setLoading(true);
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours later

      const storyData: any = {
        authorId: author.uid,
        authorUsername: author.username,
        authorPhotoURL: author.photoURL || '',
        mediaURL,
        mediaType,
        caption,
        createdAt: serverTimestamp(),
        expiresAt: expiresAt.toISOString(),
      };

      if (poll && poll.question && poll.optionA && poll.optionB) {
        storyData.poll = {
          question: poll.question,
          optionA: poll.optionA,
          optionB: poll.optionB,
          votesA: 0,
          votesB: 0,
          voters: {}
        };
      }

      const docRef = await addDoc(collection(db, 'stories'), storyData);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'stories');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const voteStoryPoll = async (storyId: string, userId: string, choice: 'A' | 'B', currentPoll: any) => {
    try {
      const voters = currentPoll.voters || {};
      const previousChoice = voters[userId];

      if (previousChoice === choice) return; // Already voted this option

      let votesA = currentPoll.votesA || 0;
      let votesB = currentPoll.votesB || 0;

      if (previousChoice === 'A') votesA = Math.max(0, votesA - 1);
      if (previousChoice === 'B') votesB = Math.max(0, votesB - 1);

      if (choice === 'A') votesA += 1;
      if (choice === 'B') votesB += 1;

      voters[userId] = choice;

      const storyRef = doc(db, 'stories', storyId);
      await updateDoc(storyRef, {
        poll: {
          ...currentPoll,
          votesA,
          votesB,
          voters,
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stories/${storyId}`);
    }
  };

  const createHighlightAlbum = async (userId: string, title: string, coverImageURL: string, storyIds: string[] = []) => {
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'users', userId, 'highlights'), {
        userId,
        title,
        coverImageURL,
        storyIds,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${userId}/highlights`);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateHighlightAlbum = async (userId: string, albumId: string, data: any) => {
    try {
      await updateDoc(doc(db, 'users', userId, 'highlights', albumId), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/highlights/${albumId}`);
    }
  };

  const deleteHighlightAlbum = async (userId: string, albumId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId, 'highlights', albumId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}/highlights/${albumId}`);
    }
  };

  const deleteStory = async (storyId: string) => {
    try {
      await deleteDoc(doc(db, 'stories', storyId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `stories/${storyId}`);
    }
  };

  const archiveStory = async (storyId: string) => {
    try {
      await updateDoc(doc(db, 'stories', storyId), {
        expiresAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stories/${storyId}`, true);
    }
  };

  const addStoryToHighlightAlbum = async (userId: string, albumId: string, storyId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId, 'highlights', albumId), {
        storyIds: arrayUnion(storyId),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/highlights/${albumId}`, true);
    }
  };

  const updateUserProfile = async (
    userId: string,
    updates: { username: string; fullName: string; bio: string; photoURL: string }
  ) => {
    setLoading(true);
    try {
      const cleanUsername = updates.username.trim().slice(0, 30);
      if (cleanUsername.length < 3) {
        throw new Error('Username must be at least 3 characters');
      }
      await updateDoc(doc(db, 'users', userId), {
        username: cleanUsername,
        fullName: updates.fullName.trim().slice(0, 80),
        bio: updates.bio.trim().slice(0, 220),
        photoURL: updates.photoURL.trim().slice(0, 900000),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`, true);
    } finally {
      setLoading(false);
    }
  };

  return { 
    createPost, likePost, unlikePost, addComment, likeComment, unlikeComment, 
    followUser, unfollowUser, getOrCreateConversation, sendMessage, blockUser, 
    unblockUser, createStory, voteStoryPoll, deleteStory, archiveStory,
    createHighlightAlbum, updateHighlightAlbum, deleteHighlightAlbum,
    addStoryToHighlightAlbum, updateUserProfile, loading 
  };
}
