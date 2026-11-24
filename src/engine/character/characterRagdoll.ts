import type { Vec3 } from '../core/types';
import type { CharacterPose, CharacterRig, JointPose } from './rig';

export type CharacterRagdollPhase = 'animated' | 'falling' | 'ragdoll' | 'recovering';

export interface RagdollJointState {
  jointId: string;
  rotation: Vec3;
  angularVelocity: Vec3;
}

export interface CharacterRagdollState {
  characterId: string;
  rigId: string;
  phase: CharacterRagdollPhase;
  changedAtFrame: number;
  recoveryStartedAtFrame: number | null;
  recoveryDurationFrames: number;
  joints: RagdollJointState[];
}

export interface CharacterRagdollOptions {
  gravityTorque?: Vec3;
  angularDamping?: number;
  maxAngularSpeed?: number;
  recoveryDurationFrames?: number;
}

export interface CharacterRagdollStep {
  state: CharacterRagdollState;
  pose: CharacterPose;
}

const finiteVec = (v: Vec3): boolean => [v.x, v.y, v.z].every(Number.isFinite);
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (v: Vec3, n: number): Vec3 => ({ x: v.x * n, y: v.y * n, z: v.z * n });
const clampMagnitude = (v: Vec3, max: number): Vec3 => {
  const length = Math.hypot(v.x, v.y, v.z);
  return length > max && length > 0 ? scale(v, max / length) : v;
};
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const smooth = (t: number): number => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };

function poseJointMap(pose: CharacterPose): Map<string, JointPose> {
  return new Map(pose.joints.map(joint => [joint.jointId, joint]));
}

/** Creates a caller-owned angular ragdoll state from the current animated pose. */
export function createCharacterRagdollState(
  rig: CharacterRig,
  pose: CharacterPose,
  frame = pose.frame
): CharacterRagdollState {
  if (pose.rigId !== rig.id || !Number.isFinite(frame) || frame < 0) {
    throw new Error('Ragdoll state requires a matching rig pose and non-negative frame.');
  }
  const input = poseJointMap(pose);
  return {
    characterId: rig.characterId,
    rigId: rig.id,
    phase: 'animated',
    changedAtFrame: frame,
    recoveryStartedAtFrame: null,
    recoveryDurationFrames: 24,
    joints: rig.joints.map(joint => ({
      jointId: joint.id,
      rotation: { ...(input.get(joint.id)?.rotation ?? joint.bindRotation) },
      angularVelocity: { x: 0, y: 0, z: 0 }
    }))
  };
}

/** Adds an authored angular impulse to a joint and switches the character into ragdoll mode. */
export function applyCharacterRagdollImpulse(
  rig: CharacterRig,
  previous: CharacterRagdollState,
  jointId: string,
  impulse: Vec3,
  frame: number
): CharacterRagdollState {
  if (rig.id !== previous.rigId || rig.characterId !== previous.characterId ||
      !rig.joints.some(joint => joint.id === jointId)) {
    throw new Error('Ragdoll impulse rig or joint does not match the saved state.');
  }
  if (!finiteVec(impulse) || !Number.isFinite(frame) || frame < previous.changedAtFrame) {
    throw new Error('Ragdoll impulse and frame must be finite and non-decreasing.');
  }
  const joints = previous.joints.map(joint => joint.jointId === jointId
    ? { ...joint, angularVelocity: add(joint.angularVelocity, impulse) }
    : joint);
  return {
    ...previous, phase: 'falling', changedAtFrame: frame,
    recoveryStartedAtFrame: null, joints
  };
}

/**
 * Integrates simple per-joint angular motion with damping. This is an
 * animation-oriented ragdoll approximation: it has no segment masses,
 * rigid-body constraints, collision solver, or world-space gravity response.
 */
