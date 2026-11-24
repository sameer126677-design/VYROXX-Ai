import type { Vec3 } from '../core/types';
import type { CharacterHitRegion } from './characterImpactReaction';

export interface CombatHitbox {
  id: string;
  ownerCharacterId: string;
  center: Vec3;
  radius: number;
  region: CharacterHitRegion;
  damage: number;
  knockback: number;
  activeFromFrame: number;
  activeUntilFrame: number;
}

export interface CombatHurtbox {
  id: string;
  characterId: string;
  center: Vec3;
  radius: number;
  region: CharacterHitRegion;
  enabled: boolean;
}

const finiteVec = (v: Vec3) => [v.x, v.y, v.z].every(Number.isFinite);

/** Validates an authored spherical attack volume in world space. */
export function validateCombatHitbox(hitbox: CombatHitbox): CombatHitbox {
  if (!hitbox.id.trim() || !hitbox.ownerCharacterId.trim() || !finiteVec(hitbox.center) ||
      !Number.isFinite(hitbox.radius) || hitbox.radius <= 0 ||
      !Number.isFinite(hitbox.damage) || hitbox.damage < 0 ||
      !Number.isFinite(hitbox.knockback) || hitbox.knockback < 0 ||
      !Number.isFinite(hitbox.activeFromFrame) || !Number.isFinite(hitbox.activeUntilFrame) ||
      hitbox.activeFromFrame < 0 || hitbox.activeUntilFrame < hitbox.activeFromFrame) {
    throw new Error('Combat hitbox has invalid identity, geometry, damage or active frame range.');
  }
  return { ...hitbox, center: { ...hitbox.center } };
}

/** Validates a target hurt volume in world space. */
export function validateCombatHurtbox(hurtbox: CombatHurtbox): CombatHurtbox {
  if (!hurtbox.id.trim() || !hurtbox.characterId.trim() || !finiteVec(hurtbox.center) ||
      !Number.isFinite(hurtbox.radius) || hurtbox.radius <= 0) {
    throw new Error('Combat hurtbox has invalid identity or geometry.');
  }
  return { ...hurtbox, center: { ...hurtbox.center } };
}
