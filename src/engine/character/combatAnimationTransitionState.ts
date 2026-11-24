import type { CombatAnimationAction } from './combatAnimation';
import { createCombatAnimationTransition, canInterruptCombatAnimation, type CombatAnimationTransition } from './combatAnimationTransitions';
export interface CombatAnimationTransitionState { current:CombatAnimationAction|'none'; previous:CombatAnimationAction|'none'; startedAtFrame:number; transition:CombatAnimationTransition; }
export function createCombatAnimationTransitionState(frame=0):CombatAnimationTransitionState{
 if(!Number.isFinite(frame)||frame<0)throw new Error('Invalid animation transition frame.');
 return {current:'none',previous:'none',startedAtFrame:frame,transition:createCombatAnimationTransition('none','none')};
}
export function transitionCombatAnimation(previous:CombatAnimationTransitionState,next:CombatAnimationAction,frame:number,blendFrames?:number):CombatAnimationTransitionState{
 if(!Number.isFinite(frame)||frame<previous.startedAtFrame)throw new Error('Animation transition frames must be non-decreasing.');
 if(previous.current===next)return previous;
 if(!canInterruptCombatAnimation(previous.current,next))return previous;
 const transition=createCombatAnimationTransition(previous.current,next,{blendFrames,interruptible:true});
 return {current:next,previous:previous.current,startedAtFrame:frame,transition};
}
export function sampleCombatAnimationTransition(previous:CombatAnimationTransitionState,frame:number):{weight:number;complete:boolean}{
 if(!Number.isFinite(frame)||frame<previous.startedAtFrame)throw new Error('Invalid animation transition sample frame.');
 const duration=Math.max(1,previous.transition.blendFrames),p=Math.max(0,Math.min(1,(frame-previous.startedAtFrame)/duration));
 return {weight:p,complete:p>=1};
}
