import type { CharacterPose, CharacterRig } from './rig';
import type { CharacterPhysicsState, CharacterPhysicsContact } from './collisionPhysics';
import { evaluateCombatPhysicalAnimation } from './combatPhysicalAnimation';
import { createCombatImpactFromContacts, type CombatImpactBridgeOptions } from './combatImpactPhysicsBridge';
import type { CharacterImpactRequest } from './characterImpactReaction';
import { analyzeCharacterPhysicsContacts, type CharacterPhysicsContactAnalysis } from './characterPhysicsContactAnalysis';
export interface CharacterPhysicsAnimationFeedbackOptions extends CombatImpactBridgeOptions { leanScale?:number; bobScale?:number; impactEnabled?:boolean; }
export interface CharacterPhysicsAnimationFeedbackResult { pose:CharacterPose; analysis:CharacterPhysicsContactAnalysis; impact:CharacterImpactRequest|null; impactApplied:boolean; signals:ReturnType<typeof evaluateCombatPhysicalAnimation>['signals']; }
export function evaluateCharacterPhysicsAnimationFeedback(rig:CharacterRig,pose:CharacterPose,physics:CharacterPhysicsState,contacts:CharacterPhysicsContact[],frame:number,options:CharacterPhysicsAnimationFeedbackOptions={}):CharacterPhysicsAnimationFeedbackResult {
 const analysis=analyzeCharacterPhysicsContacts(physics,contacts);
 const impact=options.impactEnabled===false?null:createCombatImpactFromContacts(rig.characterId,physics,contacts,frame,options);
 const animation=evaluateCombatPhysicalAnimation(rig,pose,physics,contacts,frame,impact,{leanScale:options.leanScale,bobScale:options.bobScale});
 return {pose:animation.pose,analysis,impact,impactApplied:animation.impactApplied,signals:animation.signals};
}
