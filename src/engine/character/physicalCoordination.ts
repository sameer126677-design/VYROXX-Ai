import type { Object3D } from 'three';
import type { Vec3 } from '../core/types';
import type { CharacterPose, CharacterRig } from './rig';
import { solveLimbIK3D, type LimbIK3DRequest, type IK3DResult } from './ik3d';

export type PhysicalCoordinationPhase = 'approach' | 'grip' | 'lift' | 'carry' | 'lower' | 'release' | 'complete';
export interface LoadTransform { position: Vec3; rotation: Vec3; }
export interface CharacterLoadShare { characterId: string; share: number; load: number; }
export interface PhysicalCoordinationState {
  interactionId: string;
  payloadId: string;
  firstCharacterId: string;
  secondCharacterId: string;
  phase: PhysicalCoordinationPhase;
  changedAtFrame: number;
  phaseStartedAtFrame: number;
  phaseDurationFrames: number;
  payloadMass: number;
  firstHandOffset: Vec3;
  secondHandOffset: Vec3;
  from: LoadTransform;
  to: LoadTransform;
}
export type PhysicalCoordinationEvent =
  | { type: 'grip'; frame: number; firstReachable: boolean; secondReachable: boolean; contact: boolean }
  | { type: 'lift'; frame: number }
  | { type: 'carry'; frame: number; target: LoadTransform; durationFrames?: number }
  | { type: 'lower'; frame: number; target: LoadTransform; durationFrames?: number }
  | { type: 'release'; frame: number }
  | { type: 'complete'; frame: number };

export interface PhysicalCoordinationRequest {
  firstRig: CharacterRig;
  firstPose: CharacterPose;
  secondRig: CharacterRig;
  secondPose: CharacterPose;
  firstArm: Omit<LimbIK3DRequest, 'target'>;
  secondArm: Omit<LimbIK3DRequest, 'target'>;
}
export interface PhysicalCoordinationResult {
  firstPose: CharacterPose;
  secondPose: CharacterPose;
  firstIK: IK3DResult;
  secondIK: IK3DResult;
  firstLoadShare: CharacterLoadShare;
  secondLoadShare: CharacterLoadShare;
  payloadTransform: LoadTransform;
  phase: PhysicalCoordinationPhase;
}

const phases: PhysicalCoordinationPhase[] = ['approach', 'grip', 'lift', 'carry', 'lower', 'release', 'complete'];
const copyVec = (v: Vec3): Vec3 => ({ x: v.x, y: v.y, z: v.z });
const copyTransform = (t: LoadTransform): LoadTransform => ({ position: copyVec(t.position), rotation: copyVec(t.rotation) });
const finiteVec = (v: Vec3): boolean => [v.x, v.y, v.z].every(Number.isFinite);
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const smooth = (t: number): number => { const x = clamp01(t); return x * x * (3 - 2 * x); };
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

function validateTransform(value: LoadTransform): void {
  if (!finiteVec(value.position) || !finiteVec(value.rotation)) throw new Error('Payload transform values must be finite.');
}

