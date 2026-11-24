import type { CharacterControllerPipelineInput, CharacterControllerPipelineResult } from './characterControllerPipeline';
import { stepCharacterControllerPipeline } from './characterControllerPipeline';
import type { CharacterUnifiedControllerState } from './characterUnifiedControllerState';
import type { CharacterUnifiedGroundingOptions, CharacterUnifiedBalanceOptions } from './characterUnifiedControllerStages';
import { stepCharacterGroundedIK, type CharacterGroundedIKResult } from './characterGroundedIKPipeline';
import { stepCharacterBalancePipeline, type CharacterBalancePipelineResult } from './characterBalancePipeline';
export interface CharacterUnifiedControllerInput extends Omit<CharacterControllerPipelineInput,'state'> { state:CharacterUnifiedControllerState; grounding?:CharacterUnifiedGroundingOptions; balance?:CharacterUnifiedBalanceOptions; }
export interface CharacterUnifiedControllerResult { state:CharacterUnifiedControllerState; controller:CharacterControllerPipelineResult; pose:CharacterControllerPipelineResult['animation']['pose']; groundedIK:CharacterGroundedIKResult|null; balance:CharacterBalancePipelineResult|null; }
export function stepCharacterUnifiedController(input:CharacterUnifiedControllerInput):CharacterUnifiedControllerResult {
 const {state,rig,frame,fps}=input;
 if(state.controller.rigId!==rig.id||state.controller.characterId!==rig.characterId||frame<state.lastFrame||!Number.isFinite(frame)||!Number.isFinite(fps)||fps<=0) throw new Error('Unified controller identity or frame is invalid.');
 const controller=stepCharacterControllerPipeline({...input,state:state.controller});
 let pose=controller.animation.pose,groundedIK:CharacterGroundedIKResult|null=null,balance:CharacterBalancePipelineResult|null=null;
 let groundedState=state.groundedIK,balanceState=state.balance;
 if(input.grounding){
  if(!groundedState) throw new Error('Grounded IK state must be initialized when grounding is enabled.');
  groundedIK=stepCharacterGroundedIK({rig,pose,frame,fps,state:groundedState,surface:input.grounding.surface,rootPosition:input.grounding.rootPosition,contact:input.grounding.contact,adaptation:input.grounding.adaptation,iterations:input.grounding.iterations,tolerance:input.grounding.tolerance,pelvisResponse:input.grounding.pelvisResponse,maxPelvisOffset:input.grounding.maxPelvisOffset});
  pose=groundedIK.pose;
  if(groundedIK.pelvis.supported){
   const root=rig.joints.find(j=>j.id===rig.rootJointId);
   if(root){
    const joints=pose.joints.map(j=>j.jointId===root.id?{...j,position:{x:(j.position??root.bindPosition).x+groundedIK!.pelvis.offset.x,y:(j.position??root.bindPosition).y+groundedIK!.pelvis.offset.y,z:(j.position??root.bindPosition).z+groundedIK!.pelvis.offset.z}}:j);
    pose={...pose,joints};
   }
  }
  groundedState=groundedIK.state;
 }
 if(input.balance){
  if(!balanceState) throw new Error('Balance state must be initialized when balance is enabled.');
  balance=stepCharacterBalancePipeline({rig,pose,state:balanceState,frame,fps,supportPoints:input.balance.supportPoints,masses:input.balance.masses,velocity:{x:controller.state.physics.velocity.x,z:controller.state.physics.velocity.z},margin:input.balance.margin,maxCorrection:input.balance.maxCorrection,predictionHorizonSec:input.balance.predictionHorizonSec,predictionWeight:input.balance.predictionWeight,postureStrength:input.balance.postureStrength,maxLean:input.balance.maxLean});
  pose=balance.pose;balanceState=balance.state;
 }
 return {state:{controller:controller.state,groundedIK:groundedState,balance:balanceState,lastFrame:frame},controller,pose,groundedIK,balance};
}
