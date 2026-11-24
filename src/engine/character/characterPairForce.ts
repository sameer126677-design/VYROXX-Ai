import type { Vec3 } from '../core/types';
import type { CharacterPhysicsState } from './collisionPhysics';
import type { CharacterPairInteractionResult } from './pairInteraction';

export interface CharacterPairForceState {
  interactionId: string;
  firstCharacterId: string;
  secondCharacterId: string;
  action: 'push' | 'pull' | 'release';
  direction: Vec3;
  magnitude: number;
  changedAtFrame: number;
  active: boolean;
}

export interface CharacterPairForceRequest {
  interactionId: string;
  action: 'push' | 'pull' | 'release';
  direction: Vec3;
  magnitude: number;
  firstMass: number;
  secondMass: number;
  deltaSeconds: number;
  frame: number;
}

export interface CharacterPairForceResult {
  state: CharacterPairForceState;
  firstState: CharacterPhysicsState;
  secondState: CharacterPhysicsState;
  firstForce: Vec3;
  secondForce: Vec3;
}

const EPS = 1e-8;
const finiteVec = (v: Vec3): boolean => [v.x, v.y, v.z].every(Number.isFinite);
const length = (v: Vec3): number => Math.hypot(v.x, v.y, v.z);
const scale = (v: Vec3, n: number): Vec3 => ({ x: v.x * n, y: v.y * n, z: v.z * n });
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

/** Creates a deterministic force state for one pair of distinct characters. */
export function createCharacterPairForceState(
  interactionId: string,
  firstCharacterId: string,
  secondCharacterId: string,
  frame = 0
): CharacterPairForceState {
  if (![interactionId, firstCharacterId, secondCharacterId].every(v => v.trim()) ||
      firstCharacterId === secondCharacterId || !Number.isFinite(frame) || frame < 0) {
    throw new Error('Pair force state requires an interaction id, two distinct characters and a valid frame.');
  }
  return {
    interactionId, firstCharacterId, secondCharacterId, action: 'release',
    direction: { x: 0, y: 0, z: 0 }, magnitude: 0, changedAtFrame: frame, active: false
  };
}

/**
 * Applies equal-and-opposite caller-authored forces over one frame interval.
 * Pair contact is accepted only when both hand IK targets are reachable and
 * the pair interaction reports contact; this is not body collision detection.
 */
export function applyCharacterPairForce(
  previous: CharacterPairForceState,
  firstPrevious: CharacterPhysicsState,
  secondPrevious: CharacterPhysicsState,
  request: CharacterPairForceRequest,
  interaction: CharacterPairInteractionResult
): CharacterPairForceResult {
  if (request.interactionId !== previous.interactionId ||
      firstPrevious.characterId !== previous.firstCharacterId ||
      secondPrevious.characterId !== previous.secondCharacterId ||
      interaction.first.pose.rigId === interaction.second.pose.rigId) {
    throw new Error('Pair force state, character states and interaction must refer to the same two characters.');
  }
  if (!Number.isFinite(request.frame) || request.frame < previous.changedAtFrame ||
      request.frame < firstPrevious.changedAtFrame || request.frame < secondPrevious.changedAtFrame) {
    throw new Error('Pair force frames must be finite and non-decreasing.');
  }
  if (!Number.isFinite(request.deltaSeconds) || request.deltaSeconds < 0 ||
      !Number.isFinite(request.magnitude) || request.magnitude < 0 || !finiteVec(request.direction)) {
    throw new Error('Pair force magnitude, direction and frame duration must be finite and non-negative.');
  }
  if (![request.firstMass, request.secondMass].every(m => Number.isFinite(m) && m > 0)) {
    throw new Error('Both character masses must be positive finite values.');
  }

  if (request.action === 'release') {
    const state: CharacterPairForceState = {
      ...previous, action: 'release', direction: { x: 0, y: 0, z: 0 },
      magnitude: 0, changedAtFrame: request.frame, active: false
    };
    return { state, firstState: firstPrevious, secondState: secondPrevious,
      firstForce: { x: 0, y: 0, z: 0 }, secondForce: { x: 0, y: 0, z: 0 } };
  }

  if (interaction.contact !== true || interaction.bothReachable !== true) {
    throw new Error('Character pair force requires both reachable hand targets and confirmed contact.');
  }
  if (interaction.first.action !== request.action) {
    throw new Error('Pair interaction push/pull action must match the force request.');
  }
  const magnitude = length(request.direction);
  if (magnitude <= EPS) throw new Error('Pair force direction must be a non-zero vector.');
  const direction = scale(request.direction, 1 / magnitude);
  const firstForce = scale(direction, request.magnitude);
  const secondForce = scale(firstForce, -1);
  const firstVelocity = add(firstPrevious.velocity, scale(firstForce, request.deltaSeconds / request.firstMass));
  const secondVelocity = add(secondPrevious.velocity, scale(secondForce, request.deltaSeconds / request.secondMass));
  const active = request.magnitude > 0 && request.deltaSeconds > 0;
  const state: CharacterPairForceState = {
    ...previous, action: request.action, direction, magnitude: request.magnitude,
    changedAtFrame: request.frame, active
  };
  return {
    state,
    firstState: { ...firstPrevious, velocity: firstVelocity, grounded: false, changedAtFrame: request.frame },
    secondState: { ...secondPrevious, velocity: secondVelocity, grounded: false, changedAtFrame: request.frame },
    firstForce, secondForce
  };
}
