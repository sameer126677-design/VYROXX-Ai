import type { Vec3 } from '../core/types';
import type { CharacterPose, CharacterRig, JointPose } from './rig';

export type CharacterHitRegion = 'head' | 'torso' | 'left-arm' | 'right-arm' | 'left-leg' | 'right-leg';
export type CharacterImpactKind = 'punch' | 'kick' | 'collision' | 'fall';

export interface CharacterImpactRequest {
  id: string;
  kind: CharacterImpactKind;
  region: CharacterHitRegion;
  direction: Vec3;
  intensity: number;
  startFrame: number;
  durationFrames?: number;
}

export interface CharacterImpactState {
  characterId: string;
  rigId: string;
  request: CharacterImpactRequest;
  durationFrames: number;
  changedAtFrame: number;
}

export interface CharacterImpactSample {
  state: CharacterImpactState;
  pose: CharacterPose;
  intensity: number;
  complete: boolean;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const finiteVec = (v: Vec3) => [v.x, v.y, v.z].every(Number.isFinite);
const normalize = (v: Vec3): Vec3 => {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
};
const smoothOut = (t: number) => {
  const x = clamp(t, 0, 1);
  return (1 - x) * (1 - x);
};

const regionWeights: Record<CharacterHitRegion, Record<string, number>> = {
  head: { head: 1, neck: 0.72, spine: 0.22 },
  torso: { spine: 1, neck: 0.38, left_shoulder: 0.5, right_shoulder: 0.5, left_hip: 0.25, right_hip: 0.25 },
  'left-arm': { left_shoulder: 1, left_elbow: 0.8, left_wrist: 0.45, spine: 0.12 },
  'right-arm': { right_shoulder: 1, right_elbow: 0.8, right_wrist: 0.45, spine: 0.12 },
  'left-leg': { left_hip: 1, left_knee: 0.8, left_ankle: 0.45, spine: 0.18 },
  'right-leg': { right_hip: 1, right_knee: 0.8, right_ankle: 0.45, spine: 0.18 }
};

/** Validates and stores one deterministic, timeline-addressable hit reaction. */
export function createCharacterImpactState(
  rig: CharacterRig,
  request: CharacterImpactRequest
): CharacterImpactState {
  const directionLength = Math.hypot(request.direction.x, request.direction.y, request.direction.z);
  if (!request.id.trim() || !finiteVec(request.direction) || directionLength < 1e-8 ||
      !Number.isFinite(request.intensity) || request.intensity < 0 ||
      !Number.isFinite(request.startFrame) || request.startFrame < 0) {
    throw new Error('Impact request requires an id, finite non-zero direction, non-negative intensity and frame.');
  }
  const durationFrames = Math.floor(request.durationFrames ?? (request.kind === 'fall' ? 42 : 18));
  if (durationFrames < 1) throw new Error('Impact duration must be at least one frame.');
  return {
    characterId: rig.characterId,
    rigId: rig.id,
    request: { ...request, direction: normalize(request.direction) },
    durationFrames,
    changedAtFrame: request.startFrame
  };
}

/**
 * Samples an additive, stylized hit reaction over time. It preserves the
 * supplied base pose and adds region-weighted joint rotations; it is not
 * a contact solver or a physically simulated body response.
 */
export function sampleCharacterImpactReaction(
  rig: CharacterRig,
  basePose: CharacterPose,
  state: CharacterImpactState,
  frame: number
): CharacterImpactSample {
  if (rig.id !== state.rigId || rig.characterId !== state.characterId || basePose.rigId !== rig.id) {
    throw new Error('Impact rig, character state and base pose must match.');
  }
  if (!Number.isFinite(frame) || frame < state.request.startFrame) {
    throw new Error('Impact sample frame must be finite and not precede the impact.');
  }
  const elapsed = frame - state.request.startFrame;
  const progress = clamp(elapsed / state.durationFrames, 0, 1);
  const envelope = smoothOut(progress);
  const intensity = state.request.intensity * envelope;
  const direction = state.request.direction;
  const kindScale = state.request.kind === 'kick' ? 1.12 : state.request.kind === 'fall' ? 1.25 : state.request.kind === 'collision' ? 1.05 : 1;
  const weights = regionWeights[state.request.region];
  const source = new Map(basePose.joints.map(joint => [joint.jointId, joint]));
  const joints: JointPose[] = rig.joints.map(joint => {
    const base = source.get(joint.id);
    const rotation = base?.rotation ?? joint.bindRotation;
    const weight = weights[joint.id] ?? 0;
    if (!weight) return { jointId: joint.id, rotation: { ...rotation }, position: base?.position ? { ...base.position } : undefined };
    const amount = intensity * kindScale * weight;
    const side = state.request.region.startsWith('left') ? -1 : state.request.region.startsWith('right') ? 1 : Math.sign(direction.x || 1);
    const offset = {
      x: clamp(-direction.y * amount * 0.32, -0.8, 0.8),
      y: clamp(direction.x * amount * 0.24, -0.65, 0.65),
      z: clamp((direction.x * side + direction.z * 0.65) * amount * 0.42, -1.1, 1.1)
    };
    return {
      jointId: joint.id,
      rotation: { x: rotation.x + offset.x, y: rotation.y + offset.y, z: rotation.z + offset.z },
      position: base?.position ? { ...base.position } : undefined
    };
  });
  const complete = progress >= 1;
  return {
    state: { ...state, changedAtFrame: frame },
    pose: { rigId: rig.id, frame, joints },
    intensity,
    complete
  };
}
