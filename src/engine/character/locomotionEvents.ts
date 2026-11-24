import type { GroundContactPlan } from './groundContact';

export interface FootstepEvent {
  side: 'left' | 'right';
  frame: number;
  intensity: number;
}
export interface FootstepEventState {
  rigId: string;
  previousLeftPhase: number | null;
  previousRightPhase: number | null;
  lastFrame: number | null;
}
export interface FootstepDetectionOptions {
  stanceRatio?: number;
  speed?: number;
  minimumSpeed?: number;
}
export interface FootstepDetectionResult {
  events: FootstepEvent[];
  state: FootstepEventState;
}

/** Creates caller-owned state for one-shot footstep event detection. */
export function createFootstepEventState(rigId: string): FootstepEventState {
  return { rigId, previousLeftPhase: null, previousRightPhase: null, lastFrame: null };
}

/**
 * Emits one event when a foot crosses from swing into stance. State must be
 * retained by the caller between sequential frames; replay after seeking.
 */
export function detectFootstepEvents(
  rigId: string,
  frame: number,
  plan: GroundContactPlan,
  previous: FootstepEventState,
  options: FootstepDetectionOptions = {}
): FootstepDetectionResult {
  if (previous.rigId !== rigId) throw new Error('Footstep state belongs to a different rig.');
  if (previous.lastFrame !== null && frame < previous.lastFrame) {
    throw new Error('Footstep event tracker requires non-decreasing frames; reset state before seeking backwards.');
  }
  const stance = Math.max(0.1, Math.min(0.9, options.stanceRatio ?? 0.62));
  const speed = Math.max(0, options.speed ?? 0);
  const minimumSpeed = Math.max(0, options.minimumSpeed ?? 0.12);
  const next: FootstepEventState = { ...previous };
  const events: FootstepEvent[] = [];
  for (const contact of plan.contacts) {
    const key = contact.side === 'left' ? 'previousLeftPhase' : 'previousRightPhase';
    const prior = previous[key];
    const enteredStance = prior !== null && prior >= stance && contact.phase < stance;
    if (enteredStance && speed >= minimumSpeed && contact.reachable) {
      events.push({ side: contact.side, frame, intensity: Math.max(0.15, Math.min(1, speed / 4)) });
    }
    next[key] = contact.phase;
  }
  next.lastFrame = frame;
  return { events, state: next };
}
