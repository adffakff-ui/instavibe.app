export interface CameraSettings {
  frontCameraAlways: boolean;
  toolsPosition: 'left' | 'right';
  gridLines: boolean;
}

const STORAGE_KEY = 'instavibe_camera_settings';

export const DEFAULT_CAMERA_SETTINGS: CameraSettings = {
  frontCameraAlways: false,
  toolsPosition: 'left',
  gridLines: false,
};

export function getCameraSettings(): CameraSettings {
  if (typeof window === 'undefined') return DEFAULT_CAMERA_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CAMERA_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      frontCameraAlways: Boolean(parsed.frontCameraAlways),
      toolsPosition: parsed.toolsPosition === 'right' ? 'right' : 'left',
      gridLines: Boolean(parsed.gridLines),
    };
  } catch {
    return DEFAULT_CAMERA_SETTINGS;
  }
}

export function saveCameraSettings(partial: Partial<CameraSettings>): CameraSettings {
  const current = getCameraSettings();
  const updated: CameraSettings = {
    ...current,
    ...partial,
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('instavibe:camera-settings-updated', { detail: updated }));
    } catch {
      // ignore localStorage quota errors
    }
  }
  return updated;
}
