import type { Vec3 } from '../core/types';
import { applyCharacterCombatDamage, type CharacterCombatState } from './characterCombat';
import type { CombatHitContact } from './combatHitDetection';

export interface CombatHitEvent {
  id: string;
  attackerId: string;
  targetId: string;
  region: CombatHitContact['region'];
  damage: number;
  knockback: number;
  direction: Vec3;
  frame: number;
}

export interface CombatResolutionResult {
  targetState: CharacterCombatState;
  event: CombatHitEvent;
}

/** Converts a previously detected contact into a gameplay damage event. */
export function resolveCombatHit(
  targetState: CharacterCombatState,
  contact: CombatHitContact
): CombatResolutionResult {
  if (targetState.characterId !== contact.targetId) {
    throw new Error('Combat contact target does not match the supplied character state.');
  }
  if (![contact.damage,contact.knockback,contact.frame].every(Number.isFinite) ||
      contact.damage < 0 || contact.knockback < 0 || contact.frame < targetState.changedAtFrame) {
    throw new Error('Combat contact contains invalid damage, knockback or frame values.');
  }
  const targetStateNext = applyCharacterCombatDamage(targetState,contact.damage,contact.frame);
  const event: CombatHitEvent = {
    id: `hit-${contact.hitboxId}-${contact.hurtboxId}-${contact.frame}`,
    attackerId: contact.attackerId, targetId: contact.targetId,
    region: contact.region, damage: contact.damage, knockback: contact.knockback,
    direction: { ...contact.normal }, frame: contact.frame
  };
  return { targetState: targetStateNext, event };
}
