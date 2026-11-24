import type { CharacterPose, CharacterRig } from './rig';
import { sampleCombatAnimation, type CombatAnimationRequest } from './combatAnimation';
export interface CombatAnimationBlendOptions { weight:number; fadeInFrames?:number; fadeOutFrames?:number; }
export function blendCombatAnimationPose(rig:CharacterRig,basePose:CharacterPose,request:CombatAnimationRequest,frame:number,options:CombatAnimationBlendOptions):CharacterPose{
 if(!Number.isFinite(options.weight)||options.weight<0||options.weight>1||!Number.isInteger(options.fadeInFrames??0)||(options.fadeInFrames??0)<0||!Number.isInteger(options.fadeOutFrames??0)||(options.fadeOutFrames??0)<0)throw new Error('Invalid combat animation blend options.');
 const sampled=sampleCombatAnimation(rig,basePose,request,frame);
 const t=Math.max(0,Math.min(1,(frame-request.startFrame)/request.durationFrames));
 const fadeIn=options.fadeInFrames?Math.min(1,(frame-request.startFrame)/options.fadeInFrames):1;
 const fadeOut=options.fadeOutFrames?Math.min(1,(request.startFrame+request.durationFrames-frame)/options.fadeOutFrames):1;
 const weight=options.weight*Math.min(fadeIn,fadeOut);
 const base=new Map(basePose.joints.map(j=>[j.jointId,j]));
 return {...sampled,joints:sampled.joints.map(j=>{const b=base.get(j.jointId);if(!b)return j;return {...j,rotation:{x:b.rotation.x+(j.rotation.x-b.rotation.x)*weight,y:b.rotation.y+(j.rotation.y-b.rotation.y)*weight,z:b.rotation.z+(j.rotation.z-b.rotation.z)*weight}};})};
}
