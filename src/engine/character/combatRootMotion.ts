import type { Vec3 } from '../core/types';
import type { CharacterPhysicsState } from './collisionPhysics';
import type { CombatLocomotionSample } from './combatLocomotion';
export interface CombatRootMotionResult { state:CharacterPhysicsState; appliedDisplacement:Vec3; blocked:boolean; }
export function applyCombatRootMotion(previous:CharacterPhysicsState,motion:CombatLocomotionSample,frame:number,weight=1,previousAppliedDisplacement:Vec3={x:0,y:0,z:0}):CombatRootMotionResult{
 if(!Number.isFinite(frame)||frame<previous.changedAtFrame||!Number.isFinite(weight)||weight<0||weight>1||![motion.rootDisplacement.x,motion.rootDisplacement.y,motion.rootDisplacement.z,previousAppliedDisplacement.x,previousAppliedDisplacement.y,previousAppliedDisplacement.z].every(Number.isFinite))throw new Error('Invalid combat root motion request.');
 const displacement={x:(motion.rootDisplacement.x-previousAppliedDisplacement.x)*weight,y:(motion.rootDisplacement.y-previousAppliedDisplacement.y)*weight,z:(motion.rootDisplacement.z-previousAppliedDisplacement.z)*weight};
 const state={...previous,position:{x:previous.position.x+displacement.x,y:previous.position.y+displacement.y,z:previous.position.z+displacement.z},changedAtFrame:frame};
 return {state,appliedDisplacement:displacement,blocked:false};
}
