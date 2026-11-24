import type { EngineScene, Vec3 } from '../core/types';

export type EnvironmentPropKind = 'tree' | 'rock' | 'building' | 'crystal' | 'cloud' | 'mountain';
export interface EnvironmentPropPlacement {
  id: string;
  kind: EnvironmentPropKind;
  position: Vec3;
  scale: Vec3;
  rotationY: number;
  color: string;
}
export interface EnvironmentPlan {
  preset: string;
  ground: { type: string; color: string; size: number; roughness: number; metalness: number };
  sky: { top: string; horizon: string; bottom: string };
  atmosphere: { fogColor: string; fogDensity: number };
  scatter: EnvironmentPropPlacement[];
}
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: string): () => number {
  let state = hash(seed) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

/** Plans a repeatable environment from the scene's declared world and background settings. */
export function directSceneEnvironment(scene: EngineScene): EnvironmentPlan {
  const config = scene.sourceSegment.scene3d;
  const preset = config?.environment ?? 'studio';
  const groundType = config?.groundType ?? 'studio-floor';
  const groundSize = clamp(config?.groundSize ?? 120, 20, 600);
  const groundColors: Record<string, string> = {
    asphalt: '#202733', grass: '#315b37', dirt: '#76543a',
    'studio-floor': '#171d2b', grid: '#101827', track: '#292d38', none: '#000000',
  };
  const skyDefaults: Record<string, { top: string; horizon: string; bottom: string }> = {
    city: { top: '#17233e', horizon: '#64748b', bottom: '#1e293b' },
    street: { top: '#101827', horizon: '#475569', bottom: '#111827' },
    forest: { top: '#173b4a', horizon: '#71927a', bottom: '#263d32' },
    space: { top: '#020617', horizon: '#111827', bottom: '#030712' },
    racetrack: { top: '#263b59', horizon: '#94a3b8', bottom: '#475569' },
    studio: { top: '#273449', horizon: '#64748b', bottom: '#111827' },
    interior: { top: '#3b3440', horizon: '#82766f', bottom: '#211e25' },
    wasteland: { top: '#473b35', horizon: '#a17b5b', bottom: '#3b3029' },
  };
  const sky = skyDefaults[preset] ?? skyDefaults.studio;
  const colors: Record<string, string[]> = {
    forest: ['#315b37', '#426b3f', '#244b39'],
    city: ['#64748b', '#475569', '#94a3b8'],
    street: ['#475569', '#334155', '#64748b'],
    wasteland: ['#8b684b', '#6b5545', '#a17b5b'],
    space: ['#64748b', '#94a3b8', '#475569'],
  };
  const palette = colors[preset] ?? ['#64748b', '#94a3b8', '#38bdf8'];
  const random = rng(scene.id + ':' + preset);
  const scatter: EnvironmentPropPlacement[] = [];
  const count = preset === 'forest' ? 34 : preset === 'city' || preset === 'street' ? 22 : preset === 'wasteland' ? 18 : preset === 'space' ? 24 : 0;
  for (let i = 0; i < count; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 16 + random() * Math.max(12, groundSize * 0.36);
    const kind: EnvironmentPropKind = preset === 'forest'
      ? (random() > 0.2 ? 'tree' : 'rock')
      : preset === 'city' || preset === 'street'
      ? 'building'
      : preset === 'space'
      ? (random() > 0.72 ? 'crystal' : 'rock')
      : (random() > 0.55 ? 'rock' : 'mountain');
    const height = kind === 'building' ? 3 + random() * 12 : kind === 'tree' ? 2.5 + random() * 3 : 0.7 + random() * 2.2;
    scatter.push({
      id: `env-${scene.id}-${i}`,
      kind,
      position: { x: Math.cos(angle) * radius, y: kind === 'mountain' ? height * 0.35 : 0, z: Math.sin(angle) * radius },
      scale: kind === 'building'
        ? { x: 1.5 + random() * 2.5, y: height, z: 1.5 + random() * 2.5 }
        : { x: 0.65 + random() * 0.8, y: height, z: 0.65 + random() * 0.8 },
      rotationY: random() * Math.PI * 2,
      color: palette[i % palette.length],
    });
  }
  const fogDefault = scene.weather.type === 'fog' ? scene.weather.density * 0.025 : preset === 'forest' ? 0.008 : 0;
  return {
    preset,
    ground: {
      type: groundType,
      color: scene.background.groundColor || groundColors[groundType] || '#202733',
      size: groundSize,
      roughness: groundType === 'studio-floor' ? 0.28 : groundType === 'grass' ? 0.95 : 0.82,
      metalness: groundType === 'studio-floor' ? 0.24 : groundType === 'asphalt' ? 0.12 : 0.02,
    },
    sky: {
      top: config?.fogColor && preset === 'space' ? '#020617' : scene.background.skyTop || sky.top,
      horizon: scene.background.horizonColor || sky.horizon,
      bottom: scene.background.skyBottom || sky.bottom,
    },
    atmosphere: {
      fogColor: config?.fogColor ?? sky.horizon,
      fogDensity: clamp(config?.fogDensity ?? fogDefault, 0, 0.08),
    },
    scatter,
  };
}
