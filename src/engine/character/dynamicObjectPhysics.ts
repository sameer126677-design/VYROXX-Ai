import type { Object3D } from 'three';
import type { Vec3 } from '../core/types';

export type DynamicBodyShape =
  | { kind: 'sphere'; radius: number }
  | { kind: 'box'; halfExtents: Vec3 };

export interface DynamicBodyDefinition {
  id: string;
  shape: DynamicBodyShape;
  mass: number;
  restitution?: number;
  friction?: number;
  isStatic?: boolean;
}

export interface DynamicBodyState {
  id: string;
  position: Vec3;
  velocity: Vec3;
  force: Vec3;
  sleeping: boolean;
  changedAtFrame: number;
}

export interface DynamicPhysicsOptions {
  gravity?: Vec3;
  groundY?: number;
  linearDamping?: number;
  solverIterations?: number;
  maxSubstepSec?: number;
  sleepSpeed?: number;
}

export interface DynamicBodyContact {
  bodyA: string;
  bodyB: string | 'ground';
  normal: Vec3;
  penetration: number;
  impulse: number;
}

export interface DynamicPhysicsStep {
  states: DynamicBodyState[];
  contacts: DynamicBodyContact[];
  frame: number;
}

const EPS = 1e-8;
const add=(a:Vec3,b:Vec3):Vec3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const sub=(a:Vec3,b:Vec3):Vec3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const scale=(v:Vec3,s:number):Vec3=>({x:v.x*s,y:v.y*s,z:v.z*s});
const dot=(a:Vec3,b:Vec3):number=>a.x*b.x+a.y*b.y+a.z*b.z;
const length=(v:Vec3):number=>Math.hypot(v.x,v.y,v.z);
const clamp=(v:number,a:number,b:number):number=>Math.max(a,Math.min(b,v));
const finiteVec=(v:Vec3):boolean=>[v.x,v.y,v.z].every(Number.isFinite);
const normalize=(v:Vec3):Vec3=>{const n=length(v);return n>EPS?scale(v,1/n):{x:0,y:1,z:0};};

function validateDefinition(def:DynamicBodyDefinition):void {
  if(!def.id.trim())throw new Error('Dynamic body requires a stable id.');
  if(!Number.isFinite(def.mass)||def.mass<=0)throw new Error('Dynamic body mass must be positive and finite.');
  if(def.shape.kind==='sphere'){
    if(!Number.isFinite(def.shape.radius)||def.shape.radius<=0)throw new Error('Sphere body radius must be positive.');
  }else if(!finiteVec(def.shape.halfExtents)||def.shape.halfExtents.x<=0||def.shape.halfExtents.y<=0||def.shape.halfExtents.z<=0){
    throw new Error('Box body half-extents must be positive and finite.');
  }
  for(const value of [def.restitution,def.friction]){
    if(value!==undefined&&(!Number.isFinite(value)||value<0||value>1))throw new Error('Body restitution and friction must be between zero and one.');
  }
}

/** Creates serializable state for a dynamic or static body. */
export function createDynamicBodyState(id:string,position:Vec3,frame=0):DynamicBodyState{
  if(!id.trim()||!finiteVec(position)||!Number.isFinite(frame)||frame<0)throw new Error('Dynamic body state requires an id, finite position and non-negative frame.');
  return{id,position:{...position},velocity:{x:0,y:0,z:0},force:{x:0,y:0,z:0},sleeping:false,changedAtFrame:frame};
}

