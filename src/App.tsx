/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  LayoutGrid,
  FolderKanban,
  Package,
  Settings as SettingsIcon,
  Loader2,
} from 'lucide-react';
import {
  EmailAuthProvider,
  User,
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider, testFirestoreConnection } from './lib/firebase';
import { DEFAULT_APP_SETTINGS, createInitialConsentRecord } from './lib/defaults';
import {
  associateAssetWithProject,
  createAssetRecord,
  createGenerationJob,
  createProjectAndChat,
  deleteAllUserFirestoreData,
  deleteAssetRecord,
  ensureUserProfile,
  exportAllUserData,
  getReadableErrorMessage,
  permanentlyDeleteProject,
  renameAssetRecord,
  renameProjectAndChat,
  saveChatAndProjectGenerationResult,
  softDeleteOrRecoverProject,
  subscribeChatThread,
  subscribeProjectJobs,
  subscribeUserAssets,
  subscribeUserProfile,
  subscribeUserProjects,
  toggleAssetFavorite,
  toggleProjectArchive,
  toggleProjectFavorite,
  touchChatOpened,
  updateChatMessagesOnly,
  updateGenerationJob,
  updateUserProfileAndSettings,
} from './lib/firestoreService';
import {
  deleteAccountServerStorage as wipeServerStorageApi,
  deleteAssetBinary,
  fetchAuthenticatedAssetBlobUrl,
  planAnimationScene,
  toFriendlyAiErrorMessage,
  uploadAssetBinary,
} from './lib/apiClient';
import {
  AnimationScenePlan,
  createDefaultVisualContinuity,
  isContinuityEstablished,
  mergeVisualContinuity,
  normalizeScenePlan,
  normalizeVisualContinuity,
} from './shared/sceneSchema';
import { MAX_UPLOAD_BYTES, validateUploadBytes } from './shared/uploadValidation';
import {
  AppSettings,
  AssetCategory,
  AssetRecord,
  AttachedFileItem,
  AuthView,
  ChatMessage,
  ChatThreadRecord,
  GenerationJobRecord,
  MainSection,
  ProjectRecord,
  ProjectVersion,
  UserProfileRecord,
} from './types';
import { UserAvatar, VyroxxOrbIcon, VyroxxVLogo } from './components/BrandLogo';
import { AuthScreens } from './components/AuthScreens';
import { HomeView } from './components/HomeView';
import { WorkspaceView } from './components/WorkspaceView';
import { ProjectsView } from './components/ProjectsView';
import { AssetsView } from './components/AssetsView';
import { SettingsView } from './components/SettingsView';
import { LegalPageView } from './components/LegalPages';
import {
  AssetPreviewModal,
  ConfirmModal,
  ExportModal,
  RenameModal,
  ReuseAssetModal,
  UploadAssetModal,
  VersionHistoryModal,
} from './components/Modals';

function inferAssetCategoryFromFile(file: File): AssetCategory {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext)) return 'Images';
  if (['mp4', 'webm', 'mov'].includes(ext)) return 'Videos';
  if (['mp3', 'wav', 'ogg'].includes(ext)) return 'Audio';
  return 'Other Files';
}

const NAV_STATE_STORAGE_PREFIX = 'vyroxx_nav_';

