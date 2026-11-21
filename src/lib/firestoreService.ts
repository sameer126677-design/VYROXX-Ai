import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { auth, db } from './firebase';
import {
  AppSettings,
  AssetRecord,
  ChatMessage,
  ChatThreadRecord,
  GenerationJobRecord,
  PrivacyConsentRecord,
  ProjectRecord,
  ProjectStatus,
  ProjectVersion,
  UserProfileRecord,
} from '../types';
import {
  AnimationScenePlan,
  createDefaultVisualContinuity,
  normalizeScenePlan,
  normalizeVisualContinuity,
  VisualContinuityBible,
} from '../shared/sceneSchema';
import { createInitialConsentRecord, DEFAULT_APP_SETTINGS } from './defaults';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function getReadableErrorMessage(err: unknown, fallback = 'Operation failed.'): string {
  if (!(err instanceof Error)) return String(err || fallback);
  try {
    const parsed = JSON.parse(err.message);
    if (parsed && typeof parsed.error === 'string') {
      return parsed.error;
    }
  } catch {
    // Plain error message
  }
  return err.message || fallback;
}

function stripUndefined<T>(val: T): T {
  if (Array.isArray(val)) {
    return val.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (val !== null && typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }
  return val;
}

function toMillis(ts: unknown): number {
  if (ts instanceof Timestamp) return ts.toMillis();
  if (typeof ts === 'number') return ts;
  return Date.now();
}

export function formatRelativeTime(ms: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 45) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function normalizeUsernameSlug(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 38);
}

