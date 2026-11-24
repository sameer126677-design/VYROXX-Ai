import type { Vec3 } from '../core/types';
export interface CombatFootPlantState { leftAnchor:Vec3|null; rightAnchor:Vec3|null; leftLocked:boolean; rightLocked:boolean; changedAtFrame:number; }
export interface CombatFootPlantSample { state:CombatFootPlantState; leftTarget:Vec3|null; rightTarget:Vec3|null; leftWeight:number; rightWeight:number; }
export function createCombatFootPlantState(frame=0):CombatFootPlantState{
 if(!Number.isFinite(frame)||frame<0)throw new Error('Invalid foot plant frame.');
 return {leftAnchor:null,rightAnchor:null,leftLocked:false,rightLocked:false,changedAtFrame:frame};
}
export function updateCombatFootPlant(previous:CombatFootPlantState,request:{frame:number;leftPosition:Vec3;rightPosition:Vec3;leftContact:boolean;rightContact:boolean;lockThreshold?:number}):CombatFootPlantSample{
 const {frame,leftPosition,rightPosition}=request,threshold=request.lockThreshold??0.65;
 if(!Number.isFinite(frame)||frame<previous.changedAtFrame||![leftPosition.x,leftPosition.y,leftPosition.z,rightPosition.x,rightPosition.y,rightPosition.z,threshold].every(Number.isFinite)||threshold<0||threshold>1)throw new Error('Invalid foot planting request.');
 const leftLocked=request.leftContact&&threshold>0,rightLocked=request.rightContact&&threshold>0;
 const state:CombatFootPlantState={leftAnchor:leftLocked?(previous.leftLocked?previous.leftAnchor:{...leftPosition}):null,rightAnchor:rightLocked?(previous.rightLocked?previous.rightAnchor:{...rightPosition}):null,leftLocked,rightLocked,changedAtFrame:frame};
 return {state,leftTarget:state.leftAnchor,rightTarget:state.rightAnchor,leftWeight:leftLocked?1:0,rightWeight:rightLocked?1:0};
}
