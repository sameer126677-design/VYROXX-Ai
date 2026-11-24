import type { Vec3 } from '../core/types';
export interface CharacterBalanceState { rigId:string; centerOfMass:Vec3|null; velocity:{x:number;z:number}; lastFrame:number|null; stableFrames:number; }
export function createCharacterBalanceState(rigId:string):CharacterBalanceState {
 if(!rigId.trim()) throw new Error('Balance state requires a rig id.');
 return {rigId,centerOfMass:null,velocity:{x:0,z:0},lastFrame:null,stableFrames:0};
}
