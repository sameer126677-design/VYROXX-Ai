import fs from 'node:fs';
import path from 'node:path';
import { jwtVerify } from 'jose';
import { z } from 'zod';
import {
  AnimationScenePlanSchema,
  VisualContinuityBibleSchema,
} from './src/shared/sceneSchema';

export interface FirebaseAppletConfig {
  projectId: string;
}

export interface RuntimeSecurityConfig {
  projectId: string;
  isProd: boolean;
  allowedOrigins: Set<string>;
  hasCodecraftApiKey: boolean;
}

export function validateStartupConfig(
  rootDir: string,
  env: NodeJS.ProcessEnv = process.env
): RuntimeSecurityConfig {
  const configPath = path.join(rootDir, 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('Missing firebase-applet-config.json in workspace root.');
  }

  let parsed: Partial<FirebaseAppletConfig>;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    throw new Error('Invalid JSON in firebase-applet-config.json.');
  }

  if (
    typeof parsed.projectId !== 'string' ||
    !/^[a-z0-9-]{3,128}$/.test(parsed.projectId)
  ) {
    throw new Error('Invalid or missing projectId in firebase-applet-config.json.');
  }

  const isProd = env.NODE_ENV === 'production';
  const allowedOrigins = buildAllowedOrigins(env, isProd);
  const hasCodecraftApiKey = Boolean(
    env.CODECRAFT_API_KEY &&
      env.CODECRAFT_API_KEY.trim().length > 10 &&
      env.CODECRAFT_API_KEY !== 'MY_CODECRAFT_API_KEY' &&
      env.CODECRAFT_API_KEY !== 'CODECRAFT_API_KEY'
  );

  return {
    projectId: parsed.projectId,
    isProd,
    allowedOrigins,
    hasCodecraftApiKey,
  };
}

export function buildAllowedOrigins(
  env: NodeJS.ProcessEnv = process.env,
  isProd = env.NODE_ENV === 'production'
): Set<string> {
  const origins = new Set<string>();

  const candidates: string[] = [];
  if (env.APP_URL && env.APP_URL !== 'MY_APP_URL') {
    candidates.push(env.APP_URL);
  }
  if (env.ALLOWED_ORIGINS) {
    for (const part of env.ALLOWED_ORIGINS.split(',')) {
      if (part.trim()) candidates.push(part.trim());
    }
  }
  if (!isProd) {
    candidates.push('http://localhost:3000', 'http://127.0.0.1:3000');
  }

  for (const raw of candidates) {
    try {
      const u = new URL(raw);
      if (u.protocol === 'https:' || u.protocol === 'http:') {
        origins.add(u.origin);
      }
    } catch {
      // Ignore malformed origin entries
    }
  }

  return origins;
}

export function isOriginAllowed(
  originHeader: string | undefined,
  reqHostHeader: string | undefined,
  allowedOrigins: Set<string>
): boolean {
  if (!originHeader) {
    return true;
  }

  let parsed: URL;
  try {
    parsed = new URL(originHeader);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return false;
  }

  if (allowedOrigins.has(parsed.origin)) {
    return true;
  }

  // Allow exact same-host requests (e.g., Cloud Run preview host proxied under *.run.app)
  if (reqHostHeader && parsed.host === reqHostHeader) {
    return true;
  }

  return false;
}

export function buildAppSecurityHeaders(options: {
  isProd: boolean;
  isHttps: boolean;
}): Record<string, string> {
  const { isProd, isHttps } = options;

  const scriptSrc = isProd ? "script-src 'self'" : "script-src 'self' 'unsafe-inline'";
  const connectSrc = isProd
    ? "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://firestore.googleapis.com wss://*.firebaseio.com"
    : "connect-src 'self' ws://localhost:* ws://127.0.0.1:* https://*.googleapis.com https://*.firebaseio.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://firestore.googleapis.com wss://*.firebaseio.com";

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' blob: data: https:",
    "media-src 'self' blob:",
    connectSrc,
    "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com",
    "frame-ancestors 'self' https://aistudio.google.com https://*.google.com https://*.googleusercontent.com",
  ].join('; ');

  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'X-DNS-Prefetch-Control': 'off',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Content-Security-Policy': csp,
  };

  if (isProd || isHttps) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }

  return headers;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * In-memory sliding-window rate limiter with bounded key capacity and stale-entry pruning.
 * NOTE: For horizontal multi-instance deployments, swap this interface with a Redis-backed store.
 */
export class SlidingWindowRateLimiter {
  private buckets = new Map<string, number[]>();
  private opCount = 0;

  constructor(private readonly maxEntries = 10_000) {}

