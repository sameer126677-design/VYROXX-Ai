import type { Vec3 } from '../core/types';
import type { CharacterPose, CharacterRig, JointPose } from './rig';
import { validateCharacterRig } from './rig';

export type MotionPreset = 'idle' | 'walk' | 'run' | 'sprint' | 'jump' | 'look-around';
export interface MotionClip {
  id: string;
  rigId: string;
  preset: MotionPreset;
  durationFrames: number;
  loop: boolean;
  amplitude: number;
  speed: number;
}
const ZERO: Vec3 = { x: 0, y: 0, z: 0 };
function pose(jointId: string, x = 0, y = 0, z = 0): JointPose {
  return { jointId, rotation: { x, y, z } };
}

/** Procedural keyframe-free motion sampler; deterministic at any frame. */
export function sampleMotionClip(rig: CharacterRig, clip: MotionClip, frame: number, fps: number): CharacterPose {
  const validation = validateCharacterRig(rig);
  if (!validation.valid) throw new Error(`Invalid rig: ${validation.errors.join(' ')}`);
  if (clip.rigId !== rig.id) throw new Error('Motion clip belongs to a different rig.');
  const duration = Math.max(1, clip.durationFrames);
  const sampleFrame = clip.loop ? ((frame % duration) + duration) % duration : Math.max(0, Math.min(duration, frame));
  const phase = (sampleFrame / Math.max(1, duration)) * Math.PI * 2 * Math.max(0.1, clip.speed);
  const swing = Math.sin(phase) * clip.amplitude;
  const bob = Math.abs(Math.sin(phase * 2)) * clip.amplitude * 0.16;
  let joints: JointPose[] = [];
  switch (clip.preset) {
    case 'walk':
    case 'run':
    case 'sprint': {
      const factor = clip.preset === 'walk' ? 0.55 : clip.preset === 'sprint' ? 1.35 : 1;
      joints = [
        pose('left_hip', swing * factor), pose('right_hip', -swing * factor),
        pose('left_knee', Math.max(0, -swing) * factor * 0.8),
        pose('right_knee', Math.max(0, swing) * factor * 0.8),
        pose('left_shoulder', -swing * factor * 0.7),
        pose('right_shoulder', swing * factor * 0.7),
        pose('left_elbow', -0.12 * factor), pose('right_elbow', -0.12 * factor),
        pose('spine', 0, 0, bob),
      ];
      break;
    }
    case 'jump':
      joints = [pose('left_hip', -0.45), pose('right_hip', -0.45), pose('left_knee', 0.8), pose('right_knee', 0.8), pose('left_shoulder', -0.8), pose('right_shoulder', -0.8), pose('spine', 0, 0, bob)];
      break;
    case 'look-around':
      joints = [pose('head', 0, Math.sin(phase) * 0.5), pose('neck', 0, Math.sin(phase) * 0.18)];
      break;
    default:
      joints = [pose('spine', 0, 0, bob * 0.35), pose('head', Math.sin(phase) * 0.025)];
  }
  return { rigId: rig.id, frame, joints };
}

export function createMotionClip(rig: CharacterRig, preset: MotionPreset, fps: number, durationSec: number, options: Partial<Pick<MotionClip, 'amplitude' | 'speed' | 'loop'>> = {}): MotionClip {
  return {
    id: `motion-${rig.characterId}-${preset}`,
    rigId: rig.id,
    preset,
    durationFrames: Math.max(1, Math.round(fps * durationSec)),
    loop: options.loop ?? ['idle', 'walk', 'run', 'sprint'].includes(preset),
    amplitude: options.amplitude ?? (preset === 'walk' ? 0.55 : preset === 'idle' ? 0.12 : 0.9),
    speed: options.speed ?? (preset === 'walk' ? 1.5 : preset === 'idle' ? 0.5 : 2.4),
  };
}
