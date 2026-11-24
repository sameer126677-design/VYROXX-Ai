import type { Vec3 } from '../core/types';
export interface CombatEvadeState { characterId:string; startedAtFrame:number; endsAtFrame:number; direction:Vec3; invulnerableFromFrame:number; invulnerableUntilFrame:number; changedAtFrame:number; }
export function createCombatEvadeState(characterId:string,frame:number,durationFrames:number,direction:Vec3,invulnerabilityStart=0,invulnerabilityDuration=0):CombatEvadeState{
 if(!characterId.trim()||![frame,durationFrames,direction.x,direction.y,direction.z,invulnerabilityStart,invulnerabilityDuration].every(Number.isFinite)||frame<0||!Number.isInteger(durationFrames)||durationFrames<1||invulnerabilityStart<0||invulnerabilityDuration<0||Math.hypot(direction.x,direction.y,direction.z)<1e-8)throw new Error('Invalid combat evade request.');
 const n=Math.hypot(direction.x,direction.y,direction.z);
 return {characterId,startedAtFrame:frame,endsAtFrame:frame+durationFrames,direction:{x:direction.x/n,y:direction.y/n,z:direction.z/n},invulnerableFromFrame:frame+Math.min(durationFrames,invulnerabilityStart),invulnerableUntilFrame:frame+Math.min(durationFrames,invulnerabilityStart+invulnerabilityDuration),changedAtFrame:frame};
}
export function sampleCombatEvade(previous:CombatEvadeState,frame:number):{state:CombatEvadeState;active:boolean;invulnerable:boolean;progress:number}{
 if(!Number.isFinite(frame)||frame<previous.changedAtFrame)throw new Error('Evade frame must be non-decreasing.');
 const progress=Math.max(0,Math.min(1,(frame-previous.startedAtFrame)/Math.max(1,previous.endsAtFrame-previous.startedAtFrame)));
 return {state:{...previous,changedAtFrame:frame},active:frame<previous.endsAtFrame,invulnerable:frame>=previous.invulnerableFromFrame&&frame<=previous.invulnerableUntilFrame,progress};
}