export function stepCharacterRagdoll(
  rig: CharacterRig,
  previous: CharacterRagdollState,
  frame: number,
  fps: number,
  options: CharacterRagdollOptions = {}
): CharacterRagdollStep {
  if (rig.id !== previous.rigId || rig.characterId !== previous.characterId) {
    throw new Error('Ragdoll rig does not match the saved character state.');
  }
  if (!Number.isFinite(frame) || !Number.isFinite(fps) || fps <= 0 || frame < previous.changedAtFrame) {
    throw new Error('Ragdoll frames must be non-decreasing and use a positive fps.');
  }
  const gravityTorque = options.gravityTorque ?? { x: 0, y: 0, z: 0 };
  if (!finiteVec(gravityTorque)) throw new Error('Ragdoll gravity torque must be finite.');
  const damping = Math.max(0, Math.min(1, options.angularDamping ?? 0.12));
  const maxSpeed = Math.max(0.01, options.maxAngularSpeed ?? 8);
  const dt = (frame - previous.changedAtFrame) / fps;
  const retain = Math.pow(1 - damping, dt * fps);
  const joints = previous.joints.map(joint => {
    const angularVelocity = clampMagnitude(scale(add(joint.angularVelocity, scale(gravityTorque, dt)), retain), maxSpeed);
    return {
      jointId: joint.jointId,
      angularVelocity,
      rotation: add(joint.rotation, scale(angularVelocity, dt))
    };
  });
  const state: CharacterRagdollState = {
    ...previous,
    phase: joints.some(joint => Math.hypot(joint.angularVelocity.x, joint.angularVelocity.y, joint.angularVelocity.z) > 0.08) ? 'falling' : 'ragdoll',
    changedAtFrame: frame,
    joints
  };
  const pose: CharacterPose = {
    rigId: rig.id,
    frame,
    joints: joints.map(joint => ({ jointId: joint.jointId, rotation: { ...joint.rotation } }))
  };
  return { state, pose };
}

/** Blends a fallen character back toward an authored get-up pose over a fixed timeline. */
export function recoverCharacterFromRagdoll(
  rig: CharacterRig,
  previous: CharacterRagdollState,
  getUpPose: CharacterPose,
  frame: number,
  durationFrames = previous.recoveryDurationFrames
): CharacterRagdollStep {
  if (rig.id !== previous.rigId || getUpPose.rigId !== rig.id) {
    throw new Error('Ragdoll recovery requires matching rig and get-up pose.');
  }
  if (!Number.isFinite(frame) || frame < previous.changedAtFrame ||
      !Number.isInteger(durationFrames) || durationFrames < 1) {
    throw new Error('Recovery frame and duration are invalid.');
  }
  const start = previous.recoveryStartedAtFrame ?? frame;
  const t = smooth((frame - start) / durationFrames);
  const fallen = new Map(previous.joints.map(joint => [joint.jointId, joint]));
  const target = poseJointMap(getUpPose);
  const joints = rig.joints.map(joint => {
    const from = fallen.get(joint.id);
    const to = target.get(joint.id);
    const targetRotation = to?.rotation ?? joint.bindRotation;
    return {
      jointId: joint.id,
      rotation: from ? {
        x: lerp(from.rotation.x, targetRotation.x, t),
        y: lerp(from.rotation.y, targetRotation.y, t),
        z: lerp(from.rotation.z, targetRotation.z, t)
      } : { ...targetRotation },
      angularVelocity: from ? scale(from.angularVelocity, 1 - t) : { x: 0, y: 0, z: 0 }
    };
  });
  const complete = t >= 1;
  const state: CharacterRagdollState = {
    ...previous,
    phase: complete ? 'animated' : 'recovering',
    changedAtFrame: frame,
    recoveryStartedAtFrame: complete ? null : start,
    recoveryDurationFrames: durationFrames,
    joints: complete ? joints.map(joint => ({ ...joint, angularVelocity: { x: 0, y: 0, z: 0 } })) : joints
  };
  const pose: CharacterPose = {
    rigId: rig.id,
    frame,
    joints: joints.map(joint => ({ jointId: joint.jointId, rotation: { ...joint.rotation } }))
  };
  return { state, pose };
}
