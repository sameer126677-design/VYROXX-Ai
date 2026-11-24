import type { CombatAnimationProfile } from './combatAnimationProfile';
import type { CombatAnimationAction } from './combatAnimation';
export interface CombatAnimationState { characterId:string; profile:CombatAnimationProfile|null; startedAtFrame:number; endsAtFrame:number; lastAction:CombatAnimationAction|'none'; }
export function createCombatAnimationState(characterId:string,frame=0):CombatAnimationState{
 if(!characterId.trim()||!Number.isFinite(frame)||frame<0)throw new Error('Invalid combat animation state.');
 return {characterId,profile:null,startedAtFrame:frame,endsAtFrame:frame,lastAction:'none'};
}
export function startCombatAnimationState(previous:CombatAnimationState,profile:CombatAnimationProfile,frame:number):CombatAnimationState{
 if(!Number.isFinite(frame)||frame<previous.startedAtFrame||!Number.isInteger(profile.durationFrames)||profile.durationFrames<1||!Number.isInteger(profile.blendInFrames)||profile.blendInFrames<0||!Number.isInteger(profile.blendOutFrames)||profile.blendOutFrames<0)throw new Error('Invalid combat animation transition.');
 return {...previous,profile,startedAtFrame:frame,endsAtFrame:frame+profile.durationFrames,lastAction:profile.action};
}
export function clearCombatAnimationState(previous:CombatAnimationState,frame:number):CombatAnimationState{
 if(!Number.isFinite(frame)||frame<previous.startedAtFrame)throw new Error('Invalid combat animation clear frame.');
 return {...previous,profile:null,startedAtFrame:frame,endsAtFrame:frame,lastAction:'none'};
}
