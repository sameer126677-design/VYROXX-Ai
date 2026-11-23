import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createServer as createViteServer } from 'vite';
import { createRemoteJWKSet } from 'jose';
import { z } from 'zod';
import { MAX_UPLOAD_BYTES, validateUploadBytes } from './src/shared/uploadValidation';
import {
  buildAppSecurityHeaders,
  isOriginAllowed,
  JwtKeyResolver,
  PlanRequestSchema,
  resolveSafeUserFilePath,
  SlidingWindowRateLimiter,
  validateStartupConfig,
  verifyFirebaseBearerToken,
} from './serverSecurity';
import {
  AI_UNAVAILABLE_USER_MESSAGE,
  AiChainItem,
  CHAIN,
  CODECRAFT_BASE_URL,
  generateAnimationScenePlan,
} from './aiService';

export {
  AI_UNAVAILABLE_USER_MESSAGE,
  CHAIN,
  CODECRAFT_BASE_URL,
};

const PORT = 3000;
const ROOT_DIR = process.cwd();
const DEFAULT_STORAGE_ROOT = path.join(ROOT_DIR, '.vyroxx_storage');

const REFERENCE_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
const REFERENCE_IMAGES_TOTAL_MAX_BYTES = 5 * 1024 * 1024;

async function loadReferenceImages(storageRoot: string, uid: string, paths: string[]) {
  if (paths.length > 3) throw new Error('You can attach up to 3 reference images per generation.');
  const images: Array<{ mimeType: 'image/png' | 'image/jpeg' | 'image/webp'; base64Data: string; fileName: string }> = [];
  let totalBytes = 0;
  for (const storagePath of paths) {
    const [ownerUid, fileName] = storagePath.split('/');
    if (ownerUid !== uid || !fileName) throw new Error('Reference image access denied.');
    const targetPath = resolveSafeUserFilePath(storageRoot, uid, fileName);
    if (!targetPath || !fs.existsSync(targetPath)) throw new Error('Reference image was not found. Please upload it again.');
    const ext = path.extname(fileName).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : null;
    if (!mimeType) throw new Error('Reference images must be PNG, JPG, or WebP.');
    const buffer = await fs.promises.readFile(targetPath);
    if (!buffer.length || buffer.length > REFERENCE_IMAGE_MAX_BYTES) throw new Error('Each reference image must be 4 MB or smaller.');
    totalBytes += buffer.length;
    if (totalBytes > REFERENCE_IMAGES_TOTAL_MAX_BYTES) throw new Error('Reference images are too large. Keep the combined size under 5 MB.');
    const validation = validateUploadBytes(fileName, mimeType, buffer);
    if (!validation.ok) throw new Error(`Invalid reference image: ${validation.error}`);
    images.push({ mimeType, base64Data: buffer.toString('base64'), fileName });
  }
  return images;
}

const DEFAULT_FIREBASE_JWKS = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
  )
);

interface AuthenticatedRequest extends Request {
  auth?: {
    uid: string;
    email?: string;
    emailVerified: boolean;
  };
}

const AssetUploadSchema = z.object({
  fileName: z.string().min(1).max(160),
  mimeType: z.string().min(1).max(120),
  base64Data: z.string().min(1).max(28_000_000), // ~20MB binary max
});

const ALLOWED_ASSET_MIME_PREFIXES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/ogg',
  'application/json',
  'text/json',
  'text/plain',
  'application/pdf',
  'model/gltf-binary',
  'model/gltf+json',
];

export interface CreateVyroxxAppOptions {
  storageRoot?: string;
  projectId?: string;
  jwks?: JwtKeyResolver;
  allowedOrigins?: Set<string>;
  isProd?: boolean;
  rateLimiter?: SlidingWindowRateLimiter;
  ipRateLimitMax?: number;
  fetchFn?: typeof fetch;
  codecraftFetch?: typeof fetch;
  codecraftApiKey?: string;
  chain?: readonly AiChainItem[];
  timeoutMs?: number;
}

