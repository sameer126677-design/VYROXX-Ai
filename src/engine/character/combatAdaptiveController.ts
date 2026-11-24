import type { CombatDifficultyProfile } from './combatDifficulty';
import type { PlayerCombatBehaviorProfile, PlayerCombatBehaviorEvent, PlayerCombatBehaviorSummary } from './combatPlayerBehavior';
import { recordPlayerCombatBehavior, summarizePlayerCombatBehavior } from './combatPlayerBehavior';
import { planAdaptiveCombatReaction, type AdaptiveCombatReactionPlan } from './combatAdaptiveReaction';
export interface AdaptiveCombatControllerState { behavior:PlayerCombatBehaviorProfile; summary:PlayerCombatBehaviorSummary; reaction:AdaptiveCombatReactionPlan; lastAdaptedFrame:number; summarySamples:number; }
export function createAdaptiveCombatController(behavior:PlayerCombatBehaviorProfile,difficulty:CombatDifficultyProfile,frame=0):AdaptiveCombatControllerState{
 if(!Number.isFinite(frame)||frame<0)throw new Error('Invalid adaptive controller frame.');
 const summary=summarizePlayerCombatBehavior(behavior);
 return {behavior,summary,reaction:planAdaptiveCombatReaction(summary,difficulty),lastAdaptedFrame:frame,summarySamples:behavior.samples};
}
export function updateAdaptiveCombatController(previous:AdaptiveCombatControllerState,event:PlayerCombatBehaviorEvent,frame:number,difficulty:CombatDifficultyProfile,minSamplesBetweenAdaptations=3):AdaptiveCombatControllerState{
 if(!Number.isFinite(frame)||frame<previous.lastAdaptedFrame||!Number.isInteger(minSamplesBetweenAdaptations)||minSamplesBetweenAdaptations<1)throw new Error('Invalid adaptive controller update.');
 const behavior=recordPlayerCombatBehavior(previous.behavior,event,frame);
 if(behavior.samples-previous.summarySamples < minSamplesBetweenAdaptations)return {...previous,behavior};
 const summary=summarizePlayerCombatBehavior(behavior);
 return {behavior,summary,reaction:planAdaptiveCombatReaction(summary,difficulty),lastAdaptedFrame:frame,summarySamples:behavior.samples};
}
