import { stepCharacterLocomotionMachine, type CharacterLocomotionMachineInput, type CharacterLocomotionMachineResult } from './characterLocomotionMachine';
import { createCharacterLocomotionMachineState, type CharacterLocomotionMachineState } from './characterLocomotionMachineState';
export function createThreeCharacterLocomotionMachineState(rigId:string,frame=0,grounded=true):CharacterLocomotionMachineState { return createCharacterLocomotionMachineState(rigId,frame,grounded); }
export function stepThreeCharacterLocomotionMachine(input:CharacterLocomotionMachineInput):CharacterLocomotionMachineResult { return stepCharacterLocomotionMachine(input); }
