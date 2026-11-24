import type { CombatAction } from './characterCombat';

export interface CombatComboStep {
  action: Exclude<CombatAction,'idle'|'stagger'>;
  moveId: string;
  input: string;
  windowStartFrames: number;
  windowEndFrames: number;
}

export interface CombatComboDefinition {
  id: string;
  steps: CombatComboStep[];
  maxGapFrames: number;
}

export interface CombatComboState {
  comboId: string | null;
  nextStepIndex: number;
  lastInputFrame: number;
  completed: boolean;
  acceptedInputs: string[];
}

export interface CombatComboResult {
  state: CombatComboState;
  accepted: boolean;
  completed: boolean;
  nextMoveId: string | null;
  reason: string | null;
}

/** Creates an empty state for a reusable authored combo definition. */
export function createCombatComboState(): CombatComboState {
  return { comboId:null, nextStepIndex:0, lastInputFrame:-1, completed:false, acceptedInputs:[] };
}

/** Accepts one ordered input inside its authored frame window. */
export function advanceCombatCombo(
  definition: CombatComboDefinition,
  previous: CombatComboState,
  input: string,
  frame: number
): CombatComboResult {
  if (!definition.id.trim() || !definition.steps.length ||
      !Number.isInteger(definition.maxGapFrames) || definition.maxGapFrames < 0 ||
      !Number.isFinite(frame) || frame < 0 || !input.trim()) {
    throw new Error('Combo definition or input is invalid.');
  }
  definition.steps.forEach(step => {
    if (!step.moveId.trim() || !step.input.trim() ||
        !Number.isInteger(step.windowStartFrames) || !Number.isInteger(step.windowEndFrames) ||
        step.windowStartFrames < 0 || step.windowEndFrames < step.windowStartFrames) {
      throw new Error('Combo step has invalid move, input or frame window.');
    }
  });
  if (previous.lastInputFrame >= 0 && frame < previous.lastInputFrame) {
    throw new Error('Combo input frames must be non-decreasing.');
  }
  let index = previous.comboId === definition.id ? previous.nextStepIndex : 0;
  const expired = previous.lastInputFrame >= 0 && frame - previous.lastInputFrame > definition.maxGapFrames;
  if (expired || previous.completed) index = 0;
  const step = definition.steps[index];
  const elapsed = previous.lastInputFrame < 0 || previous.comboId !== definition.id ? 0 : frame - previous.lastInputFrame;
  if (input !== step.input || (index > 0 && (elapsed < step.windowStartFrames || elapsed > step.windowEndFrames))) {
    const reset = createCombatComboState();
    return { state: { ...reset, comboId:definition.id, lastInputFrame:frame }, accepted:false,
      completed:false, nextMoveId:null, reason:'Input did not match the next combo step or its timing window.' };
  }
  const nextIndex = index + 1;
  const completed = nextIndex >= definition.steps.length;
  const state: CombatComboState = {
    comboId: definition.id, nextStepIndex: completed ? 0 : nextIndex,
    lastInputFrame: frame, completed, acceptedInputs: [...(index === 0 ? [] : previous.acceptedInputs),input]
  };
  return { state, accepted:true, completed, nextMoveId:completed ? null : definition.steps[nextIndex].moveId, reason:null };
}
