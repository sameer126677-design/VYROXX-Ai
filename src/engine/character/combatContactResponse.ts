import type { CharacterPhysicsState, CharacterPhysicsContact } from './collisionPhysics';
import type { Vec3 } from '../core/types';
export interface CombatContactResponseOptions { slide?:number; stopThreshold?:number; }
export interface CombatContactResponseResult { state:CharacterPhysicsState; removedVelocity:Vec3; slidingVelocity:Vec3; }
export function resolveCombatContactVelocity(previous:CharacterPhysicsState,contacts:CharacterPhysicsContact[],frame:number,options:CombatContactResponseOptions={}):CombatContactResponseResult{
 const slide=options.slide??0.08,threshold=options.stopThreshold??0.015;
 if(!Number.isFinite(frame)||frame<previous.changedAtFrame||![slide,threshold].every(Number.isFinite)||slide<0||slide>1||threshold<0)throw new Error('Invalid contact response settings.');
 let velocity={...previous.velocity};
 for(const contact of contacts){const n=contact.normal,dot=velocity.x*n.x+velocity.y*n.y+velocity.z*n.z;if(dot<0){const factor=1+dot*0;velocity={x:velocity.x-n.x*dot*(1-slide),y:velocity.y-n.y*dot*(1-slide),z:velocity.z-n.z*dot*(1-slide)};}}
 if(Math.hypot(velocity.x,velocity.y,velocity.z)<threshold)velocity={x:0,y:0,z:0};
 return {state:{...previous,velocity,changedAtFrame:frame},removedVelocity:{x:previous.velocity.x-velocity.x,y:previous.velocity.y-velocity.y,z:previous.velocity.z-velocity.z},slidingVelocity:velocity};
}
