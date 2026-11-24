export type PlayerCombatBehaviorEvent='attack'|'block'|'dodge'|'retreat'|'approach';
export interface PlayerCombatBehaviorProfile { attacks:number; blocks:number; dodges:number; retreats:number; approaches:number; lastEventFrame:number; samples:number; }
export interface PlayerCombatBehaviorSummary { aggression:number; defense:number; evasion:number; retreatTendency:number; preferredStyle:'aggressive'|'defensive'|'evasive'|'balanced'; }
export function createPlayerCombatBehaviorProfile(frame=0):PlayerCombatBehaviorProfile{
 if(!Number.isFinite(frame)||frame<0)throw new Error('Invalid player behavior frame.');
 return {attacks:0,blocks:0,dodges:0,retreats:0,approaches:0,lastEventFrame:frame,samples:0};
}
export function recordPlayerCombatBehavior(previous:PlayerCombatBehaviorProfile,event:PlayerCombatBehaviorEvent,frame:number):PlayerCombatBehaviorProfile{
 if(!Number.isFinite(frame)||frame<previous.lastEventFrame)throw new Error('Player behavior frames must be non-decreasing.');
 return {...previous,[event==='attack'?'attacks':event==='block'?'blocks':event==='dodge'?'dodges':event==='retreat'?'retreats':'approaches']:previous[event==='attack'?'attacks':event==='block'?'blocks':event==='dodge'?'dodges':event==='retreat'?'retreats':'approaches']+1,lastEventFrame:frame,samples:previous.samples+1};
}
export function summarizePlayerCombatBehavior(p:PlayerCombatBehaviorProfile):PlayerCombatBehaviorSummary{
 const total=Math.max(1,p.samples),aggression=(p.attacks+p.approaches)/total,defense=p.blocks/total,evasion=p.dodges/total,retreatTendency=p.retreats/total;
 const max=Math.max(aggression,defense,evasion);
 const preferredStyle=max<0.4?'balanced':max===aggression?'aggressive':max===defense?'defensive':'evasive';
 return {aggression,defense,evasion,retreatTendency,preferredStyle};
}
