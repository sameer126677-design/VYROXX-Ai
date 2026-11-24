import type { CharacterRig, CharacterPose } from './rig';
import { evaluateLocomotionState } from './locomotion';
import { applyCharacterLocomotionIntelligence } from './characterLocomotionPose';
import { chooseCharacterLocomotionMode, characterLocomotionTransitionFrames } from './characterLocomotionMachinePolicy';
import type { CharacterLocomotionMachineState, CharacterLocomotionMode } from './characterLocomotionMachineState';
export interface CharacterLocomotionMachineInput { rig:CharacterRig; pose:CharacterPose; state:CharacterLocomotionMachineState; frame:number; fps:number; velocity:{x:number;y:number;z:number}; grounded:boolean; heading:number; turning?:boolean; walkSpeed?:number; runSpeed?:number; sprintSpeed?:number; }
export interface CharacterLocomotionMachineResult { state:CharacterLocomotionMachineState; pose:CharacterPose; mode:CharacterLocomotionMode; previousMode:CharacterLocomotionMode; transitionProgress:number; locomotion:ReturnType<typeof evaluateLocomotionState>; }
export function stepCharacterLocomotionMachine(input:CharacterLocomotionMachineInput):CharacterLocomotionMachineResult {
 const {rig,pose,state,frame,fps}=input;
 if(state.rigId!==rig.id||pose.rigId!==rig.id||!Number.isFinite(frame)||frame<state.lastFrame||!Number.isFinite(fps)||fps<=0||![input.velocity.x,input.velocity.y,input.velocity.z,input.heading].every(Number.isFinite)) throw new Error('Locomotion machine rig, pose, velocity or frame is invalid.');
 const speed=Math.hypot(input.velocity.x,input.velocity.z),stable=input.grounded?state.stableGroundFrames+1:0;
 const mode=chooseCharacterLocomotionMode({speed,verticalVelocity:input.velocity.y,grounded:input.grounded,turning:input.turning??false,walkSpeed:input.walkSpeed,runSpeed:input.runSpeed,sprintSpeed:input.sprintSpeed},state.wasGrounded,state.stableGroundFrames);
 const changed=mode!==state.mode,previousMode=changed?state.mode:state.previousMode,duration=changed?characterLocomotionTransitionFrames(state.mode,mode,fps):state.transitionDurationFrames,started=changed?frame:state.transitionStartedFrame;
 const progress=Math.max(0,Math.min(1,(frame-started)/Math.max(1,duration)));
 const locomotion=evaluateLocomotionState({velocity:{x:input.velocity.x,z:input.velocity.z},heading:input.heading,frame,fps},{walkSpeed:input.walkSpeed,runSpeed:input.runSpeed,sprintSpeed:input.sprintSpeed});
 const animated=mode==='jump'||mode==='fall'||mode==='land'?pose:applyCharacterLocomotionIntelligence(rig,pose,locomotion).pose;
 return {state:{rigId:rig.id,mode,previousMode,transitionStartedFrame:started,transitionDurationFrames:duration,lastFrame:frame,wasGrounded:input.grounded,stableGroundFrames:stable},pose:animated,mode,previousMode,transitionProgress:progress,locomotion};
}
