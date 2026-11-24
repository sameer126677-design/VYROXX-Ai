import type { Vec3 } from '../core/types';
export type CombatSquadRole='engage'|'flank'|'support'|'reserve'|'retreat';
export interface CombatSquadMember { characterId:string; position:Vec3; health:number; stamina:number; }
export interface CombatSquadRoleAssignment { characterId:string; role:CombatSquadRole; slot:number; }
export function assignCombatSquadRoles(members:CombatSquadMember[],leaderId:string,retreatHealthRatio=0.2):CombatSquadRoleAssignment[]{
 if(!leaderId.trim()||!Number.isFinite(retreatHealthRatio)||retreatHealthRatio<0||retreatHealthRatio>1)throw new Error('Invalid squad role assignment request.');
 const ids=new Set<string>();
 const ordered=[...members].sort((a,b)=>a.characterId.localeCompare(b.characterId));
 for(const m of ordered){if(!m.characterId.trim()||ids.has(m.characterId)||![m.position.x,m.position.y,m.position.z,m.health,m.stamina].every(Number.isFinite)||m.health<0||m.stamina<0)throw new Error('Squad members must have unique ids and valid stats.');ids.add(m.characterId);}
 const active=ordered.filter(m=>m.health>retreatHealthRatio*100);
 return ordered.map(m=>{const slot=ordered.findIndex(x=>x.characterId===m.characterId);let role:CombatSquadRole;
 if(m.health<=retreatHealthRatio*100)role='retreat';
 else if(m.characterId===leaderId||active.indexOf(m)===0)role='engage';
 else if(active.indexOf(m)===1)role='flank';
 else if(m.stamina<25)role='reserve';
 else role='support';
 return {characterId:m.characterId,role,slot};});
}
