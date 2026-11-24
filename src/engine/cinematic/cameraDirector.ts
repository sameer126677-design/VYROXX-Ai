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
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}
function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/** Resolves a stable focus point from the planner's element identity and offset. */
export function resolveCameraFocus(scene: EngineScene, elementId?: string, offset: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 | null {
  if (!elementId) return null;
  const node = scene.nodes.find((item) => item.id === elementId || item.sourceElement?.id === elementId);
  if (!node) return null;
  return add(node.transform.position, offset);
}

/** Derives shot composition and deterministic camera movement from planner intent. */
export function directSceneCamera(scene: EngineScene, fps: number): CameraTrack {
  const cfg = scene.sourceSegment.scene3d?.camera3d;
  const shot = cfg?.shotType ?? 'custom';
  const start = cfg?.position ?? { x: 0, y: 4, z: 18 };
  const target = cfg?.target ?? { x: 0, y: 0, z: 0 };
  const frames = Math.max(1, Math.round(scene.durationSec * fps) - 1);
  const amount = clamp(scene.camera.intensity, 0, 1);
  const focus = cfg?.motion === 'follow-subject'
    ? resolveCameraFocus(scene, cfg.followElementId, cfg.followOffset)
    : null;
  let derivedStart = start;
  let derivedTarget = focus ?? target;
  let derivedEnd = cfg?.endPosition ?? start;
  let endTarget = cfg?.endTarget ?? derivedTarget;
  let fov = cfg?.fov ?? 50;

  if (cfg) {
    const radius = Math.max(1, cfg.orbitRadius);
    const center = focus ?? target;
    if (shot === 'wide') fov = Math.max(fov, 58);
    if (shot === 'close-up') fov = Math.min(fov, 38);
    if (shot === 'extreme-close-up') fov = Math.min(fov, 28);
    if (shot === 'low-angle') {
      derivedStart = { ...start, y: Math.min(start.y, center.y - 1.8) };
      derivedEnd = cfg.endPosition ?? derivedStart;
    } else if (shot === 'high-angle' || shot === 'birds-eye') {
      const height = shot === 'birds-eye' ? radius * 0.9 : Math.max(start.y, center.y + radius * 0.35);
      derivedStart = { x: start.x, y: height, z: start.z };
      derivedEnd = cfg.endPosition ?? derivedStart;
    } else if (shot === 'over-the-shoulder') {
      derivedStart = { x: center.x + 2.2, y: center.y + 1.2, z: center.z + 5.5 };
      derivedEnd = cfg.endPosition ?? derivedStart;
    } else if (shot === 'orbit' || cfg.motion === 'orbit') {
      const angle = cfg.orbitSpeed * scene.durationSec;
      derivedEnd = cfg.endPosition ?? {
        x: center.x + Math.sin(angle) * radius,
        y: start.y,
        z: center.z + Math.cos(angle) * radius,
      };
      derivedTarget = center;
      endTarget = cfg.endTarget ?? center;
    } else if (shot === 'tracking' || cfg.motion === 'tracking' || cfg.motion === 'follow-subject') {
      derivedTarget = center;
      endTarget = cfg.endTarget ?? center;
      const offset = cfg.followOffset ?? { x: 0, y: 2, z: 8 };
      derivedStart = { x: center.x + offset.x, y: center.y + offset.y, z: center.z + offset.z };
      derivedEnd = cfg.endPosition ?? derivedStart;
    }

    if (cfg.motion === 'dolly-in' && !cfg.endPosition) {
      const direction = { x: derivedStart.x - derivedTarget.x, y: derivedStart.y - derivedTarget.y, z: derivedStart.z - derivedTarget.z };
      derivedEnd = { x: derivedTarget.x + direction.x * 0.72, y: derivedTarget.y + direction.y * 0.72, z: derivedTarget.z + direction.z * 0.72 };
    } else if (cfg.motion === 'dolly-out' && !cfg.endPosition) {
      const direction = { x: derivedStart.x - derivedTarget.x, y: derivedStart.y - derivedTarget.y, z: derivedStart.z - derivedTarget.z };
      derivedEnd = { x: derivedTarget.x + direction.x * 1.28, y: derivedTarget.y + direction.y * 1.28, z: derivedTarget.z + direction.z * 1.28 };
    } else if (cfg.motion === 'pan' && !cfg.endPosition) {
      derivedEnd = { ...derivedStart, x: derivedStart.x + 3 * amount };
    } else if (cfg.motion === 'tilt' && !cfg.endTarget) {
      endTarget = { ...derivedTarget, y: derivedTarget.y + 2 * amount };
    } else if (cfg.motion === 'flythrough' && !cfg.endPosition) {
      derivedEnd = { x: derivedStart.x, y: derivedStart.y + 1.5, z: derivedStart.z - 7 * Math.max(0.25, amount) };
    }
  } else {
    if (scene.camera.motion === 'zoom-in') derivedEnd = { ...start, z: start.z - 5 * amount };
    if (scene.camera.motion === 'zoom-out') derivedEnd = { ...start, z: start.z + 5 * amount };
    if (scene.camera.motion === 'pan-left') derivedEnd = { ...start, x: start.x - 4 * amount };
    if (scene.camera.motion === 'pan-right') derivedEnd = { ...start, x: start.x + 4 * amount };
    if (scene.camera.motion === 'follow-subject' && scene.nodes[0]) {
      const p = scene.nodes[0].transform.position;
      derivedTarget = { x: p.x, y: p.y, z: p.z };
      endTarget = derivedTarget;
    }
  }

  return {
    sceneId: scene.id,
    keyframes: [
      { frame: scene.startFrame, position: derivedStart, target: derivedTarget, fov, easing: 'ease-in-out' },
      { frame: scene.startFrame + frames, position: derivedEnd, target: endTarget, fov, easing: 'ease-in-out' },
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
