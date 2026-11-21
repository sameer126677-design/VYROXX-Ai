import { AnimationScenePlan, VisualContinuityBible } from './shared/sceneSchema';

export type AuthView = 'welcome' | 'login' | 'signup' | 'verify-email' | 'forgot-password' | 'age-consent';

export type MainSection = 'home' | 'workspace' | 'projects' | 'assets' | 'settings' | 'privacy' | 'terms';

export type ProjectStatus = 'idle' | 'generating' | 'completed' | 'failed';

export interface AttachedFileItem {
  id: string;
  name: string;
  size: string;
  mimeType: string;
  type: 'image' | 'video' | 'audio' | 'document';
  assetId?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments?: AttachedFileItem[];
  scenePlan?: AnimationScenePlan;
  jobId?: string;
  versionNumber?: number;
  status?: 'generating' | 'completed' | 'failed';
  error?: string;
}

export interface ProjectVersion {
  version: number;
  prompt: string;
  timestamp: string;
  scenePlan: AnimationScenePlan;
}

export interface ProjectRecord {
  id: string;
  userId: string;
  title: string;
  status: ProjectStatus;
  chatId: string;
  visualContinuity: VisualContinuityBible;
  latestScenePlan: AnimationScenePlan | null;
  latestJobId?: string;
  thumbnailSummary?: string;
  favorite: boolean;
  archived: boolean;
  deletedAt: string | null;
  versionCount: number;
  createdAtMs: number;
  updatedAtMs: number;
  lastModifiedLabel: string;
}

export interface ChatThreadRecord {
  id: string;
  userId: string;
  projectId: string;
  title: string;
  messages: ChatMessage[];
  versions: ProjectVersion[];
  historyIndex: number;
  createdAtMs: number;
  updatedAtMs: number;
  lastOpenedAtMs: number;
}

export type AssetCategory =
  | 'Characters'
  | 'Backgrounds'
  | 'Props'
  | 'Images'
  | 'Videos'
  | 'Audio'
  | 'Other Files';

export interface AssetRecord {
  id: string;
  userId: string;
  name: string;
  category: AssetCategory;
  mimeType: string;
  fileFormat: string;
  fileSizeBytes: number;
  fileSizeLabel: string;
  source: 'Uploaded' | 'AI-Generated';
  storagePath: string;
  associatedProjectId: string | null;
  favorited: boolean;
  textPreview?: string | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface GenerationJobRecord {
  id: string;
  userId: string;
  projectId: string;
  chatId: string;
  status: 'queued' | 'planning' | 'validating' | 'rendering' | 'completed' | 'failed';
  prompt: string;
  progress: number;
  stageLabel: string;
  error: string | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface PrivacyConsentRecord {
  essentialStorage: boolean;
  optionalAnalytics: boolean;
  aiProcessingConsent: boolean;
  ageNoticeAcknowledged?: boolean;
  consentVersion?: string;
  consentedAt: string;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  accentColor: 'cyan' | 'blue' | 'indigo' | 'emerald';
  compactMode: boolean;
  glassIntensity: 'subtle' | 'standard' | 'high';
  language: string;
  aiResponseStyle: 'concise' | 'balanced' | 'detailed';
  autoPlayPreviews: boolean;
  autoSaveInterval: 'instant' | '1m' | '5m';
  defaultFps: '24' | '30' | '60' | 'custom';
  customDefaultFps: number;
  defaultExportFormat: 'WebM' | 'MP4' | 'GIF';
  defaultExportQuality: 'Standard' | 'High' | 'Maximum';
  previewQuality: 'Draft' | 'Balanced' | 'Full Resolution';
  defaultBackground: 'Original' | 'Transparent';
  defaultWidth: number;
  defaultHeight: number;
  notifications: {
    generationComplete: boolean;
    exportComplete: boolean;
    generationFailed: boolean;
    productUpdates: boolean;
  };
}

export interface UserProfileRecord {
  uid: string;
  displayName: string;
  username: string;
  email: string;
  photoURL: string;
  bio: string;
  roleTitle: string;
  emailVerified: boolean;
  ageConfirmed18Plus: boolean;
  privacyConsent: PrivacyConsentRecord;
  preferences: AppSettings;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface ExportConfig {
  fileName: string;
  format: 'WebM' | 'MP4' | 'GIF';
  resolutionPreset: '720p' | '1080p' | '1440p' | '4K' | 'Custom';
  width: number;
  height: number;
  fpsPreset: '24' | '30' | '60' | 'Custom';
  customFps: number;
  quality: 'Standard' | 'High' | 'Maximum';
  includeAudio: boolean;
  background: 'Original' | 'Transparent';
}
