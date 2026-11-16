import React, { useState } from 'react';
import { Check, ChevronRight, ChevronLeft, PlusSquare, Clapperboard, Radio } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CameraSettings, getCameraSettings, saveCameraSettings } from '../utils/cameraSettings';

interface CameraSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenStory?: () => void;
  onOpenReels?: () => void;
  onOpenLive?: () => void;
}

export default function CameraSettingsModal({
  isOpen,
  onClose,
  onOpenStory,
  onOpenReels,
  onOpenLive,
}: CameraSettingsModalProps) {
  const { language } = useAuth();
  const isAr = language === 'ar';

  const [settings, setSettings] = useState<CameraSettings>(() => getCameraSettings());

  if (!isOpen) return null;

  const handleToggleFrontCamera = () => {
    const updated = saveCameraSettings({ frontCameraAlways: !settings.frontCameraAlways });
    setSettings(updated);
  };

  const handleSelectPosition = (pos: 'left' | 'right') => {
    const updated = saveCameraSettings({ toolsPosition: pos });
    setSettings(updated);
  };

  const Chevron = isAr ? ChevronLeft : ChevronRight;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isAr ? 'إعدادات الكاميرا' : 'Camera Settings'}
      className="fixed inset-0 z-[140] h-[100dvh] bg-black text-white flex flex-col pt-safe pb-safe animate-in fade-in duration-200"
    >
      {/* Top Header matching Screenshot 2 */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/10">
        <button
          type="button"
          onClick={onClose}
          aria-label={isAr ? 'حفظ وإغلاق الإعدادات' : 'Save and Close Settings'}
          className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-transform active:scale-95 shadow-md shrink-0"
        >
          <Check size={22} className="stroke-[3]" />
        </button>

        <h2 className="text-xl font-bold tracking-tight text-white flex-1 text-center pe-10">
          {isAr ? 'إعدادات الكاميرا' : 'Camera Settings'}
        </h2>
      </div>

      {/* Settings Content Container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 max-w-xl mx-auto w-full">
        {/* Navigation list: Story, Reels, Live */}
        <div className="divide-y divide-white/10 rounded-2xl overflow-hidden bg-white/5 border border-white/10">
          {/* Story */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenStory?.();
            }}
            className="w-full flex items-center justify-between p-4 hover:bg-white/10 transition-colors text-start group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-600/30 text-purple-400 flex items-center justify-center">
                <PlusSquare size={20} />
              </div>
              <span className="font-semibold text-sm text-white">
                {isAr ? 'القصة' : 'Story'}
              </span>
            </div>
            <Chevron size={20} className="text-white/40 group-hover:text-white transition-colors" />
          </button>

          {/* Reels */}
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onOpenReels) {
                onOpenReels();
              } else {
                window.dispatchEvent(new CustomEvent('instavibe:switch-view', { detail: 'reels' }));
              }
            }}
            className="w-full flex items-center justify-between p-4 hover:bg-white/10 transition-colors text-start group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-600/30 text-rose-400 flex items-center justify-center">
                <Clapperboard size={20} />
              </div>
              <span className="font-semibold text-sm text-white">
                {isAr ? 'ريلز' : 'Reels'}
              </span>
            </div>
            <Chevron size={20} className="text-white/40 group-hover:text-white transition-colors" />
          </button>

          {/* Live */}
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onOpenLive) {
                onOpenLive();
              } else {
                window.dispatchEvent(new CustomEvent('instavibe:switch-view', { detail: 'live' }));
              }
            }}
            className="w-full flex items-center justify-between p-4 hover:bg-white/10 transition-colors text-start group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-600/30 text-red-400 flex items-center justify-center">
                <Radio size={20} />
              </div>
              <span className="font-semibold text-sm text-white">
                {isAr ? 'بث مباشر' : 'Live Broadcast'}
              </span>
            </div>
            <Chevron size={20} className="text-white/40 group-hover:text-white transition-colors" />
          </button>
        </div>

        {/* Section 1: عناصر التحكم (Controls) */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 px-1">
            {isAr ? 'عناصر التحكم' : 'Controls'}
          </h3>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="space-y-0.5 pe-4">
              <label
                htmlFor="front-camera-toggle"
                className="font-medium text-sm text-white block cursor-pointer select-none"
              >
                {isAr ? 'البدء مع تشغيل الكاميرا الأمامية دائمًا' : 'Always start with front camera'}
              </label>
              <p className="text-xs text-white/40">
                {isAr
                  ? 'يفتح الكاميرا بوضع السيلفي الأمامي تلقائياً عند الدخول إلى القصص.'
                  : 'Automatically launches in selfie mode when opening the story camera.'}
              </p>
            </div>

            {/* Switch Toggle */}
            <button
              id="front-camera-toggle"
              type="button"
              role="switch"
              aria-checked={settings.frontCameraAlways}
              onClick={handleToggleFrontCamera}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.frontCameraAlways ? 'bg-blue-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.frontCameraAlways
                    ? isAr
                      ? '-translate-x-5'
                      : 'translate-x-5'
                    : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Section 2: أدوات الكاميرا (Camera Tools) */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 px-1">
            {isAr ? 'أدوات الكاميرا' : 'Camera Tools'}
          </h3>

          <p className="text-xs text-white/60 px-1 leading-relaxed">
            {isAr
              ? 'اختر جانب الشاشة الذي تريد أن يظهر به شريط أدوات الكاميرا.'
              : 'Choose which side of the screen you want the camera toolbar to appear on.'}
          </p>

          <div className="space-y-2 pt-1">
            {/* Option: الجانب الأيسر (Left Side) */}
            <button
              type="button"
              onClick={() => handleSelectPosition('left')}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-start ${
                settings.toolsPosition === 'left'
                  ? 'bg-white/10 border-blue-500/80'
                  : 'bg-white/5 border-white/10 hover:bg-white/[0.07]'
              }`}
            >
              <span className="font-semibold text-sm text-white">
                {isAr ? 'الجانب الأيسر' : 'Left side'}
              </span>

              {/* Custom Radio Button */}
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  settings.toolsPosition === 'left' ? 'border-white' : 'border-white/30'
                }`}
              >
                {settings.toolsPosition === 'left' && (
                  <div className="w-3 h-3 rounded-full bg-white" />
                )}
              </div>
            </button>

            {/* Option: الجانب الأيمن (Right Side) */}
            <button
              type="button"
              onClick={() => handleSelectPosition('right')}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-start ${
                settings.toolsPosition === 'right'
                  ? 'bg-white/10 border-blue-500/80'
                  : 'bg-white/5 border-white/10 hover:bg-white/[0.07]'
              }`}
            >
              <span className="font-semibold text-sm text-white">
                {isAr ? 'الجانب الأيمن' : 'Right side'}
              </span>

              {/* Custom Radio Button */}
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  settings.toolsPosition === 'right' ? 'border-white' : 'border-white/30'
                }`}
              >
                {settings.toolsPosition === 'right' && (
                  <div className="w-3 h-3 rounded-full bg-white" />
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
