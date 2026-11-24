import type { Vec3 } from '../core/types';
import type { CharacterPose, CharacterRig } from './rig';
import { blendCharacterPoses } from './animation';
import { solveLimbIK3D, type IK3DResult, type LimbIK3DRequest } from './ik3d';

export type InteractionHand = 'left' | 'right';
export type CharacterInteractionAction = 'reach' | 'grab' | 'push' | 'pull' | 'release';
export type InteractionHandGesture = 'relaxed' | 'open' | 'fist' | 'point';
export interface CharacterInteractionRequest {
  hand: InteractionHand; action: CharacterInteractionAction; target: Vec3;
  pole?: Vec3; weight?: number; targetOffset?: Vec3; reachTolerance?: number;
}
export interface CharacterInteractionResult {
  pose: CharacterPose; action: CharacterInteractionAction; hand: InteractionHand;
  gesture: InteractionHandGesture; target: Vec3; reachable: boolean; contact: boolean; ik: IK3DResult | null;
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

/** Directs a hand toward a world-space point. Contact is geometric proximity, not mesh collision or physical grasp simulation. */
export function evaluateCharacterInteraction(rig: CharacterRig, pose: CharacterPose, request: CharacterInteractionRequest): CharacterInteractionResult {
  if (pose.rigId !== rig.id) throw new Error('Interaction pose belongs to a different rig.');
  const target = add(request.target, request.targetOffset ?? { x: 0, y: 0, z: 0 });
  const gesture: InteractionHandGesture = request.action === 'push' ? 'open'
    : request.action === 'grab' || request.action === 'pull' ? 'fist'
    : request.action === 'reach' ? 'point' : 'relaxed';
  if (request.action === 'release') return { pose, action: request.action, hand: request.hand, gesture, target, reachable: true, contact: false, ik: null };
  const prefix = request.hand === 'left' ? 'left' : 'right';
  const ikRequest: LimbIK3DRequest = {
    rootJointId: prefix + '_shoulder', middleJointId: prefix + '_elbow', endJointId: prefix + '_wrist',
    target, pole: request.pole ?? { x: target.x, y: target.y, z: target.z + (request.hand === 'left' ? -0.35 : 0.35) }
  };
  const solved = solveLimbIK3D(rig, pose, ikRequest);
  const weight = clamp(request.weight ?? 1, 0, 1);
  const blended = weight >= 1 ? solved.pose : blendCharacterPoses(pose, solved.pose, weight);
  const end = solved.result.end;
  const distance = Math.hypot(end.x - target.x, end.y - target.y, end.z - target.z);
  const tolerance = Math.max(0.005, request.reachTolerance ?? 0.08);
  const reachable = solved.result.reachable;
  return { pose: blended, action: request.action, hand: request.hand, gesture, target, reachable,
    contact: reachable && distance <= tolerance && weight >= 0.5, ik: solved.result };
}
