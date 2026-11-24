import type { Vec3 } from '../core/types';
import type { CombatMovementAction } from './combatMovement';
export type CombatFootworkPhase='plant'|'push-off'|'flight'|'landing'|'settle';
export interface CombatFootworkSample { phase:CombatFootworkPhase; normalizedProgress:number; leftFootWeight:number; rightFootWeight:number; rootBob:number; stride:number; }
export function sampleCombatFootwork(action:CombatMovementAction,elapsedFrames:number,durationFrames:number,side:'left'|'right'='right'):CombatFootworkSample{
 if(!Number.isFinite(elapsedFrames)||!Number.isInteger(durationFrames)||durationFrames<1||elapsedFrames<0)throw new Error('Invalid combat footwork timeline.');
 const p=Math.max(0,Math.min(1,elapsedFrames/durationFrames));
 const phase:CombatFootworkPhase=p<0.18?'plant':p<0.42?'push-off':p<0.68?'flight':p<0.86?'landing':'settle';
 const moving=action!=='hold';
 const phasePulse=Math.sin(Math.PI*p);
 const leftFootWeight=action==='strafe-left'?0.75:action==='strafe-right'?0.25:side==='left'?0.65:0.35;
 const rightFootWeight=1-leftFootWeight;
 const dodge=action.startsWith('dodge')||action==='backstep';
 return {phase,normalizedProgress:p,leftFootWeight:moving?leftFootWeight:0.5,rightFootWeight:moving?rightFootWeight:0.5,rootBob:moving?phasePulse*(dodge?0.045:0.025):0,stride:moving?phasePulse*(dodge?1.25:1):0};
}
