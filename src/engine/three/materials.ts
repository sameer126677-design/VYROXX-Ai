import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createSeededRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function detectSoftwareGl(renderer: THREE.WebGLRenderer): boolean {
  try {
    const gl = renderer.getContext();
    const glStr = String(gl.getParameter(gl.RENDERER) || '');
    return /SwiftShader|llvmpipe|Software Rasterizer/i.test(glStr);
  } catch {
    return false;
  }
}

export function createRoomEnvMap(renderer: THREE.WebGLRenderer): {
  texture: THREE.Texture;
  pmrem: THREE.PMREMGenerator;
} {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const renderTarget = pmrem.fromScene(room, 0.04);
  room.dispose();
  return { texture: renderTarget.texture, pmrem };
}

function makeCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  options?: {
    repeatX?: number;
    repeatY?: number;
    srgb?: boolean;
    maxAnisotropy?: number;
  }
): THREE.Texture {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      draw(ctx, width, height);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(options?.repeatX ?? 1, options?.repeatY ?? 1);
    if (options?.srgb !== false) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    if (options?.maxAnisotropy) {
      tex.anisotropy = Math.min(8, options.maxAnisotropy);
    }
    tex.needsUpdate = true;
    return tex;
  }

  // Headless Node.js fallback DataTexture so materials remain inspectable without DOM
  const data = new Uint8Array(4 * 4 * 4);
  for (let i = 0; i < 16; i++) {
    data[i * 4] = 140;
    data[i * 4 + 1] = 160;
    data[i * 4 + 2] = 190;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, 4, 4, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(options?.repeatX ?? 1, options?.repeatY ?? 1);
  if (options?.srgb !== false) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.needsUpdate = true;
  return tex;
}

export function createAsphaltTexture(
  baseHex: string,
  stripeHex: string,
  lanes: number,
  maxAnisotropy = 4
): THREE.Texture {
  const rng = createSeededRng(hashSeed(`${baseHex}:${stripeHex}:${lanes}`));
  return makeCanvasTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = baseHex;
      ctx.fillRect(0, 0, w, h);

      // Subtle mineral grain
      for (let i = 0; i < 3200; i++) {
        const x = rng() * w;
        const y = rng() * h;
        const v = Math.floor(20 + rng() * 32);
        ctx.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
        ctx.fillRect(x, y, 2, 2);
      }

      // Edge curbs
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, 0, 22, h);
      ctx.fillRect(w - 22, 0, 22, h);

      // Dashed lane dividers
      ctx.fillStyle = stripeHex;
      const laneCount = Math.max(1, Math.min(6, lanes));
      for (let l = 1; l < laneCount; l++) {
        const lx = Math.round((w * l) / laneCount) - 4;
        for (let y = 16; y < h; y += 96) {
          ctx.fillRect(lx, y, 8, 52);
        }
      }
    },
    { repeatX: 1, repeatY: 16, maxAnisotropy }
  );
}

export function createTrackTexture(
  baseHex: string,
  curbAccentHex: string,
  maxAnisotropy = 4
): THREE.Texture {
  const rng = createSeededRng(hashSeed(`track:${baseHex}:${curbAccentHex}`));
  return makeCanvasTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = baseHex;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2400; i++) {
        const v = Math.floor(18 + rng() * 24);
        ctx.fillStyle = `rgb(${v},${v},${v + 4})`;
        ctx.fillRect(rng() * w, rng() * h, 2, 2);
      }
      // Red/white or accent/white racing apex curbing on edges
      const segH = 64;
      for (let y = 0; y < h; y += segH) {
        const even = Math.floor(y / segH) % 2 === 0;
        ctx.fillStyle = even ? curbAccentHex : '#f8fafc';
        ctx.fillRect(0, y, 28, segH);
        ctx.fillRect(w - 28, y, 28, segH);
      }
      // Center racing line dashes
      ctx.fillStyle = '#e2e8f0';
      for (let y = 18; y < h; y += 84) {
        ctx.fillRect(w / 2 - 4, y, 8, 42);
      }
    },
    { repeatX: 1, repeatY: 22, maxAnisotropy }
  );
}

