import type { CharacterPhysicsState } from './collisionPhysics';
import type { CharacterAnimationPipelineState } from './characterAnimationPipelineState';
import type { CombatFootPlantState } from './combatFootPlanting';
export interface CharacterControllerState { characterId:string; rigId:string; lastFrame:number; physics:CharacterPhysicsState; animation:CharacterAnimationPipelineState; feet:CombatFootPlantState; }
export function createCharacterControllerState(physics:CharacterPhysicsState,animation:CharacterAnimationPipelineState,feet:CombatFootPlantState):CharacterControllerState {
 if(!physics.characterId.trim()||physics.characterId!==animation.characterId||!Number.isFinite(physics.changedAtFrame)||physics.changedAtFrame<0||animation.lastFrame!==physics.changedAtFrame||feet.changedAtFrame>physics.changedAtFrame) throw new Error('Controller initial states must share character identity and frame.');
 return {characterId:physics.characterId,rigId:animation.rigId,lastFrame:physics.changedAtFrame,physics:{...physics,position:{...physics.position},velocity:{...physics.velocity}},animation:{...animation},feet:{...feet}};
}
