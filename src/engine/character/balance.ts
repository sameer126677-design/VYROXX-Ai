import type { Vec3 } from '../core/types';
import type { CharacterPose, CharacterRig } from './rig';
import { evaluateRigWorldPose3D } from './ik3d';

export interface SupportPoint { x: number; z: number; }
export interface BalanceMass { jointId: string; weight: number; }
export interface BalanceOptions {
  supportPoints: SupportPoint[];
  masses?: BalanceMass[];
  /** Maximum horizontal root correction per solve, in rig world units. */
  maxCorrection?: number;
  /** Margin kept inside the support polygon. */
  margin?: number;
  iterations?: number;
}
export interface BalanceReport {
  pose: CharacterPose;
  centerOfMass: Vec3;
  supportCenter: SupportPoint;
  correction: SupportPoint;
  stable: boolean;
  distanceToSupport: number;
  supportPolygon: SupportPoint[];
}

const cross2 = (o: SupportPoint, a: SupportPoint, b: SupportPoint) => (a.x-o.x)*(b.z-o.z)-(a.z-o.z)*(b.x-o.x);
const distance2 = (a: SupportPoint,b: SupportPoint) => Math.hypot(a.x-b.x,a.z-b.z);
function convexHull(points: SupportPoint[]): SupportPoint[] {
  const sorted=[...points].sort((a,b)=>a.x-b.x||a.z-b.z);
  if(sorted.length<=2)return sorted;
  const lower:SupportPoint[]=[];
  for(const p of sorted){while(lower.length>=2&&cross2(lower[lower.length-2],lower[lower.length-1],p)<=0)lower.pop();lower.push(p);}
  const upper:SupportPoint[]=[];
  for(let i=sorted.length-1;i>=0;i--){const p=sorted[i];while(upper.length>=2&&cross2(upper[upper.length-2],upper[upper.length-1],p)<=0)upper.pop();upper.push(p);}
  upper.pop();lower.pop();return lower.concat(upper);
}
function inside(point:SupportPoint, polygon:SupportPoint[]):boolean {
  if(polygon.length<3)return false;
  let sign=0;
  for(let i=0;i<polygon.length;i++){
    const value=cross2(polygon[i],polygon[(i+1)%polygon.length],point);
    if(Math.abs(value)<1e-8)continue;
    const next=Math.sign(value);
    if(sign&&next!==sign)return false;
    sign=next;
  }
  return true;
}
function closestPointOnSegment(p:SupportPoint,a:SupportPoint,b:SupportPoint):SupportPoint {
  const dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz;
  const t=den?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/den)):0;
  return {x:a.x+t*dx,z:a.z+t*dz};
}
function closestOnPolygon(point:SupportPoint,polygon:SupportPoint[]):SupportPoint {
  if(polygon.length===1)return polygon[0];
  let best=polygon[0],bestDistance=Infinity;
  const count=polygon.length===2?1:polygon.length;
  for(let i=0;i<count;i++){
    const candidate=closestPointOnSegment(point,polygon[i],polygon[(i+1)%polygon.length]);
    const d=distance2(point,candidate);
    if(d<bestDistance){best=candidate;bestDistance=d;}
  }
  return best;
}
function centerOfMass(rig:CharacterRig,pose:CharacterPose,masses?:BalanceMass[]):Vec3 {
  const world=evaluateRigWorldPose3D(rig,pose);
  const selected=masses?.length?masses:rig.joints.filter(j=>j.length>0).map(j=>({jointId:j.id,weight:Math.max(0.01,j.length)}));
  let total=0,x=0,y=0,z=0;
  for(const mass of selected){
    const joint=world.get(mass.jointId);
    if(!joint||!Number.isFinite(mass.weight)||mass.weight<=0)continue;
    total+=mass.weight;x+=joint.position.x*mass.weight;y+=joint.position.y*mass.weight;z+=joint.position.z*mass.weight;
  }
  if(!total)throw new Error('Balance model has no valid weighted joints.');
  return {x:x/total,y:y/total,z:z/total};
}

/**
 * Estimates static balance against a ground-plane support polygon (X/Z).
 * The solver translates the root joint horizontally; it does not simulate
 * gravity, momentum, stepping, or dynamic rigid-body contact.
 */
