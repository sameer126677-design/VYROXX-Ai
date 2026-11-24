import type { CharacterPose, CharacterRig } from './rig';
import type { SupportPoint, BalanceMass } from './balance';
import { solveDynamicCharacterBalance3D } from './balance';
import { evaluateRigWorldPose3D } from './ik3d';
import { createCharacterBalanceState, type CharacterBalanceState } from './characterBalanceState';
import { predictCharacterBalanceMotion } from './characterBalancePrediction';
import { applyCharacterBalancePosture, type CharacterBalancePosture } from './characterBalancePosture';
export interface CharacterBalancePipelineInput { rig:CharacterRig; pose:CharacterPose; state:CharacterBalanceState; frame:number; fps:number; supportPoints:SupportPoint[]; masses?:BalanceMass[]; velocity?:{x:number;z:number}; acceleration?:{x:number;z:number}; margin?:number; maxCorrection?:number; predictionHorizonSec?:number; predictionWeight?:number; postureStrength?:number; maxLean?:number; }
export interface CharacterBalancePipelineResult { state:CharacterBalanceState; pose:CharacterPose; stable:boolean; centerOfMass:{x:number;y:number;z:number}; predictedCenterOfMass:{x:number;y:number;z:number}; correction:{x:number;z:number}; supportPolygon:SupportPoint[]; posture:CharacterBalancePosture; }
export function stepCharacterBalancePipeline(input:CharacterBalancePipelineInput):CharacterBalancePipelineResult {
 const {rig,pose,state,frame,fps}=input;
 if(pose.rigId!==rig.id||state.rigId!==rig.id||!Number.isFinite(frame)||!Number.isFinite(fps)||fps<=0||(state.lastFrame!==null&&frame<state.lastFrame)) throw new Error('Balance pipeline identity or frame is invalid.');
 if(!input.supportPoints.length) throw new Error('Balance pipeline requires support points.');
 const initialWorld=evaluateRigWorldPose3D(rig,pose);
 const masses=input.masses?.length?input.masses:rig.joints.filter(j=>j.length>0).map(j=>({jointId:j.id,weight:Math.max(0.01,j.length)}));
 let total=0,x=0,y=0,z=0;
 for(const mass of masses){const joint=initialWorld.get(mass.jointId);if(joint&&Number.isFinite(mass.weight)&&mass.weight>0){total+=mass.weight;x+=joint.position.x*mass.weight;y+=joint.position.y*mass.weight;z+=joint.position.z*mass.weight;}}
 if(!total) throw new Error('Balance pipeline has no valid mass distribution.');
 const center={x:x/total,y:y/total,z:z/total};
 const motion=predictCharacterBalanceMotion(center,frame,fps,state,input.velocity);
 const acceleration=input.acceleration??motion.acceleration;
 const report=solveDynamicCharacterBalance3D(rig,pose,{supportPoints:input.supportPoints,masses,velocity:motion.velocity,acceleration,margin:input.margin,maxCorrection:input.maxCorrection,predictionHorizonSec:input.predictionHorizonSec,predictionWeight:input.predictionWeight});
 const posture=applyCharacterBalancePosture(rig,report.pose,report.correction,report.predictionOffset,input.postureStrength??0.65,input.maxLean??0.28);
 const next:CharacterBalanceState={rigId:rig.id,centerOfMass:report.centerOfMass,velocity:motion.velocity,lastFrame:frame,stableFrames:report.stable?state.stableFrames+1:0};
 return {state:next,pose:posture.pose,stable:report.stable,centerOfMass:report.centerOfMass,predictedCenterOfMass:report.predictedCenterOfMass,correction:report.correction,supportPolygon:report.supportPolygon,posture};
}
