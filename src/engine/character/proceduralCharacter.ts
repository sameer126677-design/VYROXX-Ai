import * as THREE from 'three';
import type { CharacterRig } from './rig';
import { createHumanoidRig, validateCharacterRig } from './rig';
import { createThreeRigRuntime, type ThreeRigRuntime } from './threeRig';

export type CharacterExpression = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised';
export type CharacterAnchor = 'head' | 'chest' | 'waist' | 'left-wrist' | 'right-wrist' | 'left-foot' | 'right-foot';
export type CharacterAccessory = 'cap' | 'backpack' | 'necklace' | 'wristband' | 'belt' | 'boots';
export type CharacterHandGesture = 'relaxed' | 'open' | 'fist' | 'point' | 'peace';
export type CharacterHand = 'left' | 'right';
export interface CharacterIdentity { id: string; displayName: string; seed: number; signature: string; }
export interface CharacterAccessorySpec { type: CharacterAccessory; color?: string; side?: 'left' | 'right' | 'both'; }
export interface CharacterAppearance {
  id: string; bodyColor?: string; skinColor?: string; hairColor?: string;
  clothingColor?: string; accentColor?: string; eyeColor?: string;
  expression?: CharacterExpression; headScale?: number;
  bodyScale?: { x?: number; y?: number; z?: number };
  style?: 'stylized' | 'low-poly' | 'toon';
  identity?: CharacterIdentity;
  accessories?: CharacterAccessorySpec[];
}
export interface ProceduralCharacterModel {
  root: THREE.Group; rig: ThreeRigRuntime;
  appearance: CharacterAppearance & { bodyScale: { x: number; y: number; z: number } };
  anchors: Map<CharacterAnchor, THREE.Group>;
  handJoints: Map<CharacterHand, THREE.Group[]>;
  dispose(): void;
}
const DEFAULTS = { bodyColor:'#64748b', skinColor:'#c98f6b', hairColor:'#20202a', clothingColor:'#26364b', accentColor:'#38bdf8', eyeColor:'#171923', expression:'neutral' as CharacterExpression, headScale:1, style:'stylized' as const };
const mat = (color:string, roughness=0.78) => new THREE.MeshStandardMaterial({color,roughness});
function add(parent:THREE.Object3D, geometry:THREE.BufferGeometry, material:THREE.Material, name:string, position:[number,number,number], scale:[number,number,number]=[1,1,1]):THREE.Mesh {
  const mesh = new THREE.Mesh(geometry,material); mesh.name=name; mesh.position.set(...position); mesh.scale.set(...scale); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
}
function segment(parent:THREE.Object3D,name:string,end:THREE.Vector3,radius:number,material:THREE.Material):void {
  const length=end.length(); const mesh=add(parent,new THREE.CapsuleGeometry(radius,Math.max(0.001,length-radius*2),4,8),material,name,[end.x/2,end.y/2,end.z/2]);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.clone().normalize());
}
function resolve(input:CharacterAppearance):ProceduralCharacterModel['appearance'] {
  return {...DEFAULTS,...input,bodyScale:{x:input.bodyScale?.x??1,y:input.bodyScale?.y??1,z:input.bodyScale?.z??1}};
}
function joint(rig:ThreeRigRuntime,id:string):THREE.Group {
  const value=rig.joints.get(id); if(!value) throw new Error(`Missing humanoid joint: ${id}`); return value;
}
function buildFace(head:THREE.Group,a:ProceduralCharacterModel['appearance']):void {
  const s=a.headScale??1, skin=mat(a.skinColor??DEFAULTS.skinColor), hair=mat(a.hairColor??DEFAULTS.hairColor);
  const eye=new THREE.MeshBasicMaterial({color:a.eyeColor??DEFAULTS.eyeColor});
  add(head,new THREE.SphereGeometry(.2,20,16),skin,'face-head',[0,0,0],[.82*s,1.02*s,.78*s]);
  add(head,new THREE.SphereGeometry(.205,16,10,0,Math.PI*2,0,Math.PI*.56),hair,'hair-cap',[0,.105*s,-.005],[.87*s,.62*s,.82*s]);
  for(const x of[-.067,.067]) { add(head,new THREE.SphereGeometry(.027*s,12,10),new THREE.MeshBasicMaterial({color:'#fffaf2'}),'eye-white',[x,.018*s,.151*s],[1,1,.5]); add(head,new THREE.SphereGeometry(.014*s,10,8),eye,'eye-pupil',[x,.018*s,.166*s],[1,1,.5]); }
  const expression=a.expression??'neutral', mouthMat=new THREE.MeshBasicMaterial({color:'#542b2b'});
  const mouth=expression==='surprised'?new THREE.CircleGeometry(.025*s,16):new THREE.TorusGeometry(.027*s,.006*s,6,18,Math.PI);
  const mouthMesh=add(head,mouth,mouthMat,'mouth',[0,expression==='surprised'?-.085*s:-.105*s,.15*s],[1,expression==='sad'?.75:1,.4]);
  mouthMesh.rotation.z=expression==='happy'||expression==='neutral'?Math.PI:0;
  if(expression==='angry') for(const x of[-.07,.07]) { const brow=add(head,new THREE.BoxGeometry(.07*s,.012*s,.012*s),hair,'eyebrow',[x,.075*s,.16*s]); brow.rotation.z=x<0?-.22:.22; }
}

