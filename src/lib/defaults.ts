import { AppSettings, PrivacyConsentRecord } from '../types';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'dark',
  accentColor: 'cyan',
  compactMode: false,
  glassIntensity: 'standard',
  language: 'English (US)',
  aiResponseStyle: 'balanced',
  autoPlayPreviews: true,
  autoSaveInterval: 'instant',
  defaultFps: '30',
  customDefaultFps: 30,
  defaultExportFormat: 'WebM',
  defaultExportQuality: 'High',
  previewQuality: 'Full Resolution',
  defaultBackground: 'Original',
  defaultWidth: 1280,
  defaultHeight: 720,
  notifications: {
    generationComplete: true,
    exportComplete: true,
    generationFailed: true,
    productUpdates: false,
  },
};

export const CURRENT_CONSENT_VERSION = '2026-11-dpdp-v1';

export function createInitialConsentRecord(optionalAnalytics = false): PrivacyConsentRecord {
  return {
    essentialStorage: true,
    optionalAnalytics,
    aiProcessingConsent: true,
    ageNoticeAcknowledged: true,
    consentVersion: CURRENT_CONSENT_VERSION,
    consentedAt: new Date().toISOString(),
  };
}
