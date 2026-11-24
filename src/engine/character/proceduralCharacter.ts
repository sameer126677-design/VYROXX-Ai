import * as THREE from 'three';
import type { CharacterRig } from './rig';
import { createHumanoidRig, validateCharacterRig } from './rig';
import { createThreeRigRuntime, type ThreeRigRuntime } from './threeRig';

export type CharacterExpression = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised';
export interface CharacterAppearance {
  id: string; bodyColor?: string; skinColor?: string; hairColor?: string;
  clothingColor?: string; accentColor?: string; eyeColor?: string;
  expression?: CharacterExpression; headScale?: number;
  bodyScale?: { x?: number; y?: number; z?: number };
  style?: 'stylized' | 'low-poly' | 'toon';
}
export interface ProceduralCharacterModel {
  root: THREE.Group; rig: ThreeRigRuntime;
  appearance: CharacterAppearance & { bodyScale: { x: number; y: number; z: number } };
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

/** Builds a stylized humanoid mesh hierarchy attached to the native animation rig. */
export function createProceduralCharacter(input:CharacterAppearance,rigDefinition?:CharacterRig):ProceduralCharacterModel {
  const appearance=resolve(input), definition=rigDefinition??createHumanoidRig(appearance.id);
  const validation=validateCharacterRig(definition); if(!validation.valid) throw new Error(`Invalid character rig: ${validation.errors.join(' ')}`);
  const rig=createThreeRigRuntime(definition,{showBones:false}); rig.root.name=`VYROXX_Character_${appearance.id}`;
  rig.root.scale.set(appearance.bodyScale.x,appearance.bodyScale.y,appearance.bodyScale.z);
  const spine=joint(rig,'spine'), head=joint(rig,'head'), ls=joint(rig,'left_shoulder'), rs=joint(rig,'right_shoulder'), le=joint(rig,'left_elbow'), re=joint(rig,'right_elbow'), lh=joint(rig,'left_hip'), rh=joint(rig,'right_hip'), lk=joint(rig,'left_knee'), rk=joint(rig,'right_knee');
  const clothes=mat(appearance.clothingColor??DEFAULTS.clothingColor), skin=mat(appearance.skinColor??DEFAULTS.skinColor), body=mat(appearance.bodyColor??DEFAULTS.bodyColor), accent=mat(appearance.accentColor??DEFAULTS.accentColor,.48);
  add(spine,new THREE.CapsuleGeometry(.235,.38,6,12),clothes,'torso-jacket',[0,.23,0],[1.12,1.05,.8]);
  add(spine,new THREE.BoxGeometry(.31,.08,.035),accent,'jacket-trim',[0,.35,.205]);
  add(spine,new THREE.CylinderGeometry(.09,.13,.12,12),skin,'neck',[0,.54,0]);
  buildFace(head,appearance);
  segment(ls,'left-upper-arm',new THREE.Vector3(-.28,-.28,0),.085,clothes); segment(rs,'right-upper-arm',new THREE.Vector3(.28,-.28,0),.085,clothes);
  segment(le,'left-forearm',new THREE.Vector3(-.05,-.27,0),.067,skin); segment(re,'right-forearm',new THREE.Vector3(.05,-.27,0),.067,skin);
  add(le,new THREE.SphereGeometry(.075,12,10),skin,'left-hand',[-.05,-.3,0],[.8,1.1,.65]); add(re,new THREE.SphereGeometry(.075,12,10),skin,'right-hand',[.05,-.3,0],[.8,1.1,.65]);
  segment(lh,'left-thigh',new THREE.Vector3(0,-.42,0),.115,clothes); segment(rh,'right-thigh',new THREE.Vector3(0,-.42,0),.115,clothes);
  segment(lk,'left-shin',new THREE.Vector3(0,-.38,0),.078,body); segment(rk,'right-shin',new THREE.Vector3(0,-.38,0),.078,body);
  add(lk,new THREE.BoxGeometry(.16,.09,.25),mat('#202733'),'left-shoe',[0,-.4,.07]); add(rk,new THREE.BoxGeometry(.16,.09,.25),mat('#202733'),'right-shoe',[0,-.4,.07]);
  if(appearance.style==='low-poly') rig.root.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){m.geometry=m.geometry.toNonIndexed();m.geometry.computeVertexNormals();const materials=Array.isArray(m.material)?m.material:[m.material];materials.forEach(x=>{if(x instanceof THREE.MeshStandardMaterial)x.flatShading=true;});}});
  rig.root.userData.vyroxxCharacter={id:appearance.id,appearance,rigId:definition.id};
  return {root:rig.root,rig,appearance,dispose(){rig.root.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){m.geometry.dispose();(Array.isArray(m.material)?m.material:[m.material]).forEach(x=>x.dispose());}});rig.root.removeFromParent();}};
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
