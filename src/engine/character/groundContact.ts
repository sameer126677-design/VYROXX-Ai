import type { Vec3 } from '../core/types';
import type { CharacterRig, CharacterPose } from './rig';
import { solveLimbIK3D, type LimbIK3DRequest } from './ik3d';

export interface GroundContactSurface {
  heightAt(x:number,z:number):number;
  normalAt?(x:number,z:number):Vec3;
}
export interface GroundContactOptions {
  surface?:GroundContactSurface;
  rootPosition?:Vec3;
  rootVelocity?:{x:number;z:number};
  strideLength?:number;
  stepHeight?:number;
  cycleRate?:number;
  stanceRatio?:number;
  rightPhaseOffset?:number;
  footSeparation?:number;
  poleDistance?:number;
  frameOffset?:number;
}
export interface GroundFootContact {
  side:'left'|'right';
  phase:number;
  planted:boolean;
  weight:number;
  target:Vec3;
  normal:Vec3;
  reachable:boolean;
}
export interface GroundContactPlan {
  frame:number;
  contacts:[GroundFootContact,GroundFootContact];
  ikRequests:LimbIK3DRequest[];
  supportPoints:{x:number;z:number}[];
}
const TAU=Math.PI*2;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const wrap=(v:number)=>((v%TAU)+TAU)%TAU;
const normalize=(v:Vec3):Vec3=>{const n=Math.hypot(v.x,v.y,v.z)||1;return{x:v.x/n,y:v.y/n,z:v.z/n};};

/**
 * Plans deterministic 3D foot contacts. During stance the foot is held at a
 * velocity-compensated world target; during swing it follows a lifted arc.
 * This is a procedural approximation, not persistent rigid-body contact.
 */
export function evaluateGroundContactPlan(rig:CharacterRig,frame:number,fps:number,options:GroundContactOptions={}):GroundContactPlan {
  const root=options.rootPosition??{x:0,y:0,z:0};
  const velocity=options.rootVelocity??{x:0,z:0};
  const stride=Math.max(0,options.strideLength??0.42);
  const lift=Math.max(0,options.stepHeight??0.14);
  const stance=clamp(options.stanceRatio??0.62,0.1,0.9);
  const rate=Math.max(0.1,options.cycleRate??1.5);
  const elapsed=Math.max(0,frame+ (options.frameOffset??0))/Math.max(1,fps);
  const basePhase=wrap(elapsed*TAU*rate);
  const separation=Math.max(0.08,options.footSeparation??0.18);
  const poleDistance=Math.max(0.1,options.poleDistance??0.8);
  const make=(side:'left'|'right',phaseValue:number):GroundFootContact=>{
    const phase=wrap(phaseValue)/TAU;
    const planted=phase<stance;
    const progress=planted?phase/stance:(phase-stance)/(1-stance);
    const stanceElapsed=phase/Math.max(0.1,stance)*stance/rate;
    const localX=planted?stride*0.5-velocity.x*stanceElapsed:stride*(-0.5+progress);
    const localZ=(side==='left'?-1:1)*separation*0.5;
    const x=root.x+localX;
    const z=root.z+localZ-velocity.z*(planted?stanceElapsed:0);
    const terrainY=options.surface?.heightAt(x,z)??0;
    const y=terrainY+(planted?0:Math.sin(progress*Math.PI)*lift);
    const normal=normalize(options.surface?.normalAt?.(x,z)??{x:0,y:1,z:0});
    const hip=rig.joints.find(j=>j.id===side+'_hip');
    const knee=rig.joints.find(j=>j.id===side+'_knee');
    const ankle=rig.joints.find(j=>j.id===side+'_ankle');
    const reach=(knee?.length??0)+(ankle?.length??0);
    const reachable=!!hip&&!!knee&&!!ankle&&Math.hypot(x-(root.x+(hip.bindPosition.x)),y-root.y,z-(root.z+hip.bindPosition.z))<=reach+0.05;
    return{side,phase,planted,weight:planted?1:0.25,target:{x,y,z},normal,reachable};
  };
  const contacts:[GroundFootContact,GroundFootContact]=[
    make('left',basePhase),
    make('right',basePhase+(options.rightPhaseOffset??Math.PI))
  ];
  const ikRequests=contacts.map(contact=>{
    const side=contact.side;
    const hip=rig.joints.find(j=>j.id===side+'_hip');
    const knee=rig.joints.find(j=>j.id===side+'_knee');
    const ankle=rig.joints.find(j=>j.id===side+'_ankle');
    if(!hip||!knee||!ankle)return null;
    return{
      rootJointId:hip.id,middleJointId:knee.id,endJointId:ankle.id,
      target:contact.target,
      pole:{x:contact.target.x,y:contact.target.y+poleDistance,z:contact.target.z+(side==='left'?-0.25:0.25)}
    } satisfies LimbIK3DRequest;
  }).filter((item):item is LimbIK3DRequest=>item!==null);
  const supportPoints=contacts.filter(contact=>contact.planted).map(contact=>({x:contact.target.x,z:contact.target.z}));
  return{frame,contacts,ikRequests,supportPoints};
}

/** Applies planned 3D foot targets on top of the supplied animated pose. */
export function applyGroundContactPlan(rig:CharacterRig,pose:CharacterPose,plan:GroundContactPlan):CharacterPose {
  if(pose.rigId!==rig.id)throw new Error('Ground contact pose belongs to a different rig.');
  return plan.ikRequests.reduce((current,request)=>solveLimbIK3D(rig,current,request).pose,pose);
}
