import type { CombatTacticalPlan } from './combatTactics';
export interface CombatAIControllerState { characterId:string; lastDecisionFrame:number; nextDecisionFrame:number; lastAction:string; decisionCount:number; }
export function createCombatAIControllerState(characterId:string,frame=0):CombatAIControllerState{
 if(!characterId.trim()||!Number.isFinite(frame)||frame<0)throw new Error('Invalid combat AI controller state.');
 return {characterId,lastDecisionFrame:frame,nextDecisionFrame:frame,lastAction:'wait',decisionCount:0};
}
export function updateCombatAIController(previous:CombatAIControllerState,plan:CombatTacticalPlan,frame:number,decisionIntervalFrames=6):CombatAIControllerState{
 if(!Number.isFinite(frame)||frame<previous.lastDecisionFrame||!Number.isInteger(decisionIntervalFrames)||decisionIntervalFrames<1)throw new Error('Invalid combat AI controller update.');
 if(frame<previous.nextDecisionFrame)return previous;
 return {characterId:previous.characterId,lastDecisionFrame:frame,nextDecisionFrame:frame+decisionIntervalFrames,lastAction:plan.choice.action,decisionCount:previous.decisionCount+1};
}