export function createVyroxxApiApp(options: CreateVyroxxAppOptions = {}) {
  const startupConfig = validateStartupConfig(ROOT_DIR);
  const projectId = options.projectId ?? startupConfig.projectId;
  const isProd = options.isProd ?? startupConfig.isProd;
  const allowedOrigins = options.allowedOrigins ?? startupConfig.allowedOrigins;
  const jwks = options.jwks ?? DEFAULT_FIREBASE_JWKS;
  const storageRoot = options.storageRoot ?? DEFAULT_STORAGE_ROOT;
  const rateLimiter = options.rateLimiter ?? new SlidingWindowRateLimiter();
  const ipRateLimitMax = options.ipRateLimitMax ?? 120;

  if (!fs.existsSync(storageRoot)) {
    fs.mkdirSync(storageRoot, { recursive: true });
  }

  const activeGenerations = new Set<string>();
  const smallJsonParser = express.json({ limit: '256kb' });
  const uploadJsonParser = express.json({ limit: '25mb' });

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Global security headers (compatible with AI Studio iframe embedding & Google Sign-In popups)
  app.use((req, res, next) => {
    const isHttps =
      req.secure || req.headers['x-forwarded-proto'] === 'https';
    const secHeaders = buildAppSecurityHeaders({ isProd, isHttps });
    for (const [header, value] of Object.entries(secHeaders)) {
      res.setHeader(header, value);
    }
    next();
  });

  // Strict CORS enforcement + Pre-Auth IP Rate Limiting for /api/*
  app.use('/api', (req, res, next) => {
    const origin =
      typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
    const host =
      typeof req.headers.host === 'string' ? req.headers.host : undefined;

    res.setHeader('Vary', 'Origin');

    if (origin) {
      if (!isOriginAllowed(origin, host, allowedOrigins)) {
        res.status(403).json({ error: 'Origin not allowed by CORS policy.' });
        return;
      }
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
      );
      res.setHeader('Access-Control-Max-Age', '600');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const ipDecision = rateLimiter.check(`ip:${clientIp}`, ipRateLimitMax, 60_000);
    if (!ipDecision.allowed) {
      res.setHeader('Retry-After', String(ipDecision.retryAfterSec));
      res.status(429).json({
        error: 'Too many requests from this network address. Please retry shortly.',
      });
      return;
    }

    next();
  });

  async function requireAuth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const verified = await verifyFirebaseBearerToken(
      req.headers.authorization,
      jwks,
      projectId
    );
    if (!verified.ok) {
      res.status(verified.status).json({ error: verified.error });
      return;
    }
    req.auth = verified.user;
    next();
  }

  // Healthcheck (non-sensitive liveness probe)
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'vyroxx-api' });
  });

  // Centralized AI Animation Planner Route (CodeCraft API via aiService.ts)
  app.post(
    '/api/ai/plan-scene',
    requireAuth,
    smallJsonParser,
    async (req: AuthenticatedRequest, res: Response) => {
      const uid = req.auth!.uid;

      const parsedBody = PlanRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        res.status(400).json({
          error: 'Invalid animation prompt request.',
          details: parsedBody.error.issues[0]?.message,
        });
        return;
      }

      const data = parsedBody.data;
      const lockKey = `${uid}:${data.projectId}`;

      if (activeGenerations.has(lockKey)) {
        res.status(409).json({
          error:
            'An animation generation is already in progress for this project. Please wait for it to finish.',
        });
        return;
      }

      const aiLimit = rateLimiter.check(`ai:${uid}`, 25, 5 * 60 * 1000);
      if (!aiLimit.allowed) {
        res.setHeader('Retry-After', String(aiLimit.retryAfterSec));
        res.status(429).json({
          error:
            'Rate limit reached. Please wait a minute before sending more animation requests.',
        });
        return;
      }

      activeGenerations.add(lockKey);

      try {
        const referenceImages = await loadReferenceImages(storageRoot, uid, data.referenceImagePaths ?? []);
        const result = await generateAnimationScenePlan(
          {
            prompt: data.prompt,
            conversationHistory: data.conversationHistory,
            existingContinuity: data.existingContinuity,
            currentScenePlan: data.currentScenePlan,
            requestedWidth: data.requestedWidth,
            requestedHeight: data.requestedHeight,
            requestedFps: data.requestedFps,
            requestedBackground: data.requestedBackground,
            attachmentsSummary: data.attachmentsSummary,
            referenceImages,
            aiResponseStyle: data.aiResponseStyle,
            isRegenerate: data.isRegenerate,
          },
          {
            fetchFn: options.fetchFn,
            codecraftFetch: options.codecraftFetch,
            codecraftApiKey: options.codecraftApiKey,
            chain: options.chain,
            timeoutMs: options.timeoutMs,
          }
        );

        if (!result.ok) {
          res.status(result.status).json({ error: result.error });
          return;
        }

        res.json({
          assistantMessage: result.assistantMessage,
          scenePlan: result.scenePlan,
          creationPlan: result.creationPlan,
        });
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[VYROXX AI Error]:', msg.slice(0, 240));
        res.status(503).json({
          error: AI_UNAVAILABLE_USER_MESSAGE,
        });
      } finally {
        activeGenerations.delete(lockKey);
      }
    }
  );

  // Authenticated Asset Binary Upload (dedicated 25MB JSON parser)
  app.post(
    '/api/assets/upload',
    requireAuth,
    uploadJsonParser,
    (req: AuthenticatedRequest, res: Response) => {
      const uid = req.auth!.uid;

      const uploadLimit = rateLimiter.check(`upload:${uid}`, 40, 5 * 60 * 1000);
      if (!uploadLimit.allowed) {
        res.setHeader('Retry-After', String(uploadLimit.retryAfterSec));
        res.status(429).json({
          error: 'Upload rate limit exceeded. Please wait briefly.',
        });
        return;
      }

      const parsed = AssetUploadSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: 'Invalid upload payload or file exceeds 20MB limit.' });
        return;
      }

      const { fileName, mimeType, base64Data } = parsed.data;
      const lowerMime = mimeType.toLowerCase().split(';')[0].trim();
      const isOctetGlb =
        lowerMime === 'application/octet-stream' &&
        fileName.toLowerCase().endsWith('.glb');
      if (!ALLOWED_ASSET_MIME_PREFIXES.includes(lowerMime) && !isOctetGlb) {
        res.status(400).json({
          error: `Unsupported file type (${mimeType}). Allowed: PNG, JPG, WebP, SVG, MP4, WebM, MOV, MP3, WAV, JSON, TXT, PDF, GLB, GLTF.`,
        });
        return;
      }

      const buffer = Buffer.from(base64Data, 'base64');
      if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
        res
          .status(400)
          .json({ error: 'File must be between 1 byte and 20MB.' });
        return;
      }

      const validation = validateUploadBytes(fileName, mimeType, buffer);
      if (!validation.ok) {
        res.status(400).json({ error: validation.error });
        return;
      }

      const userDir = path.resolve(storageRoot, uid);
      if (!userDir.startsWith(path.resolve(storageRoot) + path.sep)) {
        res.status(400).json({ error: 'Invalid user storage path.' });
        return;
      }
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }

      const safeBase = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
      const uniqueName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${safeBase}`;
      const targetPath = resolveSafeUserFilePath(storageRoot, uid, uniqueName);
      if (!targetPath) {
        res.status(400).json({ error: 'Invalid target storage path.' });
        return;
      }
      fs.writeFileSync(targetPath, buffer);

      const storagePath = `${uid}/${uniqueName}`;
      res.json({
        storagePath,
        fileSizeBytes: buffer.length,
      });
    }
  );

  // Authenticated Asset Binary Download / Preview Stream
  app.get(
    '/api/assets/file/:uid/:fileName',
    requireAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const authedUid = req.auth!.uid;
      const { uid, fileName } = req.params;

      const dlLimit = rateLimiter.check(`file:${authedUid}`, 60, 60 * 1000);
      if (!dlLimit.allowed) {
        res.setHeader('Retry-After', String(dlLimit.retryAfterSec));
        res.status(429).json({ error: 'Too many file requests.' });
        return;
      }

      if (authedUid !== uid) {
        res.status(403).json({
          error: 'Forbidden: You cannot access another user’s asset.',
        });
        return;
      }

      const targetPath = resolveSafeUserFilePath(storageRoot, uid, fileName);
      if (!targetPath) {
        res.status(400).json({ error: 'Invalid asset filename.' });
        return;
      }

      if (!fs.existsSync(targetPath)) {
        res.status(404).json({ error: 'Asset file not found.' });
        return;
      }

      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Download-Options', 'noopen');
      res.sendFile(targetPath);
    }
  );

  // Authenticated Asset Binary Delete
  app.delete(
    '/api/assets/file/:uid/:fileName',
    requireAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const authedUid = req.auth!.uid;
      const { uid, fileName } = req.params;

      const delLimit = rateLimiter.check(`file:${authedUid}`, 60, 60 * 1000);
      if (!delLimit.allowed) {
        res.setHeader('Retry-After', String(delLimit.retryAfterSec));
        res.status(429).json({ error: 'Too many file requests.' });
        return;
      }

      if (authedUid !== uid) {
        res.status(403).json({ error: 'Forbidden.' });
        return;
      }

      const targetPath = resolveSafeUserFilePath(storageRoot, uid, fileName);
      if (!targetPath) {
        res.status(400).json({ error: 'Invalid asset filename.' });
        return;
      }

      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }

      res.json({ deleted: true });
    }
  );

  // Authenticated Account Storage Wipe (for Account Deletion)
  app.delete(
    '/api/account/storage',
    requireAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const authedUid = req.auth!.uid;

      const wipeLimit = rateLimiter.check(`wipe:${authedUid}`, 10, 5 * 60 * 1000);
      if (!wipeLimit.allowed) {
        res.setHeader('Retry-After', String(wipeLimit.retryAfterSec));
        res.status(429).json({ error: 'Too many account storage requests.' });
        return;
      }

      const userDir = path.resolve(storageRoot, authedUid);
      if (
        userDir.startsWith(path.resolve(storageRoot) + path.sep) &&
        fs.existsSync(userDir)
      ) {
        fs.rmSync(userDir, { recursive: true, force: true });
      }
      res.json({ deleted: true });
    }
  );

  // Sanitized API Error Handler (never expose stack traces or internal secrets)
  app.use(
    '/api',
    (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      const errObj = err as { status?: number; type?: string };
      const status =
        typeof errObj?.status === 'number'
          ? errObj.status
          : errObj?.type === 'entity.too.large'
          ? 413
          : 400;
      res.status(status >= 400 && status < 600 ? status : 400).json({
        error:
          status === 413
            ? 'Request payload exceeds size limit.'
            : 'Malformed API request.',
      });
    }
  );

  return { app, startupConfig };
}

async function startServer() {
  const { app, startupConfig } = createVyroxxApiApp();
  if (!startupConfig.hasCodecraftApiKey) {
    console.warn(
      '[VYROXX] Warning: CODECRAFT_API_KEY is not configured; Claude scene planning will return 503.'
    );
  }

  // Vite Dev Middleware or Static Build
  if (!startupConfig.isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VYROXX server listening on http://0.0.0.0:${PORT}`);
  });
}

if (process.env.VYROXX_DISABLE_AUTOSTART !== 'true') {
  startServer().catch((err) => {
    console.error(
      'Failed to start VYROXX server:',
      err instanceof Error ? err.message : 'Startup error'
    );
    process.exit(1);
  });
}