const hashSeed=(value:string):number=>{let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
/** Creates a stable identity record; the signature changes only when the supplied identity seed/name changes. */
export function createCharacterIdentity(displayName:string,seed=hashSeed(displayName)):CharacterIdentity {
  const normalized=displayName.trim(); if(!normalized) throw new Error('Character identity needs a display name.');
  const stableSeed=seed>>>0; return {id:`character-${hashSeed(`${normalized}:${stableSeed}`).toString(36)}`,displayName:normalized,seed:stableSeed,signature:`${normalized.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${stableSeed.toString(36)}`};
}
/** Applies deterministic, repeatable palette variations while retaining the identity seed. */
export function createIdentityAppearance(identity:CharacterIdentity,base:CharacterAppearance={}):CharacterAppearance {
  const palettes=[{hairColor:'#20202a',clothingColor:'#26364b',accentColor:'#38bdf8'},{hairColor:'#3b241b',clothingColor:'#334155',accentColor:'#f59e0b'},{hairColor:'#151515',clothingColor:'#3f2d4f',accentColor:'#a78bfa'},{hairColor:'#5a3425',clothingColor:'#365047',accentColor:'#f472b6'}];
  const palette=palettes[identity.seed%palettes.length]; return {...palette,...base,id:base.id??identity.id,identity};
}
function createAnchors(rig:ThreeRigRuntime):Map<CharacterAnchor,THREE.Group> {
  const anchors=new Map<CharacterAnchor,THREE.Group>();
  const attach=(name:CharacterAnchor,jointId:string,offset:[number,number,number])=>{const parent=rig.joints.get(jointId);if(!parent)throw new Error(`Missing attachment joint: ${jointId}`);const group=new THREE.Group();group.name=`anchor:${name}`;group.position.set(...offset);parent.add(group);anchors.set(name,group);};
  attach('head','head',[0,.12,0]);attach('chest','spine',[0,.25,0]);attach('waist','root',[0,-.12,0]);attach('left-wrist',rig.joints.has('left_wrist')?'left_wrist':'left_elbow',rig.joints.has('left_wrist')?[0,0,0]:[-.05,-.30,0]);attach('right-wrist',rig.joints.has('right_wrist')?'right_wrist':'right_elbow',rig.joints.has('right_wrist')?[0,0,0]:[.05,-.30,0]);attach('left-foot',rig.joints.has('left_ankle')?'left_ankle':'left_knee',rig.joints.has('left_ankle')?[0,0,0]:[0,-.38,.07]);attach('right-foot',rig.joints.has('right_ankle')?'right_ankle':'right_knee',rig.joints.has('right_ankle')?[0,0,0]:[0,-.38,.07]);return anchors;
}
function buildAccessories(anchors:Map<CharacterAnchor,THREE.Group>,specs:CharacterAccessorySpec[]=[]):void {
  for(const spec of specs){const color=mat(spec.color??'#d6a84f');const addTo=(anchor:CharacterAnchor,kind:CharacterAccessory)=>{const parent=anchors.get(anchor);if(!parent)return;switch(kind){case 'cap':add(parent,new THREE.CylinderGeometry(.19,.22,.09,12),color,'accessory-cap',[0,.12,0]);break;case 'backpack':add(parent,new THREE.BoxGeometry(.28,.34,.13),color,'accessory-backpack',[0,-.02,-.22]);break;case 'necklace':add(parent,new THREE.TorusGeometry(.12,.012,6,24,Math.PI),color,'accessory-necklace',[0,.05,.18]);break;case 'wristband':add(parent,new THREE.TorusGeometry(.055,.014,6,16),color,'accessory-wristband',[0,0,0]);break;case 'belt':add(parent,new THREE.TorusGeometry(.16,.018,6,24),color,'accessory-belt',[0,-.12,0]);break;case 'boots':add(parent,new THREE.BoxGeometry(.18,.12,.3),color,'accessory-boot',[0,-.025,.08]);break;}};
    if(spec.type==='cap')addTo('head',spec.type);else if(spec.type==='backpack')addTo('chest',spec.type);else if(spec.type==='necklace')addTo('chest',spec.type);else if(spec.type==='belt')addTo('waist',spec.type);else if(spec.type==='boots'){addTo('left-foot',spec.type);addTo('right-foot',spec.type);}else {if(spec.side==='left'||spec.side==='both')addTo('left-wrist',spec.type);if(spec.side==='right'||spec.side==='both'||!spec.side)addTo('right-wrist',spec.type);}
  }
}

/** Builds a stylized humanoid mesh hierarchy attached to the native animation rig. */
export function createProceduralCharacter(input:CharacterAppearance,rigDefinition?:CharacterRig):ProceduralCharacterModel {
  const appearance=resolve(input), definition=rigDefinition??createHumanoidRig(appearance.id);
  const validation=validateCharacterRig(definition); if(!validation.valid) throw new Error(`Invalid character rig: ${validation.errors.join(' ')}`);
  const rig=createThreeRigRuntime(definition,{showBones:false}); rig.root.name=`VYROXX_Character_${appearance.id}`;
  rig.root.scale.set(appearance.bodyScale.x,appearance.bodyScale.y,appearance.bodyScale.z);
  const spine=joint(rig,'spine'), head=joint(rig,'head'), ls=joint(rig,'left_shoulder'), rs=joint(rig,'right_shoulder'), le=joint(rig,'left_elbow'), re=joint(rig,'right_elbow'), lw=rig.joints.get('left_wrist')??le, rw=rig.joints.get('right_wrist')??re, lh=joint(rig,'left_hip'), rh=joint(rig,'right_hip'), lk=joint(rig,'left_knee'), rk=joint(rig,'right_knee'), la=rig.joints.get('left_ankle')??lk, ra=rig.joints.get('right_ankle')??rk;
  const clothes=mat(appearance.clothingColor??DEFAULTS.clothingColor), skin=mat(appearance.skinColor??DEFAULTS.skinColor), body=mat(appearance.bodyColor??DEFAULTS.bodyColor), accent=mat(appearance.accentColor??DEFAULTS.accentColor,.48);
  add(spine,new THREE.CapsuleGeometry(.235,.38,6,12),clothes,'torso-jacket',[0,.23,0],[1.12,1.05,.8]);
  add(spine,new THREE.BoxGeometry(.31,.08,.035),accent,'jacket-trim',[0,.35,.205]);
  add(spine,new THREE.CylinderGeometry(.09,.13,.12,12),skin,'neck',[0,.54,0]);
  buildFace(head,appearance);
  segment(ls,'left-upper-arm',new THREE.Vector3(-.28,-.28,0),.085,clothes); segment(rs,'right-upper-arm',new THREE.Vector3(.28,-.28,0),.085,clothes);
  segment(le,'left-forearm',new THREE.Vector3(-.05,-.27,0),.067,skin); segment(re,'right-forearm',new THREE.Vector3(.05,-.27,0),.067,skin);
  add(lw,new THREE.SphereGeometry(.075,12,10),skin,'left-hand',[0,0,0],[.8,1.1,.65]); add(rw,new THREE.SphereGeometry(.075,12,10),skin,'right-hand',[0,0,0],[.8,1.1,.65]);
  const handJoints=new Map<CharacterHand,THREE.Group[]>();
  for(const [side,wrist,sign] of [['left',lw,-1],['right',rw,1]] as const){const fingers:THREE.Group[]=[];for(let i=0;i<4;i++){const finger=new THREE.Group();finger.name=`${side}-finger-${i}`;finger.position.set(sign*(i-1.5)*.026,-.035,.008);wrist.add(finger);segment(finger,`${side}-finger-mesh-${i}`,new THREE.Vector3(0,-.065,0),.011,skin);fingers.push(finger);}handJoints.set(side,fingers);}
  segment(lh,'left-thigh',new THREE.Vector3(0,-.42,0),.115,clothes); segment(rh,'right-thigh',new THREE.Vector3(0,-.42,0),.115,clothes);
  segment(lk,'left-shin',new THREE.Vector3(0,-.38,0),.078,body); segment(rk,'right-shin',new THREE.Vector3(0,-.38,0),.078,body);
  add(la,new THREE.BoxGeometry(.16,.09,.25),mat('#202733'),'left-shoe',[0,0,.07]); add(ra,new THREE.BoxGeometry(.16,.09,.25),mat('#202733'),'right-shoe',[0,0,.07]);
  const anchors=createAnchors(rig); buildAccessories(anchors,appearance.accessories);
  if(appearance.style==='low-poly') rig.root.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){m.geometry=m.geometry.toNonIndexed();m.geometry.computeVertexNormals();const materials=Array.isArray(m.material)?m.material:[m.material];materials.forEach(x=>{if(x instanceof THREE.MeshStandardMaterial)x.flatShading=true;});}});
  rig.root.userData.vyroxxCharacter={id:appearance.id,identity:appearance.identity??createCharacterIdentity(appearance.id),appearance,rigId:definition.id};
  return {root:rig.root,rig,appearance,anchors,handJoints,dispose(){rig.root.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){m.geometry.dispose();(Array.isArray(m.material)?m.material:[m.material]).forEach(x=>x.dispose());}});rig.root.removeFromParent();}};
}

