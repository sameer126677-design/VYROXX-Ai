import type { CharacterRig, CharacterPose } from './rig';
import { createMotionClip, sampleMotionClip, type MotionPreset, type MotionClip } from './animation';
import { createThreeRigRuntime, updateThreeRigFromPose, type ThreeRigOptions, type ThreeRigRuntime } from './threeRig';

export interface ThreeCharacterFrame {
  runtime: ThreeRigRuntime;
  pose: CharacterPose;
  frame: number;
}

/** Builds a rig runtime and evaluates one deterministic animation frame. */
export function evaluateThreeCharacterFrame(
  rig: CharacterRig,
  preset: MotionPreset,
  frame: number,
  fps: number,
  options: ThreeRigOptions & { durationSec?: number; clip?: MotionClip } = {}
): ThreeCharacterFrame {
  const runtime = createThreeRigRuntime(rig, options);
  const clip = options.clip ?? createMotionClip(rig, preset, fps, options.durationSec ?? 2);
  const pose = sampleMotionClip(rig, clip, frame, fps);
  updateThreeRigFromPose(runtime, rig, pose, options.unitScale ?? 1);
  return { runtime, pose, frame };
}

/** Updates an existing runtime without rebuilding its Three.js hierarchy. */
export function updateThreeCharacterFrame(
  runtime: ThreeRigRuntime,
  rig: CharacterRig,
  preset: MotionPreset,
  frame: number,
  fps: number,
  options: { durationSec?: number; clip?: MotionClip; unitScale?: number } = {}
): CharacterPose {
  const clip = options.clip ?? createMotionClip(rig, preset, fps, options.durationSec ?? 2);
  const pose = sampleMotionClip(rig, clip, frame, fps);
  updateThreeRigFromPose(runtime, rig, pose, options.unitScale ?? 1);
  return pose;
}
