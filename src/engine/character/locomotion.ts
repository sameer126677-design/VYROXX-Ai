import type { CharacterPose, CharacterRig, JointPose } from './rig';
import type { MotionPreset } from './animation';

export interface LocomotionInput {
  velocity:{x:number;z:number};
  acceleration?:{x:number;z:number};
  heading?:number;
  previousHeading?:number;
  frame?:number;
  fps?:number;
}
export interface LocomotionOptions {
  walkSpeed?:number; runSpeed?:number; sprintSpeed?:number;
  accelerationResponse?:number; maxLean?:number; strideScale?:number; stepHeightScale?:number;
}
export interface LocomotionState {
  speed:number; normalizedSpeed:number; gait:'idle'|'walk'|'run'|'sprint'; preset:MotionPreset;
  cycleRate:number; strideLength:number; stepHeight:number; heading:number; turnRate:number;
  phase:number; rootLean:{x:number;z:number};
}
export interface LocomotionFrame { state:LocomotionState; pose:CharacterPose; groundContact:{rootVelocity:{x:number;z:number};strideLength:number;stepHeight:number;cycleRate:number}; }
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const angleDelta=(a:number,b:number)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));

/** Converts world velocity into a stable locomotion/gait command. */
export function evaluateLocomotionState(input:LocomotionInput,options:LocomotionOptions={}):LocomotionState {
  const vx=Number.isFinite(input.velocity.x)?input.velocity.x:0, vz=Number.isFinite(input.velocity.z)?input.velocity.z:0;
  const speed=Math.hypot(vx,vz), walk=Math.max(0.1,options.walkSpeed??1.35);
  const run=Math.max(walk+0.1,options.runSpeed??3.4), sprint=Math.max(run+0.1,options.sprintSpeed??5.8);
  const normalizedSpeed=clamp(speed/sprint,0,1.5);
  const gait:LocomotionState['gait']=speed<0.12?'idle':speed<walk?'walk':speed<run?'run':'sprint';
  const cycleRate=gait==='idle'?0.5:gait==='walk'?1.25:gait==='run'?2.05:2.65;
  const strideLength=clamp(speed*0.22,0.12,1.25)*(options.strideScale??1);
  const stepHeight=clamp(speed*0.035,0.035,0.24)*(options.stepHeightScale??1);
  const heading=input.heading??Math.atan2(vx,vz);
  const turnRate=clamp(angleDelta(input.previousHeading??heading,heading)*Math.max(1,input.fps??30),-5,5);
  const acceleration=input.acceleration??{x:0,z:0}, maxLean=clamp(options.maxLean??0.22,0,0.6);
  const response=Math.max(0.1,options.accelerationResponse??1.8);
  const leanZ=clamp(-acceleration.x/response*0.035,-maxLean,maxLean);
  const leanX=clamp(acceleration.z/response*0.025,-maxLean,maxLean);
  return{speed,normalizedSpeed,gait,preset:gait,cycleRate,strideLength,stepHeight,heading,turnRate,
    phase:((input.frame??0)/Math.max(1,input.fps??30))*cycleRate*Math.PI*2,rootLean:{x:leanX,z:leanZ}};
}

/** Adds subtle acceleration lean and heading-aware torso counter-rotation. */
export function applyLocomotionPose(rig:CharacterRig,pose:CharacterPose,state:LocomotionState):CharacterPose {
  if(pose.rigId!==rig.id)throw new Error('Locomotion pose belongs to a different rig.');
  const joints=new Map<string,JointPose>(pose.joints.map(j=>[j.jointId,{...j,rotation:{...j.rotation},position:j.position?{...j.position}:undefined}]));
  const write=(id:string,delta:{x:number;y:number;z:number})=>{
    const existing=joints.get(id);
    if(existing)existing.rotation={x:existing.rotation.x+delta.x,y:existing.rotation.y+delta.y,z:existing.rotation.z+delta.z};
    else joints.set(id,{jointId:id,rotation:delta});
  };
  write('spine',{x:state.rootLean.x,y:0,z:state.rootLean.z+clamp(-state.turnRate*0.025,-0.12,0.12)});
  write('head',{x:-state.rootLean.x*0.35,y:0,z:-state.rootLean.z*0.25});
  return{...pose,joints:[...joints.values()]};
}
export function createLocomotionFrame(rig:CharacterRig,input:LocomotionInput,options:LocomotionOptions={}):LocomotionFrame {
  const state=evaluateLocomotionState(input,options),frame=Math.max(0,input.frame??0);
  const pose:CharacterPose={rigId:rig.id,frame,joints:[]};
  return{state,pose:applyLocomotionPose(rig,pose,state),groundContact:{rootVelocity:{...input.velocity},strideLength:state.strideLength,stepHeight:state.stepHeight,cycleRate:state.cycleRate}};
}
