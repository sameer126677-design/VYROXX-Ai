import type { CharacterPose, CharacterRig } from './rig';
import { sampleMotionClip, blendCharacterPoses, type MotionClip } from './animation';
import { blendCombatAnimationPose } from './combatAnimationBlend';
import type { CombatAnimationRequest } from './combatAnimation';
export interface CharacterAnimationPoseStageOptions { motionClip?:MotionClip|null; motionFrame?:number; combatRequest?:CombatAnimationRequest|null; combatWeight?:number; combatFadeInFrames?:number; combatFadeOutFrames?:number; }
export interface CharacterAnimationPoseStageResult { pose:CharacterPose; locomotionApplied:boolean; combatApplied:boolean; }
export function evaluateCharacterAnimationPoseStages(rig:CharacterRig,basePose:CharacterPose,frame:number,fps:number,options:CharacterAnimationPoseStageOptions={}):CharacterAnimationPoseStageResult {
 if(basePose.rigId!==rig.id||!Number.isFinite(frame)||!Number.isFinite(fps)||fps<=0) throw new Error('Animation pose stages received an invalid rig or time.');
 let pose={...basePose,frame},locomotionApplied=false,combatApplied=false;
 if(options.motionClip){
  const sample=sampleMotionClip(rig,options.motionClip,options.motionFrame??frame,fps);
  pose=blendCharacterPoses(pose,sample,1); pose.frame=frame; locomotionApplied=true;
 }
 const request=options.combatRequest;
 if(request&&frame>=request.startFrame&&frame<=request.startFrame+request.durationFrames){
  pose=blendCombatAnimationPose(rig,pose,request,frame,{weight:options.combatWeight??1,fadeInFrames:options.combatFadeInFrames,fadeOutFrames:options.combatFadeOutFrames});
  combatApplied=true;
 }
 return {pose,locomotionApplied,combatApplied};
}
