import type { Vec3 } from '../core/types';
export interface CombatTargetCandidate { characterId:string; position:Vec3; alive?:boolean; }
export interface CombatTargetResult { targetId:string|null; distance:number; direction:Vec3; }
const valid=(v:Vec3)=>[v.x,v.y,v.z].every(Number.isFinite);
export function selectCombatTarget(ownerId:string,origin:Vec3,candidates:CombatTargetCandidate[],options:{maxDistance?:number;facing?:Vec3;maxAngleDegrees?:number;currentTargetId?:string|null}={}):CombatTargetResult{
 const max=options.maxDistance??Infinity,angle=options.maxAngleDegrees??180;
 if(!ownerId.trim()||!valid(origin)||max<0||angle<0||angle>360||Number.isNaN(max))throw new Error('Invalid combat targeting request.');
 const facing=options.facing&&valid(options.facing)?options.facing:{x:0,y:0,z:1};const fl=Math.hypot(facing.x,facing.y,facing.z)||1;
 const ranked=candidates.filter(c=>c.characterId!==ownerId&&c.alive!==false&&valid(c.position)).map(c=>{const d={x:c.position.x-origin.x,y:c.position.y-origin.y,z:c.position.z-origin.z};const distance=Math.hypot(d.x,d.y,d.z);const n=distance>1e-8?{x:d.x/distance,y:d.y/distance,z:d.z/distance}:{x:0,y:0,z:1};const score=(facing.x*n.x+facing.y*n.y+facing.z*n.z)/fl;return {id:c.characterId,distance,direction:n,score};}).filter(c=>c.distance<=max&&c.score>=Math.cos(angle*Math.PI/360)).sort((a,b)=>a.distance-b.distance);
 const chosen=ranked.find(c=>c.id===options.currentTargetId)??ranked[0];
 return chosen?{targetId:chosen.id,distance:chosen.distance,direction:chosen.direction}:{targetId:null,distance:Infinity,direction:{x:0,y:0,z:1}};
}
