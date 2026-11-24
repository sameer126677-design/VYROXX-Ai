import type { IK2DResult } from './rig';
import { solveTwoBoneIK2D } from './rig';
export interface CombatFootIKRequest { hip:{x:number;y:number}; target:{x:number;y:number}; upperLength:number; lowerLength:number; bendDirection?:1|-1; }
export interface CombatFootIKResult extends IK2DResult { correction:{x:number;y:number}; }
export function solveCombatFootIK(request:CombatFootIKRequest):CombatFootIKResult{
 const result=solveTwoBoneIK2D(request.hip,request.target,request.upperLength,request.lowerLength,request.bendDirection??1);
 return {...result,correction:{x:request.target.x-result.end.x,y:request.target.y-result.end.y}};
}
