import type { Vec3 } from '../core/types';
import type { CharacterFootAdaptationResult } from './characterFootTargetAdaptation';
export interface CharacterPelvisAdaptation { offset:Vec3; supportNormal:Vec3; supported:boolean; }
export function calculateCharacterPelvisAdaptation(feet:CharacterFootAdaptationResult,rootPosition:Vec3,maxOffset=0.22,response=1):CharacterPelvisAdaptation {
 if(![rootPosition.x,rootPosition.y,rootPosition.z,maxOffset,response].every(Number.isFinite)||maxOffset<0||response<0||response>1) throw new Error('Invalid pelvis adaptation input.');
 if(feet.averageHeight===null||!feet.averageNormal) return {offset:{x:0,y:0,z:0},supportNormal:{x:0,y:1,z:0},supported:false};
 const delta=Math.max(-maxOffset,Math.min(maxOffset,feet.averageHeight-rootPosition.y));
 return {offset:{x:0,y:delta*response,z:0},supportNormal:{...feet.averageNormal},supported:true};
}
