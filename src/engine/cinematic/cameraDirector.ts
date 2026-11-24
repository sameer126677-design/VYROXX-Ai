import type { EngineScene, Vec3 } from '../core/types';

export type CameraEase = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
export interface CameraKeyframe {
  frame: number;
  position: Vec3;
  target: Vec3;
  fov: number;
  easing: CameraEase;
}
export interface CameraTrack { sceneId: string; keyframes: CameraKeyframe[]; }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function ease(t: number, type: CameraEase): number {
  if (type === 'ease-in') return t * t;
  if (type === 'ease-out') return 1 - (1 - t) * (1 - t);
  if (type === 'ease-in-out') return t < .5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2;
  return t;
}
function mix(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: lerp(a.x,b.x,t), y: lerp(a.y,b.y,t), z: lerp(a.z,b.z,t) };
}

/** Derives a deterministic camera move from the planner's existing camera intent. */
export function directSceneCamera(scene: EngineScene, fps: number): CameraTrack {
  const cfg = scene.sourceSegment.scene3d?.camera3d;
  const start = cfg?.position ?? { x: 0, y: 4, z: 18 };
  const target = cfg?.target ?? { x: 0, y: 0, z: 0 };
  const end = cfg?.endPosition ?? start;
  const endTarget = cfg?.endTarget ?? target;
  const frames = Math.max(1, Math.round(scene.durationSec * fps) - 1);
  let derivedEnd = end;
  let derivedTarget = endTarget;
  if (!cfg) {
    const amount = Math.max(0, Math.min(1, scene.camera.intensity));
    if (scene.camera.motion === 'zoom-in') derivedEnd = { ...start, z: start.z - 5 * amount };
    if (scene.camera.motion === 'zoom-out') derivedEnd = { ...start, z: start.z + 5 * amount };
    if (scene.camera.motion === 'pan-left') derivedEnd = { ...start, x: start.x - 4 * amount };
    if (scene.camera.motion === 'pan-right') derivedEnd = { ...start, x: start.x + 4 * amount };
    if (scene.camera.motion === 'follow-subject' && scene.nodes[0]) {
      const p = scene.nodes[0].transform.position;
      derivedTarget = { x: p.x, y: p.y, z: p.z };
    }
  }
  return {
    sceneId: scene.id,
    keyframes: [
      { frame: scene.startFrame, position: start, target, fov: cfg?.fov ?? 50, easing: 'ease-in-out' },
      { frame: scene.startFrame + frames, position: derivedEnd, target: derivedTarget, fov: cfg?.fov ?? 50, easing: 'ease-in-out' },
    ],
  };
}

export function sampleCameraTrack(track: CameraTrack, frame: number): CameraKeyframe {
  const first = track.keyframes[0];
  const last = track.keyframes[track.keyframes.length - 1] ?? first;
  if (!first || frame <= first.frame) return first;
  if (frame >= last.frame) return last;
  const t = ease((frame - first.frame) / Math.max(1, last.frame - first.frame), first.easing);
  return {
    frame,
    position: mix(first.position, last.position, t),
    target: mix(first.target, last.target, t),
    fov: lerp(first.fov, last.fov, t),
    easing: first.easing,
  };
}
