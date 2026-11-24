import type { CharacterRig } from './rig';
import { createMotionClip, sampleMotionClip, type MotionPreset, type MotionClip } from './animation';
import { cutoutJointRotations } from './cutoutRig';

/** Samples a procedural motion clip and returns the world-space rotations for cutout layers. */
export function sampleCutoutMotion(
  rig: CharacterRig,
  preset: MotionPreset,
  frame: number,
  fps: number,
  options: Partial<Pick<MotionClip, 'amplitude' | 'speed' | 'loop'>> = {}
): Map<string, number> {
  const clip = createMotionClip(rig, preset, fps, Math.max(1 / fps, 2), options);
  const pose = sampleMotionClip(rig, clip, frame, fps);
  return cutoutJointRotations(rig, pose);
}

/** Samples an explicitly configured clip without recreating its timing parameters. */
export function sampleCutoutClip(
  rig: CharacterRig,
  clip: MotionClip,
  frame: number,
  fps: number
): Map<string, number> {
  return cutoutJointRotations(rig, sampleMotionClip(rig, clip, frame, fps));
}
