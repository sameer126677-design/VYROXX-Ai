import crypto from 'node:crypto';

export type CloudflareFluxModel =
  | '@cf/black-forest-labs/flux-2-klein-4b'
  | '@cf/black-forest-labs/flux-2-klein-9b'
  | '@cf/black-forest-labs/flux-2-dev';

export interface CloudflareImageOptions {
  accountId?: string;
  apiToken?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export interface CloudflareImageRequest {
  prompt: string;
  model: CloudflareFluxModel;
  width: number;
  height: number;
  guidance?: number;
  seed?: number;
  referenceImages?: Array<{ bytes: Buffer; mimeType: string }>;
}

export interface CloudflareImageResult {
  bytes: Buffer;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  model: CloudflareFluxModel;
}

function detectImageMime(bytes: Buffer): CloudflareImageResult['mimeType'] | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export async function generateCloudflareImage(
  input: CloudflareImageRequest,
  options: CloudflareImageOptions = {}
): Promise<CloudflareImageResult> {
  const accountId = options.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = options.apiToken ?? process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error('Cloudflare image generation is not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN on the server.');
  }
  if ((input.referenceImages?.length ?? 0) > 4) {
    throw new Error('FLUX.2 supports up to four reference images.');
  }

  const form = new FormData();
  form.set('prompt', input.prompt);
  form.set('width', String(input.width));
  form.set('height', String(input.height));
  if (input.guidance !== undefined) form.set('guidance', String(input.guidance));
  if (input.seed !== undefined) form.set('seed', String(input.seed));

  for (const [index, reference] of (input.referenceImages ?? []).entries()) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(reference.mimeType)) {
      throw new Error('Reference images must be PNG, JPEG, or WebP.');
    }
    if (reference.bytes.length > 512 * 1024) {
      throw new Error('Each FLUX.2 reference image must be no larger than 512 KB.');
    }
    form.set(`input_image_${index}`, new Blob([new Uint8Array(reference.bytes)], { type: reference.mimeType }), `reference-${index}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 120_000);
  try {
    const fetchFn = options.fetchFn ?? fetch;
    const response = await fetchFn(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${input.model}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiToken}` },
        body: form,
        signal: controller.signal,
      }
    );

    const responseType = response.headers.get('content-type') ?? '';
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 700);
      throw new Error(`Cloudflare image request failed (${response.status}): ${detail}`);
    }

    let bytes: Buffer;
    if (responseType.includes('application/json')) {
      const payload = await response.json() as {
        success?: boolean;
        errors?: Array<{ message?: string }>;
        result?: { image?: string; data?: string };
      };
      const encoded = payload.result?.image ?? payload.result?.data;
      if (!payload.success || typeof encoded !== 'string') {
        throw new Error(payload.errors?.[0]?.message ?? 'Cloudflare returned no generated image.');
      }
      bytes = Buffer.from(encoded, 'base64');
    } else {
      bytes = Buffer.from(await response.arrayBuffer());
    }

    const mimeType = detectImageMime(bytes);
    if (!mimeType || bytes.length < 100) {
      throw new Error('Cloudflare returned an unsupported or invalid image payload.');
    }
    return { bytes, mimeType, model: input.model };
  } finally {
    clearTimeout(timeout);
  }
}

export function createGeneratedImageFileName(extension: string): string {
  const safeExtension = extension === 'jpeg' ? 'jpg' : extension;
  return `ai-image-${Date.now()}-${crypto.randomBytes(5).toString('hex')}.${safeExtension}`;
}
