import type { CombatAnimationAction } from './combatAnimation';
export interface CombatAnimationTransition { from:CombatAnimationAction|'none'; to:CombatAnimationAction|'none'; blendFrames:number; interruptible:boolean; }
const DEFAULTS:Record<string,number>={attack:5,block:3,dodge:2,hit:1,recover:7,none:4};
export function createCombatAnimationTransition(from:CombatAnimationAction|'none',to:CombatAnimationAction|'none',overrides:Partial<Pick<CombatAnimationTransition,'blendFrames'|'interruptible'>>={}):CombatAnimationTransition{
 const blendFrames=overrides.blendFrames??DEFAULTS[to];
 if(!Number.isInteger(blendFrames)||blendFrames<0)throw new Error('Animation transition blend frames must be a non-negative integer.');
 const interruptible=overrides.interruptible??(from==='recover'||from==='block'||from==='none'||to==='hit'||to==='dodge');
 return {from,to,blendFrames,interruptible};
}
export function canInterruptCombatAnimation(current:CombatAnimationAction|'none',next:CombatAnimationAction):boolean{
 if(current==='none'||current==='recover'||current==='block')return true;
 if(next==='hit'||next==='dodge')return true;
 return false;
}
