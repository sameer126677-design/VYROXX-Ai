import type { CharacterPhysicsContact, CharacterPhysicsState } from './collisionPhysics';
import type { CharacterImpactRequest, CharacterHitRegion } from './characterImpactReaction';
import type { Vec3 } from '../core/types';
export interface CombatImpactBridgeOptions { region?:CharacterHitRegion; intensityScale?:number; minimumPenetration?:number; durationFrames?:number; }
export function createCombatImpactFromContacts(characterId:string,physics:CharacterPhysicsState,contacts:CharacterPhysicsContact[],frame:number,options:CombatImpactBridgeOptions={}):CharacterImpactRequest|null{
 if(!characterId.trim()||characterId!==physics.characterId||!Number.isFinite(frame)||frame<physics.changedAtFrame)throw new Error('Impact bridge character or frame mismatch.');
 const minimum=options.minimumPenetration??0.005,contact=contacts.filter(c=>Number.isFinite(c.penetration)&&c.penetration>=minimum).sort((a,b)=>b.penetration-a.penetration)[0];
 if(!contact)return null;
 const direction:Vec3={x:contact.normal.x,y:contact.normal.y,z:contact.normal.z};
 const scale=options.intensityScale??3;
 if(!Number.isFinite(scale)||scale<0)throw new Error('Impact intensity scale must be non-negative.');
 return {id:'physics-impact-'+characterId+'-'+frame,kind:'collision',region:options.region??'torso',direction,intensity:Math.min(2,contact.penetration*scale),startFrame:frame,durationFrames:options.durationFrames};
}
