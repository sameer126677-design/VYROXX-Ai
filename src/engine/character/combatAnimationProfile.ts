import type { CombatAnimationAction } from './combatAnimation';
import type { CombatMoveDefinition } from './characterCombat';
export interface CombatAnimationProfile { action:CombatAnimationAction; durationFrames:number; intensity:number; side:'left'|'right'; blendInFrames:number; blendOutFrames:number; }
export function createCombatAnimationProfile(action:CombatAnimationAction,move?:CombatMoveDefinition,side:'left'|'right'='right',intensity=1):CombatAnimationProfile{
 if(!Number.isFinite(intensity)||intensity<0||intensity>2)throw new Error('Combat animation intensity must be between 0 and 2.');
 const duration=move?.durationFrames??(action==='dodge'?14:action==='block'?10:action==='hit'?12:16);
 return {action,durationFrames:duration,intensity,side,blendInFrames:Math.max(1,Math.round(duration*0.2)),blendOutFrames:Math.max(1,Math.round(duration*0.25))};
}
