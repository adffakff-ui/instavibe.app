export interface StoryDraft {
  id: string;
  userId: string;
  mediaURL: string;
  rawSourceUrl?: string;
  mediaType: 'image' | 'video';
  caption: string;
  selectedFilter: string;
  brightness?: number;
  contrast?: number;
  isMonochrome?: boolean;
  poll?: {
    question: string;
    optionA: string;
    optionB: string;
    votesA: number;
    votesB: number;
    voters?: Record<string, string>;
  };
  updatedAt: number; // timestamp ms
}

const STORAGE_KEY_PREFIX = 'instavibe_story_drafts_';
const MAX_DRAFTS_PER_USER = 6;

function getUserStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId || 'anonymous'}`;
}

/**
 * Retrieve all saved drafts for a user, sorted newest first
 */
export function getSavedStoryDrafts(userId: string): StoryDraft[] {
  try {
    const raw = localStorage.getItem(getUserStorageKey(userId));
    if (!raw) return [];
    const parsed: StoryDraft[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (err) {
    console.error('Failed to load story drafts:', err);
    return [];
  }
}

/**
 * Save a new draft or update an existing draft
 */
export function saveStoryDraft(draft: Omit<StoryDraft, 'id' | 'updatedAt'> & { id?: string }): StoryDraft | null {
  try {
    const drafts = getSavedStoryDrafts(draft.userId);
    const draftId = draft.id || `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    
    const draftToSave: StoryDraft = {
      ...draft,
      id: draftId,
      updatedAt: Date.now(),
    };

    // Replace if exists, or prepend
    const existingIndex = drafts.findIndex((d) => d.id === draftId);
    let updatedDrafts: StoryDraft[];
    if (existingIndex >= 0) {
      updatedDrafts = [...drafts];
      updatedDrafts[existingIndex] = draftToSave;
    } else {
      updatedDrafts = [draftToSave, ...drafts].slice(0, MAX_DRAFTS_PER_USER);
    }

    try {
      localStorage.setItem(getUserStorageKey(draft.userId), JSON.stringify(updatedDrafts));
    } catch (quotaErr) {
      console.warn('Storage quota reached, pruning older drafts to fit...', quotaErr);
      // Prune to 2 drafts if quota is exceeded
      const trimmed = updatedDrafts.slice(0, 2);
      localStorage.setItem(getUserStorageKey(draft.userId), JSON.stringify(trimmed));
    }

    return draftToSave;
  } catch (err) {
    console.error('Failed to save story draft:', err);
    return null;
  }
}

/**
 * Delete a specific draft
 */
export function deleteStoryDraft(userId: string, draftId: string): void {
  try {
    const drafts = getSavedStoryDrafts(userId);
    const filtered = drafts.filter((d) => d.id !== draftId);
    localStorage.setItem(getUserStorageKey(userId), JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to delete story draft:', err);
  }
}

/**
 * Clear all drafts for a user
 */
export function clearAllStoryDrafts(userId: string): void {
  try {
    localStorage.removeItem(getUserStorageKey(userId));
  } catch (err) {
    console.error('Failed to clear story drafts:', err);
  }
}
