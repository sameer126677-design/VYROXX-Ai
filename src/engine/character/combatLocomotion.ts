import type { Vec3 } from '../core/types';
import type { CombatMovementState } from './combatMovement';
import { sampleCombatMovement } from './combatMovement';
export interface CombatLocomotionSample { rootVelocity:Vec3; rootDisplacement:Vec3; heading:number; moving:boolean; speed:number; complete:boolean; }
export function sampleCombatLocomotion(movement:CombatMovementState|null,frame:number):CombatLocomotionSample{
 if(!Number.isFinite(frame)||frame<0)throw new Error('Invalid locomotion frame.');
 if(!movement)return {rootVelocity:{x:0,y:0,z:0},rootDisplacement:{x:0,y:0,z:0},heading:0,moving:false,speed:0,complete:true};
 const sample=sampleCombatMovement(movement,Math.max(frame,movement.startedAtFrame));
 return {rootVelocity:sample.velocity,rootDisplacement:sample.displacement,heading:movement.heading,moving:Math.hypot(sample.velocity.x,sample.velocity.z)>1e-5,speed:Math.hypot(sample.velocity.x,sample.velocity.z),complete:sample.complete};
}
