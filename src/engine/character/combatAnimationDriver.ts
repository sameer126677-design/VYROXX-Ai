import type { CharacterCombatState } from './characterCombat';
import type { CombatAnimationAction, CombatAnimationRequest } from './combatAnimation';
import type { CombatAnimationProfile } from './combatAnimationProfile';
import type { CombatAnimationState } from './combatAnimationState';
import { createCombatAnimationProfile } from './combatAnimationProfile';
import { startCombatAnimationState, clearCombatAnimationState } from './combatAnimationState';
export interface CombatAnimationDriverResult { state:CombatAnimationState; request:CombatAnimationRequest|null; changed:boolean; }
function actionForCombat(state:CharacterCombatState):CombatAnimationAction|null{
 if(state.phase==='complete')return null;
 if(state.action==='attack'||state.action==='counter')return 'attack';
 if(state.action==='block')return 'block';
 if(state.action==='dodge')return 'dodge';
 if(state.action==='stagger')return 'hit';
 return null;
}
export function driveCombatAnimation(previous:CombatAnimationState,combat:CharacterCombatState,frame:number,profileOverride?:CombatAnimationProfile):CombatAnimationDriverResult{
 if(combat.characterId!==previous.characterId||!Number.isFinite(frame)||frame<previous.startedAtFrame)throw new Error('Combat animation driver state mismatch.');
 const action=actionForCombat(combat);
 if(!action){const state=previous.profile&&frame>=previous.endsAtFrame?clearCombatAnimationState(previous,frame):previous;return {state,request:state.profile?{action:state.profile.action,startFrame:state.startedAtFrame,durationFrames:state.profile.durationFrames,intensity:state.profile.intensity,side:state.profile.side}:null,changed:state!==previous};}
 const changed=previous.lastAction!==action||previous.profile===null||frame>=previous.endsAtFrame;
 const next=changed?startCombatAnimationState(previous,profileOverride??createCombatAnimationProfile(action,undefined),frame):previous;
 const profile=next.profile!;
 return {state:next,request:{action:profile.action,startFrame:next.startedAtFrame,durationFrames:profile.durationFrames,intensity:profile.intensity,side:profile.side},changed};
}