export function createWindowFacadeTexture(
  wallHex: string,
  windowGlowHex: string,
  seedKey: string,
  style: string,
  maxAnisotropy = 4
): { map: THREE.Texture; emissiveMap: THREE.Texture } {
  const rng = createSeededRng(hashSeed(`${seedKey}:${wallHex}:${style}`));
  const cols = style === 'warehouse' ? 4 : 6;
  const rows = style === 'cottage' ? 4 : 12;

  const litMatrix: boolean[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < cols; c++) {
      const litChance = style === 'ruined' ? 0.16 : style === 'neon-tower' ? 0.72 : 0.48;
      row.push(rng() < litChance);
    }
    litMatrix.push(row);
  }

  const map = makeCanvasTexture(
    256,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = wallHex;
      ctx.fillRect(0, 0, w, h);

      // Subtle architectural concrete/panel seams
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 2;
      const cellW = w / cols;
      const cellH = h / rows;
      for (let r = 0; r < rows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * cellH);
        ctx.lineTo(w, r * cellH);
        ctx.stroke();

        for (let c = 0; c < cols; c++) {
          const padX = cellW * 0.18;
          const padY = cellH * 0.2;
          ctx.fillStyle = litMatrix[r][c] ? windowGlowHex : '#0b1220';
          ctx.fillRect(
            c * cellW + padX,
            r * cellH + padY,
            cellW - padX * 2,
            cellH - padY * 2
          );
        }
      }
    },
    { maxAnisotropy }
  );

  const emissiveMap = makeCanvasTexture(
    256,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      const cellW = w / cols;
      const cellH = h / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!litMatrix[r][c]) continue;
          const padX = cellW * 0.18;
          const padY = cellH * 0.2;
          ctx.fillStyle = windowGlowHex;
          ctx.fillRect(
            c * cellW + padX,
            r * cellH + padY,
            cellW - padX * 2,
            cellH - padY * 2
          );
        }
      }
    },
    { maxAnisotropy }
  );

  return { map, emissiveMap };
}

export function createGrassTerrainTexture(
  baseHex: string,
  accentHex: string,
  maxAnisotropy = 4
): THREE.Texture {
  const rng = createSeededRng(hashSeed(`grass:${baseHex}:${accentHex}`));
  return makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = baseHex;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2500; i++) {
        ctx.fillStyle = rng() > 0.5 ? accentHex : '#0f291e';
        ctx.globalAlpha = 0.12 + rng() * 0.2;
        ctx.fillRect(rng() * w, rng() * h, 2 + rng() * 3, 2 + rng() * 3);
      }
      ctx.globalAlpha = 1;
    },
    { repeatX: 16, repeatY: 16, maxAnisotropy }
  );
}

export function createBrushedMetalTexture(baseHex: string): THREE.Texture {
  const rng = createSeededRng(hashSeed(`metal:${baseHex}`));
  return makeCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const alpha = 0.03 + rng() * 0.08;
      ctx.fillStyle = rng() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
      ctx.fillRect(0, y, w, 1);
    }
  });
}

export function createCarbonFiberTexture(): THREE.Texture {
  return makeCanvasTexture(
    64,
    64,
    (ctx) => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#1e293b';
      for (let y = 0; y < 64; y += 8) {
        for (let x = 0; x < 64; x += 8) {
          if (((x + y) / 8) % 2 === 0) {
            ctx.fillRect(x, y, 8, 4);
          } else {
            ctx.fillRect(x, y + 4, 4, 4);
          }
        }
      }
    },
    { repeatX: 6, repeatY: 6 }
  );
}

export function createStudioFloorTexture(baseHex: string): THREE.Texture {
  return makeCanvasTexture(512, 512, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w / 2);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(0.65, baseHex);
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
}

