export interface PostDraft {
  id: string;
  userId: string;
  mediaURL: string;
  mediaType: 'image' | 'video';
  caption: string;
  updatedAt: number;
}

const STORAGE_KEY_PREFIX = 'instavibe_post_drafts_';
const MAX_DRAFTS_PER_USER = 6;

function getUserStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId || 'anonymous'}`;
}

export function getSavedPostDrafts(userId: string): PostDraft[] {
  try {
    const raw = localStorage.getItem(getUserStorageKey(userId));
    if (!raw) return [];
    const parsed: PostDraft[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (err) {
    console.error('Failed to load post drafts:', err);
    return [];
  }
}

export function savePostDraft(draft: Omit<PostDraft, 'id' | 'updatedAt'> & { id?: string }): PostDraft | null {
  try {
    const drafts = getSavedPostDrafts(draft.userId);
    const draftId = draft.id || `post_draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    
    const draftToSave: PostDraft = {
      ...draft,
      id: draftId,
      updatedAt: Date.now(),
    };

    const existingIndex = drafts.findIndex((d) => d.id === draftId);
    let updatedDrafts: PostDraft[];
    if (existingIndex >= 0) {
      updatedDrafts = [...drafts];
      updatedDrafts[existingIndex] = draftToSave;
    } else {
      updatedDrafts = [draftToSave, ...drafts].slice(0, MAX_DRAFTS_PER_USER);
    }

    try {
      localStorage.setItem(getUserStorageKey(draft.userId), JSON.stringify(updatedDrafts));
      return draftToSave;
    } catch {
      // If quota exceeded (e.g. multiple gallery DataURLs), keep only the latest draft
      try {
        localStorage.setItem(getUserStorageKey(draft.userId), JSON.stringify([draftToSave]));
        return draftToSave;
      } catch (innerErr) {
        console.error('Failed to save post draft due to storage quota:', innerErr);
        return null;
      }
    }
  } catch (err) {
    console.error('Failed to save post draft:', err);
    return null;
  }
}

export function deletePostDraft(userId: string, draftId: string): void {
  try {
    const drafts = getSavedPostDrafts(userId);
    const filtered = drafts.filter((d) => d.id !== draftId);
    localStorage.setItem(getUserStorageKey(userId), JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to delete post draft:', err);
  }
}
