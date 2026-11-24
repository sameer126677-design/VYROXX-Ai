import type { CharacterPhysicsState } from './collisionPhysics';
import type { Vec3 } from '../core/types';
export interface CombatPhysicsSnapshot { characterId:string; frame:number; position:Vec3; velocity:Vec3; grounded:boolean; horizontalSpeed:number; verticalSpeed:number; }
export function createCombatPhysicsSnapshot(state:CharacterPhysicsState):CombatPhysicsSnapshot{
 const {position,velocity}=state;
 if(![position.x,position.y,position.z,velocity.x,velocity.y,velocity.z,state.changedAtFrame].every(Number.isFinite))throw new Error('Cannot snapshot invalid character physics state.');
 return {characterId:state.characterId,frame:state.changedAtFrame,position:{...position},velocity:{...velocity},grounded:state.grounded,horizontalSpeed:Math.hypot(velocity.x,velocity.z),verticalSpeed:velocity.y};
}
