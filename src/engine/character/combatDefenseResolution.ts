import type { Vec3 } from '../core/types';
import type { CombatGuardState } from './combatGuard';
import { drainCombatGuard } from './combatGuard';
import type { CombatHitContact } from './combatHitDetection';
export type CombatDefenseOutcome='hit'|'blocked'|'parried'|'guard-broken';
export interface CombatDefenseResult { outcome:CombatDefenseOutcome; guard:CombatGuardState; damage:number; staminaCost:number; attackerStaggerFrames:number; direction:Vec3; frame:number; }
const dot=(a:Vec3,b:Vec3)=>a.x*b.x+a.y*b.y+a.z*b.z;
const normalize=(v:Vec3):Vec3=>{const n=Math.hypot(v.x,v.y,v.z);return n>1e-8?{x:v.x/n,y:v.y/n,z:v.z/n}:{x:0,y:0,z:1};};
/** Resolves a contact against a front-facing guard; all costs and windows are authored inputs. */
export function resolveCombatDefense(contact:CombatHitContact,guard:CombatGuardState,options:{guardAngleDegrees?:number;blockStaminaCost?:number;parryStaminaCost?:number;chipDamageRatio?:number;parryStaggerFrames?:number;guardBreakFrames?:number}={}):CombatDefenseResult{
 if(contact.targetId!==guard.characterId)throw new Error('Contact target does not match guard owner.');
 const angle=options.guardAngleDegrees??110,blockCost=options.blockStaminaCost??12,parryCost=options.parryStaminaCost??8,chip=options.chipDamageRatio??0.05,stagger=options.parryStaggerFrames??18,breakFrames=options.guardBreakFrames??24;
 if(![angle,blockCost,parryCost,chip,stagger,breakFrames].every(Number.isFinite)||angle<0||angle>360||blockCost<0||parryCost<0||chip<0||chip>1||stagger<0||breakFrames<1)throw new Error('Invalid defense tuning.');
 const incoming=normalize(contact.normal);const facing=normalize(guard.facing);const front=dot(facing,incoming)<=-Math.cos(angle*Math.PI/360);
 const available=contact.frame>=guard.guardBrokenUntilFrame;
 if(!guard.active||!available||!front)return {outcome:available?'hit':'guard-broken',guard,damage:contact.damage,staminaCost:0,attackerStaggerFrames:0,direction:incoming,frame:contact.frame};
 const parry=contact.frame>=guard.parryStartedAtFrame&&contact.frame<=guard.parryUntilFrame&&guard.stamina>=parryCost;
 const cost=parry?parryCost:blockCost;
 const next=drainCombatGuard(guard,cost,contact.frame,breakFrames);
 const broken=next.guardBrokenUntilFrame>guard.guardBrokenUntilFrame;
 return {outcome:parry?'parried':broken?'guard-broken':'blocked',guard:next,damage:parry||broken?contact.damage:contact.damage*chip,staminaCost:cost,attackerStaggerFrames:parry?stagger:0,direction:incoming,frame:contact.frame};
}
