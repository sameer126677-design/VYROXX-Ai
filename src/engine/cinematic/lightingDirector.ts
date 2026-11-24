import type { EngineScene } from '../core/types';
import { resolveVolumetricRaysIntensity } from '../../shared/sceneSchema';

export interface CinematicLightingPlan {
  mood: string;
  ambient: { color: string; intensity: number };
  key: { color: string; intensity: number; position: { x: number; y: number; z: number } };
  fill: { color: string; intensity: number; position: { x: number; y: number; z: number } };
  rim: { color: string; intensity: number; position: { x: number; y: number; z: number } };
  fog: { color: string; density: number };
  bloom: { color: string; intensity: number };
  volumetricRays: number;
  vignette: number;
}

const MOOD_PRESETS: Record<string, { ambient: string; key: string; fill: string; rim: string; keyPower: number; fillPower: number; rimPower: number }> = {
  daylight: { ambient: '#dbeafe', key: '#fff4dc', fill: '#c8e4ff', rim: '#ffffff', keyPower: 2.2, fillPower: 0.55, rimPower: 0.35 },
  cinematic: { ambient: '#8795b2', key: '#ffe0b2', fill: '#7ca7d8', rim: '#9cc8ff', keyPower: 2.4, fillPower: 0.7, rimPower: 1.25 },
  neon: { ambient: '#20264a', key: '#38bdf8', fill: '#d946ef', rim: '#8b5cf6', keyPower: 1.7, fillPower: 1.15, rimPower: 1.8 },
  noir: { ambient: '#30343d', key: '#e8edf5', fill: '#536078', rim: '#9ca3af', keyPower: 2.8, fillPower: 0.18, rimPower: 1.35 },
  'golden-hour': { ambient: '#d7a36f', key: '#ffb45c', fill: '#ffd9a1', rim: '#ff8b45', keyPower: 2.6, fillPower: 0.45, rimPower: 1.1 },
  'eerie-ash': { ambient: '#56515c', key: '#c5b5a4', fill: '#65717c', rim: '#e0a18b', keyPower: 1.25, fillPower: 0.35, rimPower: 1.55 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

/** Converts the scene's declared mood and 3D sun/fog settings into a renderer-neutral lighting rig. */
export function directSceneLighting(scene: EngineScene): CinematicLightingPlan {
  const mood = scene.lighting.mood;
  const preset = MOOD_PRESETS[mood] ?? MOOD_PRESETS.cinematic;
  const scene3d = scene.sourceSegment.scene3d;
  const elevation = (scene3d?.sunElevationDeg ?? 42) * Math.PI / 180;
  const azimuth = (scene3d?.sunAzimuthDeg ?? -35) * Math.PI / 180;
  const sunPosition = {
    x: Math.cos(elevation) * Math.cos(azimuth) * 12,
    y: Math.sin(elevation) * 12,
    z: Math.cos(elevation) * Math.sin(azimuth) * 12,
  };
  const sunIntensity = clamp(scene3d?.sunIntensity ?? 1, 0, 5);
  const ambientIntensity = clamp(scene3d?.ambientIntensity ?? scene.lighting.ambientAlpha * 2, 0, 2.5);
  const rays = resolveVolumetricRaysIntensity(scene.lighting.volumetricRays);
  return {
    mood,
    ambient: { color: preset.ambient, intensity: ambientIntensity },
    key: { color: preset.key, intensity: preset.keyPower * (scene3d ? sunIntensity : 1), position: sunPosition },
    fill: { color: preset.fill, intensity: preset.fillPower, position: { x: -sunPosition.x * 0.65, y: Math.max(1, sunPosition.y * 0.55), z: -sunPosition.z * 0.65 } },
    rim: { color: preset.rim, intensity: preset.rimPower, position: { x: -sunPosition.x, y: Math.max(2, sunPosition.y), z: -sunPosition.z } },
    fog: { color: scene3d?.fogColor ?? scene.background.skyBottom, density: clamp(scene3d?.fogDensity ?? (scene.weather.type === 'fog' ? scene.weather.density * 0.025 : 0), 0, 0.08) },
    bloom: { color: scene.lighting.bloomColor, intensity: clamp(rays * 0.8 + scene.lighting.vignette * 0.12, 0, 1.5) },
    volumetricRays: rays,
    vignette: clamp(scene.lighting.vignette, 0, 1),
  };
}
