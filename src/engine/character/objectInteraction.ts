import type { InteractionHand } from './interaction';

export type InteractionObjectStatus = 'free' | 'held' | 'released';
export interface InteractionObjectState {
  objectId: string;
  status: InteractionObjectStatus;
  hand: InteractionHand | null;
  changedAtFrame: number;
}
export type InteractionObjectCommand =
  | { type: 'grab'; hand: InteractionHand; frame: number }
  | { type: 'release'; frame: number };

/** Creates serializable state for an interactable scene object. */
export function createInteractionObjectState(objectId: string): InteractionObjectState {
  if (!objectId.trim()) throw new Error('Interaction object needs a stable id.');
  return { objectId, status: 'free', hand: null, changedAtFrame: 0 };
}

/** Applies legal object ownership transitions; actual scene parenting is handled by the Three.js runtime bridge. */
export function transitionInteractionObject(
  previous: InteractionObjectState,
  command: InteractionObjectCommand
): InteractionObjectState {
  if (!Number.isFinite(command.frame) || command.frame < previous.changedAtFrame) {
    throw new Error('Interaction object commands require non-decreasing frame numbers.');
  }
  if (command.type === 'grab') {
    if (previous.status === 'held') {
      if (previous.hand === command.hand) return previous;
      throw new Error('Interaction object is already held by the other hand.');
    }
    return { ...previous, status: 'held', hand: command.hand, changedAtFrame: command.frame };
  }
  if (previous.status !== 'held') return { ...previous, status: 'released', hand: null, changedAtFrame: command.frame };
  return { ...previous, status: 'released', hand: null, changedAtFrame: command.frame };
}
