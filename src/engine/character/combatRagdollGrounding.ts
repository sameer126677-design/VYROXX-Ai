import type { CharacterPhysicsState } from './collisionPhysics';
import type { CharacterRagdollState } from './characterRagdoll';

export interface CombatRagdollGroundingState {
  characterId: string;
  rigId: string;
  grounded: boolean;
  settled: boolean;
  settledFrames: number;
  changedAtFrame: number;
}
export interface CombatRagdollGroundingOptions {
  horizontalSpeedThreshold?: number;
  verticalSpeedThreshold?: number;
  angularSpeedThreshold?: number;
}
export interface CombatRagdollGroundingSample {
  state: CombatRagdollGroundingState;
  horizontalSpeed: number;
  verticalSpeed: number;
  angularSpeed: number;
}

export function createCombatRagdollGroundingState(
  characterId: string,
  rigId: string,
  frame = 0
): CombatRagdollGroundingState {
  if (!characterId.trim() || !rigId.trim() || !Number.isFinite(frame) || frame < 0) {
    throw new Error('Ragdoll grounding state requires character/rig ids and a non-negative frame.');
  }
  return { characterId, rigId, grounded: false, settled: false, settledFrames: 0, changedAtFrame: frame };
}

/** Accumulates grounded, low-velocity frames until the ragdoll can be considered settled. */
export function updateCombatRagdollGrounding(
  previous: CombatRagdollGroundingState,
  physics: CharacterPhysicsState,
  ragdoll: CharacterRagdollState,
  frame: number,
  options: CombatRagdollGroundingOptions = {}
): CombatRagdollGroundingSample {
  if (previous.characterId !== physics.characterId || previous.characterId !== ragdoll.characterId ||
      previous.rigId !== ragdoll.rigId || !Number.isFinite(frame) ||
      frame < previous.changedAtFrame || frame < physics.changedAtFrame || frame < ragdoll.changedAtFrame) {
    throw new Error('Ragdoll grounding inputs must belong to the same character and advance monotonically.');
  }
  if (![physics.position.x, physics.position.y, physics.position.z, physics.velocity.x, physics.velocity.y, physics.velocity.z,
    ...ragdoll.joints.flatMap(joint => [joint.angularVelocity.x, joint.angularVelocity.y, joint.angularVelocity.z])].every(Number.isFinite)) {
    throw new Error('Ragdoll grounding received non-finite physics or angular state.');
  }
  const horizontalLimit = options.horizontalSpeedThreshold ?? 0.12;
  const verticalLimit = options.verticalSpeedThreshold ?? 0.12;
  const angularLimit = options.angularSpeedThreshold ?? 0.12;
  if (![horizontalLimit, verticalLimit, angularLimit].every(Number.isFinite) ||
      horizontalLimit < 0 || verticalLimit < 0 || angularLimit < 0) {
    throw new Error('Ragdoll grounding thresholds must be non-negative.');
  }
  const horizontalSpeed = Math.hypot(physics.velocity.x, physics.velocity.z);
  const verticalSpeed = Math.abs(physics.velocity.y);
  const angularSpeed = ragdoll.joints.reduce((max, joint) =>
    Math.max(max, Math.hypot(joint.angularVelocity.x, joint.angularVelocity.y, joint.angularVelocity.z)), 0);
  const settled = physics.grounded && horizontalSpeed <= horizontalLimit &&
    verticalSpeed <= verticalLimit && angularSpeed <= angularLimit;
  const delta = frame - previous.changedAtFrame;
  const state: CombatRagdollGroundingState = {
    characterId: previous.characterId,
    rigId: previous.rigId,
    grounded: physics.grounded,
    settled,
    settledFrames: settled ? (previous.settled ? previous.settledFrames + delta : delta) : 0,
    changedAtFrame: frame
  };
  return { state, horizontalSpeed, verticalSpeed, angularSpeed };
}