export async function isUsernameAvailable(
  rawUsername: string,
  currentUid?: string
): Promise<{ available: boolean; slug: string; error?: string }> {
  const slug = normalizeUsernameSlug(rawUsername);
  if (slug.length < 2) {
    return {
      available: false,
      slug,
      error: 'Username must be at least 2 alphanumeric characters.',
    };
  }
  const path = `usernames/${slug}`;
  try {
    const snap = await getDoc(doc(db, 'usernames', slug));
    if (!snap.exists()) {
      return { available: true, slug };
    }
    const data = snap.data();
    if (currentUid && data?.uid === currentUid) {
      return { available: true, slug };
    }
    return { available: false, slug, error: 'That username is already taken.' };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function claimUsername(
  uid: string,
  rawUsername: string,
  previousSlug?: string
): Promise<string> {
  const slug = normalizeUsernameSlug(rawUsername);
  if (slug.length < 2) {
    throw new Error('Username must be at least 2 valid characters (letters, numbers, _, .).');
  }
  const path = `usernames/${slug}`;
  try {
    const existingSnap = await getDoc(doc(db, 'usernames', slug));
    if (existingSnap.exists() && existingSnap.data()?.uid !== uid) {
      throw new Error(`Username "@${slug}" is already claimed by another user.`);
    }

    const batch = writeBatch(db);
    if (previousSlug && previousSlug !== slug && previousSlug.length >= 2) {
      const prevRef = doc(db, 'usernames', previousSlug);
      const prevSnap = await getDoc(prevRef);
      if (prevSnap.exists() && prevSnap.data()?.uid === uid) {
        batch.delete(prevRef);
      }
    }
    batch.set(doc(db, 'usernames', slug), {
      uid,
      username: `@${slug}`,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return `@${slug}`;
  } catch (err) {
    if (err instanceof Error && err.message.includes('already claimed')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function ensureUserProfile(
  fbUser: User,
  overrides?: {
    displayName?: string;
    username?: string;
    ageConfirmed18Plus?: boolean;
    optionalAnalytics?: boolean;
  }
): Promise<UserProfileRecord | null> {
  const path = `users/${fbUser.uid}`;
  try {
    const userRef = doc(db, 'users', fbUser.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const d = snap.data();
      if (d.ageConfirmed18Plus !== true) {
        return null;
      }
      // Sync emailVerified flag if changed
      if (d.emailVerified !== fbUser.emailVerified) {
        await updateDoc(userRef, {
          emailVerified: fbUser.emailVerified,
          updatedAt: serverTimestamp(),
        });
      }
      return {
        uid: fbUser.uid,
        displayName: d.displayName || fbUser.displayName || 'Creator',
        username: d.username || `@${normalizeUsernameSlug(fbUser.uid.slice(0, 8))}`,
        email: d.email || fbUser.email || '',
        photoURL: d.photoURL ?? fbUser.photoURL ?? '',
        bio: d.bio ?? '',
        roleTitle: d.roleTitle ?? '',
        emailVerified: fbUser.emailVerified,
        ageConfirmed18Plus: true,
        privacyConsent: d.privacyConsent || createInitialConsentRecord(false),
        preferences: { ...DEFAULT_APP_SETTINGS, ...(d.preferences || {}) },
        createdAtMs: toMillis(d.createdAt),
        updatedAtMs: toMillis(d.updatedAt),
      };
    }

    // Do NOT silently onboard new users (e.g. first-time Google Sign-In) without explicit 18+ & DPDP consent
    if (overrides?.ageConfirmed18Plus !== true) {
      return null;
    }

    const displayName = (
      overrides?.displayName?.trim() ||
      fbUser.displayName?.trim() ||
      fbUser.email?.split('@')[0] ||
      'Creator'
    ).slice(0, 100);

    let desiredSlug = normalizeUsernameSlug(
      overrides?.username || fbUser.email?.split('@')[0] || `creator_${fbUser.uid.slice(0, 6)}`
    );
    if (desiredSlug.length < 2) {
      desiredSlug = `user_${fbUser.uid.slice(0, 6).toLowerCase()}`;
    }

    // Ensure unique username on initial registration
    const avail = await isUsernameAvailable(desiredSlug, fbUser.uid);
    const finalSlug = avail.available
      ? desiredSlug
      : `${desiredSlug.slice(0, 28)}_${fbUser.uid.slice(0, 5).toLowerCase()}`;

    const finalUsername = await claimUsername(fbUser.uid, finalSlug);
    const consent = createInitialConsentRecord(Boolean(overrides?.optionalAnalytics));
    const safeEmail = (fbUser.email && fbUser.email.length >= 3 ? fbUser.email : `${fbUser.uid.slice(0, 8)}@vyroxx.local`).slice(0, 200);

    const payload = {
      uid: fbUser.uid,
      displayName,
      username: finalUsername,
      email: safeEmail,
      photoURL: (fbUser.photoURL || '').slice(0, 1000),
      bio: '',
      roleTitle: '',
      emailVerified: fbUser.emailVerified,
      ageConfirmed18Plus: true,
      privacyConsent: consent,
      preferences: DEFAULT_APP_SETTINGS,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, payload);

    return {
      ...payload,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfileRecord | null) => void,
  onError: (err: Error) => void
) {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data();
      onData({
        uid,
        displayName: d.displayName || 'Creator',
        username: d.username || '',
        email: d.email || '',
        photoURL: d.photoURL || '',
        bio: d.bio || '',
        roleTitle: d.roleTitle || '',
        emailVerified: Boolean(d.emailVerified),
        ageConfirmed18Plus: Boolean(d.ageConfirmed18Plus),
        privacyConsent: d.privacyConsent || createInitialConsentRecord(false),
        preferences: { ...DEFAULT_APP_SETTINGS, ...(d.preferences || {}) },
        createdAtMs: toMillis(d.createdAt),
        updatedAtMs: toMillis(d.updatedAt),
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (e) {
        onError(e as Error);
      }
    }
  );
}

export async function updateUserProfileAndSettings(
  uid: string,
  currentUsername: string,
  updates: {
    displayName?: string;
    username?: string;
    photoURL?: string;
    bio?: string;
    roleTitle?: string;
    preferences?: AppSettings;
    privacyConsent?: PrivacyConsentRecord;
  }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    let nextUsername = currentUsername;
    if (updates.username !== undefined) {
      const prevSlug = normalizeUsernameSlug(currentUsername);
      const nextSlug = normalizeUsernameSlug(updates.username);
      if (nextSlug !== prevSlug) {
        nextUsername = await claimUsername(uid, nextSlug, prevSlug);
      }
    }

    const patch: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (updates.displayName !== undefined) patch.displayName = updates.displayName.trim().slice(0, 100);
    if (updates.username !== undefined) patch.username = nextUsername;
    if (updates.photoURL !== undefined) patch.photoURL = updates.photoURL.slice(0, 1000);
    if (updates.bio !== undefined) patch.bio = updates.bio.slice(0, 500);
    if (updates.roleTitle !== undefined) patch.roleTitle = updates.roleTitle.slice(0, 120);
    if (updates.preferences !== undefined) patch.preferences = stripUndefined(updates.preferences);
    if (updates.privacyConsent !== undefined) {
      patch.privacyConsent = stripUndefined(updates.privacyConsent);
    }

    await updateDoc(doc(db, 'users', uid), patch);
  } catch (err) {
    if (err instanceof Error && err.message.includes('already claimed')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// --- Projects & Chats ---
export function subscribeUserProjects(
  uid: string,
  onData: (projects: ProjectRecord[]) => void,
  onError: (err: Error) => void
) {
  const path = `users/${uid}/projects`;
  const q = query(
    collection(db, 'users', uid, 'projects'),
    where('userId', '==', uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: ProjectRecord[] = snapshot.docs.map((dSnap) => {
        const d = dSnap.data();
        const updatedAtMs = toMillis(d.updatedAt);
        const safeContinuity = normalizeVisualContinuity(d.visualContinuity);
        let safeLatestPlan: AnimationScenePlan | null = null;
        if (d.latestScenePlan) {
          const normalized = normalizeScenePlan(d.latestScenePlan, {
            fallbackContinuity: safeContinuity,
          });
          safeLatestPlan = normalized.ok ? normalized.data : null;
        }
        return {
          id: dSnap.id,
          userId: d.userId,
          title: d.title,
          status: (d.status || 'idle') as ProjectStatus,
          chatId: d.chatId,
          visualContinuity: safeContinuity,
          latestScenePlan: safeLatestPlan,
          latestJobId: d.latestJobId || undefined,
          thumbnailSummary: d.thumbnailSummary || '',
          favorite: Boolean(d.favorite),
          archived: Boolean(d.archived),
          deletedAt: d.deletedAt ?? null,
          versionCount: typeof d.versionCount === 'number' ? d.versionCount : 0,
          createdAtMs: toMillis(d.createdAt),
          updatedAtMs,
          lastModifiedLabel: formatRelativeTime(toMillis(d.lastModifiedAt || d.updatedAt)),
        };
      });
      list.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e as Error);
      }
    }
  );
}

export function subscribeChatThread(
  uid: string,
  chatId: string,
  onData: (chat: ChatThreadRecord | null) => void,
  onError: (err: Error) => void
) {
  const path = `users/${uid}/chats/${chatId}`;
  return onSnapshot(
    doc(db, 'users', uid, 'chats', chatId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data();
      const safeMessages: ChatMessage[] = Array.isArray(d.messages)
        ? d.messages.map((rawMsg: unknown) => {
            const m = (rawMsg && typeof rawMsg === 'object' ? rawMsg : {}) as ChatMessage;
            if (!m.scenePlan) return m;
            const normalized = normalizeScenePlan(m.scenePlan);
            if (normalized.ok) {
              return { ...m, scenePlan: normalized.data };
            }
            const withoutPlan: ChatMessage = { ...m };
            delete withoutPlan.scenePlan;
            return withoutPlan;
          })
        : [];

      const safeVersions: ProjectVersion[] = Array.isArray(d.versions)
        ? d.versions
            .map((rawVer: unknown) => {
              if (!rawVer || typeof rawVer !== 'object') return null;
              const v = rawVer as ProjectVersion;
              const normalized = normalizeScenePlan(v.scenePlan);
              if (!normalized.ok) return null;
              return { ...v, scenePlan: normalized.data };
            })
            .filter((v): v is ProjectVersion => v !== null)
        : [];

      onData({
        id: snap.id,
        userId: d.userId,
        projectId: d.projectId,
        title: d.title,
        messages: safeMessages,
        versions: safeVersions,
        historyIndex:
          typeof d.historyIndex === 'number'
            ? Math.min(d.historyIndex, safeVersions.length - 1)
            : -1,
        createdAtMs: toMillis(d.createdAt),
        updatedAtMs: toMillis(d.updatedAt),
        lastOpenedAtMs: toMillis(d.lastOpenedAt),
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (e) {
        onError(e as Error);
      }
    }
  );
}

export async function createProjectAndChat(
  uid: string,
  initialTitle: string,
  initialMessages: ChatMessage[]
): Promise<{ projectId: string; chatId: string }> {
  const projectId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const chatId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const safeTitle = initialTitle.trim().slice(0, 160) || 'Untitled Animation';

  const projPath = `users/${uid}/projects/${projectId}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', uid, 'projects', projectId), {
      userId: uid,
      title: safeTitle,
      status: 'generating',
      chatId,
      visualContinuity: createDefaultVisualContinuity(),
      latestScenePlan: null,
      latestJobId: '',
      thumbnailSummary: '',
      favorite: false,
      archived: false,
      deletedAt: null,
      versionCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastModifiedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'users', uid, 'chats', chatId), {
      userId: uid,
      projectId,
      title: safeTitle,
      messages: stripUndefined(initialMessages),
      versions: [],
      historyIndex: -1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastOpenedAt: serverTimestamp(),
    });

    await batch.commit();
    return { projectId, chatId };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, projPath);
  }
}

export async function saveChatAndProjectGenerationResult(
  uid: string,
  projectId: string,
  chatId: string,
  params: {
    status: ProjectStatus;
    messages: ChatMessage[];
    versions: ProjectVersion[];
    historyIndex: number;
    visualContinuity: VisualContinuityBible;
    latestScenePlan: AnimationScenePlan | null;
    latestJobId: string;
    thumbnailSummary: string;
  }
): Promise<void> {
  const path = `users/${uid}/projects/${projectId}`;
  try {
    const safeContinuity = normalizeVisualContinuity(params.visualContinuity);
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', uid, 'chats', chatId), {
      messages: stripUndefined(params.messages.slice(-100)),
      versions: stripUndefined(params.versions.slice(-50)),
      historyIndex: Math.min(49, params.historyIndex),
      updatedAt: serverTimestamp(),
      lastOpenedAt: serverTimestamp(),
    });

    batch.update(doc(db, 'users', uid, 'projects', projectId), {
      status: params.status,
      visualContinuity: stripUndefined(safeContinuity),
      latestScenePlan: params.latestScenePlan ? stripUndefined(params.latestScenePlan) : null,
      latestJobId: params.latestJobId,
      thumbnailSummary: params.thumbnailSummary.slice(0, 300),
      versionCount: params.versions.length,
      updatedAt: serverTimestamp(),
      lastModifiedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateChatMessagesOnly(
  uid: string,
  chatId: string,
  messages: ChatMessage[],
  versions: ProjectVersion[],
  historyIndex: number
): Promise<void> {
  const path = `users/${uid}/chats/${chatId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'chats', chatId), {
      messages: stripUndefined(messages.slice(-100)),
      versions: stripUndefined(versions.slice(-50)),
      historyIndex: Math.min(49, historyIndex),
      updatedAt: serverTimestamp(),
      lastOpenedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function touchChatOpened(uid: string, chatId: string): Promise<void> {
  const path = `users/${uid}/chats/${chatId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'chats', chatId), {
      lastOpenedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-blocking
  }
}

export async function renameProjectAndChat(
  uid: string,
  projectId: string,
  chatId: string,
  newTitle: string
): Promise<void> {
  const safe = newTitle.trim().slice(0, 160);
  if (!safe) return;
  const path = `users/${uid}/projects/${projectId}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', uid, 'projects', projectId), {
      title: safe,
      updatedAt: serverTimestamp(),
      lastModifiedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'users', uid, 'chats', chatId), {
      title: safe,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function toggleProjectFavorite(
  uid: string,
  projectId: string,
  favorite: boolean
): Promise<void> {
  const path = `users/${uid}/projects/${projectId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'projects', projectId), {
      favorite,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function toggleProjectArchive(
  uid: string,
  projectId: string,
  archived: boolean
): Promise<void> {
  const path = `users/${uid}/projects/${projectId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'projects', projectId), {
      archived,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function softDeleteOrRecoverProject(
  uid: string,
  projectId: string,
  deleted: boolean
): Promise<void> {
  const path = `users/${uid}/projects/${projectId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'projects', projectId), {
      deletedAt: deleted ? new Date().toISOString() : null,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function permanentlyDeleteProject(
  uid: string,
  projectId: string,
  chatId: string
): Promise<void> {
  const path = `users/${uid}/projects/${projectId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', uid, 'projects', projectId));
    batch.delete(doc(db, 'users', uid, 'chats', chatId));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- Generation Jobs Tracking ---
export async function createGenerationJob(
  uid: string,
  projectId: string,
  chatId: string,
  prompt: string
): Promise<string> {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `users/${uid}/generationJobs/${jobId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'generationJobs', jobId), {
      userId: uid,
      projectId,
      chatId,
      status: 'planning',
      prompt: prompt.slice(0, 4000),
      progress: 20,
      stageLabel: 'Understanding animation prompt with VYROXX AI...',
      error: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return jobId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateGenerationJob(
  uid: string,
  jobId: string,
  patch: {
    status: GenerationJobRecord['status'];
    progress: number;
    stageLabel: string;
    error?: string | null;
  }
): Promise<void> {
  const path = `users/${uid}/generationJobs/${jobId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'generationJobs', jobId), {
      status: patch.status,
      progress: patch.progress,
      stageLabel: patch.stageLabel.slice(0, 200),
      error: patch.error ? patch.error.slice(0, 1000) : null,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export function subscribeProjectJobs(
  uid: string,
  projectId: string,
  onData: (jobs: GenerationJobRecord[]) => void
) {
  const q = query(
    collection(db, 'users', uid, 'generationJobs'),
    where('userId', '==', uid),
    where('projectId', '==', projectId)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const jobs: GenerationJobRecord[] = snapshot.docs.map((dSnap) => {
        const d = dSnap.data();
        return {
          id: dSnap.id,
          userId: d.userId,
          projectId: d.projectId,
          chatId: d.chatId,
          status: d.status,
          prompt: d.prompt,
          progress: d.progress,
          stageLabel: d.stageLabel || '',
          error: d.error || null,
          createdAtMs: toMillis(d.createdAt),
          updatedAtMs: toMillis(d.updatedAt),
        };
      });
      jobs.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(jobs);
    },
    () => {
      // Ignore transient listener errors
    }
  );
}

// --- Assets Management ---
export function subscribeUserAssets(
  uid: string,
  onData: (assets: AssetRecord[]) => void,
  onError: (err: Error) => void
) {
  const path = `users/${uid}/assets`;
  const q = query(
    collection(db, 'users', uid, 'assets'),
    where('userId', '==', uid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const assets: AssetRecord[] = snapshot.docs.map((dSnap) => {
        const d = dSnap.data();
        return {
          id: dSnap.id,
          userId: d.userId,
          name: d.name,
          category: d.category,
          mimeType: d.mimeType,
          fileFormat: d.fileFormat,
          fileSizeBytes: d.fileSizeBytes,
          fileSizeLabel: d.fileSizeLabel,
          source: d.source,
          storagePath: d.storagePath,
          associatedProjectId: d.associatedProjectId ?? null,
          favorited: Boolean(d.favorited),
          textPreview: d.textPreview ?? null,
          createdAtMs: toMillis(d.createdAt),
          updatedAtMs: toMillis(d.updatedAt),
        };
      });
      assets.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(assets);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e as Error);
      }
    }
  );
}

export async function createAssetRecord(
  uid: string,
  asset: Omit<AssetRecord, 'id' | 'userId' | 'createdAtMs' | 'updatedAtMs'>
): Promise<string> {
  const assetId = `asset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `users/${uid}/assets/${assetId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'assets', assetId), {
      userId: uid,
      name: asset.name.slice(0, 160),
      category: asset.category,
      mimeType: asset.mimeType.slice(0, 120),
      fileFormat: asset.fileFormat.slice(0, 20),
      fileSizeBytes: asset.fileSizeBytes,
      fileSizeLabel: asset.fileSizeLabel.slice(0, 40),
      source: asset.source,
      storagePath: asset.storagePath.slice(0, 500),
      associatedProjectId: asset.associatedProjectId ?? null,
      favorited: asset.favorited,
      textPreview: asset.textPreview ? asset.textPreview.slice(0, 20000) : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return assetId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function renameAssetRecord(
  uid: string,
  assetId: string,
  newName: string
): Promise<void> {
  const path = `users/${uid}/assets/${assetId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'assets', assetId), {
      name: newName.trim().slice(0, 160),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function toggleAssetFavorite(
  uid: string,
  assetId: string,
  favorited: boolean
): Promise<void> {
  const path = `users/${uid}/assets/${assetId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'assets', assetId), {
      favorited,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function associateAssetWithProject(
  uid: string,
  assetId: string,
  projectId: string
): Promise<void> {
  const path = `users/${uid}/assets/${assetId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'assets', assetId), {
      associatedProjectId: projectId,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteAssetRecord(uid: string, assetId: string): Promise<void> {
  const path = `users/${uid}/assets/${assetId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'assets', assetId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- Full User Data Export & Account Deletion (DPDP / GDPR Rights) ---
export async function exportAllUserData(uid: string) {
  const [userSnap, projSnaps, chatSnaps, assetSnaps, jobSnaps] = await Promise.all([
    getDoc(doc(db, 'users', uid)),
    getDocs(query(collection(db, 'users', uid, 'projects'), where('userId', '==', uid))),
    getDocs(query(collection(db, 'users', uid, 'chats'), where('userId', '==', uid))),
    getDocs(query(collection(db, 'users', uid, 'assets'), where('userId', '==', uid))),
    getDocs(query(collection(db, 'users', uid, 'generationJobs'), where('userId', '==', uid))),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    profile: userSnap.exists() ? userSnap.data() : null,
    projects: projSnaps.docs.map((d) => ({ id: d.id, ...d.data() })),
    chats: chatSnaps.docs.map((d) => ({ id: d.id, ...d.data() })),
    assets: assetSnaps.docs.map((d) => ({ id: d.id, ...d.data() })),
    generationJobs: jobSnaps.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

export async function deleteAllUserFirestoreData(uid: string, username: string) {
  const [projSnaps, chatSnaps, assetSnaps, jobSnaps] = await Promise.all([
    getDocs(query(collection(db, 'users', uid, 'projects'), where('userId', '==', uid))),
    getDocs(query(collection(db, 'users', uid, 'chats'), where('userId', '==', uid))),
    getDocs(query(collection(db, 'users', uid, 'assets'), where('userId', '==', uid))),
    getDocs(query(collection(db, 'users', uid, 'generationJobs'), where('userId', '==', uid))),
  ]);

  const batch = writeBatch(db);
  projSnaps.docs.forEach((d) => batch.delete(d.ref));
  chatSnaps.docs.forEach((d) => batch.delete(d.ref));
  assetSnaps.docs.forEach((d) => batch.delete(d.ref));
  jobSnaps.docs.forEach((d) => batch.delete(d.ref));

  const slug = normalizeUsernameSlug(username);
  if (slug.length >= 2) {
    const unameRef = doc(db, 'usernames', slug);
    const unameSnap = await getDoc(unameRef);
    if (unameSnap.exists() && unameSnap.data()?.uid === uid) {
      batch.delete(unameRef);
    }
  }
  batch.delete(doc(db, 'users', uid));
  await batch.commit();
}
