import type { CharacterPose, CharacterRig } from './rig';
import type { CharacterPhysicsState, CharacterPhysicsContact } from './collisionPhysics';
import { deriveCombatPhysicsAnimationSignals, type CombatPhysicsAnimationSignals } from './combatPhysicsAnimationSignals';
import { applyCombatPhysicsPose, type CombatPhysicsPoseOptions } from './combatPhysicsPose';
import { createCharacterImpactState, sampleCharacterImpactReaction, type CharacterImpactRequest } from './characterImpactReaction';
export interface CombatPhysicalAnimationResult { pose:CharacterPose; signals:CombatPhysicsAnimationSignals; impactApplied:boolean; }
export function evaluateCombatPhysicalAnimation(rig:CharacterRig,basePose:CharacterPose,physics:CharacterPhysicsState,contacts:CharacterPhysicsContact[],frame:number,impact?:CharacterImpactRequest|null,options:CombatPhysicsPoseOptions={}):CombatPhysicalAnimationResult{
 const signals=deriveCombatPhysicsAnimationSignals(physics,contacts);
 let pose=applyCombatPhysicsPose(rig,basePose,signals,options),impactApplied=false;
 if(impact&&frame>=impact.startFrame){const state=createCharacterImpactState(rig,impact);pose=sampleCharacterImpactReaction(rig,pose,state,frame).pose;impactApplied=true;}
 return {pose,signals,impactApplied};
}
