import type { CharacterCapsule, CharacterPhysicsOptions, CharacterPhysicsState, EnvironmentCollider, CharacterPhysicsStep } from './collisionPhysics';
import { stepCharacterPhysics } from './collisionPhysics';
import type { Vec3 } from '../core/types';
import { driveCombatMovementPhysics, type CombatMovementPhysicsOptions } from './combatMovementPhysics';
export interface CombatPhysicsPipelineResult { state:CharacterPhysicsState; movementVelocity:Vec3; contacts:CharacterPhysicsStep['contacts']; grounded:boolean; appliedGravity:number; }
export function stepCombatPhysicsPipeline(previous:CharacterPhysicsState,desiredVelocity:Vec3,capsule:CharacterCapsule,colliders:EnvironmentCollider[],frame:number,fps:number,movementOptions:CombatMovementPhysicsOptions={},physicsOptions:CharacterPhysicsOptions={}):CombatPhysicsPipelineResult{
 const driven=driveCombatMovementPhysics(previous,desiredVelocity,frame,fps,movementOptions);
 const stepped=stepCharacterPhysics(driven.state,capsule,colliders,frame,fps,physicsOptions);
 return {state:stepped.state,movementVelocity:driven.state.velocity,contacts:stepped.contacts,grounded:stepped.grounded,appliedGravity:stepped.appliedGravity};
}
