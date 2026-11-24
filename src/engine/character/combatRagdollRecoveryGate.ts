import type { CharacterPhysicsState } from './collisionPhysics';
import type { CharacterRagdollState } from './characterRagdoll';
import type { CombatRagdollGroundingState } from './combatRagdollGrounding';

export interface CombatRagdollRecoveryGateOptions {
  minimumSettledFrames?: number;
  maximumHorizontalSpeed?: number;
  maximumVerticalSpeed?: number;
}
export interface CombatRagdollRecoveryGateResult {
  allowed: boolean;
  reason: 'ready' | 'not-settled' | 'airborne' | 'moving-too-fast' | 'not-ragdoll';
}

export function canStartCombatRagdollRecovery(
  ragdoll: CharacterRagdollState,
  physics: CharacterPhysicsState,
  grounding: CombatRagdollGroundingState,
  options: CombatRagdollRecoveryGateOptions = {}
): CombatRagdollRecoveryGateResult {
  const minimum = options.minimumSettledFrames ?? 8;
  const horizontal = options.maximumHorizontalSpeed ?? 0.2;
  const vertical = options.maximumVerticalSpeed ?? 0.2;
  if (![minimum, horizontal, vertical].every(Number.isFinite) || minimum < 0 || horizontal < 0 || vertical < 0) {
    throw new Error('Ragdoll recovery gate thresholds are invalid.');
  }
  if (ragdoll.phase !== 'falling' && ragdoll.phase !== 'ragdoll') return { allowed: false, reason: 'not-ragdoll' };
  if (!physics.grounded || !grounding.grounded) return { allowed: false, reason: 'airborne' };
  if (!grounding.settled || grounding.settledFrames < minimum) return { allowed: false, reason: 'not-settled' };
  if (Math.hypot(physics.velocity.x, physics.velocity.z) > horizontal ||
      Math.abs(physics.velocity.y) > vertical) return { allowed: false, reason: 'moving-too-fast' };
  return { allowed: true, reason: 'ready' };
}
