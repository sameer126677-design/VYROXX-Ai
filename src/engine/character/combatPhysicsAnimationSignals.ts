import type { CharacterPhysicsState, CharacterPhysicsContact } from './collisionPhysics';
export interface CombatPhysicsAnimationSignals { speed:number; verticalSpeed:number; grounded:boolean; impactMagnitude:number; contactCount:number; locomotionWeight:number; fallWeight:number; }
export function deriveCombatPhysicsAnimationSignals(physics:CharacterPhysicsState,contacts:CharacterPhysicsContact[]=[]):CombatPhysicsAnimationSignals{
 const speed=Math.hypot(physics.velocity.x,physics.velocity.z),impactMagnitude=contacts.reduce((sum,c)=>sum+Math.max(0,c.penetration),0);
 return {speed,verticalSpeed:physics.velocity.y,grounded:physics.grounded,impactMagnitude,contactCount:contacts.length,locomotionWeight:Math.min(1,speed/5),fallWeight:physics.grounded?0:Math.min(1,Math.max(0,-physics.velocity.y)/8)};
}
