export type CombatRangeBand='clinch'|'close'|'mid'|'long'|'out-of-range';
export interface CombatSpacingResult { distance:number; band:CombatRangeBand; preferredDistance:number; correction:number; canAttack:boolean; }
export interface CombatSpacingOptions { clinchDistance?:number; closeDistance?:number; midDistance?:number; preferredDistance?:number; attackReach?:number; }
export function evaluateCombatSpacing(distance:number,options:CombatSpacingOptions={}):CombatSpacingResult{
 const clinch=options.clinchDistance??0.55,close=options.closeDistance??1.5,mid=options.midDistance??3,preferred=options.preferredDistance??1.2,reach=options.attackReach??1.6;
 if(![distance,clinch,close,mid,preferred,reach].every(Number.isFinite)||distance<0||clinch<0||close<clinch||mid<close||preferred<0||reach<0)throw new Error('Invalid combat spacing values.');
 const band:CombatRangeBand=distance<=clinch?'clinch':distance<=close?'close':distance<=mid?'mid':distance<=reach?'long':'out-of-range';
 return {distance,band,preferredDistance:preferred,correction:distance-preferred,canAttack:distance<=reach};
}
