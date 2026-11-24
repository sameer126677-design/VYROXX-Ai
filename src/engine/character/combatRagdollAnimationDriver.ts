import type { CharacterPose, CharacterRig } from './rig';
import type { CharacterRagdollState } from './characterRagdoll';
import { stepCharacterRagdoll, recoverCharacterFromRagdoll } from './characterRagdoll';
import type { CombatRagdollAnimationState } from './combatRagdollAnimationState';
import { transitionCombatRagdollAnimation } from './combatRagdollAnimationState';
import { blendCombatRagdollPoses } from './combatRagdollPoseBlend';
import type { CharacterRagdollOptions } from './characterRagdoll';
export interface CombatRagdollAnimationDriverResult { animationState:CombatRagdollAnimationState; ragdollState:CharacterRagdollState; pose:CharacterPose; blendWeight:number; complete:boolean; }
export function driveCombatRagdollAnimation(rig:CharacterRig,animatedPose:CharacterPose,previousRagdoll:CharacterRagdollState,previousAnimation:CombatRagdollAnimationState,frame:number,fps:number,grounded:boolean,options:{blendFrames?:number;ragdoll?:CharacterRagdollOptions;weight?:number;getUpPose?:CharacterPose}={}):CombatRagdollAnimationDriverResult {
  if(previousRagdoll.rigId!==rig.id||previousRagdoll.characterId!==rig.characterId||animatedPose.rigId!==rig.id) throw new Error('Ragdoll animation driver rig mismatch.');
  const ragdollStep=previousRagdoll.phase==='falling'||previousRagdoll.phase==='ragdoll'?stepCharacterRagdoll(rig,previousRagdoll,frame,fps,options.ragdoll):null;
  const recoveryStep=previousRagdoll.phase==='recovering'?(options.getUpPose?recoverCharacterFromRagdoll(rig,previousRagdoll,options.getUpPose,frame,options.ragdoll?.recoveryDurationFrames):null):null;
  if(previousRagdoll.phase==='recovering'&&!recoveryStep) throw new Error('A get-up pose is required while ragdoll recovery is active.');
  const ragdollState=ragdollStep?.state??recoveryStep?.state??previousRagdoll;
  const animationState=transitionCombatRagdollAnimation(previousAnimation,ragdollState.phase,grounded,frame,options.blendFrames??8);
  const ragdollPose=ragdollStep?.pose??recoveryStep?.pose??animatedPose;
  const blended=blendCombatRagdollPoses(rig,animatedPose,ragdollPose,animationState,frame,{weight:options.weight});
  return {animationState,ragdollState,pose:blended.pose,blendWeight:blended.weight,complete:blended.complete};
}