function loadSavedNavState(uid: string): {
  section?: MainSection;
  projectId?: string | null;
} {
  try {
    const raw = sessionStorage.getItem(`${NAV_STATE_STORAGE_PREFIX}${uid}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { section?: MainSection; projectId?: string | null };
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveNavState(uid: string, section: MainSection, projectId: string | null) {
  try {
    sessionStorage.setItem(
      `${NAV_STATE_STORAGE_PREFIX}${uid}`,
      JSON.stringify({ section, projectId })
    );
  } catch {
    // Ignore storage quota errors
  }
}

function clearNavState(uid?: string | null) {
  try {
    if (uid) {
      sessionStorage.removeItem(`${NAV_STATE_STORAGE_PREFIX}${uid}`);
    }
  } catch {
    // Ignore
  }
}

export default function App() {
  // Firebase Authentication State
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [verifiedTokenUid, setVerifiedTokenUid] = useState<string | null>(null);
  const [needsAgeConsent, setNeedsAgeConsent] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [authView, setAuthView] = useState<AuthView>('welcome');
  const pendingSignupMetaRef = useRef<{
    displayName: string;
    username: string;
    ageConfirmed18Plus: boolean;
    optionalAnalytics: boolean;
  } | null>(null);

  // Real Firestore User Data
  const [profile, setProfile] = useState<UserProfileRecord | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);

  // Navigation & Active Project Workspace State
  const [activeSection, setActiveSection] = useState<MainSection>('home');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<ChatThreadRecord | null>(null);
  const [projectJobs, setProjectJobs] = useState<GenerationJobRecord[]>([]);

  // Generation & UI Feedback State
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingMsgId, setRegeneratingMsgId] = useState<string | null>(null);
  const [homeSubmitting, setHomeSubmitting] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<AttachedFileItem[]>([]);

  // Modals State
  const [exportModalState, setExportModalState] = useState<{
    isOpen: boolean;
    scenePlan: AnimationScenePlan | null;
    projectTitle: string;
  }>({
    isOpen: false,
    scenePlan: null,
    projectTitle: '',
  });
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<AssetRecord | null>(null);
  const [reuseAsset, setReuseAsset] = useState<AssetRecord | null>(null);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);

  const [renameTarget, setRenameTarget] = useState<{
    type: 'project' | 'asset';
    id: string;
    chatId?: string;
    currentName: string;
  } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'project-trash' | 'project-permanent' | 'asset';
    id: string;
    chatId?: string;
    storagePath?: string;
    name: string;
  } | null>(null);

  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const initializeVerifiedSession = async (fbUser: User) => {
    setProfileError(null);
    setNeedsAgeConsent(false);
    let tokenRes = await fbUser.getIdTokenResult(false);
    if (tokenRes.claims.email_verified !== true) {
      await fbUser.getIdToken(true);
      tokenRes = await fbUser.getIdTokenResult(false);
    }

    testFirestoreConnection().catch(() => {});

    let ensured: UserProfileRecord | null = null;
    let lastErr: unknown = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        ensured = await ensureUserProfile(
          fbUser,
          pendingSignupMetaRef.current || undefined
        );
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        // Force fresh JWT token once and retry briefly if Firestore just received newly verified status
        await fbUser.getIdToken(true).catch(() => {});
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    if (ensured) {
      pendingSignupMetaRef.current = null;
      setProfile(ensured);
      setFirebaseUser(fbUser);
      setNeedsAgeConsent(false);
      setVerifiedTokenUid(fbUser.uid);
    } else if (!lastErr) {
      // User authenticated via provider (e.g. first-time Google Sign-In) without 18+ & DPDP consent yet
      setFirebaseUser(fbUser);
      setVerifiedTokenUid(null);
      setNeedsAgeConsent(true);
    } else {
      console.error('Failed to ensure user profile:', lastErr);
      setProfileError(
        getReadableErrorMessage(lastErr, 'Unable to initialize your user profile in Firestore.')
      );
      setVerifiedTokenUid(null);
    }
  };

  // 1. Observe Firebase Authentication Session
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setFirebaseUser(null);
        setVerifiedTokenUid(null);
        setNeedsAgeConsent(false);
        setProfile(null);
        setProfileError(null);
        setProjects([]);
        setAssets([]);
        setActiveProjectId(null);
        setActiveChat(null);
        setProjectJobs([]);
        setProjectsLoading(false);
        setAssetsLoading(false);
        setAuthReady(true);
        return;
      }

      if (!fbUser.emailVerified) {
        try {
          await fbUser.reload();
        } catch {
          // Ignore offline reload error
        }
      }

      setFirebaseUser(fbUser);

      if (!fbUser.emailVerified) {
        setVerifiedTokenUid(null);
        setAuthView('verify-email');
        setAuthReady(true);
        return;
      }

      try {
        await initializeVerifiedSession(fbUser);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsubAuth();
  }, []);

  // 2. Subscribe to Verified User's Profile, Projects, and Assets (only after verified JWT is ready)
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified || verifiedTokenUid !== firebaseUser.uid) {
      return;
    }

    const uid = firebaseUser.uid;
    setProjectsLoading(true);
    setAssetsLoading(true);

    const savedNav = loadSavedNavState(uid);
    if (savedNav.projectId) {
      setActiveProjectId((prev) => prev || savedNav.projectId || null);
    }
    if (
      savedNav.section &&
      ['home', 'workspace', 'projects', 'assets', 'settings'].includes(savedNav.section)
    ) {
      setActiveSection((prev) => (prev === 'home' ? savedNav.section! : prev));
    }

    const unsubProfile = subscribeUserProfile(
      uid,
      (p) => {
        if (p) setProfile(p);
      },
      (err) => console.error(err)
    );

    const unsubProjects = subscribeUserProjects(
      uid,
      (list) => {
        setProjects(list);
        setProjectsLoading(false);
      },
      (err) => {
        console.error(err);
        setProjectsLoading(false);
      }
    );

    const unsubAssets = subscribeUserAssets(
      uid,
      (list) => {
        setAssets(list);
        setAssetsLoading(false);
      },
      (err) => {
        console.error(err);
        setAssetsLoading(false);
      }
    );

    return () => {
      unsubProfile();
      unsubProjects();
      unsubAssets();
    };
  }, [firebaseUser, firebaseUser?.emailVerified, verifiedTokenUid]);

  const activeProject =
    projects.find((p) => p.id === activeProjectId && !p.deletedAt) || null;

  useEffect(() => {
    if (!verifiedTokenUid) return;
    if (!projectsLoading && activeSection === 'workspace' && !activeProject) {
      setActiveProjectId(null);
      setActiveSection('home');
      return;
    }
    saveNavState(verifiedTokenUid, activeSection, activeProjectId);
  }, [verifiedTokenUid, activeSection, activeProjectId, activeProject, projectsLoading]);

  // 3. Subscribe to Active Project's Chat Thread & Generation Jobs
  useEffect(() => {
    if (
      !firebaseUser ||
      !firebaseUser.emailVerified ||
      verifiedTokenUid !== firebaseUser.uid ||
      !activeProject
    ) {
      setActiveChat(null);
      setProjectJobs([]);
      return;
    }

    const uid = firebaseUser.uid;
    touchChatOpened(uid, activeProject.chatId);

    const unsubChat = subscribeChatThread(
      uid,
      activeProject.chatId,
      (chat) => setActiveChat(chat),
      (err) => console.error(err)
    );

    const unsubJobs = subscribeProjectJobs(uid, activeProject.id, (jobs) => {
      setProjectJobs(jobs);
    });

    return () => {
      unsubChat();
      unsubJobs();
    };
  }, [
    firebaseUser,
    firebaseUser?.emailVerified,
    verifiedTokenUid,
    activeProject?.id,
    activeProject?.chatId,
  ]);

  // 4. Apply Theme Preference
  const settings: AppSettings = profile?.preferences || DEFAULT_APP_SETTINGS;

  useEffect(() => {
    const root = document.documentElement;
    const isDark =
      settings.theme === 'dark' ||
      (settings.theme === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  const handleRefreshVerification = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    if (auth.currentUser.emailVerified) {
      await auth.currentUser.getIdToken(true);
      await initializeVerifiedSession(auth.currentUser);
      setActiveSection('home');
    }
  };

  const uploadAttachedFilesForProject = async (
    uid: string,
    projectId: string,
    rawFiles: File[]
  ): Promise<void> => {
    for (const file of rawFiles) {
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error(`Attachment "${file.name}" exceeds the 20 MB upload limit.`);
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const preCheck = validateUploadBytes(
        file.name,
        file.type || 'application/octet-stream',
        bytes
      );
      if (!preCheck.ok) {
        throw new Error(`Attachment "${file.name}" rejected: ${preCheck.error}`);
      }
      const ext = (file.name.split('.').pop() || 'FILE').toUpperCase().slice(0, 20);
      const sizeKB = Math.max(1, Math.round(file.size / 1024));
      const sizeLabel =
        sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;

      let textPreview: string | null = null;
      if (
        file.type.includes('json') ||
        file.type.startsWith('text/') ||
        ext === 'JSON' ||
        ext === 'TXT'
      ) {
        try {
          textPreview = (await file.text()).slice(0, 18000);
        } catch {
          textPreview = null;
        }
      }

      const uploaded = await uploadAssetBinary(file);
      await createAssetRecord(uid, {
        name: file.name.replace(/\.[^/.]+$/, '').slice(0, 160) || file.name,
        category: inferAssetCategoryFromFile(file),
        mimeType: file.type || 'application/octet-stream',
        fileFormat: ext,
        fileSizeBytes: uploaded.fileSizeBytes,
        fileSizeLabel: sizeLabel,
        source: 'Uploaded',
        storagePath: uploaded.storagePath,
        associatedProjectId: projectId,
        favorited: false,
        textPreview,
      });
    }
  };

  // Core AI Generation Pipeline
  const runGenerationPipeline = async (params: {
    uid: string;
    projectId: string;
    chatId: string;
    promptText: string;
    existingMessages: ChatMessage[];
    existingVersions: ProjectVersion[];
    existingContinuity: ProjectRecord['visualContinuity'];
    currentScenePlan: AnimationScenePlan | null;
    attachmentsSummary?: string[];
    isRegenerate?: boolean;
  }) => {
    const {
      uid,
      projectId,
      chatId,
      promptText,
      existingMessages,
      existingVersions,
      existingContinuity,
      currentScenePlan,
      attachmentsSummary,
      isRegenerate,
    } = params;

    const safeExistingContinuity = normalizeVisualContinuity(existingContinuity);
    let safeCurrentScenePlan: AnimationScenePlan | null = null;
    if (currentScenePlan) {
      const normalizedCurrent = normalizeScenePlan(currentScenePlan, {
        fallbackContinuity: safeExistingContinuity,
      });
      safeCurrentScenePlan = normalizedCurrent.ok ? normalizedCurrent.data : null;
    }

    setWorkspaceError(null);
    setIsGenerating(true);

    let jobId = '';
    try {
      jobId = await createGenerationJob(uid, projectId, chatId, promptText);

      const conversationHistory = existingMessages
        .filter((m) => m.status !== 'failed')
        .slice(-12)
        .map((m) => ({
          role: m.role,
          content: m.content.slice(0, 1400),
        }));

      const requestedFps =
        settings.defaultFps === 'custom'
          ? settings.customDefaultFps
          : Number(settings.defaultFps) || 30;

      let aiResponse: { assistantMessage: string; scenePlan: AnimationScenePlan };
      if (import.meta.env.DEV && promptText.trim() === '/devtest whale') {
        const { DEV_WHALE_SCENE_PLAN } = await import('../tests/fixtures/devWhale');
        const normalizedDev = normalizeScenePlan(DEV_WHALE_SCENE_PLAN, {
          width: settings.defaultWidth,
          height: settings.defaultHeight,
          fps: requestedFps,
          fallbackContinuity: safeExistingContinuity,
        });
        if (!normalizedDev.ok) {
          throw new Error(normalizedDev.error);
        }
        aiResponse = {
          assistantMessage:
            'Loaded DEV test fixture: Blue Whale (14-part 3D custom model).',
          scenePlan: normalizedDev.data,
        };
      } else {
        aiResponse = await planAnimationScene({
          prompt: promptText,
          projectId,
          conversationHistory,
          existingContinuity: safeExistingContinuity,
          currentScenePlan: safeCurrentScenePlan,
          requestedWidth: settings.defaultWidth,
          requestedHeight: settings.defaultHeight,
          requestedFps,
          requestedBackground:
            settings.defaultBackground === 'Transparent' ? 'transparent' : 'scene',
          attachmentsSummary,
          aiResponseStyle: settings.aiResponseStyle,
          isRegenerate,
        });
      }

      const hasPriorIdentity =
        Boolean(safeCurrentScenePlan) ||
        isContinuityEstablished(safeExistingContinuity);

      const mergedContinuity = mergeVisualContinuity(
        hasPriorIdentity ? safeExistingContinuity : null,
        aiResponse.scenePlan.visualContinuity
      );

      const validatedScenePlan: AnimationScenePlan = {
        ...aiResponse.scenePlan,
        visualContinuity: mergedContinuity,
      };

      await updateGenerationJob(uid, jobId, {
        status: 'validating',
        progress: 85,
        stageLabel: 'Saving scene continuity & animation plan to Firestore...',
      });

      const nextVersionNum = existingVersions.length + 1;
      const newVersion: ProjectVersion = {
        version: nextVersionNum,
        prompt: promptText.slice(0, 400),
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        scenePlan: validatedScenePlan,
      };

      const aiMsg: ChatMessage = {
        id: `msg_ai_${Date.now()}`,
        role: 'assistant',
        content: aiResponse.assistantMessage,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        scenePlan: validatedScenePlan,
        jobId,
        versionNumber: nextVersionNum,
        status: 'completed',
      };

      const nextVersions = [...existingVersions, newVersion];
      const nextMessages = [...existingMessages, aiMsg];

      await saveChatAndProjectGenerationResult(uid, projectId, chatId, {
        status: 'completed',
        messages: nextMessages,
        versions: nextVersions,
        historyIndex: nextVersions.length - 1,
        visualContinuity: mergedContinuity,
        latestScenePlan: validatedScenePlan,
        latestJobId: jobId,
        thumbnailSummary: validatedScenePlan.summary,
      });

      await updateGenerationJob(uid, jobId, {
        status: 'completed',
        progress: 100,
        stageLabel: 'Completed',
      });
    } catch (err) {
      const errMsg = toFriendlyAiErrorMessage(
        getReadableErrorMessage(
          err,
          'Animation generation failed. Please retry.'
        )
      );
      setWorkspaceError(errMsg);

      if (jobId) {
        await updateGenerationJob(uid, jobId, {
          status: 'failed',
          progress: 0,
          stageLabel: 'Generation failed',
          error: errMsg,
        }).catch(() => {});
      }

      const failedMsg: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: 'I could not complete that scene generation request.',
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        jobId: jobId || undefined,
        status: 'failed',
        error: errMsg,
      };

      await saveChatAndProjectGenerationResult(uid, projectId, chatId, {
        status: 'failed',
        messages: [...existingMessages, failedMsg],
        versions: existingVersions,
        historyIndex: existingVersions.length - 1,
        visualContinuity: safeExistingContinuity,
        latestScenePlan: safeCurrentScenePlan,
        latestJobId: jobId,
        thumbnailSummary: safeCurrentScenePlan?.summary || '',
      }).catch(() => {});
    } finally {
      setIsGenerating(false);
    }
  };

  // Start a New Project from Home
  const handleHomePromptSubmit = async (
    promptText: string,
    attachments: AttachedFileItem[],
    rawFiles: File[]
  ) => {
    if (!firebaseUser || !firebaseUser.emailVerified || !profile) return;
    setHomeError(null);
    setHomeSubmitting(true);

    try {
      const titleFromPrompt =
        promptText
          .replace(/^(create|make|build|generate)\s+(an?\s+)?/i, '')
          .split(/[.,!?]/)[0]
          .trim()
          .slice(0, 60) || 'New Animation';

      const userMsg: ChatMessage = {
        id: `msg_u_${Date.now()}`,
        role: 'user',
        content: promptText,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      const { projectId, chatId } = await createProjectAndChat(
        firebaseUser.uid,
        titleFromPrompt,
        [userMsg]
      );

      if (rawFiles.length > 0) {
        await uploadAttachedFilesForProject(firebaseUser.uid, projectId, rawFiles);
      }

      setPendingAttachments([]);
      setActiveProjectId(projectId);
      setActiveSection('workspace');
      setHomeSubmitting(false);

      await runGenerationPipeline({
        uid: firebaseUser.uid,
        projectId,
        chatId,
        promptText,
        existingMessages: [userMsg],
        existingVersions: [],
        existingContinuity: createDefaultVisualContinuity(),
        currentScenePlan: null,
        attachmentsSummary: attachments.map((a) => `${a.name} (${a.type})`),
      });
    } catch (err) {
      setHomeSubmitting(false);
      setHomeError(
        toFriendlyAiErrorMessage(
          getReadableErrorMessage(err, 'Failed to start project.')
        )
      );
    }
  };

  // Follow-up Prompt in Workspace
  const handleWorkspacePromptSubmit = async (
    promptText: string,
    attachments: AttachedFileItem[],
    rawFiles: File[]
  ) => {
    if (!firebaseUser || !activeProject || !activeChat || isGenerating) return;

    const uid = firebaseUser.uid;
    try {
      if (rawFiles.length > 0) {
        await uploadAttachedFilesForProject(uid, activeProject.id, rawFiles);
      }

      const userMsg: ChatMessage = {
        id: `msg_u_${Date.now()}`,
        role: 'user',
        content: promptText,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      const nextMessages = [...activeChat.messages, userMsg];

      await updateChatMessagesOnly(
        uid,
        activeChat.id,
        nextMessages,
        activeChat.versions,
        activeChat.historyIndex
      );

      setPendingAttachments([]);

      await runGenerationPipeline({
        uid,
        projectId: activeProject.id,
        chatId: activeChat.id,
        promptText,
        existingMessages: nextMessages,
        existingVersions: activeChat.versions,
        existingContinuity: normalizeVisualContinuity(activeProject.visualContinuity),
        currentScenePlan: activeProject.latestScenePlan,
        attachmentsSummary: attachments.map((a) => `${a.name} (${a.type})`),
      });
    } catch (err) {
      setWorkspaceError(
        toFriendlyAiErrorMessage(
          getReadableErrorMessage(err, 'Failed to send workspace message.')
        )
      );
    }
  };

  const handleRetryPrompt = async (
    promptText: string,
    attachments?: AttachedFileItem[]
  ) => {
    if (!firebaseUser || !activeProject || !activeChat || isGenerating) return;
    await runGenerationPipeline({
      uid: firebaseUser.uid,
      projectId: activeProject.id,
      chatId: activeChat.id,
      promptText,
      existingMessages: activeChat.messages,
      existingVersions: activeChat.versions,
      existingContinuity: normalizeVisualContinuity(activeProject.visualContinuity),
      currentScenePlan: activeProject.latestScenePlan,
      attachmentsSummary: attachments?.map((a) => `${a.name} (${a.type})`),
    });
  };

  const handleRegenerateMessage = async (messageId: string) => {
    if (!firebaseUser || !activeProject || !activeChat || isGenerating) return;

    const msgIdx = activeChat.messages.findIndex((m) => m.id === messageId);
    const precedingUser = [...activeChat.messages.slice(0, msgIdx >= 0 ? msgIdx : undefined)]
      .reverse()
      .find((m) => m.role === 'user');
    const promptToUse =
      precedingUser?.content ||
      activeChat.versions[activeChat.historyIndex]?.prompt ||
      activeProject.title;

    setRegeneratingMsgId(messageId);
    try {
      await runGenerationPipeline({
        uid: firebaseUser.uid,
        projectId: activeProject.id,
        chatId: activeChat.id,
        promptText: promptToUse,
        existingMessages: activeChat.messages,
        existingVersions: activeChat.versions,
        existingContinuity: normalizeVisualContinuity(activeProject.visualContinuity),
        currentScenePlan: activeProject.latestScenePlan,
        attachmentsSummary: precedingUser?.attachments?.map(
          (a) => `${a.name} (${a.type})`
        ),
        isRegenerate: true,
      });
    } finally {
      setRegeneratingMsgId(null);
    }
  };

  const handleRestoreVersion = async (index: number, version: ProjectVersion) => {
    if (!firebaseUser || !activeProject || !activeChat) return;

    const normalizedVersionPlan = normalizeScenePlan(version.scenePlan, {
      fallbackContinuity: normalizeVisualContinuity(activeProject.visualContinuity),
    });
    if (!normalizedVersionPlan.ok) {
      setWorkspaceError('Cannot restore this version because its scene data is incomplete.');
      return;
    }

    const restoreNote: ChatMessage = {
      id: `msg_restore_${Date.now()}`,
      role: 'assistant',
      content: `Restored Version ${version.version} ("${version.prompt}"):`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      versionNumber: version.version,
      status: 'completed',
      scenePlan: normalizedVersionPlan.data,
    };

    try {
      await saveChatAndProjectGenerationResult(
        firebaseUser.uid,
        activeProject.id,
        activeChat.id,
        {
          status: 'completed',
          messages: [...activeChat.messages, restoreNote],
          versions: activeChat.versions,
          historyIndex: index,
          visualContinuity: normalizedVersionPlan.data.visualContinuity,
          latestScenePlan: normalizedVersionPlan.data,
          latestJobId: activeProject.latestJobId || '',
          thumbnailSummary: normalizedVersionPlan.data.summary,
        }
      );
    } catch (err) {
      setWorkspaceError(getReadableErrorMessage(err, 'Failed to restore version.'));
    }
  };

  const handleUndo = () => {
    if (!activeChat || activeChat.historyIndex <= 0) return;
    const prevIdx = activeChat.historyIndex - 1;
    const targetVer = activeChat.versions[prevIdx];
    if (targetVer) handleRestoreVersion(prevIdx, targetVer);
  };

  const handleRedo = () => {
    if (!activeChat || activeChat.historyIndex >= activeChat.versions.length - 1) return;
    const nextIdx = activeChat.historyIndex + 1;
    const targetVer = activeChat.versions[nextIdx];
    if (targetVer) handleRestoreVersion(nextIdx, targetVer);
  };

  const handleClearWorkspaceHistory = async () => {
    if (!firebaseUser || !activeChat) return;
    try {
      await updateChatMessagesOnly(
        firebaseUser.uid,
        activeChat.id,
        [],
        activeChat.versions,
        activeChat.historyIndex
      );
    } catch (err) {
      setWorkspaceError(
        getReadableErrorMessage(err, 'Failed to clear conversation history.')
      );
    }
  };

  const handleDownloadAsset = async (asset: AssetRecord) => {
    try {
      if (asset.storagePath) {
        const blobUrl = await fetchAuthenticatedAssetBlobUrl(asset.storagePath);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${asset.name.replace(/\s+/g, '_')}.${asset.fileFormat.toLowerCase()}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
      } else if (asset.textPreview) {
        const blob = new Blob([asset.textPreview], { type: asset.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${asset.name}.${asset.fileFormat.toLowerCase()}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Asset download error:', err);
    }
  };

  const handleSelectProjectForAsset = async (
    projectId: string | 'new',
    asset: AssetRecord
  ) => {
    if (!firebaseUser) return;
    const attachment: AttachedFileItem = {
      id: `att_reuse_${Date.now()}`,
      name: `${asset.name}.${asset.fileFormat.toLowerCase()}`,
      size: asset.fileSizeLabel,
      mimeType: asset.mimeType,
      type:
        asset.category === 'Videos'
          ? 'video'
          : asset.category === 'Audio'
          ? 'audio'
          : asset.category === 'Other Files'
          ? 'document'
          : 'image',
      assetId: asset.id,
    };

    setPendingAttachments([attachment]);
    setReuseAsset(null);

    if (projectId === 'new') {
      setActiveSection('home');
    } else {
      await associateAssetWithProject(firebaseUser.uid, asset.id, projectId).catch(() => {});
      setActiveProjectId(projectId);
      setActiveSection('workspace');
    }
  };

  const handleExportAccountData = async () => {
    if (!firebaseUser) return;
    const data = await exportAllUserData(firebaseUser.uid);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vyroxx_data_export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteAccount = async (currentPasswordForReauth?: string) => {
    const fbUser = auth.currentUser;
    if (!fbUser || !profile) {
      throw new Error('No active authenticated user.');
    }

    // Reauthenticate first if needed so we don't wipe data then fail deleteUser
    const usesPassword = fbUser.providerData.some((p) => p.providerId === 'password');
    if (usesPassword && fbUser.email) {
      if (!currentPasswordForReauth) {
        throw new Error('Please enter your current password to confirm account deletion.');
      }
      const cred = EmailAuthProvider.credential(fbUser.email, currentPasswordForReauth);
      await reauthenticateWithCredential(fbUser, cred);
    } else {
      await reauthenticateWithPopup(fbUser, googleProvider);
    }

    await wipeServerStorageApi().catch(() => {});
    await deleteAllUserFirestoreData(fbUser.uid, profile.username);
    await deleteUser(fbUser);
  };

  // Loading splash while Firebase Auth resolves
  if (!authReady) {
    return (
      <div className="min-h-screen w-full vyroxx-bg flex flex-col items-center justify-center gap-4 text-slate-300">
        <VyroxxVLogo size={64} />
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
          <span>Initializing secure workspace...</span>
        </div>
      </div>
    );
  }

  // Protected Route Gate: Block unauthenticated, unverified, or age/consent-unconfirmed users
  if (!firebaseUser || !firebaseUser.emailVerified || needsAgeConsent) {
    return (
      <AuthScreens
        authView={
          firebaseUser && !firebaseUser.emailVerified
            ? 'verify-email'
            : firebaseUser && needsAgeConsent
            ? 'age-consent'
            : authView
        }
        setAuthView={setAuthView}
        unverifiedUserEmail={firebaseUser?.email}
        onRefreshVerification={handleRefreshVerification}
        onSignupMetadataReady={(meta) => {
          pendingSignupMetaRef.current = meta;
        }}
        onCompleteAgeConsent={async (meta) => {
          if (!auth.currentUser) return;
          pendingSignupMetaRef.current = {
            displayName:
              auth.currentUser.displayName ||
              auth.currentUser.email?.split('@')[0] ||
              'Creator',
            username: auth.currentUser.email?.split('@')[0] || '',
            ageConfirmed18Plus: meta.ageConfirmed18Plus,
            optionalAnalytics: meta.optionalAnalytics,
          };
          await initializeVerifiedSession(auth.currentUser);
        }}
      />
    );
  }

  // Profile loading / recovery fallback while Firestore ensures user document
  if (!profile) {
    return (
      <div className="min-h-screen w-full vyroxx-bg flex flex-col items-center justify-center gap-4 px-6 text-center text-slate-300">
        <VyroxxVLogo size={56} />
        {profileError ? (
          <div className="max-w-md rounded-2xl vyroxx-glass p-6 border border-rose-500/40 space-y-4">
            <h2 className="text-lg font-semibold text-white">
              Workspace Connection Error
            </h2>
            <p className="text-xs text-rose-200 leading-relaxed">{profileError}</p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (firebaseUser) initializeVerifiedSession(firebaseUser);
                }}
                className="px-4 py-2 rounded-xl vyroxx-btn-primary text-xs font-semibold cursor-pointer"
              >
                Retry Connection
              </button>
              <button
                type="button"
                onClick={async () => {
                  await signOut(auth);
                  setAuthView('login');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
            <span>Loading your VYROXX profile...</span>
          </div>
        )}
      </div>
    );
  }

  const isLightMode = settings.theme === 'light';
  const activeJob =
    projectJobs.find((j) => j.status !== 'completed' && j.status !== 'failed') ||
    projectJobs[0] ||
    null;

  const navItems: {
    id: MainSection;
    label: string;
    icon: React.ElementType;
  }[] = [
    { id: 'home', label: 'Home', icon: LayoutGrid },
    { id: 'projects', label: 'My Projects', icon: FolderKanban },
    { id: 'assets', label: 'My Assets', icon: Package },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div
      className={`min-h-screen w-full flex flex-col sm:flex-row relative overflow-hidden ${
        isLightMode ? 'vyroxx-light-bg text-slate-900' : 'vyroxx-bg text-slate-100'
      }`}
    >
      {/* Top-Right Profile Avatar */}
      <div className="fixed top-4 right-5 z-30">
        <UserAvatar
          avatarUrl={profile.photoURL}
          name={profile.displayName}
          size={44}
          onClick={() => setActiveSection('settings')}
        />
      </div>

      {/* Slim Vertical Left Sidebar */}
      <aside className="hidden sm:flex flex-col items-center py-5 px-2.5 w-[68px] shrink-0 bg-slate-950/75 backdrop-blur-2xl border-r border-white/10 z-30 select-none">
        <button
          type="button"
          onClick={() => setActiveSection('home')}
          className="mb-7 hover:scale-105 transition-transform cursor-pointer"
          title="VYROXX Home"
        >
          <VyroxxOrbIcon size={40} />
        </button>

        <nav className="flex flex-col items-center gap-3.5 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeSection === item.id ||
              (item.id === 'home' && activeSection === 'workspace');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                title={item.label}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-800/90 text-cyan-300 border border-cyan-400/65 shadow-[0_0_20px_rgba(34,211,238,0.35)]'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className="w-5 h-5" />
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 h-14 bg-slate-950/90 backdrop-blur-xl border-t border-white/10 flex items-center justify-around z-40 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            activeSection === item.id ||
            (item.id === 'home' && activeSection === 'workspace');
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-xl text-[11px] font-medium ${
                isActive ? 'text-cyan-300' : 'text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Main Viewport */}
      <main className="flex-1 min-w-0 min-h-screen sm:h-screen overflow-y-auto pt-14 sm:pt-12 pb-16 sm:pb-0">
        {activeSection === 'home' && (
          <HomeView
            user={profile}
            onSubmitPrompt={handleHomePromptSubmit}
            pendingAttachments={pendingAttachments}
            onClearPendingAttachments={() => setPendingAttachments([])}
            isSubmitting={homeSubmitting}
            submitError={homeError}
          />
        )}

        {activeSection === 'workspace' && activeProject && (
          <WorkspaceView
            project={activeProject}
            chatThread={activeChat}
            activeJob={activeJob}
            user={profile}
            settings={settings}
            onSendMessage={handleWorkspacePromptSubmit}
            onRetryPrompt={handleRetryPrompt}
            onRegenerateMessage={handleRegenerateMessage}
            onOpenExport={(scenePlan, projectTitle) =>
              setExportModalState({ isOpen: true, scenePlan, projectTitle })
            }
            onOpenRename={() =>
              setRenameTarget({
                type: 'project',
                id: activeProject.id,
                chatId: activeProject.chatId,
                currentName: activeProject.title,
              })
            }
            onOpenVersionHistory={() => setVersionHistoryOpen(true)}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClearHistory={handleClearWorkspaceHistory}
            onNewProject={() => setActiveSection('home')}
            isGenerating={isGenerating}
            regeneratingMsgId={regeneratingMsgId}
            autosaveError={workspaceError}
            pendingAttachments={pendingAttachments}
            onClearPendingAttachments={() => setPendingAttachments([])}
          />
        )}

        {activeSection === 'workspace' && !activeProject && (
          <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center">
            <p className="text-slate-400 text-sm mb-4">
              Select a project or start a new prompt to enter the Creation Workspace.
            </p>
            <button
              type="button"
              onClick={() => setActiveSection('home')}
              className="px-5 py-2.5 rounded-xl vyroxx-btn-primary text-xs sm:text-sm cursor-pointer"
            >
              Go to Home Prompt
            </button>
          </div>
        )}

        {activeSection === 'projects' && (
          <ProjectsView
            projects={projects}
            loading={projectsLoading}
            onOpenProject={(projId) => {
              setActiveProjectId(projId);
              setActiveSection('workspace');
            }}
            onNewProject={() => setActiveSection('home')}
            onRenameProject={(proj) =>
              setRenameTarget({
                type: 'project',
                id: proj.id,
                chatId: proj.chatId,
                currentName: proj.title,
              })
            }
            onToggleFavorite={(projectId, nextFav) =>
              toggleProjectFavorite(firebaseUser.uid, projectId, nextFav)
            }
            onDownloadProject={(scenePlan, projectTitle) =>
              setExportModalState({ isOpen: true, scenePlan, projectTitle })
            }
            onToggleArchive={(projectId, nextArch) =>
              toggleProjectArchive(firebaseUser.uid, projectId, nextArch)
            }
            onDeleteProject={(proj) =>
              setDeleteTarget({
                type: 'project-trash',
                id: proj.id,
                name: proj.title,
              })
            }
            onRecoverProject={(projectId) =>
              softDeleteOrRecoverProject(firebaseUser.uid, projectId, false)
            }
            onPermanentDeleteProject={(proj) =>
              setDeleteTarget({
                type: 'project-permanent',
                id: proj.id,
                chatId: proj.chatId,
                name: proj.title,
              })
            }
          />
        )}

        {activeSection === 'assets' && (
          <AssetsView
            assets={assets}
            loading={assetsLoading}
            onOpenUploadModal={() => setUploadModalOpen(true)}
            onPreviewAsset={(asset) => setPreviewAsset(asset)}
            onRenameAsset={(asset) =>
              setRenameTarget({
                type: 'asset',
                id: asset.id,
                currentName: asset.name,
              })
            }
            onReuseInProject={(asset) => setReuseAsset(asset)}
            onDownloadAsset={handleDownloadAsset}
            onToggleFavoriteAsset={(assetId, nextFav) =>
              toggleAssetFavorite(firebaseUser.uid, assetId, nextFav)
            }
            onDeleteAsset={(asset) =>
              setDeleteTarget({
                type: 'asset',
                id: asset.id,
                storagePath: asset.storagePath,
                name: asset.name,
              })
            }
          />
        )}

        {activeSection === 'settings' && (
          <SettingsView
            user={profile}
            projectsCount={projects.filter((p) => !p.deletedAt).length}
            assets={assets}
            onSaveProfileAndSettings={async (updates) => {
              const currentConsent =
                profile.privacyConsent || createInitialConsentRecord(false);
              await updateUserProfileAndSettings(firebaseUser.uid, profile.username, {
                displayName: updates.displayName,
                username: updates.username,
                photoURL: updates.photoURL,
                bio: updates.bio,
                roleTitle: updates.roleTitle,
                preferences: updates.preferences,
                privacyConsent: {
                  ...currentConsent,
                  optionalAnalytics: updates.optionalAnalytics,
                  consentedAt: new Date().toISOString(),
                },
              });
            }}
            onRequestLogout={() => setLogoutModalOpen(true)}
            onManageProjects={() => setActiveSection('projects')}
            onExportAccountData={handleExportAccountData}
            onDeleteAccount={handleDeleteAccount}
            onOpenLegal={(page) => setActiveSection(page)}
          />
        )}

        {(activeSection === 'privacy' || activeSection === 'terms') && (
          <LegalPageView
            page={activeSection}
            onBack={() => setActiveSection('settings')}
          />
        )}
      </main>

      {/* Modals */}
      {exportModalState.scenePlan && (
        <ExportModal
          isOpen={exportModalState.isOpen}
          onClose={() => setExportModalState((p) => ({ ...p, isOpen: false }))}
          defaultProjectName={exportModalState.projectTitle}
          scenePlan={exportModalState.scenePlan}
          settings={settings}
        />
      )}

      <UploadAssetModal
        isOpen={uploadModalOpen}
        uid={firebaseUser.uid}
        onClose={() => setUploadModalOpen(false)}
      />

      <AssetPreviewModal
        asset={previewAsset}
        onClose={() => setPreviewAsset(null)}
        onReuseInProject={(asset) => setReuseAsset(asset)}
        onDownloadAsset={handleDownloadAsset}
      />

      <ReuseAssetModal
        asset={reuseAsset}
        projects={projects}
        onClose={() => setReuseAsset(null)}
        onSelectProject={handleSelectProjectForAsset}
      />

      {activeProject && (
        <VersionHistoryModal
          isOpen={versionHistoryOpen}
          project={activeProject}
          chatThread={activeChat}
          onClose={() => setVersionHistoryOpen(false)}
          onRestoreVersion={handleRestoreVersion}
        />
      )}

      <RenameModal
        isOpen={Boolean(renameTarget)}
        title={renameTarget?.type === 'project' ? 'Rename Project' : 'Rename Asset'}
        initialValue={renameTarget?.currentName || ''}
        onClose={() => setRenameTarget(null)}
        onSave={async (newName) => {
          if (!renameTarget) return;
          if (renameTarget.type === 'project' && renameTarget.chatId) {
            await renameProjectAndChat(
              firebaseUser.uid,
              renameTarget.id,
              renameTarget.chatId,
              newName
            );
          } else if (renameTarget.type === 'asset') {
            await renameAssetRecord(firebaseUser.uid, renameTarget.id, newName);
          }
        }}
      />

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title={
          deleteTarget?.type === 'project-permanent'
            ? 'Permanently Delete Project'
            : deleteTarget?.type === 'project-trash'
            ? 'Move Project to Trash'
            : 'Delete Asset'
        }
        description={
          deleteTarget?.type === 'project-permanent'
            ? `Are you sure you want to permanently delete "${deleteTarget.name}"? This action cannot be undone.`
            : deleteTarget?.type === 'project-trash'
            ? `Move "${deleteTarget?.name}" to Trash & Recovery? You can restore it anytime from Recently Deleted.`
            : `Remove "${deleteTarget?.name}" from your asset library and delete its uploaded file?`
        }
        confirmLabel={
          deleteTarget?.type === 'project-permanent' ? 'Delete Permanently' : 'Delete'
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (deleteTarget.type === 'project-trash') {
            await softDeleteOrRecoverProject(firebaseUser.uid, deleteTarget.id, true);
          } else if (deleteTarget.type === 'project-permanent' && deleteTarget.chatId) {
            await permanentlyDeleteProject(
              firebaseUser.uid,
              deleteTarget.id,
              deleteTarget.chatId
            );
            if (activeProjectId === deleteTarget.id) {
              setActiveProjectId(null);
            }
          } else if (deleteTarget.type === 'asset') {
            await deleteAssetRecord(firebaseUser.uid, deleteTarget.id);
            if (deleteTarget.storagePath) {
              await deleteAssetBinary(deleteTarget.storagePath);
            }
          }
        }}
      />

      <ConfirmModal
        isOpen={logoutModalOpen}
        title="Log Out of VYROXX"
        description="Sign out of your current VYROXX session? Your projects and assets stay safely synced in your Cloud Firestore account."
        confirmLabel="Log Out"
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={async () => {
          clearNavState(firebaseUser?.uid);
          await signOut(auth);
          setActiveProjectId(null);
          setActiveSection('home');
          setAuthView('welcome');
        }}
      />
    </div>
  );
}