export function updateCharacterExpression(model:ProceduralCharacterModel,expression:CharacterExpression):void {
  const head=model.rig.joints.get('head'); if(!head)return;
  const replacement=createProceduralCharacter({...model.appearance,expression});
  const nextHead=replacement.rig.joints.get('head'); if(!nextHead){replacement.dispose();return;}
  const names=/^(face-head|hair-cap|eye-white|eye-pupil|mouth|eyebrow)$/;
  head.children.filter(child=>names.test(child.name)).forEach(child=>{head.remove(child);const mesh=child as THREE.Mesh;if(mesh.isMesh){mesh.geometry.dispose();(Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(m=>m.dispose());}});
  nextHead.children.filter(child=>names.test(child.name)).forEach(child=>{nextHead.remove(child);head.add(child);});
  replacement.dispose(); model.appearance.expression=expression;
}


/** Applies deterministic finger curl presets to the procedural hand joints. */
export function setCharacterHandGesture(model:ProceduralCharacterModel,hand:CharacterHand,gesture:CharacterHandGesture):void {
  const fingers=model.handJoints.get(hand); if(!fingers)return;
  const curls:Record<CharacterHandGesture,number[]> = {
    relaxed:[.12,.12,.12,.12], open:[0,0,0,0], fist:[1.15,1.25,1.25,1.1],
    point:[1.15,0,1.15,1.1], peace:[1.15,0,0,1.1],
  };
  fingers.forEach((finger,index)=>{finger.rotation.x=curls[gesture][index]??0;});
}

/** Closes or opens the simple procedural eyelids for a blink. */
export function setCharacterBlink(model:ProceduralCharacterModel,closed:boolean):void {
  const head=model.rig.joints.get('head'); if(!head)return;
  head.traverse(object=>{if(object.name==='eye-white'||object.name==='eye-pupil'){object.scale.y=closed?0.08:1;}});
}

/** Moves both pupils within a small bounded gaze range. */
export function setCharacterGaze(model:ProceduralCharacterModel,x:number,y:number):void {
  const head=model.rig.joints.get('head'); if(!head)return;
  const gx=Math.max(-0.012,Math.min(0.012,x)), gy=Math.max(-0.012,Math.min(0.012,y));
  head.traverse(object=>{if(object.name==='eye-pupil'){object.position.x=(object.position.x<0?-0.067:0.067)+gx;object.position.y=0.018+gy;}});
}
