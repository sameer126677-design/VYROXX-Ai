import type { CombatHitContact } from './combatHitDetection';
import type { CharacterCombatState } from './characterCombat';
export interface CombatThreatAssessment { threat:number; incomingDamage:number; nearestHitFrame:number|null; attacking:boolean; urgent:boolean; }
export function assessCombatThreat(target:CharacterCombatState,contacts:CombatHitContact[],frame:number,lookAheadFrames=12):CombatThreatAssessment{
 if(!Number.isFinite(frame)||!Number.isFinite(lookAheadFrames)||lookAheadFrames<0||target.health<0)throw new Error('Invalid combat threat assessment request.');
 const incoming=contacts.filter(c=>c.targetId===target.characterId&&c.frame>=frame&&c.frame<=frame+lookAheadFrames).sort((a,b)=>a.frame-b.frame);
 const incomingDamage=incoming.reduce((sum,c)=>sum+c.damage,0);
 const nearestHitFrame=incoming[0]?.frame??null;
 const attacking=target.action==='attack'&&target.phase!=='complete';
 const timeFactor=nearestHitFrame===null?0:1-Math.min(1,(nearestHitFrame-frame)/Math.max(1,lookAheadFrames));
 const damageFactor=Math.min(1,incomingDamage/Math.max(1,target.health));
 const threat=Math.max(0,Math.min(1,Math.max(timeFactor,damageFactor)*(attacking?1:0.85)));
 return {threat,incomingDamage,nearestHitFrame,attacking,urgent:nearestHitFrame!==null&&nearestHitFrame-frame<=3};
}
