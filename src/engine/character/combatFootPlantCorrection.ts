import type { Vec3 } from '../core/types';
import type { CombatFootPlantState } from './combatFootPlanting';
export interface CombatFootPlantCorrection { rootOffset:Vec3; leftError:Vec3|null; rightError:Vec3|null; }
const error=(anchor:Vec3|null,current:Vec3,locked:boolean):Vec3|null=>locked&&anchor?{x:anchor.x-current.x,y:anchor.y-current.y,z:anchor.z-current.z}:null;
export function calculateCombatFootPlantCorrection(state:CombatFootPlantState,leftCurrent:Vec3,rightCurrent:Vec3,maxCorrection=0.12):CombatFootPlantCorrection{
 if(![leftCurrent.x,leftCurrent.y,leftCurrent.z,rightCurrent.x,rightCurrent.y,rightCurrent.z,maxCorrection].every(Number.isFinite)||maxCorrection<0)throw new Error('Invalid foot correction input.');
 const leftError=error(state.leftAnchor,leftCurrent,state.leftLocked),rightError=error(state.rightAnchor,rightCurrent,state.rightLocked);
 const count=Number(!!leftError)+Number(!!rightError);
 const average={x:count?((leftError?.x??0)+(rightError?.x??0))/count:0,y:count?((leftError?.y??0)+(rightError?.y??0))/count:0,z:count?((leftError?.z??0)+(rightError?.z??0))/count:0};
 const length=Math.hypot(average.x,average.y,average.z),scale=length>maxCorrection&&length>0?maxCorrection/length:1;
 return {rootOffset:{x:average.x*scale,y:average.y*scale,z:average.z*scale},leftError,rightError};
}