/** Creates caller-owned state for two characters coordinating one shared load. */
export function createPhysicalCoordinationState(input: {
  interactionId: string; payloadId: string; firstCharacterId: string; secondCharacterId: string;
  payloadMass: number; firstHandOffset: Vec3; secondHandOffset: Vec3;
  initialTransform: LoadTransform; targetTransform: LoadTransform; frame?: number; phaseDurationFrames?: number;
}): PhysicalCoordinationState {
  const frame = input.frame ?? 0, duration = input.phaseDurationFrames ?? 18;
  if (![input.interactionId, input.payloadId, input.firstCharacterId, input.secondCharacterId].every(v => v.trim())) {
    throw new Error('Physical coordination requires interaction, payload and character ids.');
  }
  if (input.firstCharacterId === input.secondCharacterId) throw new Error('Physical coordination requires two distinct characters.');
  if (!Number.isFinite(input.payloadMass) || input.payloadMass <= 0) throw new Error('Payload mass must be a positive finite value.');
  if (!Number.isFinite(frame) || frame < 0 || !Number.isInteger(duration) || duration < 1) throw new Error('Physical coordination frame and duration are invalid.');
  validateTransform(input.initialTransform); validateTransform(input.targetTransform);
  if (!finiteVec(input.firstHandOffset) || !finiteVec(input.secondHandOffset)) throw new Error('Hand attachment offsets must be finite.');
  return {
    interactionId: input.interactionId, payloadId: input.payloadId,
    firstCharacterId: input.firstCharacterId, secondCharacterId: input.secondCharacterId,
    phase: 'approach', changedAtFrame: frame, phaseStartedAtFrame: frame, phaseDurationFrames: duration,
    payloadMass: input.payloadMass, firstHandOffset: copyVec(input.firstHandOffset), secondHandOffset: copyVec(input.secondHandOffset),
    from: copyTransform(input.initialTransform), to: copyTransform(input.targetTransform),
  };
}

/** Enforces the lift/carry/lower/release order and requires a confirmed two-hand grip. */
export function transitionPhysicalCoordination(
  previous: PhysicalCoordinationState, event: PhysicalCoordinationEvent,
): PhysicalCoordinationState {
  if (!Number.isFinite(event.frame) || event.frame < previous.changedAtFrame) throw new Error('Physical coordination frames must be finite and non-decreasing.');
  const next = (phase: PhysicalCoordinationPhase, from = previous.from, to = previous.to, duration = previous.phaseDurationFrames): PhysicalCoordinationState => ({
    ...previous, phase, from: copyTransform(from), to: copyTransform(to),
    phaseStartedAtFrame: event.frame, changedAtFrame: event.frame, phaseDurationFrames: duration,
  });
  if (event.type === 'grip') {
    if (previous.phase !== 'approach') throw new Error('Grip can only be established during approach.');
    if (!event.firstReachable || !event.secondReachable || !event.contact) throw new Error('Both characters must reach and contact the shared payload before lifting.');
    return next('grip');
  }
  if (event.type === 'lift') {
    if (previous.phase !== 'grip') throw new Error('A shared load can lift only after both characters establish grip.');
    return next('lift');
  }
  if (event.type === 'carry') {
    if (previous.phase !== 'lift' && previous.phase !== 'carry') throw new Error('Carrying requires an established grip and lift.');
    validateTransform(event.target);
    const duration = event.durationFrames ?? previous.phaseDurationFrames;
    if (!Number.isInteger(duration) || duration < 1) throw new Error('Carry duration must be a positive whole number of frames.');
    return next('carry', samplePhysicalCoordinationTransform(previous, event.frame), event.target, duration);
  }
  if (event.type === 'lower') {
    if (previous.phase !== 'carry' && previous.phase !== 'lift') throw new Error('A shared load can lower only after lifting.');
    validateTransform(event.target);
    const duration = event.durationFrames ?? previous.phaseDurationFrames;
    if (!Number.isInteger(duration) || duration < 1) throw new Error('Lower duration must be a positive whole number of frames.');
    return next('lower', samplePhysicalCoordinationTransform(previous, event.frame), event.target, duration);
  }
  if (event.type === 'release') {
    if (previous.phase !== 'lower') throw new Error('Both characters can release the load only after lowering it.');
    if (event.frame < previous.phaseStartedAtFrame + previous.phaseDurationFrames) throw new Error('The lowering timeline must finish before release.');
    return next('release');
  }
  if (previous.phase !== 'release') throw new Error('Coordination can complete only after both characters release the load.');
  return next('complete');
}

