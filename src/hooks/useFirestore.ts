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
  arrayUnion,
  arrayRemove,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { claimUsernameAndSaveProfile, detectAuthProvider } from '../lib/authService';
import { ReactionType, normalizeReaction } from '../utils/reactions';
import {
  StoryAudience,
  StoryMention,
  StoryPartnership,
  StoryPromotion,
  StorySettings,
  StorySticker,
  StoryTextOverlay,
} from '../types/story';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'inappropriate'
  | 'hate_speech'
  | 'misinformation'
  | 'impersonation'
  | 'violence'
  | 'copyright'
  | 'other';

export interface SubmitReportInput {
  targetType: 'post' | 'profile';
  targetId: string;
  targetAuthorId?: string;
  targetUsername?: string;
  targetSummary?: string;
  reason: ReportReason;
  reasonLabel?: string;
  details?: string;
  reporterUsername?: string;
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
      // Extract English and Arabic/Unicode hashtags cleanly
      const tags = Array.from(
        new Set(cleanCaption.match(/#[\p{L}\p{N}_]+/giu)?.map(t => t.slice(1).toLowerCase()) || [])
      ).slice(0, 30);

      const docRef = await addDoc(collection(db, 'posts'), {
        authorId: author.uid,
        authorUsername: author.username,
        authorPhotoURL: author.photoURL,
        mediaURL: mediaURL.slice(0, 900000),
        mediaType,
        caption: cleanCaption,
        tags,
        likesCount: 0,
        reactionCounts: {},
        commentsCount: 0,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'posts', true);
    } finally {
      setLoading(false);
    }
  };

  const deletePost = async (postId: string) => {
    try {
      await deleteDoc(doc(db, 'posts', postId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `posts/${postId}`, true);
    }
  };

  const savePost = async (userId: string, post: any) => {
    if (!userId || !post?.id) return;
    try {
      await setDoc(doc(db, 'users', userId, 'savedPosts', post.id), {
        userId,
        postId: post.id,
        authorId: post.authorId || '',
        authorUsername: (post.authorUsername || 'user').slice(0, 50),
        authorPhotoURL: (post.authorPhotoURL || '').slice(0, 900000),
        mediaURL: (post.mediaURL || '').slice(0, 900000),
        mediaType: post.mediaType === 'video' ? 'video' : 'image',
        caption: (post.caption || '').slice(0, 2200),
        likesCount: typeof post.likesCount === 'number' ? Math.max(0, post.likesCount) : 0,
        commentsCount: typeof post.commentsCount === 'number' ? Math.max(0, post.commentsCount) : 0,
        savedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}/savedPosts/${post.id}`);
    }
  };

  const unsavePost = async (userId: string, postId: string) => {
    if (!userId || !postId) return;
    try {
      await deleteDoc(doc(db, 'users', userId, 'savedPosts', postId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}/savedPosts/${postId}`);
    }
  };

  const sendNotification = async (recipientId: string, sender: any, type: 'like' | 'follow' | 'message' | 'comment', postId?: string, text?: string) => {
    if (recipientId === sender.uid) return; // Don't notify self
    try {
      await addDoc(collection(db, 'users', recipientId, 'notifications'), {
        recipientId,
        senderId: sender.uid,
        senderUsername: (sender.username || 'user').slice(0, 50),
        senderPhotoURL: (sender.photoURL || '').slice(0, 900000),
        type,
        postId: postId || null,
        text: (text || '').slice(0, 1000),
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Notification Error:', error);
    }
  };

  const reactToPost = async (
    postId: string,
    userId: string,
    postAuthorId: string,
    sender: any,
    reaction: ReactionType = 'heart',
    postTags: string[] = []
  ) => {
    try {
      const likeRef = doc(db, 'posts', postId, 'likes', userId);
      const postRef = doc(db, 'posts', postId);

      const result = await runTransaction(db, async (transaction) => {
        const [likeSnap, postSnap] = await Promise.all([
          transaction.get(likeRef),
          transaction.get(postRef),
        ]);

        const postData = postSnap.exists() ? postSnap.data() : {};
        const currentLikesCount = typeof postData.likesCount === 'number' ? postData.likesCount : 0;
        const nextCounts: Record<string, number> = { ...(postData.reactionCounts || {}) };

        if (!likeSnap.exists()) {
          nextCounts[reaction] = (nextCounts[reaction] || 0) + 1;
          transaction.set(likeRef, {
            postId,
            userId,
            username: (sender?.username || 'user').slice(0, 50),
            userPhotoURL: (sender?.photoURL || '').slice(0, 900000),
            reaction,
            createdAt: serverTimestamp(),
          });
          if (postSnap.exists()) {
            transaction.update(postRef, {
              likesCount: currentLikesCount + 1,
              reactionCounts: nextCounts,
            });
          }
          return { isNew: true, changed: true };
        }

        const prevReaction = normalizeReaction(likeSnap.data().reaction, 'heart');
        if (prevReaction === reaction) {
          return { isNew: false, changed: false };
        }

        if (typeof nextCounts[prevReaction] === 'number' && nextCounts[prevReaction] > 0) {
          const decremented = nextCounts[prevReaction] - 1;
          if (decremented > 0) {
            nextCounts[prevReaction] = decremented;
          } else {
            delete nextCounts[prevReaction];
          }
        }
        nextCounts[reaction] = (nextCounts[reaction] || 0) + 1;

        transaction.update(likeRef, {
          username: (sender?.username || 'user').slice(0, 50),
          userPhotoURL: (sender?.photoURL || '').slice(0, 900000),
          reaction,
        });
        if (postSnap.exists()) {
          transaction.update(postRef, {
            reactionCounts: nextCounts,
          });
        }
        return { isNew: false, changed: true };
      });

      if (result.isNew && postTags.length > 0) {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentInterests = userSnap.data().interests || {};
          postTags.forEach((tag) => {
            currentInterests[tag] = (currentInterests[tag] || 0) + 1;
          });
          await updateDoc(userRef, { interests: currentInterests });
        }
      }

      if (result.changed) {
        await sendNotification(
          postAuthorId,
          sender,
          'like',
          postId,
          `post_reaction:${reaction}`
        );
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `posts/${postId}/likes/${userId}`);
    }
  };

  const likePost = async (postId: string, userId: string, postAuthorId: string, sender: any, postTags: string[] = []) => {
    await reactToPost(postId, userId, postAuthorId, sender, 'heart', postTags);
  };

  const unlikePost = async (postId: string, userId: string) => {
    try {
      const likeRef = doc(db, 'posts', postId, 'likes', userId);
      const postRef = doc(db, 'posts', postId);

      await runTransaction(db, async (transaction) => {
        const [likeSnap, postSnap] = await Promise.all([
          transaction.get(likeRef),
          transaction.get(postRef),
        ]);

        if (!likeSnap.exists()) return;

        const prevReaction = normalizeReaction(likeSnap.data().reaction, 'heart');
        transaction.delete(likeRef);

        if (postSnap.exists()) {
          const postData = postSnap.data();
          const currentLikesCount = typeof postData.likesCount === 'number' ? postData.likesCount : 0;
          const nextCounts: Record<string, number> = { ...(postData.reactionCounts || {}) };
          if (typeof nextCounts[prevReaction] === 'number' && nextCounts[prevReaction] > 0) {
            const decremented = nextCounts[prevReaction] - 1;
            if (decremented > 0) {
              nextCounts[prevReaction] = decremented;
            } else {
              delete nextCounts[prevReaction];
            }
          }
          transaction.update(postRef, {
            likesCount: Math.max(0, currentLikesCount - 1),
            reactionCounts: nextCounts,
          });
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `posts/${postId}/likes/${userId}`);
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

  const deleteComment = async (postId: string, commentId: string): Promise<boolean> => {
    try {
      const commentRef = doc(db, 'posts', postId, 'comments', commentId);
      const postRef = doc(db, 'posts', postId);
      await runTransaction(db, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        transaction.delete(commentRef);
        if (postSnap.exists()) {
          const currentCount = postSnap.data().commentsCount || 0;
          transaction.update(postRef, {
            commentsCount: Math.max(0, currentCount - 1),
          });
        }
      });
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `posts/${postId}/comments/${commentId}`);
      return false;
    }
  };

  const followUser = async (currentUserId: string, targetUserId: string, sender: any): Promise<boolean> => {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) return false;
    try {
      const [blockedByMeSnap, blockedByTargetSnap] = await Promise.all([
        getDoc(doc(db, 'users', currentUserId, 'blockedUsers', targetUserId)),
        getDoc(doc(db, 'users', targetUserId, 'blockedUsers', currentUserId)),
      ]);
      if (blockedByMeSnap.exists() || blockedByTargetSnap.exists()) {
        return false;
      }

      const batch = writeBatch(db);
      batch.set(doc(db, 'users', currentUserId, 'following', targetUserId), {
        followerId: currentUserId,
        followingId: targetUserId,
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'users', targetUserId, 'followers', currentUserId), {
        followerId: currentUserId,
        followingId: targetUserId,
        createdAt: serverTimestamp(),
      });
      await batch.commit();

      if (sender) {
        await sendNotification(targetUserId, sender, 'follow');
      }
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${currentUserId}/following/${targetUserId}`, true);
      return false;
    }
  };

  const unfollowUser = async (currentUserId: string, targetUserId: string): Promise<boolean> => {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) return false;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', currentUserId, 'following', targetUserId));
      batch.delete(doc(db, 'users', targetUserId, 'followers', currentUserId));
      await batch.commit();
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${currentUserId}/following/${targetUserId}`, true);
      return false;
    }
  };

  const removeFollower = async (currentUserId: string, followerUserId: string): Promise<boolean> => {
    if (!currentUserId || !followerUserId || currentUserId === followerUserId) return false;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', currentUserId, 'followers', followerUserId));
      batch.delete(doc(db, 'users', followerUserId, 'following', currentUserId));
      await batch.commit();
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${currentUserId}/followers/${followerUserId}`, true);
      return false;
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
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) return;
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', currentUserId, 'blockedUsers', targetUserId), {
        blockerId: currentUserId,
        blockedId: targetUserId,
        createdAt: serverTimestamp(),
      });
      // Sever both follow directions atomically
      batch.delete(doc(db, 'users', currentUserId, 'following', targetUserId));
      batch.delete(doc(db, 'users', targetUserId, 'followers', currentUserId));
      batch.delete(doc(db, 'users', targetUserId, 'following', currentUserId));
      batch.delete(doc(db, 'users', currentUserId, 'followers', targetUserId));
      await batch.commit();

      // Remove from any active direct messaging conversation
      const participantIds = [currentUserId, targetUserId].sort();
      const conversationId = participantIds.join('_');
      const convRef = doc(db, 'conversations', conversationId);
      const convSnap = await getDoc(convRef);
      if (convSnap.exists()) {
        await deleteDoc(convRef);
      }

      // Dispatch block event for real-time UI synchronization
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('instavibe:user-blocked', {
            detail: { blockerId: currentUserId, blockedUserId: targetUserId },
          })
        );
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${currentUserId}/blockedUsers/${targetUserId}`, true);
    }
  };

  const unblockUser = async (currentUserId: string, targetUserId: string) => {
    try {
      await deleteDoc(doc(db, 'users', currentUserId, 'blockedUsers', targetUserId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${currentUserId}/blockedUsers/${targetUserId}`);
    }
  };

  const createStory = async (
    author: any,
    mediaURL: string,
    mediaType: 'image' | 'video' = 'image',
    caption: string = '',
    poll?: any,
    music?: any,
    template?: any,
    collage?: any,
    studioOptions?: {
      audience?: StoryAudience;
      closeFriendIds?: string[];
      allowReplies?: boolean;
      filterId?: string;
      textOverlays?: StoryTextOverlay[];
      stickers?: StorySticker[];
      mentions?: StoryMention[];
      partnership?: StoryPartnership;
    }
  ) => {
    setLoading(true);
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours later

      const storyData: any = {
        authorId: author.uid,
        authorUsername: author.username,
        authorPhotoURL: author.photoURL || '',
        mediaURL: mediaURL.slice(0, 900000),
        mediaType,
        caption: caption.slice(0, 1000),
        likesCount: 0,
        reactionCounts: {},
        viewsCount: 0,
        tapsForwardCount: 0,
        tapsBackCount: 0,
        repliesCount: 0,
        audience: studioOptions?.audience === 'close_friends' ? 'close_friends' : 'everyone',
        allowReplies: studioOptions?.allowReplies !== false,
        allowComments: studioOptions?.allowReplies !== false,
        createdAt: serverTimestamp(),
        expiresAt: expiresAt.toISOString(),
      };

      if (
        studioOptions?.audience === 'close_friends' &&
        Array.isArray(studioOptions.closeFriendIds)
      ) {
        storyData.closeFriendIds = Array.from(
          new Set(studioOptions.closeFriendIds.filter((id) => typeof id === 'string' && id.length > 0))
        ).slice(0, 200);
      }

      if (studioOptions?.filterId && studioOptions.filterId !== 'none') {
        storyData.filterId = String(studioOptions.filterId).slice(0, 40);
      }

      if (Array.isArray(studioOptions?.textOverlays) && studioOptions.textOverlays.length > 0) {
        storyData.textOverlays = studioOptions.textOverlays.slice(0, 20).map((t) => ({
          id: String(t.id).slice(0, 40),
          text: String(t.text).slice(0, 220),
          x: Math.min(95, Math.max(5, Number(t.x) || 50)),
          y: Math.min(95, Math.max(5, Number(t.y) || 50)),
          color: String(t.color || '#ffffff').slice(0, 24),
          bgStyle: t.bgStyle || 'none',
          fontStyle: t.fontStyle || 'modern',
          scale: Number(t.scale) || 1,
        }));
      }

      if (Array.isArray(studioOptions?.stickers) && studioOptions.stickers.length > 0) {
        storyData.stickers = studioOptions.stickers.slice(0, 20).map((s) => ({
          id: String(s.id).slice(0, 40),
          type: s.type || 'emoji',
          value: String(s.value).slice(0, 80),
          label: s.label ? String(s.label).slice(0, 60) : '',
          x: Math.min(95, Math.max(5, Number(s.x) || 50)),
          y: Math.min(95, Math.max(5, Number(s.y) || 50)),
        }));
      }

      if (Array.isArray(studioOptions?.mentions) && studioOptions.mentions.length > 0) {
        storyData.mentions = studioOptions.mentions.slice(0, 20).map((m) => ({
          uid: String(m.uid).slice(0, 128),
          username: String(m.username).slice(0, 50),
          x: Math.min(95, Math.max(5, Number(m.x) || 50)),
          y: Math.min(95, Math.max(5, Number(m.y) || 50)),
        }));
      }

      if (
        studioOptions?.partnership &&
        (studioOptions.partnership.isPaid || studioOptions.partnership.partnerUsername)
      ) {
        storyData.partnership = {
          isPaid: Boolean(studioOptions.partnership.isPaid),
          ...(studioOptions.partnership.partnerId
            ? { partnerId: String(studioOptions.partnership.partnerId).slice(0, 128) }
            : {}),
          ...(studioOptions.partnership.partnerUsername
            ? { partnerUsername: String(studioOptions.partnership.partnerUsername).slice(0, 50) }
            : {}),
        };
      }

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

      if (music && music.title && music.artist) {
        storyData.music = {
          title: String(music.title).slice(0, 100),
          artist: String(music.artist).slice(0, 100),
          genre: String(music.genre || '').slice(0, 50),
        };
      }

      if (template && template.id) {
        storyData.template = {
          id: String(template.id).slice(0, 60),
          name: String(template.name || template.nameAr || '').slice(0, 100),
          prompt: String(template.prompt || template.promptAr || '').slice(0, 200),
        };
      }

      if (collage && collage.count) {
        storyData.collage = {
          count: Number(collage.count) || 2,
          style: String(collage.style || 'grid').slice(0, 30),
        };
      }

      const docRef = await addDoc(collection(db, 'stories'), storyData);

      // Notify mentioned users and tagged partner
      const notifiedIds = new Set<string>();
      if (Array.isArray(studioOptions?.mentions)) {
        for (const m of studioOptions.mentions) {
          if (m.uid && m.uid !== author.uid && !notifiedIds.has(m.uid)) {
            notifiedIds.add(m.uid);
            await sendNotification(m.uid, author, 'comment', undefined, 'mentioned you in a story');
          }
        }
      }
      if (
        studioOptions?.partnership?.partnerId &&
        studioOptions.partnership.partnerId !== author.uid &&
        !notifiedIds.has(studioOptions.partnership.partnerId)
      ) {
        await sendNotification(
          studioOptions.partnership.partnerId,
          author,
          'comment',
          undefined,
          'tagged you as a story partner'
        );
      }

      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'stories');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const addCloseFriend = async (
    userId: string,
    friend: { uid: string; username?: string; photoURL?: string }
  ) => {
    if (!userId || !friend?.uid || userId === friend.uid) return;
    try {
      await setDoc(doc(db, 'users', userId, 'closeFriends', friend.uid), {
        userId,
        friendId: friend.uid,
        username: (friend.username || 'user').slice(0, 50),
        photoURL: (friend.photoURL || '').slice(0, 900000),
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}/closeFriends/${friend.uid}`, true);
    }
  };

  const removeCloseFriend = async (userId: string, friendId: string) => {
    if (!userId || !friendId) return;
    try {
      await deleteDoc(doc(db, 'users', userId, 'closeFriends', friendId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}/closeFriends/${friendId}`, true);
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

  const reactToStory = async (
    storyId: string,
    userId: string,
    storyAuthorId: string,
    sender: any,
    reaction: ReactionType = 'heart'
  ) => {
    try {
      const reactionRef = doc(db, 'stories', storyId, 'reactions', userId);
      const storyRef = doc(db, 'stories', storyId);

      const changed = await runTransaction(db, async (transaction) => {
        const [reactionSnap, storySnap] = await Promise.all([
          transaction.get(reactionRef),
          transaction.get(storyRef),
        ]);

        const storyData = storySnap.exists() ? storySnap.data() : {};
        const currentLikesCount = typeof storyData.likesCount === 'number' ? storyData.likesCount : 0;
        const nextCounts: Record<string, number> = { ...(storyData.reactionCounts || {}) };

        if (!reactionSnap.exists()) {
          nextCounts[reaction] = (nextCounts[reaction] || 0) + 1;
          transaction.set(reactionRef, {
            storyId,
            userId,
            username: (sender?.username || 'user').slice(0, 50),
            userPhotoURL: (sender?.photoURL || '').slice(0, 900000),
            reaction,
            createdAt: serverTimestamp(),
          });
          if (storySnap.exists()) {
            transaction.update(storyRef, {
              likesCount: currentLikesCount + 1,
              reactionCounts: nextCounts,
            });
          }
          return true;
        }

        const prevReaction = normalizeReaction(reactionSnap.data().reaction, 'heart');
        if (prevReaction === reaction) {
          return false;
        }

        if (typeof nextCounts[prevReaction] === 'number' && nextCounts[prevReaction] > 0) {
          const decremented = nextCounts[prevReaction] - 1;
          if (decremented > 0) {
            nextCounts[prevReaction] = decremented;
          } else {
            delete nextCounts[prevReaction];
          }
        }
        nextCounts[reaction] = (nextCounts[reaction] || 0) + 1;

        transaction.update(reactionRef, {
          reaction,
        });
        if (storySnap.exists()) {
          transaction.update(storyRef, {
            reactionCounts: nextCounts,
          });
        }
        return true;
      });

      if (changed) {
        await sendNotification(
          storyAuthorId,
          sender,
          'like',
          undefined,
          `story_reaction:${reaction}`
        );
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `stories/${storyId}/reactions/${userId}`);
    }
  };

  const removeStoryReaction = async (storyId: string, userId: string) => {
    try {
      const reactionRef = doc(db, 'stories', storyId, 'reactions', userId);
      const storyRef = doc(db, 'stories', storyId);

      await runTransaction(db, async (transaction) => {
        const [reactionSnap, storySnap] = await Promise.all([
          transaction.get(reactionRef),
          transaction.get(storyRef),
        ]);

        if (!reactionSnap.exists()) return;

        const prevReaction = normalizeReaction(reactionSnap.data().reaction, 'heart');
        transaction.delete(reactionRef);

        if (storySnap.exists()) {
          const storyData = storySnap.data();
          const currentLikesCount = typeof storyData.likesCount === 'number' ? storyData.likesCount : 0;
          const nextCounts: Record<string, number> = { ...(storyData.reactionCounts || {}) };
          if (typeof nextCounts[prevReaction] === 'number' && nextCounts[prevReaction] > 0) {
            const decremented = nextCounts[prevReaction] - 1;
            if (decremented > 0) {
              nextCounts[prevReaction] = decremented;
            } else {
              delete nextCounts[prevReaction];
            }
          }
          transaction.update(storyRef, {
            likesCount: Math.max(0, currentLikesCount - 1),
            reactionCounts: nextCounts,
          });
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `stories/${storyId}/reactions/${userId}`);
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

  const removeStoryFromHighlightAlbum = async (userId: string, albumId: string, storyId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId, 'highlights', albumId), {
        storyIds: arrayRemove(storyId),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/highlights/${albumId}`, true);
    }
  };

  const updateStoryCaption = async (storyId: string, caption: string) => {
    if (!storyId) return;
    try {
      await updateDoc(doc(db, 'stories', storyId), {
        caption: caption.trim().slice(0, 1000),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stories/${storyId}`, true);
    }
  };

  const toggleStoryComments = async (storyId: string, enabled: boolean) => {
    if (!storyId) return;
    try {
      await updateDoc(doc(db, 'stories', storyId), {
        allowReplies: enabled,
        allowComments: enabled,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stories/${storyId}`, true);
    }
  };

  const toggleStoryAiLabel = async (storyId: string, enabled: boolean) => {
    if (!storyId) return;
    try {
      await updateDoc(doc(db, 'stories', storyId), {
        aiLabel: enabled,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stories/${storyId}`, true);
    }
  };

  const updateStoryPartnership = async (
    storyId: string,
    partnership: StoryPartnership | null,
    sender?: any,
    notifyPartner?: boolean
  ) => {
    if (!storyId) return;
    try {
      const payload: StoryPartnership | null =
        partnership && (partnership.isPaid || partnership.allowAds || partnership.partnerUsername)
          ? {
              isPaid: Boolean(partnership.isPaid),
              allowAds: Boolean(partnership.allowAds),
              ...(partnership.partnerId
                ? { partnerId: String(partnership.partnerId).slice(0, 128) }
                : {}),
              ...(partnership.partnerUsername
                ? { partnerUsername: String(partnership.partnerUsername).slice(0, 50) }
                : {}),
            }
          : null;

      await updateDoc(doc(db, 'stories', storyId), {
        partnership: payload,
      });

      if (notifyPartner && payload?.partnerId && sender?.uid && payload.partnerId !== sender.uid) {
        await sendNotification(
          payload.partnerId,
          sender,
          'comment',
          undefined,
          'tagged you as a story partner'
        );
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stories/${storyId}`, true);
    }
  };

  const updateStoryMentions = async (
    storyId: string,
    mentions: StoryMention[],
    newlyMentionedUid?: string,
    sender?: any
  ) => {
    if (!storyId) return;
    try {
      const sanitized = mentions.slice(0, 20).map((m) => ({
        uid: String(m.uid).slice(0, 128),
        username: String(m.username).slice(0, 50),
        x: Math.min(95, Math.max(5, Number(m.x) || 50)),
        y: Math.min(95, Math.max(5, Number(m.y) || 50)),
      }));

      await updateDoc(doc(db, 'stories', storyId), {
        mentions: sanitized,
      });

      if (newlyMentionedUid && sender?.uid && newlyMentionedUid !== sender.uid) {
        await sendNotification(
          newlyMentionedUid,
          sender,
          'comment',
          undefined,
          'mentioned you in a story'
        );
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stories/${storyId}`, true);
    }
  };

  const updateStoryPromotion = async (storyId: string, promoted: StoryPromotion | null) => {
    if (!storyId) return;
    try {
      await updateDoc(doc(db, 'stories', storyId), {
        promoted: promoted
          ? {
              isPromoted: Boolean(promoted.isPromoted),
              goal: promoted.goal,
              dailyBudget: Math.max(1, Number(promoted.dailyBudget) || 5),
              durationDays: Math.max(1, Number(promoted.durationDays) || 3),
              promotedAt: String(promoted.promotedAt || new Date().toISOString()).slice(0, 64),
            }
          : null,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stories/${storyId}`, true);
    }
  };

  const saveUserStorySettings = async (userId: string, settings: StorySettings) => {
    if (!userId) return;
    try {
      await updateDoc(doc(db, 'users', userId), {
        storySettings: {
          defaultAudience: settings.defaultAudience === 'close_friends' ? 'close_friends' : 'everyone',
          repliesPermission:
            settings.repliesPermission === 'off' || settings.repliesPermission === 'followers'
              ? settings.repliesPermission
              : 'everyone',
          autoSaveArchive: Boolean(settings.autoSaveArchive),
          allowStorySharing: Boolean(settings.allowStorySharing),
          allowExternalSharing: Boolean(settings.allowExternalSharing),
        },
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`, true);
    }
  };

  const updateUserProfile = async (
    userId: string,
    updates: {
      username: string;
      fullName: string;
      bio: string;
      website?: string;
      photoURL: string;
      coverPhotoURL?: string;
    }
  ) => {
    setLoading(true);
    try {
      const userSnap = await getDoc(doc(db, 'users', userId));
      const existingData = userSnap.exists() ? userSnap.data() : {};
      const email = existingData.email || auth.currentUser?.email || '';
      const previousUsername = existingData.username || '';

      const authProvider = detectAuthProvider(auth.currentUser) || existingData.authProvider || 'google';
      const emailVerified = Boolean(auth.currentUser?.emailVerified ?? existingData.emailVerified);
      const phoneNumber = auth.currentUser?.phoneNumber || existingData.phoneNumber || '';

      await claimUsernameAndSaveProfile({
        uid: userId,
        email,
        phoneNumber,
        username: updates.username,
        fullName: updates.fullName,
        bio: updates.bio,
        website: updates.website,
        photoURL: updates.photoURL,
        coverPhotoURL: updates.coverPhotoURL,
        previousUsername,
        authProvider,
        emailVerified,
      });
    } catch (error: any) {
      if (error?.message === 'USERNAME_TAKEN' || error?.message === 'INVALID_USERNAME') {
        throw error;
      }
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}`, true);
    } finally {
      setLoading(false);
    }
  };

  const updateCoverPhoto = async (userId: string, coverPhotoURL: string) => {
    if (!userId) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', userId), {
        coverPhotoURL: coverPhotoURL.trim().slice(0, 900000),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`, true);
    } finally {
      setLoading(false);
    }
  };

  const recordStoryView = async (
    storyId: string,
    viewerId: string,
    viewerProfile: { username?: string; photoURL?: string }
  ) => {
    if (!storyId || !viewerId) return;
    try {
      const viewerDocRef = doc(db, 'stories', storyId, 'viewers', viewerId);
      const storyRef = doc(db, 'stories', storyId);

      await runTransaction(db, async (transaction) => {
        const viewerSnap = await transaction.get(viewerDocRef);
        if (viewerSnap.exists()) {
          // Already recorded view for this user
          return;
        }

        const storySnap = await transaction.get(storyRef);
        const currentViews = storySnap.exists() && typeof storySnap.data().viewsCount === 'number'
          ? storySnap.data().viewsCount
          : 0;

        transaction.set(viewerDocRef, {
          storyId,
          viewerId,
          username: (viewerProfile?.username || 'user').slice(0, 50),
          userPhotoURL: (viewerProfile?.photoURL || '').slice(0, 900000),
          viewedAt: serverTimestamp(),
        });

        if (storySnap.exists()) {
          transaction.update(storyRef, {
            viewsCount: currentViews + 1,
          });
        }
      });
    } catch (error) {
      console.warn('Could not record story view in Firestore:', error);
    }
  };

  const submitReport = async (input: SubmitReportInput): Promise<string | undefined> => {
    if (!auth.currentUser) {
      throw new Error('Must be authenticated to submit a report');
    }
    setLoading(true);
    try {
      const reporterUid = auth.currentUser.uid;
      const reporterUsername = (
        input.reporterUsername ||
        auth.currentUser.displayName ||
        auth.currentUser.email?.split('@')[0] ||
        'user'
      ).slice(0, 50);

      const reportPayload: Record<string, any> = {
        reporterId: reporterUid,
        reporterUsername,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        status: 'pending',
        createdAt: serverTimestamp(),
      };

      if (input.targetAuthorId) {
        reportPayload.targetAuthorId = input.targetAuthorId;
      }
      if (input.targetUsername) {
        reportPayload.targetUsername = input.targetUsername.slice(0, 50);
      }
      if (input.targetSummary) {
        reportPayload.targetSummary = input.targetSummary.slice(0, 500);
      }
      if (input.reasonLabel) {
        reportPayload.reasonLabel = input.reasonLabel.slice(0, 100);
      }
      if (input.details && input.details.trim().length > 0) {
        reportPayload.details = input.details.trim().slice(0, 1000);
      }

      const docRef = await addDoc(collection(db, 'reports'), reportPayload);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reports', true);
    } finally {
      setLoading(false);
    }
  };

  const recordPostView = async (postId: string) => {
    if (!postId || !auth.currentUser) return;
    try {
      const postRef = doc(db, 'posts', postId);
      await runTransaction(db, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) return;
        const currentViews = typeof postSnap.data().viewsCount === 'number' ? postSnap.data().viewsCount : 0;
        transaction.update(postRef, {
          viewsCount: currentViews + 1,
        });
      });
    } catch (error) {
      console.warn('Could not record post view:', error);
    }
  };

  const recordStoryTap = async (storyId: string, direction: 'forward' | 'back') => {
    if (!storyId || !auth.currentUser) return;
    try {
      const storyRef = doc(db, 'stories', storyId);
      const fieldName = direction === 'forward' ? 'tapsForwardCount' : 'tapsBackCount';
      await runTransaction(db, async (transaction) => {
        const storySnap = await transaction.get(storyRef);
        if (!storySnap.exists()) return;
        const data = storySnap.data();
        const currentCount = typeof data[fieldName] === 'number' ? data[fieldName] : 0;
        transaction.update(storyRef, {
          [fieldName]: currentCount + 1,
        });
      });
    } catch (error) {
      console.warn('Could not record story tap in Firestore:', error);
    }
  };

  const recordStoryReply = async (storyId: string) => {
    if (!storyId || !auth.currentUser) return;
    try {
      const storyRef = doc(db, 'stories', storyId);
      await runTransaction(db, async (transaction) => {
        const storySnap = await transaction.get(storyRef);
        if (!storySnap.exists()) return;
        const data = storySnap.data();
        const currentReplies = typeof data.repliesCount === 'number' ? data.repliesCount : 0;
        transaction.update(storyRef, {
          repliesCount: currentReplies + 1,
        });
      });
    } catch (error) {
      console.warn('Could not record story reply in Firestore:', error);
    }
  };

  const keepExpiringStory = async (
    userId: string,
    notificationId: string,
    storyId: string,
    currentExpiresAt?: string
  ) => {
    if (!userId || !notificationId) return;
    try {
      if (storyId) {
        const storyRef = doc(db, 'stories', storyId);
        const storySnap = await getDoc(storyRef);
        if (storySnap.exists()) {
          const parsedCurrent = currentExpiresAt ? new Date(currentExpiresAt).getTime() : NaN;
          const baseMs = !Number.isNaN(parsedCurrent)
            ? Math.max(Date.now(), parsedCurrent)
            : Date.now();
          const extendedExpiresAt = new Date(baseMs + 24 * 60 * 60 * 1000).toISOString();
          await updateDoc(storyRef, {
            expiresAt: extendedExpiresAt,
          });
        }
      }
      await updateDoc(doc(db, 'users', userId, 'notifications', notificationId), {
        read: true,
        actionTaken: 'kept',
        handledAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stories/${storyId}`, true);
    }
  };

  const deleteExpiringStoryNow = async (
    userId: string,
    notificationId: string,
    storyId: string
  ) => {
    if (!userId || !notificationId) return;
    try {
      if (storyId) {
        const storyRef = doc(db, 'stories', storyId);
        const storySnap = await getDoc(storyRef);
        if (storySnap.exists()) {
          await deleteDoc(storyRef);
        }
      }
      await updateDoc(doc(db, 'users', userId, 'notifications', notificationId), {
        read: true,
        actionTaken: 'deleted',
        handledAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `stories/${storyId}`, true);
    }
  };

  return { 
    createPost, deletePost, savePost, unsavePost,
    reactToPost, likePost, unlikePost, addComment, likeComment, unlikeComment, deleteComment,
    followUser, unfollowUser, removeFollower, getOrCreateConversation, sendMessage, blockUser, 
    unblockUser, createStory, addCloseFriend, removeCloseFriend, voteStoryPoll, reactToStory, removeStoryReaction, recordStoryView,
    recordStoryTap, recordStoryReply,
    keepExpiringStory, deleteExpiringStoryNow,
    deleteStory, archiveStory, createHighlightAlbum, updateHighlightAlbum,
    deleteHighlightAlbum, addStoryToHighlightAlbum, removeStoryFromHighlightAlbum,
    updateStoryCaption, toggleStoryComments, toggleStoryAiLabel,
    updateStoryPartnership, updateStoryMentions, updateStoryPromotion,
    saveUserStorySettings,
    updateUserProfile, updateCoverPhoto,
    submitReport, recordPostView, loading 
  };
}
