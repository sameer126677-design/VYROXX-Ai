import type { CharacterPhysicsState } from './collisionPhysics';
import type { CombatFootPlantState } from './combatFootPlanting';
export interface CombatGroundingSample { grounded:boolean; leftSupported:boolean; rightSupported:boolean; supportCount:number; stable:boolean; }
export function sampleCombatGrounding(physics:CharacterPhysicsState,feet:CombatFootPlantState):CombatGroundingSample{
 const leftSupported=feet.leftLocked&&feet.leftAnchor!==null,rightSupported=feet.rightLocked&&feet.rightAnchor!==null;
 const supportCount=Number(leftSupported)+Number(rightSupported);
 return {grounded:physics.grounded,leftSupported,rightSupported,supportCount,stable:physics.grounded&&supportCount>0};
}
