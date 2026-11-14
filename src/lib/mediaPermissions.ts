export type BrowserPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface AppMediaPermissions {
  camera: boolean;
  microphone: boolean;
}

const STORAGE_KEY = 'instavibe_media_permissions';

export function getStoredMediaPermissions(): AppMediaPermissions | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        camera: Boolean(parsed.camera),
        microphone: Boolean(parsed.microphone),
      };
    }
  } catch {
    // Ignore malformed local storage
  }
  return null;
}

export function saveStoredMediaPermissions(perms: AppMediaPermissions): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(perms));
  } catch {
    // Ignore storage quota / private mode failures
  }
}

export async function queryBrowserPermission(
  name: 'camera' | 'microphone'
): Promise<BrowserPermissionState> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return 'unknown';
  }
  try {
    const status = await navigator.permissions.query({
      name: name as PermissionName,
    });
    if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
      return status.state;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}
