export type CombatStatusKind='stagger'|'knockdown'|'guard-break'|'invulnerable';
export interface CombatStatusEffect { id:string; kind:CombatStatusKind; startedAtFrame:number; endsAtFrame:number; intensity:number; sourceId?:string; }
export interface CombatStatusState { characterId:string; effects:CombatStatusEffect[]; changedAtFrame:number; }
export function createCombatStatusState(characterId:string,frame=0):CombatStatusState{
 if(!characterId.trim()||!Number.isFinite(frame)||frame<0)throw new Error('Invalid combat status state.');
 return {characterId,effects:[],changedAtFrame:frame};
}
export function applyCombatStatusEffect(previous:CombatStatusState,effect:CombatStatusEffect,policy:'refresh'|'extend'|'replace'='refresh'):CombatStatusState{
 if(!effect.id.trim()||!Number.isInteger(effect.startedAtFrame)||!Number.isInteger(effect.endsAtFrame)||effect.startedAtFrame<previous.changedAtFrame||effect.endsAtFrame<effect.startedAtFrame||!Number.isFinite(effect.intensity)||effect.intensity<0)throw new Error('Invalid combat status effect.');
 const existing=previous.effects.find(e=>e.kind===effect.kind);
 let effects=previous.effects.filter(e=>e.endsAtFrame>=effect.startedAtFrame);
 if(!existing||policy==='replace')effects=effects.filter(e=>e.kind!==effect.kind).concat(effect);
 else if(policy==='extend')effects=effects.map(e=>e.kind===effect.kind?{...e,endsAtFrame:Math.max(e.endsAtFrame,effect.endsAtFrame),intensity:Math.max(e.intensity,effect.intensity)}:e);
 else effects=effects.map(e=>e.kind===effect.kind?{...effect,endsAtFrame:Math.max(e.endsAtFrame,effect.endsAtFrame)}:e);
 return {...previous,effects,changedAtFrame:effect.startedAtFrame};
}
export function stepCombatStatusEffects(previous:CombatStatusState,frame:number):CombatStatusState{
 if(!Number.isFinite(frame)||frame<previous.changedAtFrame)throw new Error('Combat status frame must be non-decreasing.');
 return {...previous,effects:previous.effects.filter(e=>frame<=e.endsAtFrame),changedAtFrame:frame};
}
