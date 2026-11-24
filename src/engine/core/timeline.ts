import type { EngineNode, EngineScene, Vec3 } from './types';

export type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
export interface TransformKeyframe {
  frame: number;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  easing?: Easing;
}
export interface TransformTrack {
  nodeId: string;
  keyframes: TransformKeyframe[];
}
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
function ease(t: number, type: Easing = 'linear'): number {
  if (type === 'ease-in') return t * t;
  if (type === 'ease-out') return 1 - (1 - t) * (1 - t);
  if (type === 'ease-in-out') return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  return t;
}
function mix(a: number, b: number, t: number): number { return a + (b - a) * t; }
function mixVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), z: mix(a.z, b.z, t) };
}
function sampleVec(a: Vec3, b: Vec3, t: number): Vec3 { return mixVec(a, b, t); }

/** Deterministically samples a transform track at an absolute timeline frame. */
export function sampleTransformTrack(base: EngineNode['transform'], track: TransformTrack, frame: number): EngineNode['transform'] {
  const keys = [...track.keyframes].sort((a, b) => a.frame - b.frame);
  if (!keys.length) return base;
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (frame <= first.frame) return {
    position: first.position ?? base.position,
    rotation: first.rotation ?? base.rotation,
    scale: first.scale ?? base.scale,
  };
  if (frame >= last.frame) return {
    position: last.position ?? base.position,
    rotation: last.rotation ?? base.rotation,
    scale: last.scale ?? base.scale,
  };
  let left = first;
  let right = last;
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (frame >= keys[i].frame && frame <= keys[i + 1].frame) {
      left = keys[i]; right = keys[i + 1]; break;
    }
  }
  const span = Math.max(1, right.frame - left.frame);
  const t = ease(clamp01((frame - left.frame) / span), left.easing);
  return {
    position: sampleVec(left.position ?? base.position, right.position ?? base.position, t),
    rotation: sampleVec(left.rotation ?? base.rotation, right.rotation ?? base.rotation, t),
    scale: sampleVec(left.scale ?? base.scale, right.scale ?? base.scale, t),
  };
}

export function getSceneAtFrame(scenes: EngineScene[], frame: number): EngineScene | null {
  return scenes.find((scene) => frame >= scene.startFrame && frame < scene.endFrame)
    ?? (frame >= (scenes[scenes.length - 1]?.endFrame ?? Infinity) ? scenes[scenes.length - 1] ?? null : null);
}
