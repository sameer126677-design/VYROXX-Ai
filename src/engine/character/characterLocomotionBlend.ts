import type { LocomotionState } from './locomotion';
export interface CharacterLocomotionBlend { idle:number; walk:number; run:number; sprint:number; forward:number; backward:number; strafeLeft:number; strafeRight:number; speedWeight:number; }
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export function blendCharacterLocomotion(state:LocomotionState,walkSpeed=1.35,runSpeed=3.4,sprintSpeed=5.8):CharacterLocomotionBlend {
 if(![walkSpeed,runSpeed,sprintSpeed,state.speed].every(Number.isFinite)||walkSpeed<=0||runSpeed<=walkSpeed||sprintSpeed<=runSpeed) throw new Error('Locomotion blend speed thresholds are invalid.');
 const walk=clamp((state.speed-0.08)/(walkSpeed-0.08));
 const run=clamp((state.speed-walkSpeed)/(runSpeed-walkSpeed));
 const sprint=clamp((state.speed-runSpeed)/(sprintSpeed-runSpeed));
 const idle=clamp(1-state.speed/0.12);
 const direction=state.movementDirection;
 return {idle,walk:state.gait==='walk'?1-walk*0.15:walk*(1-run),run:state.gait==='run'?1:run*(1-sprint),sprint:state.gait==='sprint'?1:sprint,
  forward:Number(direction==='forward'),backward:Number(direction==='backward'),strafeLeft:Number(direction==='strafe-left'),strafeRight:Number(direction==='strafe-right'),speedWeight:clamp(state.speed/sprintSpeed)};
}
