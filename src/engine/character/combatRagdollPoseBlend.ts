import type { CharacterPose, CharacterRig, JointPose } from './rig';
import type { CombatRagdollAnimationState } from './combatRagdollAnimationState';
export interface CombatRagdollPoseBlendOptions { weight?:number; }
export interface CombatRagdollPoseBlendResult { pose:CharacterPose; weight:number; complete:boolean; }
const smooth=(t:number)=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);};
export function blendCombatRagdollPoses(rig:CharacterRig,animatedPose:CharacterPose,ragdollPose:CharacterPose,state:CombatRagdollAnimationState,frame:number,options:CombatRagdollPoseBlendOptions={}):CombatRagdollPoseBlendResult {
  if(animatedPose.rigId!==rig.id||ragdollPose.rigId!==rig.id||state.rigId!==rig.id||state.characterId!==rig.characterId) throw new Error('Ragdoll pose blend rig mismatch.');
  if(!Number.isFinite(frame)||frame<state.startedAtFrame) throw new Error('Ragdoll pose blend frame is invalid.');
  const requested=options.weight??1;
  if(!Number.isFinite(requested)||requested<0||requested>1) throw new Error('Ragdoll pose blend weight must be between zero and one.');
  const progress=state.blendFrames===0?1:smooth((frame-state.startedAtFrame)/state.blendFrames);
  const entering=state.mode==='falling'||state.mode==='grounded';
  const transitionWeight=entering?progress:1-progress;
  const weight=requested*transitionWeight;
  const animated=new Map(animatedPose.joints.map(j=>[j.jointId,j]));
  const ragdoll=new Map(ragdollPose.joints.map(j=>[j.jointId,j]));
  const joints:JointPose[]=rig.joints.map(j=>{
    const a=animated.get(j.id),r=ragdoll.get(j.id),ar=a?.rotation??j.bindRotation,rr=r?.rotation??ar;
    return {jointId:j.id,rotation:{x:ar.x+(rr.x-ar.x)*weight,y:ar.y+(rr.y-ar.y)*weight,z:ar.z+(rr.z-ar.z)*weight},position:a?.position?{...a.position}:r?.position?{...r.position}:undefined};
  });
  return {pose:{rigId:rig.id,frame,joints},weight,complete:progress>=1};
}
