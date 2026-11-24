import type { CharacterPose, CharacterRig, JointPose } from './rig';
export type CombatAnimationAction='attack'|'block'|'dodge'|'hit'|'recover';
export interface CombatAnimationRequest { action:CombatAnimationAction; startFrame:number; durationFrames:number; intensity?:number; side?:'left'|'right'; }
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
/** Adds a stylized combat overlay to an existing pose. This does not replace authored clips. */
export function sampleCombatAnimation(rig:CharacterRig,basePose:CharacterPose,request:CombatAnimationRequest,frame:number):CharacterPose{
 if(basePose.rigId!==rig.id||!Number.isFinite(frame)||frame<request.startFrame||!Number.isInteger(request.durationFrames)||request.durationFrames<1||!Number.isFinite(request.intensity??1))throw new Error('Invalid combat animation sample.');
 const t=clamp((frame-request.startFrame)/request.durationFrames,0,1),pulse=Math.sin(Math.PI*t),power=clamp(request.intensity??1,0,2),side=request.side==='left'?-1:1;
 const offsets:Record<string,{x:number;y:number;z:number}>={};
 const put=(id:string,x:number,y=0,z=0)=>offsets[id]={x:x*pulse*power,y:y*pulse*power,z:z*pulse*power};
 if(request.action==='attack'){put(side>0?'right_shoulder':'left_shoulder',-0.85,0.05*side);put(side>0?'right_elbow':'left_elbow',-0.45);put('spine',0,0.12*side);put('hips',0,0.08*side);}
 if(request.action==='block'){put('left_shoulder',-0.65);put('right_shoulder',-0.65);put('left_elbow',-0.8);put('right_elbow',-0.8);put('spine',-0.08);}
 if(request.action==='dodge'){put('spine',0,0.12*side,-0.35*side);put('left_hip',-0.2);put('right_hip',-0.2);}
 if(request.action==='hit'){put('head',-0.22,0.1*side);put('spine',0,0.12*side,0.18*side);}
 if(request.action==='recover'){put('spine',0,0,-0.12*side);put('head',0,0.04*side);}
 const source=new Map(basePose.joints.map(j=>[j.jointId,j]));const joints:JointPose[]=rig.joints.map(j=>{const base=source.get(j.id),rot=base?.rotation??j.bindRotation,o=offsets[j.id]??{x:0,y:0,z:0};return {jointId:j.id,rotation:{x:rot.x+o.x,y:rot.y+o.y,z:rot.z+o.z},position:base?.position?{...base.position}:undefined};});
 return {rigId:rig.id,frame,joints};
}