export function solveCharacterBalance3D(rig:CharacterRig,pose:CharacterPose,options:BalanceOptions):BalanceReport {
  if(pose.rigId!==rig.id)throw new Error('Pose rig id does not match the target rig.');
  if(options.supportPoints.length===0)throw new Error('Balance solver requires at least one support point.');
  const polygon=convexHull(options.supportPoints);
  const margin=Math.max(0,options.margin??0.015);
  const maxCorrection=Math.max(0,options.maxCorrection??0.12);
  const iterations=Math.max(1,Math.min(5,Math.floor(options.iterations??2)));
  let current:CharacterPose={...pose,joints:pose.joints.map(j=>({...j,rotation:{...j.rotation},position:j.position?{...j.position}:undefined}))};
  let com=centerOfMass(rig,current,options.masses);
  const supportCenter=polygon.reduce((acc,p)=>({x:acc.x+p.x/polygon.length,z:acc.z+p.z/polygon.length}),{x:0,z:0});
  let correction={x:0,z:0};
  for(let pass=0;pass<iterations;pass++){
    const projected={x:com.x,z:com.z};
    const isInside=inside(projected,polygon);
    const closest=closestOnPolygon(projected,polygon);
    const edgeDistance=distance2(projected,closest);
    let dx=0,dz=0,desired=0;
    if(!isInside){dx=closest.x-projected.x;dz=closest.z-projected.z;desired=edgeDistance+margin;}
    else if(margin>0&&edgeDistance<margin){dx=supportCenter.x-projected.x;dz=supportCenter.z-projected.z;desired=Math.hypot(dx,dz);}
    if(desired<1e-7)break;
    const step=Math.min(maxCorrection/iterations,desired);
    const sx=dx/Math.max(desired,1e-8)*step,sz=dz/Math.max(desired,1e-8)*step;
    correction={x:correction.x+sx,z:correction.z+sz};
    const root=rig.joints.find(j=>j.id===rig.rootJointId)!;
    const existing=current.joints.find(j=>j.jointId===root.id);
    const base=existing?.position??root.bindPosition;
    const next={x:base.x+sx,y:base.y,z:base.z+sz};
    const joints=current.joints.filter(j=>j.jointId!==root.id);
    joints.push({jointId:root.id,rotation:existing?.rotation??root.bindRotation,position:next});
    current={...current,joints};
    com=centerOfMass(rig,current,options.masses);
  }
  const finalPoint={x:com.x,z:com.z};
  const stable=inside(finalPoint,polygon);
  const nearest=closestOnPolygon(finalPoint,polygon);
  return {pose:current,centerOfMass:com,supportCenter,correction,stable,distanceToSupport:stable?0:distance2(finalPoint,nearest),supportPolygon:polygon};
}

export interface DynamicBalanceOptions extends BalanceOptions {
  velocity?:{x:number;z:number};
  acceleration?:{x:number;z:number};
  predictionHorizonSec?:number;
  predictionWeight?:number;
}
export interface DynamicBalanceReport extends BalanceReport {
  predictedCenterOfMass:Vec3;
  predictionOffset:SupportPoint;
}
/**
 * Lightweight predictive balance: estimates where the COM will drift over a
 * short horizon, biases the pose against that drift, then runs static support
 * correction. This is not a rigid-body or momentum simulation.
 */
export function solveDynamicCharacterBalance3D(
  rig:CharacterRig,pose:CharacterPose,options:DynamicBalanceOptions
):DynamicBalanceReport {
  if(pose.rigId!==rig.id)throw new Error('Pose rig id does not match the target rig.');
  const horizon=Math.max(0,Math.min(0.5,options.predictionHorizonSec??0.12));
  const weight=Math.max(0,Math.min(1,options.predictionWeight??0.65));
  const velocity=options.velocity??{x:0,z:0},acceleration=options.acceleration??{x:0,z:0};
  const offset={
    x:(velocity.x*horizon+0.5*acceleration.x*horizon*horizon)*weight,
    z:(velocity.z*horizon+0.5*acceleration.z*horizon*horizon)*weight
  };
  const root=rig.joints.find(j=>j.id===rig.rootJointId);
  if(!root)throw new Error('Dynamic balance requires a valid root joint.');
  const rootPose=pose.joints.find(j=>j.jointId===root.id);
  const base=rootPose?.position??root.bindPosition;
  const predictedPose:CharacterPose={...pose,joints:[
    ...pose.joints.filter(j=>j.jointId!==root.id),
    {jointId:root.id,rotation:rootPose?.rotation??root.bindRotation,
      position:{x:base.x-offset.x,y:base.y,z:base.z-offset.z}}
  ]};
  const report=solveCharacterBalance3D(rig,predictedPose,options);
  const predictedCenterOfMass={...report.centerOfMass};
  return{...report,predictedCenterOfMass,predictionOffset:offset};
}
