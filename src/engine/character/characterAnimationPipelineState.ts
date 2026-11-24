import type { CharacterRig } from './rig';
export interface CharacterAnimationPipelineState { characterId:string; rigId:string; lastFrame:number; }
export function createCharacterAnimationPipelineState(rig:CharacterRig,frame=0):CharacterAnimationPipelineState {
 if(!rig.characterId.trim()||!rig.id.trim()||!Number.isFinite(frame)||frame<0) throw new Error('Animation pipeline requires a valid rig and frame.');
 return {characterId:rig.characterId,rigId:rig.id,lastFrame:frame};
}
export function validateCharacterAnimationPipelineState(rig:CharacterRig,state:CharacterAnimationPipelineState,frame:number):void {
 if(state.characterId!==rig.characterId||state.rigId!==rig.id||!Number.isFinite(frame)||frame<state.lastFrame) throw new Error('Animation pipeline state, rig or frame does not match.');
}
