import type { CombatMoveDefinition, CharacterCombatState, CombatTransition } from './characterCombat';
import { startCharacterCombatMove } from './characterCombat';
import type { CombatGuardState } from './combatGuard';
import { updateCombatGuard } from './combatGuard';
import type { CombatAIChoice } from './combatAI';
import { createCombatMovementState, type CombatMovementState } from './combatMovement';
export interface CombatAIExecutionRequest { characterId:string; frame:number; heading:number; targetDistance:number; targetDirection:{x:number;y:number;z:number}; movementDurationFrames?:number; movementSpeed?:number; }
export interface CombatAIExecutionResult { action:CombatAIChoice['action']; combat:CharacterCombatState; guard:CombatGuardState; movement:CombatMovementState|null; transition:CombatTransition|null; accepted:boolean; reason:string|null; }
export function executeCombatAIChoice(choice:CombatAIChoice,combat:CharacterCombatState,guard:CombatGuardState,request:CombatAIExecutionRequest):CombatAIExecutionResult{
 if(combat.characterId!==request.characterId||guard.characterId!==request.characterId||!Number.isFinite(request.frame)||request.frame<combat.changedAtFrame||request.frame<guard.changedAtFrame||!Number.isFinite(request.heading)||!Number.isFinite(request.targetDistance)||request.targetDistance<0||![request.targetDirection.x,request.targetDirection.y,request.targetDirection.z].every(Number.isFinite))throw new Error('Combat AI execution state does not match its request.');
 let nextCombat=combat,nextGuard=guard,movement:CombatMovementState|null=null,transition:CombatTransition|null=null,accepted=true,reason:string|null=null;
 if(choice.action==='attack'){
  if(!choice.move){accepted=false;reason='Attack decision has no move definition.';}
  else{transition=startCharacterCombatMove(combat,{move:choice.move,frame:request.frame,targetDistance:request.targetDistance,targetDirection:request.targetDirection});nextCombat=transition.state;accepted=transition.accepted;reason=transition.reason;}
 }else if(choice.action==='guard){
  nextGuard=updateCombatGuard(guard,{active:true,facing:request.targetDirection,frame:request.frame});
 }else if(choice.action==='approach'||choice.action==='retreat'){
  movement=createCombatMovementState({action:choice.action,heading:request.heading,frame:request.frame,durationFrames:request.movementDurationFrames??12,speed:request.movementSpeed??1.4});
 }else if(choice.action==='wait'){
  nextGuard=updateCombatGuard(guard,{active:false,facing:guard.facing,frame:request.frame});
 }
 return {action:choice.action,combat:nextCombat,guard:nextGuard,movement,transition,accepted,reason};
}
