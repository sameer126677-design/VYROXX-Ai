import type { CombatSquadRoleAssignment } from './combatSquadRoles';
import type { CombatTargetResult } from './combatTargeting';
export interface CombatSquadOrder { characterId:string; role:CombatSquadRoleAssignment['role']; targetId:string|null; action:'engage'|'flank'|'support'|'hold'|'retreat'; priority:number; }
export function coordinateCombatSquad(assignments:CombatSquadRoleAssignment[],target:CombatTargetResult,focusLimit=2):CombatSquadOrder[]{
 if(!Number.isInteger(focusLimit)||focusLimit<1)throw new Error('Squad focus limit must be a positive integer.');
 const sorted=[...assignments].sort((a,b)=>a.slot-b.slot||a.characterId.localeCompare(b.characterId));
 return sorted.map(a=>{let action:CombatSquadOrder['action'];let priority:number;
 switch(a.role){case'retreat':action='retreat';priority=100;break;case'engage':action=target.targetId?'engage':'hold';priority=80;break;case'flank':action=target.targetId&&target.focusCount<focusLimit?'flank':'support';priority=60;break;case'support':action=target.targetId?'support':'hold';priority=40;break;default:action='hold';priority=20;}
 return {characterId:a.characterId,role:a.role,targetId:action==='retreat'||action==='hold'?null:target.targetId,action,priority};});
}
