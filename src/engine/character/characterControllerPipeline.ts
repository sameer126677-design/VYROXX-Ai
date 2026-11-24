import type { CharacterRig } from './rig';
import type { CharacterCapsule, CharacterPhysicsOptions, EnvironmentCollider } from './collisionPhysics';
import { stepCombatPhysicsPipeline, type CombatMovementPhysicsOptions } from './combatPhysicsPipeline';
import { resolveCharacterControllerInput, type CharacterControllerInput } from './characterControllerInput';
import { synchronizeCharacterControllerFeet, type CharacterControllerFootInput, type CharacterControllerFootResult } from './characterControllerFootSync';
import type { CharacterControllerState } from './characterControllerState';
import type { CharacterAnimationPipelineInput, CharacterAnimationPipelineResult } from './characterAnimationPipeline';
import { evaluateCharacterAnimationPipeline } from './characterAnimationPipeline';
export interface CharacterControllerPipelineInput {
 rig:CharacterRig; state:CharacterControllerState; frame:number; fps:number; control:CharacterControllerInput;
 capsule:CharacterCapsule; colliders:EnvironmentCollider[]; feet:CharacterControllerFootInput;
 animation:Omit<CharacterAnimationPipelineInput,'rig'|'state'|'frame'|'fps'|'physics'|'contacts'|'grounded'>;
 movementOptions?:CombatMovementPhysicsOptions; physicsOptions?:CharacterPhysicsOptions;
}
export interface CharacterControllerPipelineResult { state:CharacterControllerState; desiredVelocity:{x:number;y:number;z:number}; grounded:boolean; foot:CharacterControllerFootResult; animation:CharacterAnimationPipelineResult; contacts:ReturnType<typeof stepCombatPhysicsPipeline>['contacts']; }
export function stepCharacterControllerPipeline(input:CharacterControllerPipelineInput):CharacterControllerPipelineResult {
 const {rig,state,frame,fps}=input;
 if(state.characterId!==rig.characterId||state.rigId!==rig.id||input.state.physics.characterId!==rig.characterId||!Number.isFinite(frame)||frame<state.lastFrame||!Number.isFinite(fps)||fps<=0) throw new Error('Character controller identity or frame is invalid.');
 const control=resolveCharacterControllerInput(input.control);
 const physics=stepCombatPhysicsPipeline(state.physics,control.desiredVelocity,input.capsule,input.colliders,frame,fps,input.movementOptions,input.physicsOptions);
 const foot=synchronizeCharacterControllerFeet(state.feet,physics.state,input.feet,frame);
 const animation=evaluateCharacterAnimationPipeline({...input.animation,rig,state:state.animation,frame,fps,physics:physics.state,contacts:physics.contacts,grounded:physics.grounded});
 const next:CharacterControllerState={characterId:state.characterId,rigId:state.rigId,lastFrame:frame,physics:physics.state,animation:animation.state,feet:foot.state};
 return {state:next,desiredVelocity:control.desiredVelocity,grounded:physics.grounded,foot,animation,contacts:physics.contacts};
}
