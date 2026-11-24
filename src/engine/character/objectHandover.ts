import type { InteractionHand } from './interaction';
import { transitionInteractionObject, type InteractionObjectState } from './objectInteraction';
import type { CharacterPairInteractionResult } from './pairInteraction';

export type CharacterObjectHandoverPhase = 'approach' | 'contact' | 'transferred' | 'complete';

export interface CharacterObjectHandoverState {
  objectId: string;
  sourceCharacterId: string;
  receiverCharacterId: string;
  sourceHand: InteractionHand;
  receiverHand: InteractionHand;
  phase: CharacterObjectHandoverPhase;
  changedAtFrame: number;
  objectState: InteractionObjectState;
}

export type CharacterObjectHandoverEvent =
  | { type: 'contact'; frame: number; interaction: CharacterPairInteractionResult }
  | { type: 'transfer'; frame: number; interaction: CharacterPairInteractionResult }
  | { type: 'complete'; frame: number };

/** Starts a handover only when the source character currently owns the object. */
export function createCharacterObjectHandoverState(
  sourceCharacterId: string,
  receiverCharacterId: string,
  sourceHand: InteractionHand,
  receiverHand: InteractionHand,
  objectState: InteractionObjectState,
  frame = objectState.changedAtFrame
): CharacterObjectHandoverState {
  if (!sourceCharacterId.trim() || !receiverCharacterId.trim() || sourceCharacterId === receiverCharacterId) {
    throw new Error('Object handover requires two distinct character ids.');
  }
  if (objectState.status !== 'held' || objectState.ownerCharacterId !== sourceCharacterId || objectState.hand !== sourceHand) {
    throw new Error('The source character must hold the object in the selected hand before handover.');
  }
  if (!Number.isFinite(frame) || frame < objectState.changedAtFrame) throw new Error('Handover must start at a valid non-decreasing frame.');
  return {
    objectId: objectState.objectId, sourceCharacterId, receiverCharacterId, sourceHand, receiverHand,
    phase: 'approach', changedAtFrame: frame, objectState
  };
}

/**
 * Advances the timeline-owned handover state. Ownership changes atomically at
 * the transfer phase: the source releases while the receiver becomes the holder.
 * Contact is geometric reach/contact from the coordinated character interaction,
 * not mesh collision or physical grasp simulation.
 */
export function transitionCharacterObjectHandover(
  previous: CharacterObjectHandoverState,
  event: CharacterObjectHandoverEvent
): CharacterObjectHandoverState {
  if (!Number.isFinite(event.frame) || event.frame < previous.changedAtFrame) {
    throw new Error('Handover frames must be finite and non-decreasing.');
  }

  if (event.type === 'contact') {
    if (previous.phase !== 'approach' && previous.phase !== 'contact') {
      throw new Error('Contact can only be entered or maintained before ownership transfer.');
    }
    if (!event.interaction.bothReachable || !event.interaction.contact) {
      throw new Error('Both characters must reach the shared contact point before handover contact is accepted.');
    }
    return { ...previous, phase: 'contact', changedAtFrame: event.frame };
  }

  if (event.type === 'transfer') {
    if (previous.phase !== 'contact') throw new Error('Object ownership can transfer only after confirmed contact.');
    if (!event.interaction.bothReachable || !event.interaction.contact) {
      throw new Error('Both characters must maintain contact at the moment of ownership transfer.');
    }
    const objectState = transitionInteractionObject(previous.objectState, {
      type: 'transfer', hand: previous.receiverHand, frame: event.frame, ownerCharacterId: previous.receiverCharacterId
    });
    return { ...previous, phase: 'transferred', changedAtFrame: event.frame, objectState };
  }

  if (previous.phase !== 'transferred') throw new Error('Handover can complete only after ownership has transferred.');
  return { ...previous, phase: 'complete', changedAtFrame: event.frame };
}
