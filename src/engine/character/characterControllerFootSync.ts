import type { Vec3 } from '../core/types';
import { updateCombatFootPlant, type CombatFootPlantState } from './combatFootPlanting';
import { sampleCombatGrounding, type CombatGroundingSample } from './combatGrounding';
import type { CharacterPhysicsState } from './collisionPhysics';
export interface CharacterControllerFootInput { leftPosition:Vec3; rightPosition:Vec3; leftContact:boolean; rightContact:boolean; lockThreshold?:number; }
export interface CharacterControllerFootResult { state:CombatFootPlantState; grounding:CombatGroundingSample; }
export function synchronizeCharacterControllerFeet(previous:CombatFootPlantState,physics:CharacterPhysicsState,feet:CharacterControllerFootInput,frame:number):CharacterControllerFootResult {
 const planted=updateCombatFootPlant(previous,{frame,leftPosition:feet.leftPosition,rightPosition:feet.rightPosition,leftContact:feet.leftContact,rightContact:feet.rightContact,lockThreshold:feet.lockThreshold});
 return {state:planted.state,grounding:sampleCombatGrounding(physics,planted.state)};
}