export function createPlanetTexture(
  surfaceStyle: string,
  primaryHex: string,
  secondaryHex: string,
  accentHex: string
): THREE.Texture {
  const rng = createSeededRng(hashSeed(`${surfaceStyle}:${primaryHex}:${accentHex}`));
  return makeCanvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = primaryHex;
    ctx.fillRect(0, 0, w, h);

    if (surfaceStyle === 'gas-bands') {
      for (let y = 0; y < h; y += 10) {
        ctx.fillStyle = y % 20 === 0 ? secondaryHex : accentHex;
        ctx.globalAlpha = 0.25 + rng() * 0.4;
        ctx.fillRect(0, y, w, 6 + rng() * 8);
      }
      ctx.globalAlpha = 1;
      // Great storm oval
      ctx.fillStyle = accentHex;
      ctx.beginPath();
      ctx.ellipse(w * 0.62, h * 0.58, 36, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (surfaceStyle === 'earth-like') {
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = primaryHex;
      for (let i = 0; i < 16; i++) {
        ctx.beginPath();
        ctx.ellipse(
          rng() * w,
          40 + rng() * (h - 80),
          25 + rng() * 55,
          14 + rng() * 35,
          rng() * Math.PI,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      // Polar caps + cloud wisps
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, w, 16);
      ctx.fillRect(0, h - 16, w, 16);
      ctx.globalAlpha = 0.28;
      for (let i = 0; i < 24; i++) {
        ctx.beginPath();
        ctx.ellipse(rng() * w, rng() * h, 40 + rng() * 70, 6 + rng() * 10, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      // Rocky / molten / icy craters & fissures
      for (let i = 0; i < 50; i++) {
        const cx = rng() * w;
        const cy = rng() * h;
        const r = 4 + rng() * 22;
        ctx.fillStyle = i % 3 === 0 ? accentHex : secondaryHex;
        ctx.globalAlpha = 0.3 + rng() * 0.45;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  });
}

export function createSoftParticleTexture(size = 64): THREE.Texture {
  const dim = Math.max(16, Math.min(256, Math.round(size)));
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = dim;
    canvas.height = dim;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const half = dim * 0.5;
      ctx.clearRect(0, 0, dim, dim);
      const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.32, 'rgba(255, 255, 255, 0.85)');
      grad.addColorStop(0.68, 'rgba(255, 255, 255, 0.25)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(half, half, half, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  // Headless Node.js fallback: genuine radial gradient circular alpha mask
  const data = new Uint8Array(dim * dim * 4);
  const half = (dim - 1) * 0.5;
  for (let y = 0; y < dim; y++) {
    for (let x = 0; x < dim; x++) {
      const dx = (x - half) / Math.max(1, half);
      const dy = (y - half) / Math.max(1, half);
      const r = Math.min(1, Math.hypot(dx, dy));
      const falloff = r >= 1 ? 0 : 1 - r * r * (3 - 2 * r);
      const idx = (y * dim + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = Math.round(falloff * 255);
    }
  }
  const tex = new THREE.DataTexture(data, dim, dim, THREE.RGBAFormat);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Deterministic soft vertical/horizontal light-shaft gradient texture (no Math.random).
 * Fades cleanly to 0 at top, bottom, and side edges for additive volumetric beams.
 */
export function createLightShaftTexture(width = 64, height = 128): THREE.Texture {
  const w = Math.max(16, Math.min(256, Math.round(width)));
  const h = Math.max(32, Math.min(256, Math.round(height)));

  const computeAlpha = (u: number, v: number): number => {
    // Soft bell across horizontal axis (0 at edges, 1 at center) with subtle ray striations
    const horiz = Math.sin(u * Math.PI);
    const softHoriz = Math.pow(Math.max(0, horiz), 1.65);
    const streak = 0.82 + 0.18 * Math.sin(u * Math.PI * 5.0);
    // Vertical fade: strong near top (v ~ 0.18), gently tapering down to 0 at bottom (v = 1)
    const topFade = Math.min(1, v / 0.16);
    const bottomFade = Math.pow(Math.max(0, 1 - v), 1.35);
    return Math.max(0, Math.min(1, softHoriz * streak * topFade * bottomFade));
  };

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const img = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) {
        const v = y / Math.max(1, h - 1);
        for (let x = 0; x < w; x++) {
          const u = x / Math.max(1, w - 1);
          const a = Math.round(computeAlpha(u, v) * 255);
          const idx = (y * w + x) * 4;
          img.data[idx] = 255;
          img.data[idx + 1] = 255;
          img.data[idx + 2] = 255;
          img.data[idx + 3] = a;
        }
      }
      ctx.putImageData(img, 0, 0);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    // DataTexture row 0 is bottom (flipY = false), so invert v to match CanvasTexture
    const v = 1 - y / Math.max(1, h - 1);
    for (let x = 0; x < w; x++) {
      const u = x / Math.max(1, w - 1);
      const a = Math.round(computeAlpha(u, v) * 255);
      const idx = (y * w + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = a;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry && typeof mesh.geometry.dispose === 'function') {
      mesh.geometry.dispose();
    }
    const matOrMats = mesh.material;
    if (Array.isArray(matOrMats)) {
      matOrMats.forEach((m) => disposeMaterial(m));
    } else if (matOrMats) {
      disposeMaterial(matOrMats);
    }
  });
}

function disposeMaterial(mat: THREE.Material): void {
  const anyMat = mat as unknown as Record<string, unknown>;
  for (const val of Object.values(anyMat)) {
    if (val && typeof val === 'object' && 'isTexture' in val) {
      (val as THREE.Texture).dispose();
    }
  }
  mat.dispose();
}
