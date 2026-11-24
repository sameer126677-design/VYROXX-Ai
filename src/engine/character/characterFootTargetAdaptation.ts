import type { Vec3 } from '../core/types';
import type { GroundContactPlan, GroundContactSurface, GroundFootContact } from './groundContact';
import { probeCharacterTerrain } from './characterTerrainProbe';
export interface CharacterFootAdaptationOptions { maxSlopeRadians?:number; maxStepHeight?:number; soleClearance?:number; obstacleRadius?:number; }
export interface CharacterFootAdaptationResult { contacts:[GroundFootContact,GroundFootContact]; valid:boolean; rejectedSides:('left'|'right')[]; averageHeight:number|null; averageNormal:Vec3|null; }
export function adaptCharacterFootTargets(plan:GroundContactPlan,surface:GroundContactSurface,rootY:number,options:CharacterFootAdaptationOptions={}):CharacterFootAdaptationResult {
 if(!Number.isFinite(rootY)) throw new Error('Root height must be finite.');
 const rejectedSides:('left'|'right')[]=[],accepted:GroundFootContact[]=[];
 const contacts=plan.contacts.map(contact=>{
  const probe=probeCharacterTerrain(surface,contact.target.x,contact.target.z,{maxSlopeRadians:options.maxSlopeRadians,obstacleRadius:options.obstacleRadius});
  const stepExceeded=probe.height-rootY>(options.maxStepHeight??0.42);
  const obstacleBlocked=!!probe.obstacle&&probe.obstacle.height+(probe.obstacle.clearance??0.16)>probe.height+(options.soleClearance??0.015)+0.001;
  const reachable=contact.reachable&&probe.walkable&&!stepExceeded&&!obstacleBlocked;
  const next={...contact,target:{...contact.target,y:probe.height+(options.soleClearance??0.015)},normal:probe.normal,slopeRadians:probe.slopeRadians,slopeExceeded:!probe.walkable,stepHeightExceeded:stepExceeded,obstacleBlocked,reachable};
  if(reachable&&contact.planted)accepted.push(next); else if(!reachable)rejectedSides.push(contact.side);
  return next;
 }) as [GroundFootContact,GroundFootContact];
 const averageHeight=accepted.length?accepted.reduce((sum,item)=>sum+item.target.y,0)/accepted.length:null;
 const normal=accepted.length?accepted.reduce((sum,item)=>({x:sum.x+item.normal.x,y:sum.y+item.normal.y,z:sum.z+item.normal.z}),{x:0,y:0,z:0}):null;
 const n=normal?Math.hypot(normal.x,normal.y,normal.z):0;
 return {contacts,valid:rejectedSides.length===0,rejectedSides,averageHeight,averageNormal:normal&&n>1e-8?{x:normal.x/n,y:normal.y/n,z:normal.z/n}:null};
}
