import * as THREE from 'three';
import { ShaderSpec, VisualStyle } from '../../shared/sceneSchema';

let cachedToonGradientMap: THREE.DataTexture | null = null;

/**
 * Generates a discrete 4-band cel-shading gradient DataTexture (NearestFilter)
 * for THREE.MeshToonMaterial so anime/toon scenes have crisp stepped shadows.
 */
export function getAnimeToonGradientMap(): THREE.DataTexture {
  if (cachedToonGradientMap) return cachedToonGradientMap;
  const bands = new Uint8Array([
    58, 58, 66, 255,
    125, 125, 138, 255,
    198, 198, 208, 255,
    255, 255, 255, 255,
  ]);
  const tex = new THREE.DataTexture(bands, 4, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  cachedToonGradientMap = tex;
  return tex;
}

export interface ShaderMaterialOptions {
  preset: ShaderSpec['preset'];
  primaryColor: string;
  secondaryColor: string;
  speed?: number;
  intensity?: number;
}

/**
 * Builds an animated Three.js ShaderMaterial with a `uTime` uniform updated per frame.
 */
export function createShaderMaterialFromSpec(
  opts: ShaderMaterialOptions
): THREE.ShaderMaterial {
  const colA = new THREE.Color(opts.primaryColor || '#38bdf8');
  const colB = new THREE.Color(opts.secondaryColor || '#a855f7');
  const speed = opts.speed ?? 1.2;
  const intensity = opts.intensity ?? 1.4;

  if (opts.preset === 'water-waves') {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: speed },
        uIntensity: { value: intensity },
        uColorPrimary: { value: colA },
        uColorSecondary: { value: colB },
      },
      side: THREE.DoubleSide,
      transparent: true,
      vertexShader: `
        uniform float uTime;
        uniform float uSpeed;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying float vWaveHeight;

        void main() {
          vUv = uv;
          vec3 pos = position;
          float t = uTime * uSpeed;
          float w1 = sin(pos.x * 1.4 + t * 2.1) * 0.28;
          float w2 = cos(pos.y * 1.9 - t * 1.7) * 0.22;
          float w3 = sin((pos.x + pos.y) * 2.6 + t * 2.9) * 0.1;
          float h = w1 + w2 + w3;
          pos.z += h;
          vWaveHeight = h;
          vec4 wp = modelMatrix * vec4(pos, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        uniform vec3 uColorPrimary;
        uniform vec3 uColorSecondary;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying float vWaveHeight;

        void main() {
          float crest = smoothstep(0.05, 0.55, vWaveHeight + 0.25);
          float shimmer = 0.5 + 0.5 * sin(vWorldPos.x * 4.0 + uTime * 3.0) * cos(vWorldPos.z * 4.0 - uTime * 2.2);
          vec3 col = mix(uColorPrimary, uColorSecondary, clamp(crest * 0.78 + shimmer * 0.22, 0.0, 1.0));
          gl_FragColor = vec4(col * clamp(uIntensity, 0.6, 2.2), 0.9);
        }
      `,
    });
  }

  if (opts.preset === 'energy-plasma') {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: speed },
        uIntensity: { value: intensity },
        uColorPrimary: { value: colA },
        uColorSecondary: { value: colB },
      },
      side: THREE.DoubleSide,
      transparent: true,
      vertexShader: `
        uniform float uTime;
        uniform float uSpeed;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPos;

        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          float pulse = 1.0 + sin(position.y * 5.0 + uTime * uSpeed * 3.0) * 0.04;
          vec4 mvPos = modelViewMatrix * vec4(position * pulse, 1.0);
          vViewPos = mvPos.xyz;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uSpeed;
        uniform float uIntensity;
        uniform vec3 uColorPrimary;
        uniform vec3 uColorSecondary;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPos;

        void main() {
          float t = uTime * uSpeed;
          float n = sin(vUv.x * 16.0 + t * 2.4) * cos(vUv.y * 16.0 - t * 1.9);
          float rings = 0.5 + 0.5 * sin(length(vUv - 0.5) * 28.0 - t * 4.5 + n);
          vec3 viewDir = normalize(-vViewPos);
          float rim = pow(1.0 - max(0.0, dot(viewDir, vNormal)), 2.2);
          vec3 col = mix(uColorPrimary, uColorSecondary, rings) + uColorSecondary * rim * 0.75;
          gl_FragColor = vec4(col * uIntensity, 0.92);
        }
      `,
    });
  }

  if (opts.preset === 'neon-grid') {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: speed },
        uIntensity: { value: intensity },
        uColorPrimary: { value: colA },
        uColorSecondary: { value: colB },
      },
      side: THREE.DoubleSide,
      transparent: true,
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uSpeed;
        uniform float uIntensity;
        uniform vec3 uColorPrimary;
        uniform vec3 uColorSecondary;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        void main() {
          vec2 grid = abs(fract(vUv * 12.0 - vec2(0.0, uTime * uSpeed * 0.4)) - 0.5);
          float line = 1.0 - smoothstep(0.02, 0.08, min(grid.x, grid.y));
          float pulse = 0.65 + 0.35 * sin(uTime * 3.0 + vWorldPos.x * 0.5);
          vec3 col = mix(uColorPrimary * 0.25, uColorSecondary * uIntensity, line * pulse);
          gl_FragColor = vec4(col, mix(0.45, 0.96, line));
        }
      `,
    });
  }

  // Default: 'fresnel-hologram'
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: speed },
      uIntensity: { value: intensity },
      uColorPrimary: { value: colA },
      uColorSecondary: { value: colB },
    },
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime;
      uniform float uSpeed;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying vec3 vViewPos;

      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        // Subtle holographic scanline jitter
        wp.x += sin(wp.y * 12.0 + uTime * uSpeed * 5.0) * 0.008;
        vWorldPos = wp.xyz;
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = viewMatrix * wp;
        vViewPos = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uSpeed;
      uniform float uIntensity;
      uniform vec3 uColorPrimary;
      uniform vec3 uColorSecondary;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying vec3 vViewPos;

      void main() {
        vec3 viewDir = normalize(-vViewPos);
        float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 2.4);
        float scan = 0.55 + 0.45 * sin(vWorldPos.y * 22.0 - uTime * uSpeed * 6.0);
        vec3 col = mix(uColorPrimary, uColorSecondary, fresnel) * (0.45 + fresnel * 1.4) * scan * uIntensity;
        float alpha = clamp(0.22 + fresnel * 0.72 * scan, 0.15, 0.95);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

export interface StyleApplyOptions {
  outlineColor?: string;
  outlineScale?: number;
  shaderSpec?: ShaderSpec;
}

export type StyleAdapterFn = (root: THREE.Object3D, options?: StyleApplyOptions) => void;

const styleRegistry = new Map<string, StyleAdapterFn>();

export function registerStyleAdapter(styleName: string, adapter: StyleAdapterFn): void {
  styleRegistry.set(styleName, adapter);
}

export function getRegisteredStyleNames(): string[] {
  return Array.from(styleRegistry.keys());
}

function attachToonOutlines(
  root: THREE.Object3D,
  outlineHex = '#090d16',
  outlineScale = 1.035
): void {
  const targetMeshes: THREE.Mesh[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (
      mesh.isMesh &&
      !(mesh as THREE.InstancedMesh).isInstancedMesh &&
      !mesh.userData.isOutline &&
      !mesh.userData.skipOutline &&
      mesh.geometry
    ) {
      targetMeshes.push(mesh);
    }
  });

  const outlineMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(outlineHex),
    side: THREE.BackSide,
  });

  for (const mesh of targetMeshes) {
    if (mesh.children.some((c) => c.userData.isOutline)) continue;
    const outline = new THREE.Mesh(mesh.geometry, outlineMat);
    outline.scale.setScalar(outlineScale);
    outline.userData.isOutline = true;
    outline.name = `${mesh.name || 'mesh'}_outline`;
    mesh.add(outline);
  }
}

// Built-in: Anime / Cel-Shaded 3D (MeshToonMaterial + discrete gradient map + inverted-hull outlines)
registerStyleAdapter('anime-cel', (root, opts) => {
  const gradMap = getAnimeToonGradientMap();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.isOutline || !mesh.material) return;
    if (mesh.material instanceof THREE.ShaderMaterial) return;

    const convert = (mat: THREE.Material): THREE.Material => {
      const m = mat as THREE.MeshStandardMaterial;
      // Preserve pure unlit basic or strongly emissive lights/visors
      if (mat instanceof THREE.MeshBasicMaterial) return mat;
      const toon = new THREE.MeshToonMaterial({
        color: m.color ? m.color.clone() : new THREE.Color('#38bdf8'),
        gradientMap: gradMap,
        map: m.map ?? null,
        emissive: m.emissive ? m.emissive.clone() : new THREE.Color('#000000'),
        emissiveIntensity: m.emissiveIntensity ?? 1,
        side: m.side,
        transparent: m.transparent,
        opacity: m.opacity,
      });
      mat.dispose();
      return toon;
    };

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(convert);
    } else {
      mesh.material = convert(mesh.material);
    }
  });

  attachToonOutlines(root, opts?.outlineColor ?? '#090d16', opts?.outlineScale ?? 1.038);
});

// Built-in: Low-Poly Faceted 3D
registerStyleAdapter('low-poly', (root) => {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const updateMat = (mat: THREE.Material) => {
      if ('flatShading' in mat) {
        (mat as THREE.MeshStandardMaterial).flatShading = true;
      }
      if ('roughness' in mat) {
        const std = mat as THREE.MeshStandardMaterial;
        std.roughness = Math.max(0.62, std.roughness);
      }
      mat.needsUpdate = true;
    };
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(updateMat);
    } else {
      updateMat(mesh.material);
    }
  });
});

// Built-in: Stylized 3D (smooth semi-matte shading with crisp specular pop)
registerStyleAdapter('stylized-3d', (root) => {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const tune = (mat: THREE.Material) => {
      if (mat instanceof THREE.MeshStandardMaterial) {
        mat.roughness = Math.min(0.6, Math.max(0.35, mat.roughness));
        mat.needsUpdate = true;
      }
    };
    if (Array.isArray(mesh.material)) mesh.material.forEach(tune);
    else tune(mesh.material);
  });
});

// Built-in: Hologram / Custom GLSL Shader Style
registerStyleAdapter('hologram-shader', (root, opts) => {
  const holoMat = createShaderMaterialFromSpec({
    preset: opts?.shaderSpec?.preset && opts.shaderSpec.preset !== 'none'
      ? opts.shaderSpec.preset
      : 'fresnel-hologram',
    primaryColor: opts?.shaderSpec?.primaryColor || '#22d3ee',
    secondaryColor: opts?.shaderSpec?.secondaryColor || '#a855f7',
    speed: opts?.shaderSpec?.speed ?? 1.4,
    intensity: opts?.shaderSpec?.intensity ?? 1.35,
  });

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh) return;
    if (mesh.material && !(mesh.material instanceof THREE.ShaderMaterial)) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
      mesh.material = holoMat;
    }
  });
});

// Built-in: Realistic PBR (default materials remain intact)
registerStyleAdapter('realistic-pbr', () => {});

export function applyVisualStyleToObject(
  root: THREE.Object3D,
  style: VisualStyle | string,
  options?: StyleApplyOptions
): void {
  const adapter = styleRegistry.get(style);
  if (adapter) {
    adapter(root, options);
  }
  if (options?.shaderSpec?.preset === 'toon-outline' && style !== 'anime-cel') {
    attachToonOutlines(root, options.outlineColor ?? '#090d16', options.outlineScale ?? 1.035);
  }
}

export function updateShaderUniformsInObject(root: THREE.Object3D, tSec: number): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (mat instanceof THREE.ShaderMaterial && mat.uniforms?.uTime) {
        mat.uniforms.uTime.value = tSec;
      }
    }
  });
}
