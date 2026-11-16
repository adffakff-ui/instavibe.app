import { StorySettings } from '../types/story';

export const DEFAULT_STORY_SETTINGS: StorySettings = {
  defaultAudience: 'everyone',
  repliesPermission: 'everyone',
  autoSaveArchive: true,
  allowStorySharing: true,
  allowExternalSharing: true,
};

function getStorageKey(uid?: string): string {
  return uid ? `instavibe_story_settings_${uid}` : 'instavibe_story_settings';
}

export function getStorySettings(uid?: string, profileStorySettings?: Partial<StorySettings> | null): StorySettings {
  let local: Partial<StorySettings> = {};
  try {
    const raw = window.localStorage.getItem(getStorageKey(uid));
    if (raw) {
      local = JSON.parse(raw) as Partial<StorySettings>;
    }
  } catch {
    // Ignore storage read errors
  }

  const merged = {
    ...DEFAULT_STORY_SETTINGS,
    ...local,
    ...(profileStorySettings || {}),
  };

  return {
    defaultAudience: merged.defaultAudience === 'close_friends' ? 'close_friends' : 'everyone',
    repliesPermission:
      merged.repliesPermission === 'off' || merged.repliesPermission === 'followers'
        ? merged.repliesPermission
        : 'everyone',
    autoSaveArchive: Boolean(merged.autoSaveArchive),
    allowStorySharing: Boolean(merged.allowStorySharing),
    allowExternalSharing: Boolean(merged.allowExternalSharing),
  };
}

export function saveStorySettingsLocally(uid: string | undefined, settings: StorySettings): void {
  try {
    window.localStorage.setItem(getStorageKey(uid), JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}
