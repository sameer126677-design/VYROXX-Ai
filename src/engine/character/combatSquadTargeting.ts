import type { Vec3 } from '../core/types';
import type { CombatTargetCandidate } from './combatTargeting';
import { selectCombatTarget } from './combatTargeting';
export interface SquadTargetRequest { ownerId:string; origin:Vec3; candidates:CombatTargetCandidate[]; assignedTargetByAlly?:Record<string,string>; maxDistance?:number; }
export interface SquadTargetResult { targetId:string|null; distance:number; direction:Vec3; focusCount:number; }
export function selectCombatSquadTarget(request:SquadTargetRequest):SquadTargetResult{
 const selected=selectCombatTarget(request.ownerId,request.origin,request.candidates,{maxDistance:request.maxDistance});
 if(!selected.targetId)return {...selected,focusCount:0};
 const focusCount=Object.values(request.assignedTargetByAlly??{}).filter(id=>id===selected.targetId).length;
 return {...selected,focusCount};
}
