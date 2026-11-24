import type { CharacterPhysicsState } from './collisionPhysics';
import type { CharacterBalanceRecoveryState, CharacterBalanceRecoveryOptions, CharacterBalanceRecoveryResult } from './characterBalanceRecovery';
import type { CharacterPose, CharacterRig } from './rig';
import { recoverCharacterBalance } from './characterBalanceRecovery';
export function recoverCombatPhysicsBalance(rig:CharacterRig,pose:CharacterPose,physics:CharacterPhysicsState,previous:CharacterBalanceRecoveryState,frame:number,fps:number,options:CharacterBalanceRecoveryOptions):CharacterBalanceRecoveryResult{
 return recoverCharacterBalance(rig,pose,physics,previous,frame,fps,options);
}
