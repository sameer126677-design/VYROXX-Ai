import type { CharacterPose, CharacterRig } from './rig';
import type { CharacterPhysicsState, CharacterPhysicsContact } from './collisionPhysics';
import type { SupportPoint, BalanceMass } from './balance';
import { solveDynamicCharacterBalance3D } from './balance';
import { createCharacterPhysicsFeedbackState, type CharacterPhysicsFeedbackState } from './characterPhysicsFeedbackState';
import { evaluateCharacterPhysicsAnimationFeedback, type CharacterPhysicsAnimationFeedbackOptions } from './characterPhysicsAnimationFeedback';
export interface CharacterPhysicsFeedbackInput { rig:CharacterRig; pose:CharacterPose; physics:CharacterPhysicsState; contacts:CharacterPhysicsContact[]; frame:number; state:CharacterPhysicsFeedbackState; supportPoints?:SupportPoint[]; masses?:BalanceMass[]; balance?:{enabled?:boolean;margin?:number;maxCorrection?:number;predictionHorizonSec?:number;predictionWeight?:number}; animation?:CharacterPhysicsAnimationFeedbackOptions; }
export interface CharacterPhysicsFeedbackResult { state:CharacterPhysicsFeedbackState; pose:CharacterPose; physics:CharacterPhysicsState; analysis:ReturnType<typeof evaluateCharacterPhysicsAnimationFeedback>['analysis']; signals:ReturnType<typeof evaluateCharacterPhysicsAnimationFeedback>['signals']; impact:ReturnType<typeof evaluateCharacterPhysicsAnimationFeedback>['impact']; impactApplied:boolean; balance:{applied:boolean;stable:boolean|null;correction:SupportPoint}; }
export function stepCharacterPhysicsFeedback(input:CharacterPhysicsFeedbackInput):CharacterPhysicsFeedbackResult {
 const {rig,pose,physics,contacts,frame,state}=input;
 if(rig.characterId!==physics.characterId||rig.characterId!==state.characterId||pose.rigId!==rig.id||!Number.isFinite(frame)||frame<physics.changedAtFrame||(state.lastFrame!==null&&frame<state.lastFrame)) throw new Error('Physics feedback identity or frame is invalid.');
 const animation=evaluateCharacterPhysicsAnimationFeedback(rig,pose,physics,contacts,frame,{...input.animation,impactEnabled:frame>=state.impactCooldownUntil&&(input.animation?.impactEnabled??true)});
 let finalPose=animation.pose,stable:boolean|null=null,correction={x:0,z:0},balanceApplied=false;
 if(input.balance?.enabled&&input.supportPoints?.length){
  const report=solveDynamicCharacterBalance3D(rig,finalPose,{supportPoints:input.supportPoints,masses:input.masses,velocity:{x:physics.velocity.x,z:physics.velocity.z},acceleration:{x:0,z:0},margin:input.balance.margin,maxCorrection:input.balance.maxCorrection,predictionHorizonSec:input.balance.predictionHorizonSec,predictionWeight:input.balance.predictionWeight});
  finalPose=report.pose;stable=report.stable;correction=report.correction;balanceApplied=true;
 }
 const next:CharacterPhysicsFeedbackState={characterId:state.characterId,lastFrame:frame,previousVelocity:{...physics.velocity},impactCooldownUntil:animation.impact?frame+Math.max(1,animation.impact.durationFrames??8):state.impactCooldownUntil,stableFrames:stable===null?state.stableFrames:stable?state.stableFrames+1:0};
 return {state:next,pose:finalPose,physics,analysis:animation.analysis,signals:animation.signals,impact:animation.impact,impactApplied:animation.impactApplied,balance:{applied:balanceApplied,stable,correction}};
}
