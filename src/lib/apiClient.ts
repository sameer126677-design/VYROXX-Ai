import { auth } from './firebase';
import {
  AnimationScenePlan,
  normalizeScenePlan,
  normalizeVisualContinuity,
  VisualContinuityBible,
} from '../shared/sceneSchema';

async function getVerifiedIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to perform this action.');
  }
  return user.getIdToken(false);
}

export interface PlanSceneRequest {
  prompt: string;
  projectId: string;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
  existingContinuity: VisualContinuityBible;
  currentScenePlan: AnimationScenePlan | null;
  requestedWidth?: number;
  requestedHeight?: number;
  requestedFps?: number;
  requestedBackground?: 'scene' | 'solid' | 'transparent';
  attachmentsSummary?: string[];
  aiResponseStyle?: 'concise' | 'balanced' | 'detailed';
  isRegenerate?: boolean;
}

export interface PlanSceneResponse {
  assistantMessage: string;
  scenePlan: AnimationScenePlan;
}

export const AI_BUSY_FRIENDLY_MESSAGE =
  'AI abhi available nahi hai, thodi der baad try karein.';

export function toFriendlyAiErrorMessage(
  rawMessage: string,
  httpStatus?: number
): string {
  const msg = rawMessage.trim();
  if (msg === AI_BUSY_FRIENDLY_MESSAGE) {
    return msg;
  }
  if (msg.includes('not configured') && msg.includes('Settings > Secrets')) {
    return msg;
  }
  if (httpStatus === 503 || httpStatus === 504) {
    return AI_BUSY_FRIENDLY_MESSAGE;
  }
  if (
    /\b(503|504|429)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded|operation aborted|AbortError|timed\s*out|timeout|Service Unavailable|Failed to fetch|NetworkError/i.test(
      msg
    )
  ) {
    return AI_BUSY_FRIENDLY_MESSAGE;
  }
  return msg || AI_BUSY_FRIENDLY_MESSAGE;
}

export async function planAnimationScene(
  payload: PlanSceneRequest
): Promise<PlanSceneResponse> {
  const token = await getVerifiedIdToken();

  const safeContinuity = normalizeVisualContinuity(payload.existingContinuity);
  let safeCurrentPlan: AnimationScenePlan | null = null;
  if (payload.currentScenePlan) {
    const normalizedCurrent = normalizeScenePlan(payload.currentScenePlan, {
      fallbackContinuity: safeContinuity,
    });
    safeCurrentPlan = normalizedCurrent.ok ? normalizedCurrent.data : null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 255_000);

  let res: Response;
  try {
    res = await fetch('/api/ai/plan-scene', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...payload,
        existingContinuity: safeContinuity,
        currentScenePlan: safeCurrentPlan,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    const rawErr = err instanceof Error ? err.message : String(err);
    throw new Error(toFriendlyAiErrorMessage(rawErr, 503));
  } finally {
    clearTimeout(timeout);
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  const bodyObj =
    body && typeof body === 'object' ? (body as Record<string, unknown>) : null;

  if (!res.ok) {
    const serverError =
      bodyObj && typeof bodyObj.error === 'string' && bodyObj.error.trim()
        ? bodyObj.error.trim()
        : '';
    if (!bodyObj && (res.status === 502 || res.status === 503 || res.status === 504 || res.status === 429)) {
      throw new Error(AI_BUSY_FRIENDLY_MESSAGE);
    }
    throw new Error(
      toFriendlyAiErrorMessage(
        serverError || `AI request failed (${res.status})`,
        res.status
      )
    );
  }

  if (!bodyObj) {
    throw new Error(AI_BUSY_FRIENDLY_MESSAGE);
  }

  const normalizedPlan = normalizeScenePlan(bodyObj.scenePlan, {
    width: payload.requestedWidth,
    height: payload.requestedHeight,
    fps: payload.requestedFps,
    fallbackContinuity: safeContinuity,
  });

  if (!normalizedPlan.ok) {
    throw new Error(
      normalizedPlan.error ||
        'Received an incomplete animation plan from server. Please retry.'
    );
  }

  const assistantMessage =
    typeof bodyObj.assistantMessage === 'string' && bodyObj.assistantMessage.trim()
      ? bodyObj.assistantMessage.trim()
      : 'Your animation scene plan has been generated.';

  return {
    assistantMessage,
    scenePlan: normalizedPlan.data,
  };
}

export async function uploadAssetBinary(file: File): Promise<{
  storagePath: string;
  fileSizeBytes: number;
}> {
  const token = await getVerifiedIdToken();

  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read local file.'));
    reader.readAsDataURL(file);
  });

  const res = await fetch('/api/assets/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      base64Data,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Asset upload failed (${res.status})`);
  }
  return body as { storagePath: string; fileSizeBytes: number };
}

export async function fetchAuthenticatedAssetArrayBuffer(
  storagePath: string
): Promise<ArrayBuffer> {
  const token = await getVerifiedIdToken();
  const res = await fetch(`/api/assets/file/${storagePath}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to load protected asset.');
  }
  return res.arrayBuffer();
}

export async function fetchAuthenticatedAssetBlobUrl(
  storagePath: string
): Promise<string> {
  const token = await getVerifiedIdToken();
  const res = await fetch(`/api/assets/file/${storagePath}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to load protected asset.');
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function deleteAssetBinary(storagePath: string): Promise<void> {
  if (!storagePath || !storagePath.includes('/')) return;
  const token = await getVerifiedIdToken();
  await fetch(`/api/assets/file/${storagePath}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }).catch(() => {});
}

export async function deleteAccountServerStorage(): Promise<void> {
  const token = await getVerifiedIdToken();
  await fetch('/api/account/storage', {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