  check(
    key: string,
    maxRequests: number,
    windowMs: number,
    nowMs = Date.now()
  ): RateLimitDecision {
    this.opCount++;
    if (
      this.opCount % 250 === 0 ||
      (!this.buckets.has(key) && this.buckets.size >= this.maxEntries)
    ) {
      this.prune(windowMs, nowMs);
    }

    if (!this.buckets.has(key) && this.buckets.size >= this.maxEntries) {
      const oldestKey = this.buckets.keys().next().value;
      if (oldestKey !== undefined) {
        this.buckets.delete(oldestKey);
      }
    }

    const recent = (this.buckets.get(key) || []).filter((t) => nowMs - t < windowMs);
    if (recent.length >= maxRequests) {
      this.buckets.set(key, recent);
      const oldest = recent[0] ?? nowMs;
      const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000));
      return { allowed: false, remaining: 0, retryAfterSec };
    }

    recent.push(nowMs);
    this.buckets.set(key, recent);
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - recent.length),
      retryAfterSec: 0,
    };
  }

  prune(maxWindowMs: number, nowMs = Date.now()): void {
    for (const [k, timestamps] of this.buckets.entries()) {
      const valid = timestamps.filter((t) => nowMs - t < maxWindowMs);
      if (valid.length === 0) {
        this.buckets.delete(k);
      } else {
        this.buckets.set(k, valid);
      }
    }
    while (this.buckets.size > this.maxEntries) {
      const oldestKey = this.buckets.keys().next().value;
      if (oldestKey === undefined) break;
      this.buckets.delete(oldestKey);
    }
  }

  size(): number {
    return this.buckets.size;
  }

  clear(): void {
    this.buckets.clear();
  }
}

export const PlanRequestSchema = z.object({
  prompt: z.string().min(1).max(3000),
  projectId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(1500),
      })
    )
    .max(20)
    .optional(),
  existingContinuity: VisualContinuityBibleSchema.optional(),
  currentScenePlan: AnimationScenePlanSchema.nullable().optional(),
  requestedWidth: z.number().int().min(128).max(4096).optional(),
  requestedHeight: z.number().int().min(128).max(4096).optional(),
  requestedFps: z.number().int().min(12).max(120).optional(),
  requestedBackground: z.enum(['scene', 'solid', 'transparent']).optional(),
  attachmentsSummary: z.array(z.string().max(160)).max(8).optional(),
  referenceImagePaths: z.array(z.string().max(320).regex(/^[a-zA-Z0-9_-]{1,128}\/[a-zA-Z0-9._-]{1,200}$/)).max(3).optional(),
  aiResponseStyle: z.enum(['concise', 'balanced', 'detailed']).optional(),
  isRegenerate: z.boolean().optional(),
});

export function resolveSafeUserFilePath(
  storageRoot: string,
  uid: string,
  fileName: string
): string | null {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(uid)) return null;
  if (!/^[a-zA-Z0-9._-]{1,200}$/.test(fileName) || fileName.includes('..')) return null;
  const userDir = path.resolve(storageRoot, uid);
  const targetPath = path.resolve(userDir, fileName);
  if (!targetPath.startsWith(userDir + path.sep)) return null;
  return targetPath;
}

export type JwtKeyResolver = Parameters<typeof jwtVerify>[1];

export interface VerifiedTokenResult {
  uid: string;
  email?: string;
  emailVerified: boolean;
}

export async function verifyFirebaseBearerToken(
  authHeader: string | undefined,
  jwks: JwtKeyResolver,
  projectId: string
): Promise<
  | { ok: true; user: VerifiedTokenResult }
  | { ok: false; status: 401 | 403; error: string }
> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      status: 401,
      error: 'Authentication required. Missing Bearer token.',
    };
  }

  const token = authHeader.slice(7).trim();
  if (!token || token.length > 8192) {
    return {
      ok: false,
      status: 401,
      error: 'Invalid authentication token.',
    };
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      algorithms: ['RS256'],
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });

    const uid = typeof payload.sub === 'string' ? payload.sub : '';
    const emailVerified = payload.email_verified === true;

    if (!uid || !/^[a-zA-Z0-9_-]{1,128}$/.test(uid)) {
      return {
        ok: false,
        status: 401,
        error: 'Invalid authenticated user identifier.',
      };
    }

    if (!emailVerified) {
      return {
        ok: false,
        status: 403,
        error: 'Email verification is required before using workspace APIs.',
      };
    }

    return {
      ok: true,
      user: {
        uid,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        emailVerified,
      },
    };
  } catch {
    return {
      ok: false,
      status: 401,
      error: 'Your session token is invalid or expired. Please sign in again.',
    };
  }
}
