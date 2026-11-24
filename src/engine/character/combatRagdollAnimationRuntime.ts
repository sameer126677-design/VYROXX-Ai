import type { CharacterPose, CharacterRig } from './rig';
import type { CharacterRagdollState, CharacterRagdollOptions } from './characterRagdoll';
import type { CombatRagdollAnimationState } from './combatRagdollAnimationState';
import { driveCombatRagdollAnimation, type CombatRagdollAnimationDriverResult } from './combatRagdollAnimationDriver';
export interface CombatRagdollAnimationRuntimeOptions { blendFrames?:number; ragdoll?:CharacterRagdollOptions; weight?:number; }
export function updateCombatRagdollAnimationRuntime(rig:CharacterRig,animatedPose:CharacterPose,ragdoll:CharacterRagdollState,animation:CombatRagdollAnimationState,frame:number,fps:number,grounded:boolean,options:CombatRagdollAnimationRuntimeOptions={}):CombatRagdollAnimationDriverResult {
  return driveCombatRagdollAnimation(rig,animatedPose,ragdoll,animation,frame,fps,grounded,options);
}
