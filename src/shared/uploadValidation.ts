export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

const EXT_TO_MIMES: Record<string, string[]> = {
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  webp: ['image/webp'],
  svg: ['image/svg+xml'],
  mp4: ['video/mp4'],
  webm: ['video/webm'],
  mov: ['video/quicktime'],
  mp3: ['audio/mpeg', 'audio/mp3'],
  wav: ['audio/wav', 'audio/wave', 'audio/x-wav'],
  ogg: ['audio/ogg'],
  json: ['application/json', 'text/json'],
  txt: ['text/plain'],
  pdf: ['application/pdf'],
  glb: ['model/gltf-binary', 'application/octet-stream'],
  gltf: ['model/gltf+json', 'application/json'],
};

function hasBytes(buf: Uint8Array, offset: number, expected: number[]): boolean {
  if (buf.length < offset + expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (buf[offset + i] !== expected[i]) return false;
  }
  return true;
}

function asciiAt(buf: Uint8Array, offset: number, len: number): string {
  if (buf.length < offset + len) return '';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += String.fromCharCode(buf[offset + i]);
  }
  return out;
}

export function validateSvgSafety(svgText: string): { ok: true } | { ok: false; error: string } {
  const trimmed = svgText.trim();
  if (!/<svg[\s>]/i.test(trimmed)) {
    return { ok: false, error: 'Invalid SVG document: missing <svg> root element.' };
  }
  // Normalize HTML numeric/hex entities and strip ASCII control chars to catch obfuscated schemes
  const normalized = trimmed
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&#([0-9]+);?/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .toLowerCase();

  if (/<(script|foreignobject|iframe|embed|object|applet|base|meta|link)[\s>/]/i.test(normalized)) {
    return { ok: false, error: 'Blocked SVG containing active HTML/script elements for XSS safety.' };
  }
  if (
    /(?:javascript|vbscript|livescript)\s*:|data\s*:\s*(?:text\/html|application\/xhtml\+xml|image\/svg\+xml)/i.test(
      normalized.replace(/\s+/g, '')
    )
  ) {
    return { ok: false, error: 'Blocked SVG containing executable URI schemes.' };
  }
  if (/(?:[\s/"'>])on[a-z]{2,24}\s*=/i.test(normalized)) {
    return { ok: false, error: 'Blocked SVG containing inline event handler attributes.' };
  }
  if (/@import\b|expression\s*\(/i.test(normalized)) {
    return { ok: false, error: 'Blocked SVG containing unsafe CSS directives.' };
  }
  return { ok: true };
}

export function isSafeAvatarUrl(raw: string): boolean {
  const value = raw.trim();
  if (!value) return true;
  if (value.length > 1000 || /[\s\x00-\x1f\x7f]/.test(value)) return false;
  if (value.startsWith('https://')) {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'https:' && Boolean(parsed.hostname);
    } catch {
      return false;
    }
  }
  // Authenticated internal asset path format: "<uid>/<fileName>"
  return /^[a-zA-Z0-9_-]{1,128}\/[a-zA-Z0-9._-]{1,200}$/.test(value) && !value.includes('..');
}

export function validateUploadBytes(
  fileName: string,
  mimeType: string,
  bytes: Uint8Array
): { ok: true; ext: string } | { ok: false; error: string } {
  if (!fileName || fileName.length > 160) {
    return { ok: false, error: 'Invalid filename length.' };
  }
  if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'File must be between 1 byte and 20 MB.' };
  }

  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const allowedMimes = EXT_TO_MIMES[ext];
  if (!allowedMimes) {
    return {
      ok: false,
      error: `Unsupported file extension ".${ext || 'unknown'}". Allowed: png, jpg, jpeg, webp, svg, mp4, webm, mov, mp3, wav, ogg, json, txt, pdf, glb, gltf.`,
    };
  }

  const normalizedMime = mimeType.toLowerCase().split(';')[0].trim();
  if (!allowedMimes.includes(normalizedMime)) {
    return {
      ok: false,
      error: `MIME type "${normalizedMime}" does not match ".${ext}" file extension.`,
    };
  }

  // Structural / Magic-Byte Signature Verification
  if (ext === 'png') {
    if (!hasBytes(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
      return { ok: false, error: 'Invalid PNG file signature.' };
    }
  } else if (ext === 'jpg' || ext === 'jpeg') {
    if (!hasBytes(bytes, 0, [0xff, 0xd8, 0xff])) {
      return { ok: false, error: 'Invalid JPEG file signature.' };
    }
  } else if (ext === 'webp') {
    if (asciiAt(bytes, 0, 4) !== 'RIFF' || asciiAt(bytes, 8, 4) !== 'WEBP') {
      return { ok: false, error: 'Invalid WebP file signature.' };
    }
  } else if (ext === 'pdf') {
    if (asciiAt(bytes, 0, 5) !== '%PDF-') {
      return { ok: false, error: 'Invalid PDF file signature.' };
    }
  } else if (ext === 'webm') {
    if (!hasBytes(bytes, 0, [0x1a, 0x45, 0xdf, 0xa3])) {
      return { ok: false, error: 'Invalid WebM file signature.' };
    }
  } else if (ext === 'mp4' || ext === 'mov') {
    const box = asciiAt(bytes, 4, 4);
    if (!['ftyp', 'moov', 'mdat', 'wide', 'free'].includes(box)) {
      return { ok: false, error: `Invalid ${ext.toUpperCase()} container signature.` };
    }
  } else if (ext === 'wav') {
    if (asciiAt(bytes, 0, 4) !== 'RIFF' || asciiAt(bytes, 8, 4) !== 'WAVE') {
      return { ok: false, error: 'Invalid WAV file signature.' };
    }
  } else if (ext === 'ogg') {
    if (asciiAt(bytes, 0, 4) !== 'OggS') {
      return { ok: false, error: 'Invalid OGG file signature.' };
    }
  } else if (ext === 'mp3') {
    const isId3 = asciiAt(bytes, 0, 3) === 'ID3';
    const isSync = bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
    if (!isId3 && !isSync) {
      return { ok: false, error: 'Invalid MP3 audio frame signature.' };
    }
  } else if (ext === 'svg') {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const svgCheck = validateSvgSafety(text);
    if (!svgCheck.ok) return svgCheck;
  } else if (ext === 'json') {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    try {
      JSON.parse(text);
    } catch {
      return { ok: false, error: 'Invalid JSON file: failed JSON syntax check.' };
    }
  } else if (ext === 'txt') {
    for (let i = 0; i < Math.min(bytes.length, 4096); i++) {
      if (bytes[i] === 0x00) {
        return { ok: false, error: 'Invalid TXT file: binary NUL byte detected.' };
      }
    }
  } else if (ext === 'glb') {
    // glTF 2.0 Binary container header: magic "glTF" (0x46546C67 LE) + version 2 (0x02000000 LE) + 12-byte header min
    if (
      bytes.length < 20 ||
      asciiAt(bytes, 0, 4) !== 'glTF' ||
      !hasBytes(bytes, 4, [0x02, 0x00, 0x00, 0x00])
    ) {
      return { ok: false, error: 'Invalid GLB 3D model signature (expected glTF v2 binary header).' };
    }
  } else if (ext === 'gltf') {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    try {
      const parsed = JSON.parse(text) as { asset?: { version?: unknown } };
      if (!parsed || typeof parsed !== 'object' || !parsed.asset || typeof parsed.asset !== 'object') {
        return { ok: false, error: 'Invalid glTF JSON file: missing root "asset" metadata object.' };
      }
    } catch {
      return { ok: false, error: 'Invalid glTF file: failed JSON syntax check.' };
    }
  }

  return { ok: true, ext };
}
