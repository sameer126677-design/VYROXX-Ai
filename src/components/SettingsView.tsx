import React, { useEffect, useRef, useState } from 'react';
import {
  User,
  Palette,
  Sliders,
  Settings,
  Bell,
  Lock,
  HardDrive,
  Info,
  Check,
  ShieldCheck,
  Download,
  Trash2,
  ExternalLink,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getReadableErrorMessage, isUsernameAvailable } from '../lib/firestoreService';
import { uploadAssetBinary } from '../lib/apiClient';
import { isSafeAvatarUrl, MAX_UPLOAD_BYTES, validateUploadBytes } from '../shared/uploadValidation';
import { AppSettings, AssetRecord, UserProfileRecord } from '../types';
import { UserAvatar } from './BrandLogo';

interface SettingsViewProps {
  user: UserProfileRecord;
  projectsCount: number;
  assets: AssetRecord[];
  onSaveProfileAndSettings: (updates: {
    displayName: string;
    username: string;
    photoURL: string;
    bio: string;
    roleTitle: string;
    preferences: AppSettings;
    optionalAnalytics: boolean;
  }) => Promise<void>;
  onRequestLogout: () => void;
  onManageProjects: () => void;
  onExportAccountData: () => Promise<void>;
  onDeleteAccount: (currentPasswordForReauth?: string) => Promise<void>;
  onOpenLegal: (page: 'privacy' | 'terms') => void;
}

type SettingsTab =
  | 'profile'
  | 'appearance'
  | 'preferences'
  | 'creation'
  | 'notifications'
  | 'privacy'
  | 'storage'
  | 'about';

