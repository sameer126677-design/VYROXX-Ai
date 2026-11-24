import type { CharacterRagdollPhase } from './characterRagdoll';
export type CombatRagdollAnimationMode = 'locomotion' | 'falling' | 'grounded' | 'get-up';
export interface CombatRagdollAnimationState {
  characterId: string;
  rigId: string;
  mode: CombatRagdollAnimationMode;
  previousMode: CombatRagdollAnimationMode;
  startedAtFrame: number;
  blendFrames: number;
}
export function createCombatRagdollAnimationState(characterId:string,rigId:string,frame=0):CombatRagdollAnimationState {
  if(!characterId.trim()||!rigId.trim()||!Number.isFinite(frame)||frame<0) throw new Error('Ragdoll animation state requires ids and a valid frame.');
  return {characterId,rigId,mode:'locomotion',previousMode:'locomotion',startedAtFrame:frame,blendFrames:0};
}
export function resolveCombatRagdollAnimationMode(phase:CharacterRagdollPhase,grounded:boolean):CombatRagdollAnimationMode {
  if(phase==='recovering') return 'get-up';
  if(phase==='falling') return 'falling';
  if(phase==='ragdoll') return grounded?'grounded':'falling';
  return 'locomotion';
}
export function transitionCombatRagdollAnimation(previous:CombatRagdollAnimationState,phase:CharacterRagdollPhase,grounded:boolean,frame:number,blendFrames=8):CombatRagdollAnimationState {
  if(!Number.isFinite(frame)||frame<previous.startedAtFrame||!Number.isInteger(blendFrames)||blendFrames<0) throw new Error('Ragdoll animation transition timing is invalid.');
  const mode=resolveCombatRagdollAnimationMode(phase,grounded);
  if(mode===previous.mode) return previous;
  return {...previous,previousMode:previous.mode,mode,startedAtFrame:frame,blendFrames};
}
