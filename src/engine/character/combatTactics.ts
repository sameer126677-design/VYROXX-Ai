import type { CombatMoveDefinition } from './characterCombat';
import type { CombatAIChoice, CombatAIOptions, CombatAIContext } from './combatAI';
import { chooseCombatAIAction } from './combatAI';
import { evaluateCombatSpacing, type CombatSpacingOptions, type CombatSpacingResult } from './combatSpacing';
import type { CombatThreatAssessment } from './combatThreatAssessment';
export interface CombatTacticalPlan { choice:CombatAIChoice; spacing:CombatSpacingResult; priority:'defend'|'attack'|'reposition'|'wait'; }
export function planCombatTactics(context:CombatAIContext,threat:CombatThreatAssessment,moves:CombatMoveDefinition[],options:{ai?:CombatAIOptions;spacing?:CombatSpacingOptions}={}):CombatTacticalPlan{
 const spacing=evaluateCombatSpacing(context.distance,options.spacing);
 const tacticalContext={...context,targetThreat:Math.max(context.targetThreat,threat.threat),targetIsAttacking:context.targetIsAttacking||threat.attacking};
 let choice=chooseCombatAIAction(tacticalContext,moves,options.ai);
 if(threat.urgent)choice={action:'guard',move:null,reason:'An incoming hit is imminent.'};
 const priority=choice.action==='guard'?'defend':choice.action==='attack'?'attack':choice.action==='approach'||choice.action==='retreat'?'reposition':'wait';
 return {choice,spacing,priority};
}
