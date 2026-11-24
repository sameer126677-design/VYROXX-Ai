import type { CombatSquadOrder } from './combatSquadCoordination';
import type { CombatMovementState } from './combatMovement';
import { createCombatMovementState } from './combatMovement';
export interface CombatSquadExecutionRequest { frame:number; heading:number; movementSpeed?:number; durationFrames?:number; }
export interface CombatSquadExecutionResult { characterId:string; action:CombatSquadOrder['action']; targetId:string|null; movement:CombatMovementState|null; }
export function createCombatSquadExecutionOrders(orders:CombatSquadOrder[],request:CombatSquadExecutionRequest):CombatSquadExecutionResult[]{
 if(!Number.isFinite(request.frame)||request.frame<0||!Number.isFinite(request.heading)||!Number.isFinite(request.movementSpeed??1.2)||(request.movementSpeed??1.2)<0||!Number.isInteger(request.durationFrames??12)||(request.durationFrames??12)<1)throw new Error('Invalid squad execution request.');
 return orders.map(order=>{let movement:CombatMovementState|null=null;
 if(order.action==='retreat'||order.action==='flank')movement=createCombatMovementState({action:order.action==='retreat'?'retreat':'strafe-right',heading:request.heading,frame:request.frame,durationFrames:request.durationFrames??12,speed:request.movementSpeed??1.2});
 return {characterId:order.characterId,action:order.action,targetId:order.targetId,movement};});
}
