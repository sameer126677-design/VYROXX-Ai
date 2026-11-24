import type { Vec3 } from '../core/types';
export interface CharacterControllerInput { moveX:number; moveZ:number; heading:number; maxSpeed?:number; verticalVelocity?:number; }
export interface CharacterControllerVelocity { desiredVelocity:Vec3; magnitude:number; moving:boolean; }
export function resolveCharacterControllerInput(input:CharacterControllerInput):CharacterControllerVelocity {
 const maxSpeed=input.maxSpeed??6;
 if(![input.moveX,input.moveZ,input.heading,maxSpeed,input.verticalVelocity??0].every(Number.isFinite)||maxSpeed<0) throw new Error('Character controller input must be finite and max speed non-negative.');
 const x=Math.max(-1,Math.min(1,input.moveX)),z=Math.max(-1,Math.min(1,input.moveZ));
 const length=Math.hypot(x,z),scale=length>1?1/length:1;
 const localX=x*scale,localZ=z*scale,c=Math.cos(input.heading),s=Math.sin(input.heading);
 const desiredVelocity={x:(localX*c-localZ*s)*maxSpeed,y:input.verticalVelocity??0,z:(localX*s+localZ*c)*maxSpeed};
 const magnitude=Math.hypot(desiredVelocity.x,desiredVelocity.z);
 return {desiredVelocity,magnitude,moving:magnitude>1e-5};
}
