import type { Vec3 } from '../core/types';

export type CombatAction = 'idle' | 'attack' | 'block' | 'dodge' | 'stagger' | 'counter';
export type CombatPhase = 'startup' | 'active' | 'recovery' | 'complete';

export interface CombatMoveDefinition {
  id: string;
  action: Exclude<CombatAction, 'idle'>;
  durationFrames: number;
  startupFrames: number;
  activeFrames: number;
  recoveryFrames: number;
  reach: number;
  damage: number;
  staminaCost: number;
}

export interface CharacterCombatState {
  characterId: string;
  action: CombatAction;
  phase: CombatPhase;
  moveId: string | null;
  startedAtFrame: number;
  changedAtFrame: number;
  stamina: number;
  health: number;
  lastResolvedMoveId: string | null;
}

export interface CombatCommand {
  move: CombatMoveDefinition;
  frame: number;
  targetCharacterId?: string;
  targetDistance?: number;
  targetDirection?: Vec3;
}

export interface CombatTransition {
  state: CharacterCombatState;
  accepted: boolean;
  reason: string | null;
  phase: CombatPhase;
  hitWindow: boolean;
  canBeInterrupted: boolean;
  remainingFrames: number;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const finiteVec = (v: Vec3) => [v.x, v.y, v.z].every(Number.isFinite);

function validateMove(move: CombatMoveDefinition): void {
  if (!move.id.trim() || !Number.isInteger(move.durationFrames) || move.durationFrames < 1 ||
      !Number.isInteger(move.startupFrames) || !Number.isInteger(move.activeFrames) ||
      !Number.isInteger(move.recoveryFrames) || move.startupFrames < 0 ||
      move.activeFrames < 0 || move.recoveryFrames < 0 ||
      move.startupFrames + move.activeFrames + move.recoveryFrames !== move.durationFrames ||
      !Number.isFinite(move.reach) || move.reach < 0 ||
      !Number.isFinite(move.damage) || move.damage < 0 ||
      !Number.isFinite(move.staminaCost) || move.staminaCost < 0) {
    throw new Error('Combat move has invalid timing, reach, damage or stamina cost.');
  }
}

/** Creates an isolated combat state. Health and stamina are authored gameplay values. */
export function createCharacterCombatState(
  characterId: string,
  frame = 0,
  health = 100,
  stamina = 100
): CharacterCombatState {
  if (!characterId.trim() || !Number.isFinite(frame) || frame < 0 ||
      !Number.isFinite(health) || health < 0 || !Number.isFinite(stamina) || stamina < 0) {
    throw new Error('Combat state requires a character id and valid frame, health and stamina.');
  }
  return {
    characterId, action: 'idle', phase: 'complete', moveId: null,
    startedAtFrame: frame, changedAtFrame: frame,
    health, stamina, lastResolvedMoveId: null
  };
}

/** Starts a move when the character is free, sufficiently resourced and in range. */
export function startCharacterCombatMove(
  previous: CharacterCombatState,
  command: CombatCommand
): CombatTransition {
  const { move, frame } = command;
  validateMove(move);
  if (!Number.isFinite(frame) || frame < previous.changedAtFrame) {
    throw new Error('Combat command frame must be finite and non-decreasing.');
  }
  if (previous.phase !== 'complete') {
    return { state: previous, accepted: false, reason: 'Character is already committed to a combat action.',
      phase: previous.phase, hitWindow: previous.phase === 'active', canBeInterrupted: previous.phase === 'recovery', remainingFrames: Math.max(0, move.durationFrames - (frame - previous.startedAtFrame)) };
  }
  if (previous.stamina < move.staminaCost) {
    return { state: previous, accepted: false, reason: 'Not enough stamina.', phase: 'complete',
      hitWindow: false, canBeInterrupted: false, remainingFrames: 0 };
  }
  if (command.targetDistance !== undefined &&
      (!Number.isFinite(command.targetDistance) || command.targetDistance < 0 || command.targetDistance > move.reach)) {
    return { state: previous, accepted: false, reason: 'Target is outside this move reach.', phase: 'complete',
      hitWindow: false, canBeInterrupted: false, remainingFrames: 0 };
  }
  if (command.targetDirection && !finiteVec(command.targetDirection)) {
    throw new Error('Combat target direction must be finite.');
  }
  const state: CharacterCombatState = {
    ...previous, action: move.action, phase: move.startupFrames > 0 ? 'startup' : move.activeFrames > 0 ? 'active' : 'recovery',
    moveId: move.id, startedAtFrame: frame, changedAtFrame: frame,
    stamina: clamp(previous.stamina - move.staminaCost, 0, 100)
  };
  return { state, accepted: true, reason: null, phase: state.phase,
    hitWindow: state.phase === 'active', canBeInterrupted: false, remainingFrames: move.durationFrames };
}

/** Advances startup/active/recovery windows deterministically from the move's authored timing. */
export function stepCharacterCombat(
  previous: CharacterCombatState,
  move: CombatMoveDefinition,
  frame: number
): CombatTransition {
  validateMove(move);
  if (previous.moveId !== move.id) throw new Error('Combat move does not match the active combat state.');
  if (!Number.isFinite(frame) || frame < previous.changedAtFrame) {
    throw new Error('Combat frame must be finite and non-decreasing.');
  }
  const elapsed = Math.max(0, frame - previous.startedAtFrame);
  const total = move.durationFrames;
  const complete = elapsed >= total;
  const phase: CombatPhase = complete ? 'complete'
    : elapsed < move.startupFrames ? 'startup'
    : elapsed < move.startupFrames + move.activeFrames ? 'active' : 'recovery';
  const state: CharacterCombatState = complete
    ? { ...previous, action: 'idle', phase: 'complete', moveId: null, changedAtFrame: frame, lastResolvedMoveId: move.id }
    : { ...previous, phase, changedAtFrame: frame };
  return {
    state, accepted: true, reason: null, phase,
    hitWindow: phase === 'active',
    canBeInterrupted: phase === 'recovery',
    remainingFrames: Math.max(0, total - elapsed)
  };
}

/** Applies a gameplay-authored hit to health; this does not calculate hit detection. */
export function applyCharacterCombatDamage(
  previous: CharacterCombatState,
  damage: number,
  frame: number
): CharacterCombatState {
  if (!Number.isFinite(damage) || damage < 0 || !Number.isFinite(frame) || frame < previous.changedAtFrame) {
    throw new Error('Combat damage and frame must be finite and non-negative.');
  }
  return {
    ...previous, health: Math.max(0, previous.health - damage),
    action: damage > 0 ? 'stagger' : previous.action,
    phase: damage > 0 ? 'recovery' : previous.phase,
    moveId: damage > 0 ? null : previous.moveId,
    startedAtFrame: damage > 0 ? frame : previous.startedAtFrame,
    changedAtFrame: frame
  };
}

/** Allows authored recovery between actions without exceeding the stamina ceiling. */
export function recoverCharacterCombatStamina(
  previous: CharacterCombatState,
  amount: number,
  frame: number
): CharacterCombatState {
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(frame) || frame < previous.changedAtFrame) {
    throw new Error('Stamina recovery amount and frame must be finite and non-negative.');
  }
  return { ...previous, stamina: clamp(previous.stamina + amount, 0, 100), changedAtFrame: frame };
}