/** Samples a deterministic shared payload transform for timeline playback or seeking. */
export function samplePhysicalCoordinationTransform(state: PhysicalCoordinationState, frame: number): LoadTransform {
  if (!Number.isFinite(frame) || frame < 0) throw new Error('Payload sample frame must be non-negative.');
  const animated = ['lift', 'carry', 'lower'].includes(state.phase);
  const raw = !animated ? (['release', 'complete'].includes(state.phase) ? 1 : 0)
    : (frame - state.phaseStartedAtFrame) / state.phaseDurationFrames;
  const t = smooth(raw);
  return {
    position: {
      x: mix(state.from.position.x, state.to.position.x, t),
      y: mix(state.from.position.y, state.to.position.y, t),
      z: mix(state.from.position.z, state.to.position.z, t),
    },
    rotation: {
      x: mix(state.from.rotation.x, state.to.rotation.x, t),
      y: mix(state.from.rotation.y, state.to.rotation.y, t),
      z: mix(state.from.rotation.z, state.to.rotation.z, t),
    },
  };
}

/** Splits payload weight using explicit positive support weights; defaults to an even share. */
export function calculateSharedLoadShares(
  state: PhysicalCoordinationState, firstSupportWeight = 1, secondSupportWeight = 1,
): [CharacterLoadShare, CharacterLoadShare] {
  if (![firstSupportWeight, secondSupportWeight].every(v => Number.isFinite(v) && v > 0)) {
    throw new Error('Character support weights must be positive finite values.');
  }
  const total = firstSupportWeight + secondSupportWeight;
  const firstShare = firstSupportWeight / total, secondShare = secondSupportWeight / total;
  return [
    { characterId: state.firstCharacterId, share: firstShare, load: state.payloadMass * firstShare },
    { characterId: state.secondCharacterId, share: secondShare, load: state.payloadMass * secondShare },
  ];
}

/** Solves both arm chains toward attachment points on the same sampled payload transform. */
export function evaluatePhysicalCoordination(request: PhysicalCoordinationRequest, state: PhysicalCoordinationState, frame: number): PhysicalCoordinationResult {
  if (request.firstRig.characterId !== state.firstCharacterId || request.secondRig.characterId !== state.secondCharacterId) {
    throw new Error('Physical coordination rigs do not match the character ids in state.');
  }
  if (request.firstPose.rigId !== request.firstRig.id || request.secondPose.rigId !== request.secondRig.id) {
    throw new Error('Each physical coordination pose must match its rig.');
  }
  const payloadTransform = samplePhysicalCoordinationTransform(state, frame);
  const firstTarget = { x: payloadTransform.position.x + state.firstHandOffset.x, y: payloadTransform.position.y + state.firstHandOffset.y, z: payloadTransform.position.z + state.firstHandOffset.z };
  const secondTarget = { x: payloadTransform.position.x + state.secondHandOffset.x, y: payloadTransform.position.y + state.secondHandOffset.y, z: payloadTransform.position.z + state.secondHandOffset.z };
  const first = solveLimbIK3D(request.firstRig, request.firstPose, { ...request.firstArm, target: firstTarget });
  const second = solveLimbIK3D(request.secondRig, request.secondPose, { ...request.secondArm, target: secondTarget });
  const [firstLoadShare, secondLoadShare] = calculateSharedLoadShares(state);
  return {
    firstPose: first.pose, secondPose: second.pose, firstIK: first.result, secondIK: second.result,
    firstLoadShare, secondLoadShare, payloadTransform, phase: state.phase,
  };
}

/** Applies the sampled payload transform to a Three.js object in its parent's local space. */
export function applySharedPayloadTransform(object: Object3D, state: PhysicalCoordinationState, frame: number): void {
  if (object.name && object.name !== state.payloadId && object.userData?.payloadId !== state.payloadId) {
    throw new Error('Payload object does not match the physical coordination state id.');
  }
  const transform = samplePhysicalCoordinationTransform(state, frame);
  object.position.set(transform.position.x, transform.position.y, transform.position.z);
  object.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
  object.updateMatrixWorld(true);
}
