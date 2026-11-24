import type { Vec3 } from '../core/types';
export type CombatMovementAction='approach'|'retreat'|'strafe-left'|'strafe-right'|'dodge-left'|'dodge-right'|'backstep'|'hold';
export interface CombatMovementRequest { action:CombatMovementAction; heading:number; frame:number; durationFrames:number; speed:number; }
export interface CombatMovementState { action:CombatMovementAction; startedAtFrame:number; endsAtFrame:number; heading:number; speed:number; }
export interface CombatMovementSample { state:CombatMovementState; velocity:Vec3; displacement:Vec3; complete:boolean; }
export function createCombatMovementState(request:CombatMovementRequest):CombatMovementState{
 if(!Number.isFinite(request.heading)||!Number.isFinite(request.frame)||request.frame<0||!Number.isInteger(request.durationFrames)||request.durationFrames<1||!Number.isFinite(request.speed)||request.speed<0)throw new Error('Invalid combat movement request.');
 return {action:request.action,startedAtFrame:request.frame,endsAtFrame:request.frame+request.durationFrames,heading:request.heading,speed:request.speed};
}
/** Samples a deterministic world-space combat movement command; root application stays with the caller. */
export function sampleCombatMovement(state:CombatMovementState,frame:number):CombatMovementSample{
 if(!Number.isFinite(frame)||frame<state.startedAtFrame)throw new Error('Combat movement frame precedes its start.');
 const t=Math.max(0,Math.min(1,(frame-state.startedAtFrame)/Math.max(1,state.endsAtFrame-state.startedAtFrame)));
 const fade=1-t;const forward={x:Math.sin(state.heading),z:Math.cos(state.heading)};
 const right={x:Math.cos(state.heading),z:-Math.sin(state.heading)};
 let dir={x:0,z:0};
 if(state.action==='approach')dir=forward;
 if(state.action==='retreat'||state.action==='backstep')dir={x:-forward.x,z:-forward.z};
 if(state.action==='strafe-right'||state.action==='dodge-right')dir=right;
 if(state.action==='strafe-left'||state.action==='dodge-left')dir={x:-right.x,z:-right.z};
 const multiplier=state.action.startsWith('dodge')||state.action==='backstep'?1.65:1;
 const velocity={x:dir.x*state.speed*multiplier*fade,y:0,z:dir.z*state.speed*multiplier*fade};
 const duration=Math.max(0,Math.min(frame,state.endsAtFrame)-state.startedAtFrame)/30;
 const displacement={x:dir.x*state.speed*multiplier*duration*0.5,y:0,z:dir.z*state.speed*multiplier*duration*0.5};
 return {state,velocity,displacement,complete:frame>=state.endsAtFrame};
}
