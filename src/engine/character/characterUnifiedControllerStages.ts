import type { GroundContactSurface, GroundContactOptions } from './groundContact';
import type { CharacterFootAdaptationOptions } from './characterFootTargetAdaptation';
import type { SupportPoint, BalanceMass } from './balance';
export interface CharacterUnifiedGroundingOptions { surface:GroundContactSurface; rootPosition:{x:number;y:number;z:number}; contact:Omit<GroundContactOptions,'surface'|'rootPosition'>; adaptation?:CharacterFootAdaptationOptions; iterations?:number; tolerance?:number; pelvisResponse?:number; maxPelvisOffset?:number; }
export interface CharacterUnifiedBalanceOptions { supportPoints:SupportPoint[]; masses?:BalanceMass[]; margin?:number; maxCorrection?:number; predictionHorizonSec?:number; predictionWeight?:number; postureStrength?:number; maxLean?:number; }
