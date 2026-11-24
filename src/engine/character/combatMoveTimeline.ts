import type { CombatMoveDefinition, CombatPhase } from './characterCombat';
export interface CombatMoveTimelineSample { moveId:string; phase:CombatPhase; elapsedFrames:number; normalizedProgress:number; active:boolean; complete:boolean; }
export function sampleCombatMoveTimeline(move:CombatMoveDefinition,startedAtFrame:number,frame:number):CombatMoveTimelineSample{
 if(!move.id.trim()||!Number.isInteger(move.durationFrames)||move.durationFrames<1||!Number.isInteger(move.startupFrames)||!Number.isInteger(move.activeFrames)||!Number.isInteger(move.recoveryFrames)||move.startupFrames<0||move.activeFrames<0||move.recoveryFrames<0||move.startupFrames+move.activeFrames+move.recoveryFrames!==move.durationFrames||!Number.isFinite(startedAtFrame)||!Number.isFinite(frame)||startedAtFrame<0||frame<startedAtFrame)throw new Error('Invalid combat move timeline.');
 const elapsed=frame-startedAtFrame,complete=elapsed>=move.durationFrames;
 const phase:CombatPhase=complete?'complete':elapsed<move.startupFrames?'startup':elapsed<move.startupFrames+move.activeFrames?'active':'recovery';
 return {moveId:move.id,phase,elapsedFrames:elapsed,normalizedProgress:Math.min(1,elapsed/move.durationFrames),active:phase==='active',complete};
}
