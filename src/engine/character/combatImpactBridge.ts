import type { CharacterRig, CharacterPose } from './rig';
import { createCharacterImpactState, sampleCharacterImpactReaction, type CharacterImpactKind, type CharacterHitRegion } from './characterImpactReaction';
import type { CombatHitContact } from './combatHitDetection';
export interface CombatImpactBridgeResult { pose:CharacterPose; intensity:number; complete:boolean; }
export function applyCombatContactReaction(rig:CharacterRig,basePose:CharacterPose,contact:CombatHitContact,kind:CharacterImpactKind='punch',intensity=1):CombatImpactBridgeResult{
 if(rig.characterId!==contact.targetId||!Number.isFinite(intensity)||intensity<0)throw new Error('Combat impact target or intensity is invalid.');
 const region=contact.region as CharacterHitRegion;
 const state=createCharacterImpactState(rig,{id:`combat-impact-${contact.hitboxId}-${contact.frame}`,kind,region,direction:contact.normal,intensity,startFrame:contact.frame});
 const sample=sampleCharacterImpactReaction(rig,basePose,state,contact.frame);
 return {pose:sample.pose,intensity:sample.intensity,complete:sample.complete};
}