const SETTINGS_NAV: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'preferences', label: 'Preferences', icon: Sliders },
  { id: 'creation', label: 'Creation Settings', icon: Settings },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'privacy', label: 'Privacy & Security', icon: Lock },
  { id: 'storage', label: 'Storage & Data', icon: HardDrive },
  { id: 'about', label: 'About & Support', icon: Info },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  projectsCount,
  assets,
  onSaveProfileAndSettings,
  onRequestLogout,
  onManageProjects,
  onExportAccountData,
  onDeleteAccount,
  onOpenLegal,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username);
  const [photoURL, setPhotoURL] = useState(user.photoURL);
  const [bio, setBio] = useState(user.bio);
  const [roleTitle, setRoleTitle] = useState(user.roleTitle);
  const [draftPrefs, setDraftPrefs] = useState<AppSettings>(user.preferences);
  const [optionalAnalytics, setOptionalAnalytics] = useState(
    Boolean(user.privacyConsent?.optionalAnalytics)
  );

  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'valid' | 'taken'>('idle');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Account deletion confirm state
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Export state
  const [exportingData, setExportingData] = useState(false);

  useEffect(() => {
    setDisplayName(user.displayName);
    setUsername(user.username);
    setPhotoURL(user.photoURL);
    setBio(user.bio);
    setRoleTitle(user.roleTitle);
    setDraftPrefs(user.preferences);
    setOptionalAnalytics(Boolean(user.privacyConsent?.optionalAnalytics));
  }, [user]);

  const showNotice = (msg: string) => {
    setErrorNotice(null);
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(null), 3200);
  };

  const showError = (msg: string) => {
    setSavedNotice(null);
    setErrorNotice(msg);
  };

  const handleUsernameBlur = async () => {
    if (!username.trim()) return;
    setUsernameStatus('checking');
    try {
      const res = await isUsernameAvailable(username, user.uid);
      setUsernameStatus(res.available ? 'valid' : 'taken');
      if (!res.available && res.error) {
        showError(res.error);
      }
    } catch {
      setUsernameStatus('idle');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showError('Please choose an image file (PNG, JPG, WebP, SVG).');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      showError('Profile photo exceeds the 20 MB upload limit.');
      return;
    }
    setUploadingPhoto(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const check = validateUploadBytes(file.name, file.type, bytes);
      if (!check.ok) {
        showError(check.error);
        return;
      }
      const { storagePath } = await uploadAssetBinary(file);
      setPhotoURL(storagePath);
      showNotice('Profile photo uploaded. Click Save Changes to persist.');
    } catch (err) {
      showError(getReadableErrorMessage(err, 'Photo upload failed.'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveAll = async () => {
    setErrorNotice(null);
    if (!displayName.trim()) {
      showError('Display Name cannot be empty.');
      return;
    }
    if (!isSafeAvatarUrl(photoURL)) {
      showError('Invalid profile photo reference.');
      return;
    }
    setSaving(true);
    try {
      await onSaveProfileAndSettings({
        displayName: displayName.trim(),
        username: username.trim(),
        photoURL,
        bio: bio.trim(),
        roleTitle: roleTitle.trim(),
        preferences: draftPrefs,
        optionalAnalytics,
      });
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: displayName.trim(),
        }).catch(() => {});
      }
      showNotice('Settings saved to Cloud Firestore.');
    } catch (err) {
      showError(getReadableErrorMessage(err, 'Failed to save changes.'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancelChanges = () => {
    setDisplayName(user.displayName);
    setUsername(user.username);
    setPhotoURL(user.photoURL);
    setBio(user.bio);
    setRoleTitle(user.roleTitle);
    setDraftPrefs(user.preferences);
    setOptionalAnalytics(Boolean(user.privacyConsent?.optionalAnalytics));
    setErrorNotice(null);
    showNotice('Reverted unsaved changes.');
  };

  const handleChangePassword = async () => {
    const fbUser = auth.currentUser;
    if (!fbUser || !fbUser.email) {
      showError('No authenticated user found.');
      return;
    }
    const usesPassword = fbUser.providerData.some((p) => p.providerId === 'password');
    if (!usesPassword) {
      showError('Password changes are managed by your Google Sign-In provider.');
      return;
    }
    if (!currentPassword || newPassword.length < 8) {
      showError('Enter your current password and a new password of at least 8 characters.');
      return;
    }
    setPasswordLoading(true);
    try {
      const cred = EmailAuthProvider.credential(fbUser.email, currentPassword);
      await reauthenticateWithCredential(fbUser, cred);
      await updatePassword(fbUser, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      showNotice('Password updated in Firebase Authentication.');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not update password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccountSubmit = async () => {
    if (deleteConfirmText !== 'DELETE') {
      showError('Type DELETE in uppercase to confirm permanent account erasure.');
      return;
    }
    setDeletingAccount(true);
    try {
      await onDeleteAccount(deletePassword || undefined);
    } catch (err) {
      showError(
        getReadableErrorMessage(
          err,
          'Account deletion failed. You may need to log in again before deleting.'
        )
      );
      setDeletingAccount(false);
    }
  };

  const totalAssetBytes = assets.reduce((acc, a) => acc + (a.fileSizeBytes || 0), 0);
  const totalAssetLabel =
    totalAssetBytes > 1024 * 1024
      ? `${(totalAssetBytes / (1024 * 1024)).toFixed(2)} MB`
      : `${Math.round(totalAssetBytes / 1024)} KB`;

  const activeNavLabel = SETTINGS_NAV.find((n) => n.id === activeTab)?.label || 'Profile';

  return (
    <div className="min-h-full w-full flex flex-col md:flex-row">
      <aside className="w-full md:w-72 shrink-0 bg-slate-950/55 border-b md:border-b-0 md:border-r border-white/10 p-6 flex flex-col justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-7 px-2">
            Settings
          </h2>

          <nav className="space-y-1.5">
            {SETTINGS_NAV.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/70 shadow-[0_0_22px_rgba(34,211,238,0.28)]'
                      : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-300' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-8 mt-8">
          <button
            type="button"
            onClick={onRequestLogout}
            className="w-full py-3 rounded-xl bg-slate-900/80 hover:bg-rose-950/50 border border-rose-500/45 text-rose-400 hover:text-rose-200 text-sm font-medium shadow-[0_0_20px_rgba(244,63,94,0.18)] transition-all cursor-pointer"
          >
            Log Out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 px-6 sm:px-12 py-8 overflow-y-auto pr-14">
        <div className="max-w-4xl">
          <div className="text-sm text-slate-400 mb-1">{activeNavLabel}</div>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              {activeTab === 'profile' ? 'Account Settings' : activeNavLabel}
            </h1>

            {savedNotice && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-950/75 border border-emerald-400/40 text-xs font-medium text-emerald-200">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>{savedNotice}</span>
              </div>
            )}

            {errorNotice && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-950/75 border border-rose-500/40 text-xs font-medium text-rose-200">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>{errorNotice}</span>
              </div>
            )}
          </div>

          {activeTab === 'profile' && (
            <div className="space-y-5">
              <div className="rounded-2xl vyroxx-glass p-6 border border-cyan-300/25">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-white">Profile</h3>
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Email Verified</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-5">
                  <UserAvatar avatarUrl={photoURL} name={displayName} size={84} glowRing />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={uploadingPhoto}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-slate-800/85 hover:bg-slate-700 border border-white/15 text-xs sm:text-sm font-medium text-slate-100 transition-colors cursor-pointer"
                    >
                      {uploadingPhoto ? 'Uploading...' : 'Edit Photo'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoURL('')}
                      className="px-4 py-2 rounded-xl bg-slate-800/85 hover:bg-slate-700 border border-white/15 text-xs sm:text-sm font-medium text-slate-200 transition-colors cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl vyroxx-glass p-6 border border-cyan-300/25">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl vyroxx-input border-cyan-400/35 text-sm text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Email (Verified)
                      </label>
                      <input
                        type="email"
                        value={user.email}
                        readOnly
                        className="w-full px-4 py-2.5 rounded-xl vyroxx-input opacity-75 text-sm text-slate-300 cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Role / Title
                      </label>
                      <input
                        type="text"
                        value={roleTitle}
                        onChange={(e) => setRoleTitle(e.target.value)}
                        placeholder="e.g. Animator, Director, Indie Creator"
                        className="w-full px-4 py-2.5 rounded-xl vyroxx-input border-slate-500/35 text-sm text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 flex flex-col">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-slate-300">
                          Username (Unique)
                        </label>
                        {usernameStatus === 'checking' && (
                          <span className="text-[11px] text-slate-400">Checking...</span>
                        )}
                        {usernameStatus === 'valid' && (
                          <span className="text-[11px] text-emerald-400">Available</span>
                        )}
                        {usernameStatus === 'taken' && (
                          <span className="text-[11px] text-rose-400">Already taken</span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => {
                          setUsername(e.target.value);
                          setUsernameStatus('idle');
                        }}
                        onBlur={handleUsernameBlur}
                        className="w-full px-4 py-2.5 rounded-xl vyroxx-input border-cyan-400/35 text-sm text-white"
                      />
                    </div>

                    <div className="flex-1 flex flex-col">
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Bio
                      </label>
                      <textarea
                        rows={4}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell us about your creative focus..."
                        className="w-full flex-1 px-4 py-3 rounded-xl vyroxx-input border-cyan-400/35 text-sm text-slate-200 resize-none leading-relaxed"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="rounded-2xl vyroxx-glass p-6 space-y-6 border border-cyan-300/25">
              <div>
                <h3 className="text-sm font-medium text-white mb-3">Interface Theme</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(['dark', 'light', 'system'] as const).map((tMode) => (
                    <button
                      key={tMode}
                      type="button"
                      onClick={() => setDraftPrefs((p) => ({ ...p, theme: tMode }))}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                        draftPrefs.theme === tMode
                          ? 'bg-cyan-500/15 border-cyan-400 text-white'
                          : 'bg-slate-900/60 border-white/10 text-slate-300 hover:text-white'
                      }`}
                    >
                      <div className="text-sm font-semibold capitalize">{tMode} Mode</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {tMode === 'dark'
                          ? 'Deep space cinematic canvas'
                          : tMode === 'light'
                          ? 'High-key studio surface'
                          : 'Follow OS preference'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="rounded-2xl vyroxx-glass p-6 space-y-6 border border-cyan-300/25">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    Workspace Language
                  </label>
                  <select
                    value={draftPrefs.language}
                    onChange={(e) =>
                      setDraftPrefs((p) => ({ ...p, language: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl vyroxx-input text-sm text-white"
                  >
                    <option value="English (US)" className="bg-slate-900">
                      English (US)
                    </option>
                    <option value="English (UK)" className="bg-slate-900">
                      English (UK)
                    </option>
                    <option value="Hindi (हिन्दी)" className="bg-slate-900">
                      Hindi (हिन्दी)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    AI Assistant Explanation Detail
                  </label>
                  <select
                    value={draftPrefs.aiResponseStyle}
                    onChange={(e) =>
                      setDraftPrefs((p) => ({
                        ...p,
                        aiResponseStyle: e.target.value as AppSettings['aiResponseStyle'],
                      }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl vyroxx-input text-sm text-white"
                  >
                    <option value="concise" className="bg-slate-900">
                      Concise
                    </option>
                    <option value="balanced" className="bg-slate-900">
                      Balanced
                    </option>
                    <option value="detailed" className="bg-slate-900">
                      Detailed
                    </option>
                  </select>
                </div>
              </div>

              <label className="flex items-center justify-between pt-4 border-t border-white/10 cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-white">Auto-Play Previews</div>
                  <div className="text-xs text-slate-400">
                    Automatically start animation playback when AI finishes planning a scene
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={draftPrefs.autoPlayPreviews}
                  onChange={(e) =>
                    setDraftPrefs((p) => ({ ...p, autoPlayPreviews: e.target.checked }))
                  }
                  className="w-5 h-5 accent-cyan-400 rounded cursor-pointer"
                />
              </label>
            </div>
          )}

          {activeTab === 'creation' && (
            <div className="rounded-2xl vyroxx-glass p-6 space-y-6 border border-cyan-300/25">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    Default FPS
                  </label>
                  <select
                    value={draftPrefs.defaultFps}
                    onChange={(e) =>
                      setDraftPrefs((p) => ({
                        ...p,
                        defaultFps: e.target.value as AppSettings['defaultFps'],
                      }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl vyroxx-input text-sm text-white"
                  >
                    <option value="24" className="bg-slate-900">
                      24 FPS
                    </option>
                    <option value="30" className="bg-slate-900">
                      30 FPS
                    </option>
                    <option value="60" className="bg-slate-900">
                      60 FPS
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    Default Export Format
                  </label>
                  <select
                    value={draftPrefs.defaultExportFormat}
                    onChange={(e) =>
                      setDraftPrefs((p) => ({
                        ...p,
                        defaultExportFormat: e.target.value as AppSettings['defaultExportFormat'],
                      }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl vyroxx-input text-sm text-white"
                  >
                    <option value="WebM" className="bg-slate-900">
                      WebM (VP9 / VP8)
                    </option>
                    <option value="MP4" className="bg-slate-900">
                      MP4 (Browser Codec Dependent)
                    </option>
                    <option value="GIF" className="bg-slate-900">
                      GIF (Animated GIF89a)
                    </option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10">
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Default Canvas Dimensions (Unrestricted Custom Width × Height)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="number"
                    min={128}
                    max={4096}
                    value={draftPrefs.defaultWidth}
                    onChange={(e) =>
                      setDraftPrefs((p) => ({
                        ...p,
                        defaultWidth: Number(e.target.value) || 1280,
                      }))
                    }
                    className="w-32 px-3.5 py-2 rounded-xl vyroxx-input text-sm font-mono-tabular text-center"
                  />
                  <span className="text-slate-400">×</span>
                  <input
                    type="number"
                    min={128}
                    max={4096}
                    value={draftPrefs.defaultHeight}
                    onChange={(e) =>
                      setDraftPrefs((p) => ({
                        ...p,
                        defaultHeight: Number(e.target.value) || 720,
                      }))
                    }
                    className="w-32 px-3.5 py-2 rounded-xl vyroxx-input text-sm font-mono-tabular text-center"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="rounded-2xl vyroxx-glass p-6 space-y-5 border border-cyan-300/25">
              {(
                [
                  {
                    key: 'generationComplete',
                    title: 'Generation Complete',
                    desc: 'Notify when an AI animation plan completes',
                  },
                  {
                    key: 'exportComplete',
                    title: 'Export Complete',
                    desc: 'Notify when rendered video or GIF export finishes',
                  },
                  {
                    key: 'generationFailed',
                    title: 'Generation Failed',
                    desc: 'Alert immediately if AI generation encounters an error',
                  },
                  {
                    key: 'productUpdates',
                    title: 'Product Updates',
                    desc: 'Optional product release announcements',
                  },
                ] as const
              ).map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between pb-4 last:pb-0 border-b last:border-b-0 border-white/10 cursor-pointer"
                >
                  <div>
                    <div className="text-sm font-medium text-white">{item.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{item.desc}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={draftPrefs.notifications[item.key]}
                    onChange={(e) =>
                      setDraftPrefs((p) => ({
                        ...p,
                        notifications: {
                          ...p.notifications,
                          [item.key]: e.target.checked,
                        },
                      }))
                    }
                    className="w-5 h-5 accent-cyan-400 rounded cursor-pointer"
                  />
                </label>
              ))}
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-5">
              <div className="rounded-2xl vyroxx-glass p-6 space-y-4 border border-cyan-300/25">
                <h3 className="text-base font-semibold text-white">Change Password</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="password"
                    placeholder="Current Password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="px-4 py-2.5 rounded-xl vyroxx-input text-sm"
                  />
                  <input
                    type="password"
                    placeholder="New Password (min 8 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="px-4 py-2.5 rounded-xl vyroxx-input text-sm"
                  />
                </div>
                <button
                  type="button"
                  disabled={passwordLoading}
                  onClick={handleChangePassword}
                  className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-xs font-medium text-cyan-200 cursor-pointer inline-flex items-center gap-2"
                >
                  {passwordLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Update Password</span>
                </button>
              </div>

              <div className="rounded-2xl vyroxx-glass p-6 space-y-4 border border-cyan-300/25">
                <h3 className="text-base font-semibold text-white">
                  Consent &amp; Data Protection Preferences
                </h3>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="text-sm font-medium text-white">
                      Optional Analytics Consent (Disabled by Default)
                    </div>
                    <div className="text-xs text-slate-400">
                      VYROXX uses zero hidden keystroke logging, session replay, or prompt/password tracking. Opt in or withdraw consent at any time.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={optionalAnalytics}
                    onChange={(e) => setOptionalAnalytics(e.target.checked)}
                    className="w-5 h-5 accent-cyan-400 rounded cursor-pointer"
                  />
                </label>

                <div className="p-3.5 rounded-xl bg-slate-900/75 border border-white/10 text-xs text-slate-300 space-y-1.5">
                  <div className="font-medium text-white">Recorded Consent Ledger</div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-400 font-mono-tabular">
                    <span>18+ Eligibility: {user.ageConfirmed18Plus ? 'Confirmed' : 'Pending'}</span>
                    <span>
                      Essential Storage:{' '}
                      {user.privacyConsent?.essentialStorage ? 'Consented' : 'Off'}
                    </span>
                    <span>
                      AI Processing:{' '}
                      {user.privacyConsent?.aiProcessingConsent ? 'Consented' : 'Off'}
                    </span>
                    <span>
                      Analytics: {user.privacyConsent?.optionalAnalytics ? 'Opted-In' : 'Off'}
                    </span>
                  </div>
                  {user.privacyConsent?.consentedAt && (
                    <div className="text-[11px] text-slate-500">
                      Last recorded: {new Date(user.privacyConsent.consentedAt).toLocaleString()}
                      {user.privacyConsent.consentVersion
                        ? ` (${user.privacyConsent.consentVersion})`
                        : ''}
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/75 border border-cyan-500/20 text-xs text-slate-300 leading-relaxed">
                  <strong className="text-cyan-300">Free Prototype &amp; Billing Safety:</strong>{' '}
                  No automatic paid subscriptions or payment card details are collected or stored.
                  Any future paid plans will require explicit authorization via a PCI-DSS compliant
                  processor with clear cancellation, refund, and renewal notices.
                </div>

                <div className="pt-3 border-t border-white/10 flex flex-wrap gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => onOpenLegal('privacy')}
                    className="text-cyan-300 hover:underline cursor-pointer"
                  >
                    Read Privacy Policy, Retention &amp; DPDP Notice
                  </button>
                  <span className="text-slate-500">·</span>
                  <button
                    type="button"
                    onClick={() => onOpenLegal('terms')}
                    className="text-cyan-300 hover:underline cursor-pointer"
                  >
                    Read Terms of Service
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'storage' && (
            <div className="space-y-5">
              <div className="rounded-2xl vyroxx-glass p-6 space-y-5 border border-cyan-300/25">
                <div>
                  <div className="text-sm font-medium text-white mb-1">
                    Your Stored Data Summary
                  </div>
                  <div className="flex flex-wrap gap-6 text-xs text-slate-300 font-mono-tabular">
                    <span>Projects: {projectsCount}</span>
                    <span>·</span>
                    <span>Uploaded Assets: {assets.length}</span>
                    <span>·</span>
                    <span>Asset Storage Used: {totalAssetLabel}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={onManageProjects}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/15 text-xs font-medium text-white cursor-pointer"
                  >
                    Manage Saved Projects
                  </button>

                  <button
                    type="button"
                    disabled={exportingData}
                    onClick={async () => {
                      setExportingData(true);
                      try {
                        await onExportAccountData();
                        showNotice('Full account archive downloaded as JSON.');
                      } finally {
                        setExportingData(false);
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-xs font-medium text-cyan-200 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>{exportingData ? 'Exporting...' : 'Export All My Data (JSON)'}</span>
                  </button>
                </div>
              </div>

              <div className="rounded-2xl vyroxx-glass p-6 space-y-4 border border-rose-500/35">
                <h3 className="text-base font-semibold text-rose-300">
                  Permanent Account Deletion (Right to Erasure)
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Permanently deletes your Firebase Authentication account, Firestore profile,
                  username reservation, all projects, chats, generation jobs, and uploaded binary
                  files. This cannot be undone.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder='Type "DELETE" to confirm'
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="px-4 py-2.5 rounded-xl vyroxx-input text-xs"
                  />
                  <input
                    type="password"
                    placeholder="Current Password (if email/password login)"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="px-4 py-2.5 rounded-xl vyroxx-input text-xs"
                  />
                </div>

                <button
                  type="button"
                  disabled={deletingAccount}
                  onClick={handleDeleteAccountSubmit}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                >
                  {deletingAccount ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span>Delete My Account Permanently</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="rounded-2xl vyroxx-glass p-6 space-y-4 border border-cyan-300/25">
              <h3 className="text-base font-semibold text-white">
                VYROXX — The Ultimate AI Creation Workspace
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Full-stack prompt-first AI animation studio powered by Firebase Authentication,
                user-isolated Cloud Firestore, server-side CodeCraft AI scene planning,
                and deterministic Spatial 3D &amp; 2D vector animation &amp; export renderers.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onOpenLegal('privacy')}
                  className="px-4 py-2 rounded-xl bg-slate-900/75 hover:bg-slate-800 border border-white/10 inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer"
                >
                  <span>Privacy Policy &amp; DPDP Notice</span>
                  <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenLegal('terms')}
                  className="px-4 py-2 rounded-xl bg-slate-900/75 hover:bg-slate-800 border border-white/10 inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer"
                >
                  <span>Terms of Service</span>
                  <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 rounded-2xl vyroxx-glass px-6 py-4 flex items-center gap-3 border border-cyan-300/25">
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveAll}
              className="px-6 py-2.5 rounded-xl vyroxx-btn-primary text-xs sm:text-sm font-semibold cursor-pointer inline-flex items-center gap-2 disabled:opacity-60"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
            <button
              type="button"
              onClick={handleCancelChanges}
              className="px-5 py-2.5 rounded-xl bg-slate-800/85 hover:bg-slate-700 border border-white/15 text-xs sm:text-sm font-medium text-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
