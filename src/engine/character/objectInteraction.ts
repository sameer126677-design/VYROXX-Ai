import type { InteractionHand } from './interaction';

export type InteractionObjectStatus = 'free' | 'held' | 'released';
export interface InteractionObjectState {
  objectId: string;
  status: InteractionObjectStatus;
  hand: InteractionHand | null;
  ownerCharacterId: string | null;
  changedAtFrame: number;
}
export type InteractionObjectCommand =
  | { type: 'grab'; hand: InteractionHand; frame: number; ownerCharacterId?: string }
  | { type: 'release'; frame: number }
  | { type: 'transfer'; hand: InteractionHand; frame: number; ownerCharacterId: string };

export function createInteractionObjectState(objectId: string): InteractionObjectState {
  if (!objectId.trim()) throw new Error('Interaction object needs a stable id.');
  return { objectId, status: 'free', hand: null, ownerCharacterId: null, changedAtFrame: 0 };
}

/** Serializes object ownership transitions. Scene-graph parenting is performed by the runtime bridge. */
export function transitionInteractionObject(previous: InteractionObjectState, command: InteractionObjectCommand): InteractionObjectState {
  if (!Number.isFinite(command.frame) || command.frame < previous.changedAtFrame) throw new Error('Interaction object commands require non-decreasing frame numbers.');
  if (command.type === 'grab') {
    if (previous.status === 'held') {
      if (previous.hand === command.hand && (!command.ownerCharacterId || previous.ownerCharacterId === command.ownerCharacterId)) return previous;
      throw new Error('Interaction object is already held.');
    }
    return { ...previous, status: 'held', hand: command.hand, ownerCharacterId: command.ownerCharacterId ?? null, changedAtFrame: command.frame };
  }
  if (command.type === 'transfer') {
    if (previous.status !== 'held') throw new Error('Only a held object can be transferred.');
    if (!command.ownerCharacterId.trim()) throw new Error('Object transfer requires a destination character id.');
    if (previous.ownerCharacterId === command.ownerCharacterId && previous.hand === command.hand) return previous;
    return { ...previous, status: 'held', hand: command.hand, ownerCharacterId: command.ownerCharacterId, changedAtFrame: command.frame };
  }
  return { ...previous, status: 'released', hand: null, ownerCharacterId: null, changedAtFrame: command.frame };
}
