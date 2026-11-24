import type { CharacterPose, CharacterRig, JointPose } from './rig';
import type { CombatPhysicsAnimationSignals } from './combatPhysicsAnimationSignals';
export interface CombatPhysicsPoseOptions { leanScale?:number; bobScale?:number; }
export function applyCombatPhysicsPose(rig:CharacterRig,basePose:CharacterPose,signals:CombatPhysicsAnimationSignals,options:CombatPhysicsPoseOptions={}):CharacterPose{
 if(basePose.rigId!==rig.id||![signals.speed,signals.verticalSpeed,signals.impactMagnitude].every(Number.isFinite))throw new Error('Physics pose rig or signals are invalid.');
 const leanScale=options.leanScale??0.035,bobScale=options.bobScale??0.012;
 const amount=Math.min(1,signals.speed/5),lean=Math.max(-0.22,Math.min(0.22,-signals.verticalSpeed*leanScale));
 const source=new Map(basePose.joints.map(j=>[j.jointId,j]));
 const joints:JointPose[]=rig.joints.map(j=>{const b=source.get(j.id),r=b?.rotation??j.bindRotation;const spine=j.id==='spine',head=j.id==='head';return {jointId:j.id,rotation:{x:r.x+(spine?lean:0),y:r.y,z:r.z+(spine?Math.sin(basePose.frame*0.25)*amount*bobScale:head?-lean*0.18:0)},position:b?.position?{...b.position}:undefined};});
 return {...basePose,joints};
}
