import type { Vec3 } from '../core/types';
import type { CharacterRig, CharacterPose } from './rig';
import { solveLimbIK3D, type LimbIK3DRequest } from './ik3d';

export interface GroundObstacleSample {
  height:number;
  normal?:Vec3;
  clearance?:number;
}
export interface GroundContactSurface {
  heightAt(x:number,z:number):number;
  normalAt?(x:number,z:number):Vec3;
  obstacleAt?(x:number,z:number,radius:number):GroundObstacleSample|null;
}
export interface GroundContactConstraints {
  maxSlopeRadians?:number;
  maxStepHeight?:number;
  soleClearance?:number;
  footRadius?:number;
  obstacleClearance?:number;
  rejectSteepGround?:boolean;
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
  constraints?:GroundContactConstraints;
}
export interface GroundFootContact {
  side:'left'|'right';
  phase:number;
  planted:boolean;
  weight:number;
  target:Vec3;
  normal:Vec3;
  reachable:boolean;
  slopeRadians:number;
  slopeExceeded:boolean;
  stepHeightExceeded:boolean;
  obstacleBlocked:boolean;
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
    const rawTerrainY=options.surface?.heightAt(x,z)??0;
    const constraints=options.constraints??{};
    const terrainY=Math.max(rawTerrainY,root.y-(constraints.maxStepHeight??0.42));
    const normal=normalize(options.surface?.normalAt?.(x,z)??{x:0,y:1,z:0});
    const slopeRadians=Math.acos(clamp(normal.y,-1,1));
    const slopeExceeded=slopeRadians>Math.max(0,Math.min(Math.PI/2,constraints.maxSlopeRadians??0.78));
    const stepHeightExceeded=rawTerrainY-root.y>(constraints.maxStepHeight??0.42);
    const obstacle=options.surface?.obstacleAt?.(x,z,Math.max(0,constraints.footRadius??0.07))??null;
    const soleClearance=Math.max(0,constraints.soleClearance??0.015);
    const swingLift=planted?0:Math.sin(progress*Math.PI)*lift;
    const obstacleTop=obstacle?obstacle.height+Math.max(0,obstacle.clearance??constraints.obstacleClearance??0.16):terrainY;
    const obstacleBlocked=!!obstacle&&obstacleTop>terrainY+soleClearance+swingLift+0.001;
    const y=Math.max(terrainY+soleClearance,obstacle?obstacleTop:terrainY+soleClearance)+swingLift;
    const hip=rig.joints.find(j=>j.id===side+'_hip');
    const knee=rig.joints.find(j=>j.id===side+'_knee');
    const ankle=rig.joints.find(j=>j.id===side+'_ankle');
    const reach=(knee?.length??0)+(ankle?.length??0);
    const geometricallyReachable=!!hip&&!!knee&&!!ankle&&Math.hypot(x-(root.x+(hip.bindPosition.x)),y-root.y,z-(root.z+hip.bindPosition.z))<=reach+0.05;
    const terrainAllowed=!(constraints.rejectSteepGround??true)||!slopeExceeded;
    const reachable=geometricallyReachable&&terrainAllowed&&!stepHeightExceeded&&!obstacleBlocked;
    return{side,phase,planted,weight:planted?1:0.25,target:{x,y,z},normal,reachable,slopeRadians,slopeExceeded,stepHeightExceeded,obstacleBlocked};
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
  const supportPoints=contacts.filter(contact=>contact.planted&&contact.reachable).map(contact=>({x:contact.target.x,z:contact.target.z}));
  return{frame,contacts,ikRequests,supportPoints};
}

/** Applies planned 3D foot targets on top of the supplied animated pose. */
export function applyGroundContactPlan(rig:CharacterRig,pose:CharacterPose,plan:GroundContactPlan):CharacterPose {
  if(pose.rigId!==rig.id)throw new Error('Ground contact pose belongs to a different rig.');
  return plan.ikRequests.filter(request=>plan.contacts.find(contact=>contact.side+'_hip'===request.rootJointId)?.reachable!==false).reduce((current,request)=>solveLimbIK3D(rig,current,request).pose,pose);
}

export interface FootPlantAnchor { position:Vec3; normal:Vec3; plantedAtFrame:number; }
export interface FootPlantState {
  rigId:string;
  left:FootPlantAnchor|null;
  right:FootPlantAnchor|null;
  previousLeftPhase:number|null;
  previousRightPhase:number|null;
  lastFrame:number|null;
}
export interface StatefulGroundContactResult {
  plan:GroundContactPlan;
  state:FootPlantState;
}
/** Creates an explicit, serializable tracker state. The caller owns and stores it. */
export function createFootPlantState(rigId:string):FootPlantState {
  return{rigId,left:null,right:null,previousLeftPhase:null,previousRightPhase:null,lastFrame:null};
}
/**
 * Updates persistent stance anchors. An anchor is captured on swing->stance
 * and retained until that foot enters swing; no module-global mutable state.
 */
export function updateFootPlantTracker(
  rig:CharacterRig,frame:number,fps:number,previous:FootPlantState,options:GroundContactOptions={}
):StatefulGroundContactResult {
  if(previous.rigId!==rig.id)throw new Error('Foot plant state belongs to a different rig.');
  if(previous.lastFrame!==null&&frame<previous.lastFrame)throw new Error('Foot plant tracker requires non-decreasing frames; reset state before seeking backwards.');
  const plan=evaluateGroundContactPlan(rig,frame,fps,options);
  const next:FootPlantState={...previous,left:previous.left?{...previous.left,position:{...previous.left.position},normal:{...previous.left.normal}}:null,
    right:previous.right?{...previous.right,position:{...previous.right.position},normal:{...previous.right.normal}}:null};
  for(const contact of plan.contacts){
    const key=contact.side;
    const phaseKey=key==='left'?'previousLeftPhase':'previousRightPhase';
    const priorPhase=previous[phaseKey];
    const enteredStance=contact.planted&&(priorPhase===null||priorPhase>= (options.stanceRatio??0.62));
    if(!contact.planted)next[key]=null;
    else if(enteredStance||!next[key]){
      next[key]={position:{...contact.target,y:options.surface?.heightAt(contact.target.x,contact.target.z)??contact.target.y},
        normal:{...contact.normal},plantedAtFrame:frame};
    }
    next[phaseKey]=contact.phase;
    const anchor=next[key];
    if(anchor&&contact.planted){
      contact.target={...anchor.position};
      contact.normal={...anchor.normal};
      contact.weight=1;
      const request=plan.ikRequests.find(item=>item.rootJointId===key+'_hip');
      if(request)request.target={...anchor.position};
    }
  }
  next.lastFrame=frame;
  plan.supportPoints=plan.contacts.filter(contact=>contact.planted&&contact.reachable).map(contact=>({x:contact.target.x,z:contact.target.z}));
  return{plan,state:next};
}
