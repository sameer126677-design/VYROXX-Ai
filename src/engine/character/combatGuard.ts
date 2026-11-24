import type { Vec3 } from '../core/types';

export interface CombatGuardState {
  characterId: string;
  active: boolean;
  facing: Vec3;
  stamina: number;
  maxStamina: number;
  parryStartedAtFrame: number;
  parryUntilFrame: number;
  guardBrokenUntilFrame: number;
  changedAtFrame: number;
}
export interface CombatGuardOptions {
  parryWindowFrames?: number;
  guardBreakFrames?: number;
}
const finiteVec=(v:Vec3)=>[v.x,v.y,v.z].every(Number.isFinite);
const normalize=(v:Vec3):Vec3=>{const n=Math.hypot(v.x,v.y,v.z);return n>1e-8?{x:v.x/n,y:v.y/n,z:v.z/n}:{x:0,y:0,z:1};};
export function createCombatGuardState(characterId:string,frame=0,stamina=100,maxStamina=100):CombatGuardState{
  if(!characterId.trim()||![frame,stamina,maxStamina].every(Number.isFinite)||frame<0||stamina<0||maxStamina<=0||stamina>maxStamina)throw new Error('Invalid combat guard state.');
  return {characterId,active:false,facing:{x:0,y:0,z:1},stamina,maxStamina,parryStartedAtFrame:frame,parryUntilFrame:frame-1,guardBrokenUntilFrame:frame,changedAtFrame:frame};
}
export function updateCombatGuard(previous:CombatGuardState,command:{active:boolean;facing:Vec3;frame:number;parryWindowFrames?:number;guardBreakFrames?:number}):CombatGuardState{
  const {frame,facing}=command;const parry=command.parryWindowFrames??5;const broken=command.guardBreakFrames??24;
  if(!Number.isFinite(frame)||frame<previous.changedAtFrame||!finiteVec(facing)||!Number.isInteger(parry)||parry<0||!Number.isInteger(broken)||broken<1)throw new Error('Invalid guard update.');
  const isBroken=frame<previous.guardBrokenUntilFrame;
  const rising=command.active&&!previous.active&&!isBroken;
  return {...previous,active:command.active&&!isBroken,facing:normalize(facing),parryStartedAtFrame:rising?frame:previous.parryStartedAtFrame,parryUntilFrame:rising?frame+parry:previous.parryUntilFrame,changedAtFrame:frame};
}
export function drainCombatGuard(previous:CombatGuardState,cost:number,frame:number,guardBreakFrames=24):CombatGuardState{
  if(![cost,frame].every(Number.isFinite)||cost<0||frame<previous.changedAtFrame||!Number.isInteger(guardBreakFrames)||guardBreakFrames<1)throw new Error('Invalid guard stamina drain.');
  const stamina=Math.max(0,previous.stamina-cost);const broken=stamina<=0&&previous.stamina>0;
  return {...previous,stamina,active:broken?false:previous.active,guardBrokenUntilFrame:broken?frame+guardBreakFrames:previous.guardBrokenUntilFrame,changedAtFrame:frame};
}
