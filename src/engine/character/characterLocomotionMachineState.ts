export type CharacterLocomotionMode='idle'|'walk'|'run'|'sprint'|'jump'|'fall'|'land'|'turn'|'stop';
export interface CharacterLocomotionMachineState { rigId:string; mode:CharacterLocomotionMode; previousMode:CharacterLocomotionMode; transitionStartedFrame:number; transitionDurationFrames:number; lastFrame:number; wasGrounded:boolean; stableGroundFrames:number; }
export function createCharacterLocomotionMachineState(rigId:string,frame=0,grounded=true):CharacterLocomotionMachineState {
 if(!rigId.trim()||!Number.isFinite(frame)||frame<0) throw new Error('Locomotion machine requires a rig id and valid frame.');
 return {rigId,mode:'idle',previousMode:'idle',transitionStartedFrame:frame,transitionDurationFrames:1,lastFrame:frame,wasGrounded:grounded,stableGroundFrames:grounded?1:0};
}
