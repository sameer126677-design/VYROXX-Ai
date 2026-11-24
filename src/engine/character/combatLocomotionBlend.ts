import type { CombatMovementAction } from './combatMovement';
import type { CombatFootworkSample } from './combatFootwork';
export type CombatLocomotionMode='idle'|'forward'|'backward'|'lateral'|'evasive';
export interface CombatLocomotionBlend { mode:CombatLocomotionMode; forwardWeight:number; backwardWeight:number; lateralWeight:number; evasiveWeight:number; footPhase:CombatFootworkSample['phase']; intensity:number; }
export function blendCombatLocomotion(action:CombatMovementAction,speed:number,footwork:CombatFootworkSample|null):CombatLocomotionBlend{
 if(!Number.isFinite(speed)||speed<0)throw new Error('Locomotion speed must be non-negative.');
 const mode:CombatLocomotionMode=action==='hold'?'idle':action==='approach'?'forward':action==='retreat'||action==='backstep'?'backward':action.startsWith('dodge')?'evasive':'lateral';
 return {mode,forwardWeight:Number(mode==='forward'),backwardWeight:Number(mode==='backward'),lateralWeight:Number(mode==='lateral'),evasiveWeight:Number(mode==='evasive'),footPhase:footwork?.phase??'plant',intensity:Math.max(0,Math.min(1,speed/6))};
}
