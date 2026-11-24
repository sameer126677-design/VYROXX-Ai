import type { LocomotionState } from './locomotion';
export interface CharacterLocomotionStepEvent { side:'left'|'right'; frame:number; intensity:number; }
export interface CharacterLocomotionEventState { rigId:string; previousPhase:number|null; lastFrame:number|null; }
export interface CharacterLocomotionEventResult { events:CharacterLocomotionStepEvent[]; state:CharacterLocomotionEventState; }
export function createCharacterLocomotionEventState(rigId:string):CharacterLocomotionEventState {
 if(!rigId.trim()) throw new Error('Footstep event state requires a rig id.');
 return {rigId,previousPhase:null,lastFrame:null};
}
export function detectCharacterLocomotionSteps(rigId:string,state:LocomotionState,frame:number,previous:CharacterLocomotionEventState,minimumSpeed=0.12):CharacterLocomotionEventResult {
 if(previous.rigId!==rigId||!Number.isFinite(frame)||!Number.isFinite(minimumSpeed)||minimumSpeed<0||(previous.lastFrame!==null&&frame<previous.lastFrame)) throw new Error('Invalid locomotion step event input.');
 const phase=((state.phase%(Math.PI*2))+(Math.PI*2))%(Math.PI*2),prior=previous.previousPhase;
 const crossed=(threshold:number)=>prior!==null&&(prior<threshold?phase>=threshold:prior>threshold&&phase<prior&&phase>=threshold);
 const events:CharacterLocomotionStepEvent[]=[];
 if(state.speed>=minimumSpeed&&prior!==null){
  if(prior<Math.PI&&phase>=Math.PI||prior>phase&&prior>Math.PI&&phase<Math.PI) events.push({side:'left',frame,intensity:Math.max(0.15,Math.min(1,state.speed/4))});
  if(prior>Math.PI&&phase<Math.PI||prior>phase&&phase<0.12) events.push({side:'right',frame,intensity:Math.max(0.15,Math.min(1,state.speed/4))});
 }
 return {events,state:{rigId,previousPhase:phase,lastFrame:frame}};
}
