import type { Vec3 } from '../core/types';
import type { CharacterBalanceState } from './characterBalanceState';
export interface CharacterBalancePrediction { velocity:{x:number;z:number}; acceleration:{x:number;z:number}; centerVelocity:{x:number;z:number}; }
export function predictCharacterBalanceMotion(center:Vec3,frame:number,fps:number,previous:CharacterBalanceState,externalVelocity?:{x:number;z:number}):CharacterBalancePrediction {
 if(![center.x,center.y,center.z,frame,fps,externalVelocity?.x??0,externalVelocity?.z??0].every(Number.isFinite)||fps<=0||frame<0||(previous.lastFrame!==null&&frame<previous.lastFrame)) throw new Error('Invalid balance prediction input.');
 const dt=previous.lastFrame===null?0:(frame-previous.lastFrame)/fps;
 const centerVelocity=dt>0&&previous.centerOfMass?{x:(center.x-previous.centerOfMass.x)/dt,z:(center.z-previous.centerOfMass.z)/dt}:{x:0,z:0};
 const velocity=externalVelocity??centerVelocity;
 const acceleration=dt>0?{x:(velocity.x-previous.velocity.x)/dt,z:(velocity.z-previous.velocity.z)/dt}:{x:0,z:0};
 return {velocity:{...velocity},acceleration,centerVelocity};
}
