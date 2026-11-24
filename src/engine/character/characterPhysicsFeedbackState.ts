import type { Vec3 } from '../core/types';
export interface CharacterPhysicsFeedbackState { characterId:string; lastFrame:number|null; previousVelocity:Vec3; impactCooldownUntil:number; stableFrames:number; }
export function createCharacterPhysicsFeedbackState(characterId:string,frame=0):CharacterPhysicsFeedbackState {
 if(!characterId.trim()||!Number.isFinite(frame)||frame<0) throw new Error('Invalid physics feedback state.');
 return {characterId,lastFrame:frame,previousVelocity:{x:0,y:0,z:0},impactCooldownUntil:frame,stableFrames:0};
}
