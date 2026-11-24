import type { Vec3 } from '../core/types';
import type { CharacterPhysicsState } from './collisionPhysics';
import type { CombatHitContact } from './combatHitDetection';
export interface CombatKnockbackOptions { horizontalScale?:number; verticalImpulse?:number; mass?:number; }
export interface CombatKnockbackResult { state:CharacterPhysicsState; impulse:Vec3; }
export function applyCombatKnockback(previous:CharacterPhysicsState,contact:CombatHitContact,options:CombatKnockbackOptions={}):CombatKnockbackResult{
 if(previous.characterId!==contact.targetId||![contact.knockback,contact.frame].every(Number.isFinite)||contact.knockback<0||contact.frame<previous.changedAtFrame)throw new Error('Knockback contact and physics state do not match.');
 const h=options.horizontalScale??1,v=options.verticalImpulse??0.12,m=options.mass??1;
 if(![h,v,m].every(Number.isFinite)||h<0||m<=0)throw new Error('Invalid knockback tuning.');
 const len=Math.hypot(contact.normal.x,contact.normal.y,contact.normal.z)||1;
 const impulse={x:contact.normal.x/len*contact.knockback*h/m,y:Math.max(0,v*contact.knockback/m),z:contact.normal.z/len*contact.knockback*h/m};
 return {state:{...previous,velocity:{x:previous.velocity.x+impulse.x,y:previous.velocity.y+impulse.y,z:previous.velocity.z+impulse.z},grounded:false,changedAtFrame:contact.frame},impulse};
}
