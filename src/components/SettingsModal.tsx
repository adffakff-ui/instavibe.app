import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Settings,
  User,
  Shield,
  Globe,
  Sun,
  Moon,
  Monitor,
  Camera,
  Loader2,
  CheckCircle2,
  AlertCircle,
  LogOut,
  UserCheck,
  Smartphone,
  Share2,
  Download,
  Trash2,
  Mic,
  ShieldCheck,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useFirestore } from '../hooks/useFirestore';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { evaluatePasswordStrength } from '../lib/authService';
import {
  BrowserPermissionState,
  getStoredMediaPermissions,
  queryBrowserPermission,
  saveStoredMediaPermissions,
} from '../lib/mediaPermissions';
import UserAvatar from './UserAvatar';

export type SettingsTab = 'general' | 'profile' | 'privacy';

interface SettingsModalProps {
  isOpen: boolean;
  initialTab?: SettingsTab;
  onClose: () => void;
  onProfileUpdated?: (updatedFields: {
    username: string;
    fullName: string;
    bio: string;
    photoURL: string;
  }) => void;
}

interface BlockedUserItem {
  uid: string;
  username: string;
  fullName?: string;
  photoURL?: string;
}

export default function SettingsModal({
  isOpen,
  initialTab = 'general',
  onClose,
  onProfileUpdated,
}: SettingsModalProps) {
  const {
    user,
    profile,
    authProvider,
    emailVerified,
    resendVerificationEmail,
    refreshEmailVerification,
    changeUserPassword,
    isFirebaseAuthenticated,
    dbSyncStatus,
    loginSessions,
    currentSessionId,
    revokeSession,
    blockedUsers,
    language,
    setLanguage,
    theme,
    setTheme,
    logOut,
  } = useAuth();
  const { updateUserProfile, unblockUser, loading } = useFirestore();
  const { isInstallable, isInstalled, install, publicAppUrl } = usePWAInstall();

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState('');

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmNewPwd, setConfirmNewPwd] = useState('');
  const [updatingPwd, setUpdatingPwd] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);

  const [showAccessModal, setShowAccessModal] = useState(false);
  const [cameraAccess, setCameraAccess] = useState(false);
  const [micAccess, setMicAccess] = useState(false);
  const [cameraBrowserState, setCameraBrowserState] = useState<BrowserPermissionState>('unknown');
  const [micBrowserState, setMicBrowserState] = useState<BrowserPermissionState>('unknown');
  const [applyingAccess, setApplyingAccess] = useState(false);
  const [accessModalError, setAccessModalError] = useState<string | null>(null);

  const [blockedProfiles, setBlockedProfiles] = useState<BlockedUserItem[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setFeedback(null);
      setConfirmLogout(false);
      setConfirmReset(false);
      setShowAccessModal(false);
      setAccessModalError(null);
      setShowPasswordForm(false);
      setCurrentPwd('');
      setNewPwd('');
      setConfirmNewPwd('');
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'privacy') return;
    let cancelled = false;
    const syncPermissions = async () => {
      const [camState, micState] = await Promise.all([
        queryBrowserPermission('camera'),
        queryBrowserPermission('microphone'),
      ]);
      if (cancelled) return;
      setCameraBrowserState(camState);
      setMicBrowserState(micState);

      const stored = getStoredMediaPermissions();
      if (stored) {
        setCameraAccess(stored.camera && camState !== 'denied');
        setMicAccess(stored.microphone && micState !== 'denied');
      } else {
        setCameraAccess(camState === 'granted');
        setMicAccess(micState === 'granted');
      }
    };
    syncPermissions();
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (isOpen && profile) {
      setUsername(profile.username || '');
      setFullName(profile.fullName || '');
      setBio(profile.bio || '');
      setPhotoURL(profile.photoURL || '');
    }
  }, [isOpen, profile]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAccessModal) {
          setShowAccessModal(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, showAccessModal]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'privacy') return;
    if (blockedUsers.length === 0 || !isFirebaseAuthenticated) {
      setBlockedProfiles(
        blockedUsers.map((uid) => ({
          uid,
          username: uid.slice(0, 8),
        }))
      );
      return;
    }

    let cancelled = false;
    const loadBlockedUsers = async () => {
      setLoadingBlocked(true);
      try {
        const items = await Promise.all(
          blockedUsers.map(async (uid) => {
            try {
              const snap = await getDoc(doc(db, 'users', uid));
              if (snap.exists()) {
                const data = snap.data();
                return {
                  uid,
                  username: data.username || uid.slice(0, 8),
                  fullName: data.fullName || '',
                  photoURL: data.photoURL || '',
                };
              }
            } catch {
              // Fallback if target blocked/unavailable
            }
            return {
              uid,
              username: uid.slice(0, 8),
            };
          })
        );
        if (!cancelled) {
          setBlockedProfiles(items);
        }
      } finally {
        if (!cancelled) {
          setLoadingBlocked(false);
        }
      }
    };

    loadBlockedUsers();
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeTab, blockedUsers, isFirebaseAuthenticated]);

  if (!isOpen) return null;

  const compressAvatar = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const size = 256;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas not supported'));
            return;
          }
          const minSide = Math.min(img.width, img.height);
          const sx = (img.width - minSide) / 2;
          const sy = (img.height - minSide) / 2;
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => reject(new Error('Invalid image file'));
        img.src = ev.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFeedback({
        type: 'error',
        text: language === 'ar' ? 'يرجى اختيار ملف صورة صالح' : 'Please select a valid image file',
      });
      return;
    }
    try {
      const dataUrl = await compressAvatar(file);
      setPhotoURL(dataUrl);
      setFeedback(null);
    } catch {
      setFeedback({
        type: 'error',
        text: language === 'ar' ? 'تعذر معالجة الصورة المختارة' : 'Could not process the selected image',
      });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!isFirebaseAuthenticated) {
      setFeedback({
        type: 'error',
        text:
          language === 'ar'
            ? 'يرجى تسجيل الدخول لحفظ تعديلات الملف الشخصي.'
            : 'Please sign in to save profile changes.',
      });
      return;
    }
    setFeedback(null);

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
      setFeedback({
        type: 'error',
        text:
          language === 'ar'
            ? 'يجب أن يكون اسم المستخدم بين 3 و 30 حرفاً.'
            : 'Username must be between 3 and 30 characters.',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        username: trimmedUsername,
        fullName: fullName.trim(),
        bio: bio.trim(),
        photoURL: photoURL.trim(),
      };
      await updateUserProfile(user.uid, payload);
      if (onProfileUpdated) {
        onProfileUpdated(payload);
      }
      setFeedback({
        type: 'success',
        text: language === 'ar' ? 'تم حفظ التعديلات بنجاح.' : 'Profile updated successfully.',
      });
    } catch (err: any) {
      const errCode = err?.message || '';
      setFeedback({
        type: 'error',
        text:
          errCode === 'USERNAME_TAKEN'
            ? language === 'ar'
              ? 'اسم المستخدم محجوز لحساب آخر. يرجى اختيار اسم مختلف.'
              : 'That username is already taken by another account.'
            : errCode === 'INVALID_USERNAME'
            ? language === 'ar'
              ? 'استخدم 3 إلى 30 حرفاً إنجليزياً أو رقماً أو _ فقط.'
              : 'Use 3–30 English letters, numbers, or underscores (_).'
            : language === 'ar'
            ? 'حدث خطأ أثناء حفظ التغييرات. يرجى المحاولة مجدداً.'
            : err?.message || 'Failed to save changes. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUnblockUser = async (targetUid: string) => {
    if (!user || !isFirebaseAuthenticated) return;
    setUnblockingId(targetUid);
    try {
      await unblockUser(user.uid, targetUid);
      setBlockedProfiles((prev) => prev.filter((item) => item.uid !== targetUid));
    } finally {
      setUnblockingId(null);
    }
  };

  const handleConfirmLogout = async () => {
    await logOut();
    onClose();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const strength = evaluatePasswordStrength(newPwd);
    if (!strength.isValid) {
      setFeedback({
        type: 'error',
        text:
          language === 'ar'
            ? 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل وتحتوي على أحرف وأرقام.'
            : 'New password must be at least 8 characters and include letters and numbers.',
      });
      return;
    }
    if (newPwd !== confirmNewPwd) {
      setFeedback({
        type: 'error',
        text:
          language === 'ar'
            ? 'كلمة المرور الجديدة وتأكيدها غير متطابقتين.'
            : 'New password and confirmation do not match.',
      });
      return;
    }

    setUpdatingPwd(true);
    try {
      const res = await changeUserPassword(currentPwd, newPwd);
      if (res.ok) {
        setShowPasswordForm(false);
        setCurrentPwd('');
        setNewPwd('');
        setConfirmNewPwd('');
        setFeedback({
          type: 'success',
          text:
            language === 'ar'
              ? 'تم تحديث كلمة المرور بنجاح.'
              : 'Password updated successfully.',
        });
      } else {
        setFeedback({
          type: 'error',
          text:
            res.error ||
            (language === 'ar' ? 'تعذر تحديث كلمة المرور.' : 'Failed to update password.'),
        });
      }
    } finally {
      setUpdatingPwd(false);
    }
  };

  const handleOpenAccessRequest = async () => {
    setAccessModalError(null);
    setShowAccessModal(true);
    const [camState, micState] = await Promise.all([
      queryBrowserPermission('camera'),
      queryBrowserPermission('microphone'),
    ]);
    setCameraBrowserState(camState);
    setMicBrowserState(micState);

    const stored = getStoredMediaPermissions();
    if (stored) {
      setCameraAccess(stored.camera && camState !== 'denied');
      setMicAccess(stored.microphone && micState !== 'denied');
    } else {
      setCameraAccess(camState === 'granted');
      setMicAccess(micState === 'granted');
    }
  };

  const handleApplyAccessPermissions = async () => {
    setAccessModalError(null);
    setApplyingAccess(true);

    try {
      if (!cameraAccess && !micAccess) {
        saveStoredMediaPermissions({ camera: false, microphone: false });
        setShowAccessModal(false);
        setFeedback({
          type: 'success',
          text:
            language === 'ar'
              ? 'تم إيقاف أذونات الكاميرا والميكروفون للتطبيق.'
              : 'Camera and microphone access disabled for the app.',
        });
        return;
      }

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        saveStoredMediaPermissions({ camera: cameraAccess, microphone: micAccess });
        setShowAccessModal(false);
        setFeedback({
          type: 'error',
          text:
            language === 'ar'
              ? 'المتصفح الحالي لا يدعم طلب أذونات الوسائط مباشرة.'
              : 'Your browser does not support requesting media permissions directly.',
        });
        return;
      }

      let grantedCam = false;
      let grantedMic = false;
      let lastErrorName = '';

      if (cameraAccess && micAccess) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          stream.getTracks().forEach((t) => t.stop());
          grantedCam = true;
          grantedMic = true;
        } catch (err: any) {
          lastErrorName = err?.name || '';
          // Try requesting individually in case only one hardware device exists or is permitted
          try {
            const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
            camStream.getTracks().forEach((t) => t.stop());
            grantedCam = true;
          } catch (camErr: any) {
            lastErrorName = camErr?.name || lastErrorName;
          }
          try {
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micStream.getTracks().forEach((t) => t.stop());
            grantedMic = true;
          } catch (micErr: any) {
            lastErrorName = micErr?.name || lastErrorName;
          }
        }
      } else if (cameraAccess) {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
          camStream.getTracks().forEach((t) => t.stop());
          grantedCam = true;
        } catch (err: any) {
          lastErrorName = err?.name || '';
        }
      } else if (micAccess) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStream.getTracks().forEach((t) => t.stop());
          grantedMic = true;
        } catch (err: any) {
          lastErrorName = err?.name || '';
        }
      }

      const [nextCamState, nextMicState] = await Promise.all([
        queryBrowserPermission('camera'),
        queryBrowserPermission('microphone'),
      ]);
      setCameraBrowserState(nextCamState);
      setMicBrowserState(nextMicState);

      const finalCam = cameraAccess && grantedCam;
      const finalMic = micAccess && grantedMic;
      setCameraAccess(finalCam);
      setMicAccess(finalMic);
      saveStoredMediaPermissions({ camera: finalCam, microphone: finalMic });

      if ((cameraAccess && !grantedCam) || (micAccess && !grantedMic)) {
        if (lastErrorName === 'NotAllowedError' || lastErrorName === 'PermissionDeniedError') {
          setAccessModalError(
            language === 'ar'
              ? 'تم رفض الإذن من المتصفح. يرجى السماح بالوصول من إعدادات الموقع في المتصفح ثم المحاولة مجدداً.'
              : 'Permission was denied by the browser. Please allow access in your browser site settings and try again.'
          );
        } else if (lastErrorName === 'NotFoundError' || lastErrorName === 'DevicesNotFoundError') {
          setAccessModalError(
            language === 'ar'
              ? 'لم يتم العثور على جهاز كاميرا أو ميكروفون متصل.'
              : 'No connected camera or microphone device was detected.'
          );
        } else {
          setAccessModalError(
            language === 'ar'
              ? 'تعذر تفعيل بعض الأذونات المطلوبة. تحقق من صلاحيات المتصفح.'
              : 'Could not enable all requested permissions. Check your browser permissions.'
          );
        }
        return;
      }

      setShowAccessModal(false);
      setFeedback({
        type: 'success',
        text:
          language === 'ar'
            ? 'تم تطبيق أذونات الوصول بنجاح.'
            : 'Access permissions applied successfully.',
      });
    } finally {
      setApplyingAccess(false);
    }
  };

  const handleResetAppData = async () => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith('instavibe')) {
          localStorage.removeItem(key);
        }
      });
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }
      await logOut();
    } catch (e) {
      console.error('Reset error:', e);
    } finally {
      window.location.reload();
    }
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { id: 'general', label: language === 'ar' ? 'عام والمظهر' : 'General', icon: Settings },
    { id: 'profile', label: language === 'ar' ? 'الملف الشخصي' : 'Edit Profile', icon: User },
    { id: 'privacy', label: language === 'ar' ? 'الخصوصية والحساب' : 'Privacy', icon: Shield },
  ];

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={language === 'ar' ? 'الإعدادات' : 'Settings'}
    >
      <div
        className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Sheet Grabber */}
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <Settings size={20} className="text-slate-700 dark:text-slate-200" />
            <h2 className="font-bold text-lg text-slate-900 dark:text-white">
              {language === 'ar' ? 'الإعدادات' : 'Settings'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={language === 'ar' ? 'إغلاق الإعدادات' : 'Close settings'}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setFeedback(null);
                  }}
                  className={`min-h-[44px] px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon size={15} />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {feedback && (
            <div
              className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 size={16} className="shrink-0" />
              ) : (
                <AlertCircle size={16} className="shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* TAB 1: GENERAL & APPEARANCE */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Language Selector */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <Globe size={17} className="text-slate-500" />
                  <span>{language === 'ar' ? 'لغة التطبيق' : 'App Language'}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {language === 'ar'
                    ? 'اختر لغة واجهة التطبيق واتجاه العرض.'
                    : 'Choose the interface language and reading direction.'}
                </p>
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setLanguage('ar')}
                    className={`min-h-[44px] px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors whitespace-nowrap ${
                      language === 'ar'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                        : 'bg-white dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    العربية (RTL)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`min-h-[44px] px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors whitespace-nowrap ${
                      language === 'en'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                        : 'bg-white dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    English (LTR)
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800" />

              {/* Appearance / Theme Selector */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <Sun size={17} className="text-slate-500" />
                  <span>{language === 'ar' ? 'المظهر' : 'Appearance'}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {language === 'ar'
                    ? 'بدّل بين الوضع الفاتح والوضع الداكن أو اعتمد إعدادات جهازك.'
                    : 'Switch between light mode, dark mode, or follow your device setting.'}
                </p>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { id: 'light' as const, label: language === 'ar' ? 'فاتح' : 'Light', icon: Sun },
                    { id: 'dark' as const, label: language === 'ar' ? 'داكن' : 'Dark', icon: Moon },
                    { id: 'system' as const, label: language === 'ar' ? 'تلقائي' : 'System', icon: Monitor },
                  ].map((option) => {
                    const Icon = option.icon;
                    const isSelected = theme === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setTheme(option.id)}
                        className={`min-h-[44px] px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                          isSelected
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                            : 'bg-white dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Icon size={15} />
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800" />

              {/* Mobile Install & Share */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <Smartphone size={17} className="text-purple-500" />
                  <span>{language === 'ar' ? 'تثبيت ومشاركة التطبيق على الجوال' : 'Install & Share Mobile App'}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isInstalled
                    ? language === 'ar'
                      ? 'التطبيق مثبّت حالياً كتطبيق مستقل على جهازك. يمكنك مشاركة الرابط مع الآخرين.'
                      : 'App is currently installed on your device. Share the install link with others.'
                    : language === 'ar'
                    ? 'ثبّت InstaVibe على هاتفك أو أنشئ حزمة Android APK حقيقية للمشاركة مع الجميع.'
                    : 'Install InstaVibe on your phone or build an Android APK package to share with friends.'}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {!isInstalled && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (isInstallable) {
                          const ok = await install();
                          if (ok) return;
                        }
                        onClose();
                        window.dispatchEvent(new CustomEvent('instavibe:open-install'));
                      }}
                      className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <Download size={15} />
                      <span>{language === 'ar' ? 'تثبيت التطبيق / APK' : 'Install / Get APK'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      const url = publicAppUrl || window.location.origin;
                      if (navigator.share) {
                        try {
                          await navigator.share({
                            title: 'InstaVibe',
                            text: language === 'ar' ? 'ثبّت تطبيق InstaVibe على هاتفك!' : 'Install InstaVibe on your phone!',
                            url,
                          });
                          return;
                        } catch {
                          // fallback
                        }
                      }
                      await navigator.clipboard.writeText(url).catch(() => {});
                      setFeedback({
                        type: 'success',
                        text: language === 'ar' ? 'تم نسخ رابط التطبيق للمشاركة!' : 'App link copied to clipboard!',
                      });
                    }}
                    className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Share2 size={15} />
                    <span>{language === 'ar' ? 'مشاركة رابط التطبيق' : 'Share App Link'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EDIT PROFILE */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Avatar Row */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0">
                  <UserAvatar
                    src={photoURL}
                    username={username}
                    alt={username || 'Avatar'}
                    iconSize={24}
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[44px] px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <Camera size={15} />
                    <span>{language === 'ar' ? 'تغيير الصورة الشخصية' : 'Change Profile Photo'}</span>
                  </button>
                </div>
              </div>

              {/* Photo URL */}
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 block">
                  {language === 'ar' ? 'رابط الصورة (اختياري)' : 'Photo URL (Optional)'}
                </label>
                <input
                  type="text"
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
                />
              </div>

              {/* Username */}
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 block">
                  {language === 'ar' ? 'اسم المستخدم' : 'Username'}
                </label>
                <input
                  type="text"
                  minLength={3}
                  maxLength={30}
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={language === 'ar' ? '3 إلى 30 حرفاً' : '3 to 30 characters'}
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 block">
                  {language === 'ar' ? 'الاسم الكامل' : 'Full Name'}
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={language === 'ar' ? 'اسمك الكامل...' : 'Your full name...'}
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
                />
              </div>

              {/* Bio */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {language === 'ar' ? 'النبذة التعريفية' : 'Bio'}
                  </label>
                  <span className="text-[11px] text-slate-400 tabular-nums">{bio.length}/220</span>
                </div>
                <textarea
                  rows={3}
                  maxLength={220}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={language === 'ar' ? 'اكتب نبذة قصيرة عنك...' : 'Tell others a bit about you...'}
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={saving || loading}
                className="w-full min-h-[44px] py-3 px-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                <span>{language === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}</span>
              </button>
            </form>
          )}

          {/* TAB 3: PRIVACY & ACCOUNT */}
          {activeTab === 'privacy' && (
            <div className="space-y-6">
              {/* Account Info & Database Sync */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {language === 'ar' ? 'بيانات الحساب والربط' : 'Account & Database Sync'}
                </h3>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 divide-y divide-slate-200/60 dark:divide-slate-800 text-xs">
                  <div className="p-3.5 flex items-center justify-between gap-3">
                    <span className="text-slate-500 dark:text-slate-400">
                      {language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white truncate">
                      {profile?.email || user?.email || '—'}
                    </span>
                  </div>
                  <div className="p-3.5 flex items-center justify-between gap-3">
                    <span className="text-slate-500 dark:text-slate-400">
                      {language === 'ar' ? 'مزود المصادقة' : 'Auth Provider'}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {authProvider === 'password'
                        ? language === 'ar'
                          ? 'البريد الإلكتروني وكلمة المرور'
                          : 'Email & Password'
                        : 'Google'}
                    </span>
                  </div>
                  <div className="p-3.5 flex items-center justify-between gap-3">
                    <span className="text-slate-500 dark:text-slate-400">
                      {language === 'ar' ? 'توثيق البريد الإلكتروني' : 'Email Verification'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold ${
                          emailVerified
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {emailVerified
                          ? language === 'ar'
                            ? 'موثّق'
                            : 'Verified'
                          : language === 'ar'
                          ? 'بانتظار التأكيد'
                          : 'Pending'}
                      </span>
                      {!emailVerified && (
                        <>
                          <button
                            type="button"
                            disabled={sendingVerification}
                            onClick={async () => {
                              setSendingVerification(true);
                              try {
                                const ok = await resendVerificationEmail();
                                setFeedback({
                                  type: ok ? 'success' : 'error',
                                  text: ok
                                    ? language === 'ar'
                                      ? 'تم إرسال رابط التحقق إلى بريدك الإلكتروني.'
                                      : 'Verification link sent to your email.'
                                    : language === 'ar'
                                    ? 'تعذر إرسال رابط التحقق حالياً.'
                                    : 'Unable to send verification link right now.',
                                });
                              } finally {
                                setSendingVerification(false);
                              }
                            }}
                            className="px-2 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-700 text-[11px] font-bold text-slate-800 dark:text-slate-100 hover:opacity-85 disabled:opacity-50"
                          >
                            {sendingVerification ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : language === 'ar' ? (
                              'إرسال'
                            ) : (
                              'Resend'
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={checkingVerification}
                            onClick={async () => {
                              setCheckingVerification(true);
                              try {
                                const ok = await refreshEmailVerification();
                                setFeedback({
                                  type: ok ? 'success' : 'error',
                                  text: ok
                                    ? language === 'ar'
                                      ? 'تم تأكيد البريد الإلكتروني بنجاح.'
                                      : 'Email verified successfully.'
                                    : language === 'ar'
                                    ? 'لم يتم تفعيل البريد بعد. افتح الرابط المرسل ثم أعد الفحص.'
                                    : 'Email not verified yet. Open the sent link then refresh.',
                                });
                              } finally {
                                setCheckingVerification(false);
                              }
                            }}
                            aria-label={language === 'ar' ? 'تحديث حالة التحقق' : 'Refresh verification status'}
                            className="p-1 rounded-lg bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:opacity-85 disabled:opacity-50"
                          >
                            <RefreshCw size={12} className={checkingVerification ? 'animate-spin' : ''} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="p-3.5 flex items-center justify-between gap-3">
                    <span className="text-slate-500 dark:text-slate-400">
                      {language === 'ar' ? 'حالة قاعدة البيانات' : 'Database Sync'}
                    </span>
                    <span
                      className={`font-bold ${
                        dbSyncStatus === 'connected'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : dbSyncStatus === 'error'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {dbSyncStatus === 'connected'
                        ? language === 'ar'
                          ? 'متصل ومتزامن'
                          : 'Connected & Synced'
                        : dbSyncStatus === 'error'
                        ? language === 'ar'
                          ? 'خطأ في المزامنة'
                          : 'Sync Error'
                        : language === 'ar'
                        ? 'جاري الاتصال...'
                        : 'Connecting...'}
                    </span>
                  </div>
                </div>
              </div>

              {authProvider === 'password' && (
                <>
                  <div className="border-t border-slate-100 dark:border-slate-800" />
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <KeyRound size={16} className="text-purple-500" />
                        <span>{language === 'ar' ? 'كلمة المرور والأمان' : 'Password & Security'}</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowPasswordForm((prev) => !prev)}
                        className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline"
                      >
                        {showPasswordForm
                          ? language === 'ar'
                            ? 'إلغاء'
                            : 'Cancel'
                          : language === 'ar'
                          ? 'تغيير كلمة المرور'
                          : 'Change Password'}
                      </button>
                    </div>

                    {showPasswordForm ? (
                      <form onSubmit={handleChangePassword} className="space-y-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                        <input
                          type="password"
                          dir="ltr"
                          required
                          autoComplete="current-password"
                          value={currentPwd}
                          onChange={(e) => setCurrentPwd(e.target.value)}
                          placeholder={language === 'ar' ? 'كلمة المرور الحالية' : 'Current password'}
                          className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl px-3.5 py-2 text-xs border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
                        />
                        <input
                          type="password"
                          dir="ltr"
                          required
                          minLength={8}
                          autoComplete="new-password"
                          value={newPwd}
                          onChange={(e) => setNewPwd(e.target.value)}
                          placeholder={
                            language === 'ar'
                              ? 'كلمة المرور الجديدة (8+ أحرف وأرقام)'
                              : 'New password (8+ chars, letters & numbers)'
                          }
                          className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl px-3.5 py-2 text-xs border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
                        />
                        <input
                          type="password"
                          dir="ltr"
                          required
                          minLength={8}
                          autoComplete="new-password"
                          value={confirmNewPwd}
                          onChange={(e) => setConfirmNewPwd(e.target.value)}
                          placeholder={
                            language === 'ar' ? 'تأكيد كلمة المرور الجديدة' : 'Confirm new password'
                          }
                          className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl px-3.5 py-2 text-xs border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
                        />
                        <button
                          type="submit"
                          disabled={updatingPwd}
                          className="w-full min-h-[40px] py-2 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {updatingPwd && <Loader2 size={14} className="animate-spin" />}
                          <span>{language === 'ar' ? 'حفظ كلمة المرور الجديدة' : 'Update Password'}</span>
                        </button>
                      </form>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {language === 'ar'
                          ? 'يمكنك تحديث كلمة مرور حسابك بشكل دوري لتعزيز الحماية.'
                          : 'Update your account password anytime to keep your account secure.'}
                      </p>
                    )}
                  </div>
                </>
              )}

              <div className="border-t border-slate-100 dark:border-slate-800" />

              {/* Active Login Sessions */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {language === 'ar' ? 'جلسات تسجيل الدخول النشطة' : 'Active Login Sessions'}
                  </h3>
                  <span className="text-xs text-slate-400 tabular-nums">
                    {loginSessions.filter((s) => s.status === 'active').length}
                  </span>
                </div>
                {loginSessions.filter((s) => s.status === 'active').length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-1">
                    {language === 'ar'
                      ? 'لا توجد جلسات نشطة مسجلة حالياً.'
                      : 'No active sessions recorded yet.'}
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
                    {loginSessions
                      .filter((s) => s.status === 'active')
                      .slice(0, 6)
                      .map((session) => {
                        const isCurrent = session.sessionId === currentSessionId;
                        const lastSeenDate = session.lastActiveAt?.toDate?.();
                        return (
                          <div
                            key={session.sessionId}
                            className="p-3 bg-white dark:bg-slate-900 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {session.deviceLabel}
                                </p>
                                {isCurrent && (
                                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                    {language === 'ar' ? 'الجلسة الحالية' : 'Current'}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                                <span>
                                  {session.provider === 'password'
                                    ? language === 'ar'
                                      ? 'البريد الإلكتروني'
                                      : 'Email'
                                    : 'Google'}
                                </span>
                                <span>•</span>
                                <span>
                                  {lastSeenDate
                                    ? lastSeenDate.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : language === 'ar'
                                    ? 'نشط الآن'
                                    : 'Active now'}
                                </span>
                              </p>
                            </div>
                            {!isCurrent && (
                              <button
                                type="button"
                                disabled={revokingSessionId === session.sessionId}
                                onClick={async () => {
                                  setRevokingSessionId(session.sessionId);
                                  try {
                                    await revokeSession(session.sessionId);
                                  } finally {
                                    setRevokingSessionId(null);
                                  }
                                }}
                                className="min-h-[34px] px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-xs font-semibold shrink-0 disabled:opacity-50"
                              >
                                {revokingSessionId === session.sessionId ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : language === 'ar' ? (
                                  'إنهاء'
                                ) : (
                                  'Revoke'
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800" />

              {/* Access Request / Device Permissions Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {language === 'ar' ? 'أذونات الوصول' : 'Access Permissions'}
                  </h3>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {cameraAccess || micAccess
                      ? language === 'ar'
                        ? `${cameraAccess ? 'الكاميرا' : ''}${cameraAccess && micAccess ? ' • ' : ''}${micAccess ? 'الميكروفون' : ''} مفعّل`
                        : `${cameraAccess ? 'Camera' : ''}${cameraAccess && micAccess ? ' • ' : ''}${micAccess ? 'Microphone' : ''} active`
                      : language === 'ar'
                      ? 'غير مفعّل'
                      : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {language === 'ar'
                    ? 'التحكم في أذونات الكاميرا والميكروفون للبث المباشر والمحتوى.'
                    : 'Manage Camera and Microphone access permissions for Live streams and media.'}
                </p>
                <button
                  type="button"
                  onClick={handleOpenAccessRequest}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-sm font-semibold flex items-center justify-between gap-3 transition-colors border border-slate-200/80 dark:border-slate-700"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <ShieldCheck size={17} className="text-purple-600 dark:text-purple-400 shrink-0" />
                    <span className="truncate">
                      {language === 'ar' ? 'طلب أذونات الوصول (الكاميرا والميكروفون)' : 'Access Request (Camera & Mic)'}
                    </span>
                  </span>
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400 shrink-0">
                    {language === 'ar' ? 'فتح' : 'Open'}
                  </span>
                </button>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800" />

              {/* Blocked Users */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {language === 'ar' ? 'الحسابات المحظورة' : 'Blocked Accounts'}
                  </h3>
                  <span className="text-xs text-slate-400 tabular-nums">{blockedUsers.length}</span>
                </div>

                {loadingBlocked ? (
                  <div className="flex justify-center py-6">
                    <Loader2 size={20} className="animate-spin text-slate-400" />
                  </div>
                ) : blockedProfiles.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-3">
                    {language === 'ar'
                      ? 'لا توجد حسابات محظورة حالياً.'
                      : 'You have not blocked any accounts.'}
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
                    {blockedProfiles.map((item) => (
                      <div
                        key={item.uid}
                        className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                            <UserAvatar
                              src={item.photoURL}
                              username={item.username}
                              iconSize={16}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {item.username}
                            </p>
                            {item.fullName && (
                              <p className="text-[11px] text-slate-500 truncate">{item.fullName}</p>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={unblockingId === item.uid}
                          onClick={() => handleUnblockUser(item.uid)}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
                        >
                          {unblockingId === item.uid ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <UserCheck size={13} />
                          )}
                          <span>{language === 'ar' ? 'إلغاء الحظر' : 'Unblock'}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800" />

              {/* Log Out Section */}
              <div className="space-y-2">
                {!confirmLogout ? (
                  <button
                    type="button"
                    onClick={() => setConfirmLogout(true)}
                    className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <LogOut size={16} />
                    <span>{language === 'ar' ? 'تسجيل الخروج' : 'Log Out'}</span>
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 space-y-2.5">
                    <p className="text-xs font-semibold text-red-700 dark:text-red-300 text-center">
                      {language === 'ar'
                        ? 'هل تريد بالتأكيد تسجيل الخروج؟'
                        : 'Are you sure you want to log out?'}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmLogout(false)}
                        className="min-h-[40px] py-2 px-3 rounded-lg bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      >
                        {language === 'ar' ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmLogout}
                        className="min-h-[40px] py-2 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                      >
                        {language === 'ar' ? 'تأكيد الخروج' : 'Confirm Log Out'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800" />

              {/* Reset App Data Section */}
              <div className="space-y-2">
                {!confirmReset ? (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <Trash2 size={16} />
                    <span>{language === 'ar' ? 'تصفير بيانات التطبيق والذاكرة المؤقتة' : 'Reset App Data & Cache'}</span>
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 space-y-2.5">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 text-center">
                      {language === 'ar'
                        ? 'هل تريد بالتأكيد تصفير ومسح جميع بيانات الذاكرة المحلية والمسودات؟'
                        : 'Are you sure you want to reset and clear all local data & drafts?'}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmReset(false)}
                        className="min-h-[40px] py-2 px-3 rounded-lg bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      >
                        {language === 'ar' ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={handleResetAppData}
                        className="min-h-[40px] py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                      >
                        {language === 'ar' ? 'تأكيد التصفير' : 'Confirm Reset'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Standalone Access Request Modal */}
      {showAccessModal && (
        <div
          className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => !applyingAccess && setShowAccessModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label={language === 'ar' ? 'طلب الوصول' : 'Access request'}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#242528] text-slate-900 dark:text-white rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold tracking-tight">
                {language === 'ar' ? 'طلب الوصول' : 'Access request'}
              </h3>
              <button
                type="button"
                disabled={applyingAccess}
                onClick={() => setShowAccessModal(false)}
                aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                <X size={19} />
              </button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {language === 'ar'
                ? 'يطلب التطبيق الوصول إلى الأذونات التالية:'
                : 'The app requests access to the following permissions:'}
            </p>

            {/* Permission Toggles */}
            <div className="space-y-3">
              {/* Camera Row */}
              <div className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/[0.03]">
                <div className="flex items-center gap-3 min-w-0">
                  <Camera size={18} className="text-slate-500 dark:text-slate-300 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {language === 'ar' ? 'الكاميرا' : 'Camera'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {cameraBrowserState === 'denied'
                        ? language === 'ar'
                          ? 'محظور من إعدادات المتصفح'
                          : 'Blocked in browser settings'
                        : cameraAccess
                        ? language === 'ar'
                          ? 'مفعّل'
                          : 'Enabled'
                        : language === 'ar'
                        ? 'غير مفعّل'
                        : 'Disabled'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={cameraAccess}
                  aria-label={language === 'ar' ? 'إذن الكاميرا' : 'Camera permission'}
                  dir="ltr"
                  disabled={applyingAccess}
                  onClick={() => {
                    setAccessModalError(null);
                    setCameraAccess((prev) => !prev);
                  }}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors focus:outline-none disabled:opacity-50 ${
                    cameraAccess
                      ? 'bg-purple-600 border-purple-600'
                      : 'bg-slate-300 dark:bg-[#3a3b40] border-slate-400 dark:border-slate-500'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      cameraAccess ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Microphone Row */}
              <div className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/[0.03]">
                <div className="flex items-center gap-3 min-w-0">
                  <Mic size={18} className="text-slate-500 dark:text-slate-300 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {language === 'ar' ? 'الميكروفون' : 'Microphone'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {micBrowserState === 'denied'
                        ? language === 'ar'
                          ? 'محظور من إعدادات المتصفح'
                          : 'Blocked in browser settings'
                        : micAccess
                        ? language === 'ar'
                          ? 'مفعّل'
                          : 'Enabled'
                        : language === 'ar'
                        ? 'غير مفعّل'
                        : 'Disabled'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={micAccess}
                  aria-label={language === 'ar' ? 'إذن الميكروفون' : 'Microphone permission'}
                  dir="ltr"
                  disabled={applyingAccess}
                  onClick={() => {
                    setAccessModalError(null);
                    setMicAccess((prev) => !prev);
                  }}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors focus:outline-none disabled:opacity-50 ${
                    micAccess
                      ? 'bg-purple-600 border-purple-600'
                      : 'bg-slate-300 dark:bg-[#3a3b40] border-slate-400 dark:border-slate-500'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      micAccess ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            {accessModalError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/70 text-red-600 dark:text-red-300 text-xs font-medium flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{accessModalError}</span>
              </div>
            )}

            {/* Apply Action */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={applyingAccess}
                onClick={handleApplyAccessPermissions}
                className="min-h-[42px] px-6 py-2 rounded-full bg-slate-900 dark:bg-white/15 hover:bg-slate-800 dark:hover:bg-white/25 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {applyingAccess && <Loader2 size={15} className="animate-spin" />}
                <span>{language === 'ar' ? 'تطبيق' : 'Apply'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
