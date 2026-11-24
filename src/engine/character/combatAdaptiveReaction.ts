import type { PlayerCombatBehaviorSummary } from './combatPlayerBehavior';
import type { CombatDifficultyProfile } from './combatDifficulty';
export type AdaptiveCombatReaction='pressure'|'counter'|'guard-break-attempt'|'bait'|'standard';
export interface AdaptiveCombatReactionPlan { reaction:AdaptiveCombatReaction; aggressionMultiplier:number; defenseBias:number; reason:string; }
export function planAdaptiveCombatReaction(behavior:PlayerCombatBehaviorSummary,difficulty:CombatDifficultyProfile):AdaptiveCombatReactionPlan{
 if(behavior.evasion>=0.4)return {reaction:'bait',aggressionMultiplier:0.85,defenseBias:0.25,reason:'Player frequently evades; vary timing and avoid predictable commitment.'};
 if(behavior.defense>=0.4)return {reaction:'guard-break-attempt',aggressionMultiplier:1.1,defenseBias:0.1,reason:'Player frequently blocks; vary pressure and use authored guard-breaking moves.'};
 if(behavior.aggression>=0.5)return {reaction:'counter',aggressionMultiplier:1,defenseBias:0.65,reason:'Player frequently attacks; prioritize defensive windows and counters.'};
 if(behavior.retreatTendency>=0.35)return {reaction:'pressure',aggressionMultiplier:1.05,defenseBias:0.2,reason:'Player often retreats; cautiously close distance.'};
 return {reaction:'standard',aggressionMultiplier:difficulty.difficulty==='easy'?0.8:1,defenseBias:0.35,reason:'No dominant player pattern has emerged.'};
}
