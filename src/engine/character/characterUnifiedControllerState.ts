import type { CharacterControllerState } from './characterControllerState';
import type { FootPlantState } from './groundContact';
import type { CharacterBalanceState } from './characterBalanceState';
export interface CharacterUnifiedControllerState { controller:CharacterControllerState; groundedIK:FootPlantState|null; balance:CharacterBalanceState|null; lastFrame:number; }
export function createCharacterUnifiedControllerState(controller:CharacterControllerState,groundedIK:FootPlantState|null=null,balance:CharacterBalanceState|null=null):CharacterUnifiedControllerState {
 if(groundedIK&&groundedIK.rigId!==controller.rigId) throw new Error('Unified grounded IK state rig does not match controller.');
 if(balance&&balance.rigId!==controller.rigId) throw new Error('Unified balance state rig does not match controller.');
 return {controller,groundedIK,balance,lastFrame:controller.lastFrame};
}
