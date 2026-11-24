import type { CombatAIOptions } from './combatAI';
export type CombatDifficulty='easy'|'normal'|'hard'|'expert';
export interface CombatDifficultyProfile { difficulty:CombatDifficulty; decisionIntervalFrames:number; preferredRange:number; retreatHealthRatio:number; guardThreatThreshold:number; reactionDelayFrames:number; }
const PROFILES:Record<CombatDifficulty,CombatDifficultyProfile>={
 easy:{difficulty:'easy',decisionIntervalFrames:12,preferredRange:1.35,retreatHealthRatio:0.3,guardThreatThreshold:0.82,reactionDelayFrames:8},
 normal:{difficulty:'normal',decisionIntervalFrames:6,preferredRange:1.5,retreatHealthRatio:0.2,guardThreatThreshold:0.65,reactionDelayFrames:4},
 hard:{difficulty:'hard',decisionIntervalFrames:4,preferredRange:1.65,retreatHealthRatio:0.16,guardThreatThreshold:0.52,reactionDelayFrames:2},
 expert:{difficulty:'expert',decisionIntervalFrames:2,preferredRange:1.8,retreatHealthRatio:0.12,guardThreatThreshold:0.4,reactionDelayFrames:0}
};
export function getCombatDifficultyProfile(difficulty:CombatDifficulty):CombatDifficultyProfile{return {...PROFILES[difficulty]};}
export function getCombatDifficultyAIOptions(profile:CombatDifficultyProfile):CombatAIOptions{return {preferredRange:profile.preferredRange,retreatHealthRatio:profile.retreatHealthRatio,guardThreatThreshold:profile.guardThreatThreshold};}
