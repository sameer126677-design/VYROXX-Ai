import type { CharacterPose, CharacterRig } from './rig';
export interface CharacterBalancePosture { pose:CharacterPose; lean:{x:number;z:number}; recoveryWeight:number; }
export function applyCharacterBalancePosture(rig:CharacterRig,pose:CharacterPose,correction:{x:number;z:number},prediction:{x:number;z:number},strength=0.65,maxLean=0.28):CharacterBalancePosture {
 if(pose.rigId!==rig.id||![correction.x,correction.z,prediction.x,prediction.z,strength,maxLean].every(Number.isFinite)||strength<0||strength>1||maxLean<0) throw new Error('Invalid balance posture input.');
 const x=Math.max(-maxLean,Math.min(maxLean,-(correction.z+prediction.z)*strength));
 const z=Math.max(-maxLean,Math.min(maxLean,(correction.x+prediction.x)*strength));
 const joints=pose.joints.map(j=>j.jointId==='spine'?{...j,rotation:{...j.rotation,x:j.rotation.x+x,z:j.rotation.z+z}}:j);
 const recoveryWeight=Math.max(0,Math.min(1,Math.hypot(correction.x+prediction.x,correction.z+prediction.z)/Math.max(0.001,maxLean)));
 return {pose:{...pose,joints},lean:{x,z},recoveryWeight};
}