function inverseMass(def:DynamicBodyDefinition):number{return def.isStatic?0:1/def.mass;}
function bodyAabb(def:DynamicBodyDefinition,state:DynamicBodyState):{min:Vec3;max:Vec3}{
  const h=def.shape.kind==='sphere'?{x:def.shape.radius,y:def.shape.radius,z:def.shape.radius}:def.shape.halfExtents;
  return{min:{x:state.position.x-h.x,y:state.position.y-h.y,z:state.position.z-h.z},max:{x:state.position.x+h.x,y:state.position.y+h.y,z:state.position.z+h.z}};
}
function collide(a:DynamicBodyDefinition,sa:DynamicBodyState,b:DynamicBodyDefinition,sb:DynamicBodyState):{normal:Vec3;penetration:number}|null{
  if(a.shape.kind==='sphere'&&b.shape.kind==='sphere'){
    const delta=sub(sb.position,sa.position),distance=length(delta),penetration=a.shape.radius+b.shape.radius-distance;
    return penetration>0?{normal:distance>EPS?scale(delta,1/distance):{x:1,y:0,z:0},penetration}:null;
  }
  const aa=bodyAabb(a,sa),bb=bodyAabb(b,sb);
  const overlap={x:Math.min(aa.max.x,bb.max.x)-Math.max(aa.min.x,bb.min.x),y:Math.min(aa.max.y,bb.max.y)-Math.max(aa.min.y,bb.min.y),z:Math.min(aa.max.z,bb.max.z)-Math.max(aa.min.z,bb.min.z)};
  if(overlap.x<=0||overlap.y<=0||overlap.z<=0)return null;
  const axis=overlap.x<=overlap.y&&overlap.x<=overlap.z?'x':overlap.y<=overlap.z?'y':'z';
  const normal={x:0,y:0,z:0};normal[axis]=sb.position[axis]>=sa.position[axis]?1:-1;
  return{normal,penetration:overlap[axis]};
}

function resolvePair(
  a:DynamicBodyDefinition,sa:DynamicBodyState,b:DynamicBodyDefinition,sb:DynamicBodyState,
  contact:{normal:Vec3;penetration:number}
):{a:DynamicBodyState;b:DynamicBodyState;impulse:number}{
  const invA=inverseMass(a),invB=inverseMass(b),sum=invA+invB;
  if(sum<=0)return{a:sa,b:sb,impulse:0};
  const correction=Math.max(contact.penetration-0.001,0)*0.8/sum;
  let pa=sa.position,pb=sb.position;
  if(invA)pa=sub(pa,scale(contact.normal,correction*invA));
  if(invB)pb=add(pb,scale(contact.normal,correction*invB));
  let va={...sa.velocity},vb={...sb.velocity};
  const relative=sub(vb,va),normalSpeed=dot(relative,contact.normal);
  let impulse=0;
  if(normalSpeed<0){
    const restitution=Math.min(a.restitution??0,b.restitution??0);
    impulse=-(1+restitution)*normalSpeed/sum;
    if(invA)va=sub(va,scale(contact.normal,impulse*invA));
    if(invB)vb=add(vb,scale(contact.normal,impulse*invB));
    const tangentVelocity=sub(relative,scale(contact.normal,normalSpeed));
    const tangent=length(tangentVelocity)>EPS?normalize(tangentVelocity):{x:0,y:0,z:0};
    const frictionImpulse=clamp(-dot(relative,tangent)/sum,-impulse*Math.sqrt((a.friction??0.35)*(b.friction??0.35)),impulse*Math.sqrt((a.friction??0.35)*(b.friction??0.35)));
    if(invA)va=sub(va,scale(tangent,frictionImpulse*invA));
    if(invB)vb=add(vb,scale(tangent,frictionImpulse*invB));
  }
  return{a:{...sa,position:pa,velocity:va,sleeping:false},b:{...sb,position:pb,velocity:vb,sleeping:false},impulse};
}

/**
 * Advances sphere and axis-aligned box bodies with gravity, ground contact,
 * pairwise collision and simple impulse response. Rotation, angular momentum,
 * continuous collision detection and mesh colliders are not simulated.
 */
