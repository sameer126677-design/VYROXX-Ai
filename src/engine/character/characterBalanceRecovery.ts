import type { Vec3 } from '../core/types';
import type { CharacterPose, CharacterRig } from './rig';
import type { CharacterPhysicsState } from './collisionPhysics';
import {
  solveDynamicCharacterBalance3D,
  type DynamicBalanceOptions,
  type DynamicBalanceReport,
  type SupportPoint
} from './balance';

export type BalanceRecoveryPhase = 'stable' | 'recovering' | 'unrecoverable';

export interface CharacterBalanceRecoveryState {
  characterId: string;
  phase: BalanceRecoveryPhase;
  changedAtFrame: number;
  recoveryFrames: number;
}

export interface CharacterBalanceRecoveryOptions extends Omit<DynamicBalanceOptions, 'supportPoints' | 'velocity' | 'acceleration'> {
  supportPoints: SupportPoint[];
  horizontalDamping?: number;
  stableSpeedThreshold?: number;
  maxRecoveryFrames?: number;
  acceleration?: { x: number; z: number };
}

export interface CharacterBalanceRecoveryResult {
  state: CharacterBalanceRecoveryState;
  physicsState: CharacterPhysicsState;
  pose: CharacterPose;
  report: DynamicBalanceReport;
}

/** Creates caller-owned state for deterministic balance recovery tracking. */
export function createCharacterBalanceRecoveryState(
  characterId: string,
  frame = 0
): CharacterBalanceRecoveryState {
  if (!characterId.trim() || !Number.isFinite(frame) || frame < 0) {
    throw new Error('Balance recovery requires a character id and non-negative frame.');
  }
  return { characterId, phase: 'stable', changedAtFrame: frame, recoveryFrames: 0 };
}

/**
 * Predicts horizontal drift and solves a support-polygon correction, then
 * damps horizontal root velocity. This is procedural recovery assistance,
 * not full-body muscle simulation or automatic footstep planning.
 */
export function recoverCharacterBalance(
  rig: CharacterRig,
  pose: CharacterPose,
  physics: CharacterPhysicsState,
  previous: CharacterBalanceRecoveryState,
  frame: number,
  fps: number,
  options: CharacterBalanceRecoveryOptions
): CharacterBalanceRecoveryResult {
  if (rig.characterId !== previous.characterId || physics.characterId !== previous.characterId || pose.rigId !== rig.id) {
    throw new Error('Balance recovery rig, pose, physics and state must belong to the same character.');
  }
  if (!Number.isFinite(frame) || !Number.isFinite(fps) || fps <= 0 ||
      frame < previous.changedAtFrame || frame < physics.changedAtFrame) {
    throw new Error('Balance recovery frames must be finite, non-decreasing and use positive fps.');
  }
  if (!options.supportPoints.length) throw new Error('Balance recovery requires at least one support point.');
  const damping = Math.max(0, Math.min(1, options.horizontalDamping ?? 0.18));
  const threshold = Math.max(0, options.stableSpeedThreshold ?? 0.08);
  const maxFrames = Math.max(1, Math.floor(options.maxRecoveryFrames ?? 45));
  const speed = Math.hypot(physics.velocity.x, physics.velocity.z);
  const dt = (frame - previous.changedAtFrame) / fps;
  const velocity = { x: physics.velocity.x, z: physics.velocity.z };
  const report = solveDynamicCharacterBalance3D(rig, pose, {
    ...options,
    supportPoints: options.supportPoints,
    velocity,
    acceleration: options.acceleration ?? { x: 0, z: 0 }
  });
  const decay = Math.pow(1 - damping, dt * fps);
  const nextVelocity: Vec3 = {
    x: physics.velocity.x * decay,
    y: physics.velocity.y,
    z: physics.velocity.z * decay
  };
  const recoveryFrames = report.stable && speed <= threshold ? 0 : previous.recoveryFrames + Math.max(0, frame - previous.changedAtFrame);
  const phase: BalanceRecoveryPhase = report.stable && Math.hypot(nextVelocity.x, nextVelocity.z) <= threshold
    ? 'stable'
    : recoveryFrames >= maxFrames ? 'unrecoverable' : 'recovering';
  const state: CharacterBalanceRecoveryState = {
    characterId: previous.characterId,
    phase,
    changedAtFrame: frame,
    recoveryFrames
  };
  return {
    state,
    physicsState: { ...physics, velocity: nextVelocity, changedAtFrame: frame },
    pose: report.pose,
    report
  };
}
