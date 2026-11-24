import type { Vec3 } from '../core/types';
import type { CharacterInteractionResult } from './interaction';
import type { DynamicBodyDefinition, DynamicBodyState } from './dynamicObjectPhysics';

export type CharacterObjectForceAction = 'push' | 'pull' | 'release';

export interface CharacterObjectForceState {
  characterId: string;
  objectId: string;
  hand: 'left' | 'right';
  action: CharacterObjectForceAction;
  direction: Vec3;
  magnitude: number;
  active: boolean;
  changedAtFrame: number;
}

export interface CharacterObjectForceRequest {
  characterId: string;
  objectId: string;
  hand: 'left' | 'right';
  action: CharacterObjectForceAction;
  direction: Vec3;
  magnitude: number;
  frame: number;
  contactRequired?: boolean;
}

export interface CharacterObjectForceResult {
  state: CharacterObjectForceState;
  bodyState: DynamicBodyState;
  appliedForce: Vec3;
}

const EPS = 1e-8;
const finiteVec = (v: Vec3): boolean => [v.x, v.y, v.z].every(Number.isFinite);
const length = (v: Vec3): number => Math.hypot(v.x, v.y, v.z);
const scale = (v: Vec3, n: number): Vec3 => ({ x: v.x * n, y: v.y * n, z: v.z * n });
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

/** Creates deterministic, caller-owned state for a character applying force to an object. */
export function createCharacterObjectForceState(
  characterId: string,
  objectId: string,
  hand: 'left' | 'right',
  frame = 0
): CharacterObjectForceState {
  if (!characterId.trim() || !objectId.trim() || !Number.isFinite(frame) || frame < 0) {
    throw new Error('Character-object force state requires ids and a non-negative frame.');
  }
  return {
    characterId, objectId, hand, action: 'release',
    direction: { x: 0, y: 0, z: 0 }, magnitude: 0,
    active: false, changedAtFrame: frame
  };
}

/**
 * Applies a caller-defined world-space force when the selected hand interaction
 * reports contact. Direction and magnitude are authored inputs, not inferred
 * physical measurements. The dynamic physics step consumes bodyState.force.
 */
export function applyCharacterObjectForce(
  definition: DynamicBodyDefinition,
  bodyState: DynamicBodyState,
  previous: CharacterObjectForceState,
  request: CharacterObjectForceRequest,
  interaction: CharacterInteractionResult
): CharacterObjectForceResult {
  if (definition.id !== request.objectId || bodyState.id !== request.objectId || previous.objectId !== request.objectId) {
    throw new Error('Character force request, body definition and body state must reference the same object.');
  }
  if (previous.characterId !== request.characterId || previous.hand !== request.hand || interaction.hand !== request.hand) {
    throw new Error('Character force state and interaction must reference the same character hand.');
  }
  if (definition.isStatic) throw new Error('A character cannot apply dynamic force to a static body.');
  if (!Number.isFinite(request.frame) || request.frame < previous.changedAtFrame) {
    throw new Error('Character-object force frames must be finite and non-decreasing.');
  }
  if (!Number.isFinite(request.magnitude) || request.magnitude < 0 || !finiteVec(request.direction)) {
    throw new Error('Force magnitude and direction must be finite; magnitude cannot be negative.');
  }
  if (interaction.action !== request.action && request.action !== 'release') {
    throw new Error('Interaction action must match the requested push or pull action.');
  }
  if (interaction.action !== 'release' && interaction.hand !== request.hand) {
    throw new Error('Interaction hand does not match the force request.');
  }

  if (request.action === 'release') {
    const state: CharacterObjectForceState = {
      ...previous, action: 'release', direction: { x: 0, y: 0, z: 0 },
      magnitude: 0, active: false, changedAtFrame: request.frame
    };
    return { state, bodyState, appliedForce: { x: 0, y: 0, z: 0 } };
  }

  const directionLength = length(request.direction);
  if (directionLength <= EPS) throw new Error('Push/pull direction must be a non-zero vector.');
  const contactRequired = request.contactRequired ?? true;
  if (contactRequired && (!interaction.reachable || !interaction.contact)) {
    throw new Error('Push/pull force requires a reachable hand with confirmed interaction contact.');
  }
  const direction = scale(request.direction, 1 / directionLength);
  const appliedForce = scale(direction, request.magnitude);
  const state: CharacterObjectForceState = {
    characterId: request.characterId, objectId: request.objectId, hand: request.hand,
    action: request.action, direction, magnitude: request.magnitude,
    active: request.magnitude > 0, changedAtFrame: request.frame
  };
  const nextBody: DynamicBodyState = state.active
    ? { ...bodyState, force: add(bodyState.force, appliedForce), sleeping: false }
    : bodyState;
  return { state, bodyState: nextBody, appliedForce };
}
