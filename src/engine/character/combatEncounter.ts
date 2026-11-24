import type { CombatGuardState } from './combatGuard';
import type { CombatStatusState } from './combatStatusEffects';
import type { CharacterCombatState } from './characterCombat';
export interface CombatEncounterState { characterId:string; combat:CharacterCombatState; guard:CombatGuardState; statuses:CombatStatusState; changedAtFrame:number; }
export function createCombatEncounterState(combat:CharacterCombatState,guard:CombatGuardState,statuses:CombatStatusState):CombatEncounterState{
 if(!combat.characterId||combat.characterId!==guard.characterId||combat.characterId!==statuses.characterId||combat.changedAtFrame!==guard.changedAtFrame||combat.changedAtFrame!==statuses.changedAtFrame)throw new Error('Encounter components must belong to the same character and frame.');
 return {characterId:combat.characterId,combat,guard,statuses,changedAtFrame:combat.changedAtFrame};
}
export function updateCombatEncounter(previous:CombatEncounterState,combat:CharacterCombatState,guard:CombatGuardState,statuses:CombatStatusState,frame:number):CombatEncounterState{
 if(combat.characterId!==previous.characterId||guard.characterId!==previous.characterId||statuses.characterId!==previous.characterId||![combat.changedAtFrame,guard.changedAtFrame,statuses.changedAtFrame,frame].every(Number.isFinite)||frame<previous.changedAtFrame||combat.changedAtFrame>frame||guard.changedAtFrame>frame||statuses.changedAtFrame>frame)throw new Error('Encounter update has mismatched character or frame.');
 return {characterId:previous.characterId,combat,guard,statuses,changedAtFrame:frame};
}
