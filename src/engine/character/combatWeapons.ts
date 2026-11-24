import type { CombatMoveDefinition } from './characterCombat';
import type { CombatHitbox } from './combatHitboxes';
export interface CombatWeaponProfile { id:string; reachMultiplier:number; damageMultiplier:number; knockbackMultiplier:number; staminaMultiplier:number; hitboxRadiusMultiplier:number; }
const positive=(n:number)=>Number.isFinite(n)&&n>0;
/** Applies an authored weapon profile to a move without mutating the source definition. */
export function applyCombatWeaponToMove(move:CombatMoveDefinition,weapon:CombatWeaponProfile):CombatMoveDefinition{
 if(!weapon.id.trim()||![weapon.reachMultiplier,weapon.damageMultiplier,weapon.knockbackMultiplier,weapon.staminaMultiplier,weapon.hitboxRadiusMultiplier].every(positive))throw new Error('Invalid combat weapon profile.');
 return {...move,reach:move.reach*weapon.reachMultiplier,damage:move.damage*weapon.damageMultiplier,staminaCost:move.staminaCost*weapon.staminaMultiplier};
}
/** Applies weapon scaling to one authored hitbox. */
export function applyCombatWeaponToHitbox(hitbox:CombatHitbox,weapon:CombatWeaponProfile):CombatHitbox{
 if(!weapon.id.trim()||![weapon.reachMultiplier,weapon.damageMultiplier,weapon.knockbackMultiplier,weapon.staminaMultiplier,weapon.hitboxRadiusMultiplier].every(positive))throw new Error('Invalid combat weapon profile.');
 return {...hitbox,radius:hitbox.radius*weapon.hitboxRadiusMultiplier,damage:hitbox.damage*weapon.damageMultiplier,knockback:hitbox.knockback*weapon.knockbackMultiplier};
}
