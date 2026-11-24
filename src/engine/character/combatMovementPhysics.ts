import type { Vec3 } from '../core/types';
import type { CharacterPhysicsState } from './collisionPhysics';
export interface CombatMovementPhysicsOptions { acceleration?:number; braking?:number; maxSpeed?:number; }
export interface CombatMovementPhysicsResult { state:CharacterPhysicsState; desiredVelocity:Vec3; appliedAcceleration:Vec3; }
const clampMagnitude=(v:Vec3,max:number):Vec3=>{const n=Math.hypot(v.x,v.z);return n>max&&n>0?{x:v.x*max/n,y:v.y,z:v.z*max/n}:v;};
export function driveCombatMovementPhysics(previous:CharacterPhysicsState,desired:Vec3,frame:number,fps:number,options:CombatMovementPhysicsOptions={}):CombatMovementPhysicsResult{
 if(![desired.x,desired.y,desired.z].every(Number.isFinite)||!Number.isFinite(frame)||frame<previous.changedAtFrame||!Number.isFinite(fps)||fps<=0)throw new Error('Invalid combat movement physics input.');
 const dt=(frame-previous.changedAtFrame)/fps,accel=options.acceleration??18,braking=options.braking??24,maxSpeed=options.maxSpeed??8;
 if(![accel,braking,maxSpeed].every(Number.isFinite)||accel<0||braking<0||maxSpeed<0)throw new Error('Movement acceleration, braking and speed must be non-negative.');
 const target=clampMagnitude({...desired,y:previous.velocity.y},maxSpeed),current={...previous.velocity};
 const dx=target.x-current.x,dz=target.z-current.z,distance=Math.hypot(dx,dz),rate=Math.hypot(target.x,target.z)>Math.hypot(current.x,current.z)?accel:braking,step=rate*dt,ratio=distance>0?Math.min(1,step/distance):0;
 const velocity={x:current.x+dx*ratio,y:current.y,z:current.z+dz*ratio};
 return {state:{...previous,velocity,changedAtFrame:frame},desiredVelocity:target,appliedAcceleration:{x:dt>0?(velocity.x-current.x)/dt:0,y:0,z:dt>0?(velocity.z-current.z)/dt:0}};
}
