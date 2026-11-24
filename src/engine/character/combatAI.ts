import type { CombatMoveDefinition } from './characterCombat';
export type CombatAIAction='attack'|'retreat'|'approach'|'guard'|'wait';
export interface CombatAIContext { distance:number; health:number; stamina:number; targetThreat:number; targetIsAttacking:boolean; }
export interface CombatAIChoice { action:CombatAIAction; move:CombatMoveDefinition|null; reason:string; }
export interface CombatAIOptions { preferredRange?:number; retreatHealthRatio?:number; guardThreatThreshold?:number; }
 /** Deterministic rule-based combat choice; movement and animation remain caller-owned. */
export function chooseCombatAIAction(context:CombatAIContext,moves:CombatMoveDefinition[],options:CombatAIOptions={}):CombatAIChoice{
 const range=options.preferredRange??1.5,retreat=options.retreatHealthRatio??0.2,threat=options.guardThreatThreshold??0.65;
 if(![context.distance,context.health,context.stamina,context.targetThreat,range,retreat,threat].every(Number.isFinite)||context.distance<0||context.health<0||context.stamina<0||context.targetThreat<0||range<0||retreat<0||retreat>1||threat<0||threat>1)throw new Error('Invalid combat AI context.');
 const usable=moves.filter(m=>m.action==='attack'&&m.staminaCost<=context.stamina&&m.reach>=context.distance).sort((a,b)=>b.damage-a.damage||a.staminaCost-b.staminaCost);
 if(context.health<=retreat*100)return {action:'retreat',move:null,reason:'Health is below the authored retreat threshold.'};
 if(context.targetIsAttacking&&context.targetThreat>=threat)return {action:'guard',move:null,reason:'Incoming threat exceeds the guard threshold.'};
 if(usable.length)return {action:'attack',move:usable[0],reason:'A usable attack reaches the current target.'};
 if(context.distance>range)return {action:'approach',move:null,reason:'Target is outside preferred combat range.'};
 return {action:'wait',move:null,reason:'No valid attack is currently available.'};
}
