import type { CharacterPose, CharacterRig } from './rig';
export interface CharacterTurnState { heading:number; targetHeading:number; turnProgress:number; lastFrame:number; }
export interface CharacterTurnResult { state:CharacterTurnState; pose:CharacterPose; turnDelta:number; turning:boolean; }
const delta=(a:number,b:number)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export function createCharacterTurnState(heading=0,frame=0):CharacterTurnState {
 if(!Number.isFinite(heading)||!Number.isFinite(frame)||frame<0) throw new Error('Invalid turn state.');
 return {heading,targetHeading:heading,turnProgress:1,lastFrame:frame};
}
export function updateCharacterTurnInPlace(rig:CharacterRig,pose:CharacterPose,previous:CharacterTurnState,targetHeading:number,frame:number,fps:number,response=8):CharacterTurnResult {
 if(pose.rigId!==rig.id||![targetHeading,frame,fps,response].every(Number.isFinite)||fps<=0||response<0||frame<previous.lastFrame) throw new Error('Invalid turn update.');
 const dt=(frame-previous.lastFrame)/fps,remaining=delta(previous.heading,targetHeading),blend=dt===0?0:1-Math.exp(-response*dt),turn=remaining*blend;
 const heading=previous.heading+turn,progress=clamp(1-Math.abs(delta(heading,targetHeading))/Math.max(0.001,Math.abs(remaining)));
 const spineWeight=clamp(Math.abs(remaining)/Math.PI),headCounter=-turn*0.35;
 const joints=pose.joints.map(j=>j.jointId==='spine'?{...j,rotation:{...j.rotation,y:j.rotation.y+turn*0.55*spineWeight}}:j.jointId==='head'?{...j,rotation:{...j.rotation,y:j.rotation.y+headCounter}}:j);
 return {state:{heading,targetHeading,turnProgress:progress,lastFrame:frame},pose:{...pose,joints},turnDelta:turn,turning:Math.abs(delta(heading,targetHeading))>0.015};
}
