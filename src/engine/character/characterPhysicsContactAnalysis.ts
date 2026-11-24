import type { CharacterPhysicsContact, CharacterPhysicsState } from './collisionPhysics';
export interface CharacterPhysicsContactAnalysis { strongest:CharacterPhysicsContact|null; totalPenetration:number; horizontalImpact:number; verticalImpact:number; groundedContact:boolean; severity:'none'|'light'|'medium'|'heavy'; }
export function analyzeCharacterPhysicsContacts(physics:CharacterPhysicsState,contacts:CharacterPhysicsContact[]):CharacterPhysicsContactAnalysis {
 const valid=contacts.filter(c=>[c.normal.x,c.normal.y,c.normal.z,c.penetration].every(Number.isFinite)&&c.penetration>0);
 const strongest=valid.reduce<CharacterPhysicsContact|null>((best,c)=>!best||c.penetration>best.penetration?c:best,null);
 const totalPenetration=valid.reduce((sum,c)=>sum+c.penetration,0);
 const horizontalImpact=valid.reduce((sum,c)=>sum+c.penetration*Math.hypot(c.normal.x,c.normal.z),0);
 const verticalImpact=valid.reduce((sum,c)=>sum+c.penetration*Math.abs(c.normal.y),0);
 const groundedContact=physics.grounded||valid.some(c=>c.normal.y>0.45);
 const severity=totalPenetration<0.015?'none':totalPenetration<0.06?'light':totalPenetration<0.16?'medium':'heavy';
 return {strongest,totalPenetration,horizontalImpact,verticalImpact,groundedContact,severity};
}