export function stepDynamicPhysics(
  definitions:DynamicBodyDefinition[],previous:DynamicBodyState[],frame:number,fps:number,options:DynamicPhysicsOptions={}
):DynamicPhysicsStep{
  if(!Number.isFinite(frame)||!Number.isFinite(fps)||fps<=0)throw new Error('Dynamic physics requires a finite frame and positive fps.');
  const definitionMap=new Map(definitions.map(def=>[def.id,def]));
  if(definitionMap.size!==definitions.length)throw new Error('Dynamic body ids must be unique.');
  definitions.forEach(validateDefinition);
  const stateMap=new Map(previous.map(state=>[state.id,{...state,position:{...state.position},velocity:{...state.velocity},force:{...state.force}}]));
  if(stateMap.size!==previous.length||previous.length!==definitions.length)throw new Error('Every dynamic body needs exactly one matching state.');
  for(const def of definitions)if(!stateMap.has(def.id))throw new Error(`Missing dynamic body state: ${def.id}`);
  for(const state of previous)if(!definitionMap.has(state.id)||!finiteVec(state.position)||!finiteVec(state.velocity)||!finiteVec(state.force)||frame<state.changedAtFrame)throw new Error('Dynamic body state is invalid or belongs to another frame.');
  const delta=(frame-previous[0]?.changedAtFrame??0)/fps;
  const maxStep=clamp(options.maxSubstepSec??1/60,1/240,1/15),steps=Math.max(1,Math.ceil(delta/maxStep)),dt=delta/steps;
  const gravity=options.gravity??{x:0,y:-9.81,z:0};
  if(!finiteVec(gravity))throw new Error('Gravity vector must be finite.');
  const ground=options.groundY??0,iterations=Math.max(1,Math.min(10,Math.floor(options.solverIterations??4)));
  const damping=clamp(options.linearDamping??0.015,0,1),sleepSpeed=Math.max(0,options.sleepSpeed??0.035);
  const contacts:DynamicBodyContact[]=[];
  const current=new Map(stateMap);
  for(let step=0;step<steps;step++){
    for(const def of definitions){
      const state=current.get(def.id)!;
      if(inverseMass(def)===0)continue;
      const acceleration=add(gravity,scale(state.force,1/def.mass));
      state.velocity=add(state.velocity,scale(acceleration,dt));
      state.position=add(state.position,scale(state.velocity,dt));
      const bounds=bodyAabb(def,state),bottom=bounds.min.y;
      if(bottom<ground){
        const penetration=ground-bottom;state.position.y+=penetration;
        const normal={x:0,y:1,z:0},speed=dot(state.velocity,normal);
        if(speed<0)state.velocity.y=-speed*(def.restitution??0);
        state.velocity.x*=1-(def.friction??0.35);state.velocity.z*=1-(def.friction??0.35);
        contacts.push({bodyA:def.id,bodyB:'ground',normal,penetration,impulse:Math.max(0,-speed*def.mass)});
      }
      state.velocity=scale(state.velocity,Math.pow(1-damping,dt));
      state.force={x:0,y:0,z:0};state.sleeping=false;
    }
    for(let pass=0;pass<iterations;pass++){
      let found=false;
      for(let i=0;i<definitions.length;i++)for(let j=i+1;j<definitions.length;j++){
        const a=definitions[i],b=definitions[j],sa=current.get(a.id)!,sb=current.get(b.id)!;
        if(inverseMass(a)+inverseMass(b)===0)continue;
        const hit=collide(a,sa,b,sb);if(!hit)continue;
        const result=resolvePair(a,sa,b,sb,hit);current.set(a.id,result.a);current.set(b.id,result.b);
        contacts.push({bodyA:a.id,bodyB:b.id,normal:hit.normal,penetration:hit.penetration,impulse:result.impulse});found=true;
      }
      if(!found)break;
    }
  }
  const states=definitions.map(def=>{
    const state=current.get(def.id)!;
    const speed=length(state.velocity);
    if(!def.isStatic&&speed<sleepSpeed&&Math.abs(state.position.y-bodyAabb(def,state).min.y)<EPS){state.velocity={x:0,y:0,z:0};state.sleeping=true;}
    state.changedAtFrame=frame;return state;
  });
  return{states,contacts,frame};
}

/** Applies a simulated body's translation to its Three.js object. */
export function applyDynamicBodyTransform(object:Object3D,state:DynamicBodyState):void{
  if(object.name&&object.name!==state.id&&object.userData?.physicsBodyId!==state.id)throw new Error('Three.js object does not match the dynamic body state id.');
  object.position.set(state.position.x,state.position.y,state.position.z);object.updateMatrixWorld(true);
}

/** Adds an impulse immediately to a body state; static bodies cannot receive impulses. */
export function applyDynamicBodyImpulse(definition:DynamicBodyDefinition,state:DynamicBodyState,impulse:Vec3):DynamicBodyState{
  validateDefinition(definition);
  if(definition.id!==state.id)throw new Error('Impulse body definition and state ids do not match.');
  if(definition.isStatic)throw new Error('Static bodies cannot receive impulses.');
  if(!finiteVec(impulse))throw new Error('Impulse must be finite.');
  return{...state,velocity:add(state.velocity,scale(impulse,1/definition.mass)),sleeping:false};
}
