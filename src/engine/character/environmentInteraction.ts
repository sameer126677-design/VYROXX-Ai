import type { Object3D } from 'three';
import type { Vec3 } from '../core/types';

export type EnvironmentInteractableKind = 'door' | 'drawer' | 'switch' | 'button' | 'movable';
export type EnvironmentInteractionAction = 'open' | 'close' | 'toggle' | 'press' | 'push' | 'pull' | 'move';
export type EnvironmentInteractionPhase = 'idle' | 'contact' | 'active' | 'complete';

export interface EnvironmentObjectTransform {
  position: Vec3;
  rotation: Vec3;
}

export interface EnvironmentInteractionState {
  objectId: string;
  kind: EnvironmentInteractableKind;
  action: EnvironmentInteractionAction;
  phase: EnvironmentInteractionPhase;
  changedAtFrame: number;
  activeAtFrame: number | null;
  durationFrames: number;
  from: EnvironmentObjectTransform;
  to: EnvironmentObjectTransform;
}

export type EnvironmentInteractionEvent =
  | { type: 'contact'; frame: number; result: { reachable: boolean; contact: boolean } }
  | { type: 'activate'; frame: number }
  | { type: 'complete'; frame: number }
  | { type: 'reset'; frame: number };

const allowedActions: Record<EnvironmentInteractableKind, EnvironmentInteractionAction[]> = {
  door: ['open', 'close', 'toggle'],
  drawer: ['open', 'close'],
  switch: ['toggle', 'press'],
  button: ['press'],
  movable: ['push', 'pull', 'move'],
};

const cloneTransform = (value: EnvironmentObjectTransform): EnvironmentObjectTransform => ({
  position: { ...value.position },
  rotation: { ...value.rotation },
});

function validateTransform(value: EnvironmentObjectTransform, label: string): void {
  for (const axis of ['x', 'y', 'z'] as const) {
    if (!Number.isFinite(value.position[axis]) || !Number.isFinite(value.rotation[axis])) {
      throw new Error(`Environment ${label} transform contains a non-finite ${axis} value.`);
    }
  }
}

/** Creates a timeline-owned interaction state for a scene prop using local-space transforms. */
export function createEnvironmentInteractionState(
  objectId: string,
  kind: EnvironmentInteractableKind,
  action: EnvironmentInteractionAction,
  from: EnvironmentObjectTransform,
  to: EnvironmentObjectTransform,
  durationFrames = 18,
  frame = 0,
): EnvironmentInteractionState {
  if (!objectId.trim()) throw new Error('Environment interactable needs a stable object id.');
  if (!allowedActions[kind].includes(action)) throw new Error(`Action "${action}" is not supported for environment kind "${kind}".`);
  if (!Number.isInteger(durationFrames) || durationFrames < 1) throw new Error('Environment interaction duration must be a positive whole number of frames.');
  if (!Number.isFinite(frame) || frame < 0) throw new Error('Environment interaction start frame must be non-negative.');
  validateTransform(from, 'source');
  validateTransform(to, 'target');
  return {
    objectId, kind, action, phase: 'idle', changedAtFrame: frame, activeAtFrame: null,
    durationFrames, from: cloneTransform(from), to: cloneTransform(to),
  };
}

/** Requires confirmed character reach/contact before a prop can be activated. */
export function transitionEnvironmentInteraction(
  previous: EnvironmentInteractionState,
  event: EnvironmentInteractionEvent,
): EnvironmentInteractionState {
  if (!Number.isFinite(event.frame) || event.frame < previous.changedAtFrame) {
    throw new Error('Environment interaction frames must be finite and non-decreasing.');
  }

  if (event.type === 'contact') {
    if (previous.phase !== 'idle' && previous.phase !== 'contact') {
      throw new Error('Environment contact can only be established before activation.');
    }
    if (!event.result.reachable || !event.result.contact) {
      throw new Error('Character must reach and contact the environment interaction point first.');
    }
    return { ...previous, phase: 'contact', changedAtFrame: event.frame };
  }

  if (event.type === 'activate') {
    if (previous.phase !== 'contact') throw new Error('Environment prop can activate only after confirmed contact.');
    return { ...previous, phase: 'active', activeAtFrame: event.frame, changedAtFrame: event.frame };
  }

  if (event.type === 'complete') {
    if (previous.phase !== 'active' || previous.activeAtFrame === null) {
      throw new Error('Only an active environment interaction can complete.');
    }
    if (event.frame < previous.activeAtFrame + previous.durationFrames) {
      throw new Error('Environment interaction cannot complete before its timeline duration elapses.');
    }
    return { ...previous, phase: 'complete', changedAtFrame: event.frame };
  }

  return {
    ...previous, phase: 'idle', activeAtFrame: null, changedAtFrame: event.frame,
  };
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const easeInOut = (t: number): number => t * t * (3 - 2 * t);

/** Samples a deterministic local-space prop transform for any timeline frame. */
export function sampleEnvironmentInteraction(
  state: EnvironmentInteractionState,
  frame: number,
): EnvironmentObjectTransform {
  if (!Number.isFinite(frame) || frame < 0) throw new Error('Environment sample frame must be non-negative.');
  const raw = state.phase === 'complete' ? 1
    : state.phase !== 'active' || state.activeAtFrame === null ? 0
    : Math.max(0, Math.min(1, (frame - state.activeAtFrame) / state.durationFrames));
  const t = easeInOut(raw);
  return {
    position: {
      x: lerp(state.from.position.x, state.to.position.x, t),
      y: lerp(state.from.position.y, state.to.position.y, t),
      z: lerp(state.from.position.z, state.to.position.z, t),
    },
    rotation: {
      x: lerp(state.from.rotation.x, state.to.rotation.x, t),
      y: lerp(state.from.rotation.y, state.to.rotation.y, t),
      z: lerp(state.from.rotation.z, state.to.rotation.z, t),
    },
  };
}

/** Applies the sampled local transform; collision, constraints and force simulation are intentionally out of scope. */
export function applyEnvironmentInteractionTransform(
  object: Object3D,
  state: EnvironmentInteractionState,
  frame: number,
): void {
  if (object.name && object.name !== state.objectId && object.userData?.interactionId !== state.objectId) {
    throw new Error('Environment object does not match the interaction state id.');
  }
  const transform = sampleEnvironmentInteraction(state, frame);
  object.position.set(transform.position.x, transform.position.y, transform.position.z);
  object.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
  object.updateMatrixWorld(true);
}
