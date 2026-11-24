import type { Vec3 } from '../core/types';
import type { CharacterPose, CharacterRig } from './rig';
import { evaluateCharacterInteraction, type InteractionHand, type CharacterInteractionResult } from './interaction';

export type CharacterPairAction = 'handshake' | 'handover' | 'push' | 'pull';
export interface CharacterPairInteractionRequest {
  action: CharacterPairAction;
  firstRig: CharacterRig;
  firstPose: CharacterPose;
  secondRig: CharacterRig;
  secondPose: CharacterPose;
  firstHand: InteractionHand;
  secondHand: InteractionHand;
  firstHandTarget: Vec3;
  secondHandTarget: Vec3;
  contactPoint?: Vec3;
  weight?: number;
  reachTolerance?: number;
}
export interface CharacterPairInteractionResult {
  firstPose: CharacterPose;
  secondPose: CharacterPose;
  contactPoint: Vec3;
  first: CharacterInteractionResult;
  second: CharacterInteractionResult;
  bothReachable: boolean;
  contact: boolean;
}
const midpoint = (a: Vec3, b: Vec3): Vec3 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });

/** Coordinates two arm poses toward one shared world-space point; it does not simulate body collision or physical forces. */
export function evaluateCharacterPairInteraction(request: CharacterPairInteractionRequest): CharacterPairInteractionResult {
  if (request.firstRig.id === request.secondRig.id) throw new Error('Character pair interaction requires two distinct rigs.');
  if (request.firstPose.rigId !== request.firstRig.id || request.secondPose.rigId !== request.secondRig.id) throw new Error('Each pair pose must belong to its corresponding rig.');
  const point = request.contactPoint ?? midpoint(request.firstHandTarget, request.secondHandTarget);
  const firstAction = request.action === 'push' ? 'push' : request.action === 'pull' ? 'pull' : request.action === 'handover' ? 'grab' : 'reach';
  const first = evaluateCharacterInteraction(request.firstRig, request.firstPose, {
    hand: request.firstHand, action: firstAction, target: point, weight: request.weight, reachTolerance: request.reachTolerance
  });
  const second = evaluateCharacterInteraction(request.secondRig, request.secondPose, {
    hand: request.secondHand, action: 'reach', target: point, weight: request.weight, reachTolerance: request.reachTolerance
  });
  return { firstPose: first.pose, secondPose: second.pose, contactPoint: point, first, second,
    bothReachable: first.reachable && second.reachable, contact: first.contact && second.contact };
}

export type CharacterPairPhase = 'approach' | 'contact' | 'release' | 'complete';
export interface CharacterPairInteractionState { interactionId: string; phase: CharacterPairPhase; changedAtFrame: number; }
const phaseOrder: CharacterPairPhase[] = ['approach', 'contact', 'release', 'complete'];
export function createCharacterPairInteractionState(interactionId: string, frame = 0): CharacterPairInteractionState {
  if (!interactionId.trim() || !Number.isFinite(frame) || frame < 0) throw new Error('Pair interaction needs an id and a valid starting frame.');
  return { interactionId, phase: 'approach', changedAtFrame: frame };
}
export function transitionCharacterPairInteraction(previous: CharacterPairInteractionState, phase: CharacterPairPhase, frame: number): CharacterPairInteractionState {
  if (!Number.isFinite(frame) || frame < previous.changedAtFrame) throw new Error('Pair interaction frames must be non-decreasing.');
  const currentIndex = phaseOrder.indexOf(previous.phase), nextIndex = phaseOrder.indexOf(phase);
  if (nextIndex < currentIndex || nextIndex > currentIndex + 1) throw new Error(`Invalid pair interaction phase transition: ${previous.phase} -> ${phase}.`);
  if (nextIndex === currentIndex && frame === previous.changedAtFrame) return previous;
  return { ...previous, phase, changedAtFrame: frame };
}
