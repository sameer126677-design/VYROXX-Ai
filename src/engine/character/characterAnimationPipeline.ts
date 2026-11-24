import type { CharacterPose, CharacterRig } from './rig';
import type { CharacterPhysicsState, CharacterPhysicsContact } from './collisionPhysics';
import type { CharacterImpactRequest } from './characterImpactReaction';
import { evaluateCombatPhysicalAnimation, type CombatPhysicalAnimationResult } from './combatPhysicalAnimation';
import type { CharacterRagdollState } from './characterRagdoll';
import type { CombatRagdollAnimationState } from './combatRagdollAnimationState';
import { driveCombatRagdollAnimation, type CombatRagdollAnimationDriverResult } from './combatRagdollAnimationDriver';
import type { CombatRagdollAnimationRuntimeOptions } from './combatRagdollAnimationRuntime';
import { evaluateCharacterAnimationPoseStages, type CharacterAnimationPoseStageOptions, type CharacterAnimationPoseStageResult } from './characterAnimationPoseStages';
import type { CharacterAnimationPipelineState } from './characterAnimationPipelineState';
import { validateCharacterAnimationPipelineState } from './characterAnimationPipelineState';
import type { CombatPhysicsPoseOptions } from './combatPhysicsPose';
export interface CharacterAnimationPipelineInput {
 rig:CharacterRig; state:CharacterAnimationPipelineState; basePose:CharacterPose; frame:number; fps:number;
 stages?:CharacterAnimationPoseStageOptions;
 physics?:CharacterPhysicsState|null; contacts?:CharacterPhysicsContact[]; impact?:CharacterImpactRequest|null;
 ragdoll?:CharacterRagdollState|null; ragdollAnimation?:CombatRagdollAnimationState|null; grounded?:boolean;
 getUpPose?:CharacterPose; physicalPose?:CombatPhysicsPoseOptions; ragdollOptions?:CombatRagdollAnimationRuntimeOptions;
}
export interface CharacterAnimationPipelineResult {
 state:CharacterAnimationPipelineState; pose:CharacterPose; stages:CharacterAnimationPoseStageResult;
 physical:CombatPhysicalAnimationResult|null; ragdoll:CombatRagdollAnimationDriverResult|null;
}
export function evaluateCharacterAnimationPipeline(input:CharacterAnimationPipelineInput):CharacterAnimationPipelineResult {
 const {rig,state,basePose,frame,fps}=input;
 validateCharacterAnimationPipelineState(rig,state,frame);
 if(basePose.rigId!==rig.id||basePose.frame>frame||!Number.isFinite(fps)||fps<=0) throw new Error('Animation pipeline base pose or fps is invalid.');
 const stages=evaluateCharacterAnimationPoseStages(rig,basePose,frame,fps,input.stages);
 let pose=stages.pose,physical:CombatPhysicalAnimationResult|null=null,ragdoll:CombatRagdollAnimationDriverResult|null=null;
 if(input.physics){
  if(input.physics.characterId!==rig.characterId) throw new Error('Animation pipeline physics character does not match the rig.');
  physical=evaluateCombatPhysicalAnimation(rig,pose,input.physics,input.contacts??[],frame,input.impact,input.physicalPose);
  pose=physical.pose;
 } else if(input.impact) throw new Error('Physics state is required when applying an impact reaction.');
 if(input.ragdoll){
  if(input.ragdoll.characterId!==rig.characterId||input.ragdoll.rigId!==rig.id) throw new Error('Animation pipeline ragdoll does not match the rig.');
  if(input.ragdollAnimation&&(input.ragdollAnimation.characterId!==rig.characterId||input.ragdollAnimation.rigId!==rig.id)) throw new Error('Animation pipeline ragdoll animation state does not match the rig.');
  if(!input.ragdollAnimation) throw new Error('Ragdoll animation state is required with a ragdoll state.');
  if(input.ragdoll.phase==='recovering'&&!input.getUpPose) throw new Error('Get-up pose is required during ragdoll recovery.');
  ragdoll=driveCombatRagdollAnimation(rig,pose,input.ragdoll,input.ragdollAnimation,frame,fps,input.grounded??false,{...input.ragdollOptions,getUpPose:input.getUpPose});
  pose=ragdoll.pose;
 }
 return {state:{...state,lastFrame:frame},pose,stages,physical,ragdoll};
}
