import type { CharacterPose, CharacterRig, JointPose } from './rig';
import { solveTwoBoneIK2D } from './rig';

export interface GroundSurface {
  heightAt(x: number, z: number): number;
  normalAt?(x: number, z: number): { x: number; y: number; z: number };
}
export interface FootIKOptions {
  groundSurface?: GroundSurface;
  rootPosition?: { x: number; y: number; z: number };
  rootVelocity?: { x: number; z: number };
  terrainAlign?: boolean;
  ankleAlignWeight?: number;
  groundHeight?: number;
  strideLength?: number;
  footLift?: number;
  stanceRatio?: number;
  rightPhaseOffset?: number;
  leftBendDirection?: 1 | -1;
  rightBendDirection?: 1 | -1;
}
export interface FootContact {
  side: 'left' | 'right';
  phase: number;
  planted: boolean;
  weight: number;
  target: { x: number; y: number };
  reachable: boolean;
  worldTarget?: { x: number; y: number; z: number };
  groundNormal?: { x: number; y: number; z: number };
  groundAngle?: number;
}
export interface FootContactPlan { frame: number; contacts: [FootContact, FootContact]; }

const TAU = Math.PI * 2;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const wrap = (v: number) => ((v % TAU) + TAU) % TAU;

/** Produces repeatable planted/swing foot targets in root-local XY coordinates. */
export function evaluateFootContactPlan(rig: CharacterRig, frame: number, fps: number, options: FootIKOptions = {}): FootContactPlan {
  const ground = options.groundHeight ?? 0;
  const root = options.rootPosition ?? { x: 0, y: 0, z: 0 };
  const velocity = options.rootVelocity ?? { x: 0, z: 0 };
  const stride = Math.max(0, options.strideLength ?? 0.34);
  const lift = Math.max(0, options.footLift ?? 0.12);
  const stance = clamp(options.stanceRatio ?? 0.62, 0.1, 0.9);
  const phase = wrap(Math.max(0, frame) / Math.max(1, fps) * TAU * 1.5);
  const make = (side: 'left' | 'right', value: number): FootContact => {
    const p = wrap(value) / TAU;
    const planted = p < stance;
    const progress = planted ? p / stance : (p - stance) / (1 - stance);
    const elapsedStance = p / 1.5;
    const x = planted ? stride * 0.5 - velocity.x * elapsedStance : stride * (-0.5 + progress);
    const worldX = root.x + x;
    const worldZ = root.z;
    const terrainY = options.groundSurface?.heightAt(worldX, worldZ) ?? ground;
    const y = terrainY - root.y + (planted ? 0 : Math.sin(progress * Math.PI) * lift);
    const rawNormal = options.groundSurface?.normalAt?.(worldX, worldZ) ?? { x: 0, y: 1, z: 0 };
    const normalLength = Math.hypot(rawNormal.x, rawNormal.y, rawNormal.z) || 1;
    const groundNormal = { x: rawNormal.x / normalLength, y: rawNormal.y / normalLength, z: rawNormal.z / normalLength };
    const groundAngle = options.terrainAlign === false ? 0 : Math.atan2(-groundNormal.x, Math.max(0.0001, groundNormal.y));
    const hip = rig.joints.find(j => j.id === side + '_hip');
    const knee = rig.joints.find(j => j.id === side + '_knee');
    const ankle = rig.joints.find(j => j.id === side + '_ankle');
    const reach = (knee?.length ?? 0) + (ankle?.length ?? 0);
    return { side, phase: p, planted, weight: planted ? 1 : 0.35, target: { x, y },
      reachable: !!hip && !!knee && !!ankle && Math.hypot(x - hip.bindPosition.x, y - hip.bindPosition.y) <= reach + 0.001 };
  };
  return { frame, contacts: [make('left', phase), make('right', phase + (options.rightPhaseOffset ?? Math.PI))] };
}

function requiredJoint(rig: CharacterRig, id: string) {
  const joint = rig.joints.find(item => item.id === id);
  if (!joint) throw new Error(`Foot IK requires rig joint "${id}".`);
  return joint;
}

/** Applies two-bone planar IK and writes hip/knee Z rotations into a copied pose. */
export function applyFootIKToPose(rig: CharacterRig, pose: CharacterPose, plan: FootContactPlan, options: FootIKOptions = {}): CharacterPose {
  if (pose.rigId !== rig.id) throw new Error('Foot IK pose belongs to a different rig.');
  const joints = new Map<string, JointPose>(pose.joints.map(item => [item.jointId, {
    ...item, rotation: { ...item.rotation }, position: item.position ? { ...item.position } : undefined
  }]));
  for (const contact of plan.contacts) {
    const hip = requiredJoint(rig, contact.side + '_hip');
    const knee = requiredJoint(rig, contact.side + '_knee');
    const ankle = requiredJoint(rig, contact.side + '_ankle');
    const upper = Math.max(0.0001, Math.hypot(knee.bindPosition.x, knee.bindPosition.y));
    const lower = Math.max(0.0001, Math.hypot(ankle.bindPosition.x, ankle.bindPosition.y));
    const bend = contact.side === 'left' ? (options.leftBendDirection ?? 1) : (options.rightBendDirection ?? -1);
    const solved = solveTwoBoneIK2D({ x: hip.bindPosition.x, y: hip.bindPosition.y }, contact.target, upper, lower, bend);
    const baseUpper = Math.atan2(knee.bindPosition.y, knee.bindPosition.x);
    const baseLower = Math.atan2(ankle.bindPosition.y, ankle.bindPosition.x);
    const upperAngle = Math.atan2(solved.middle.y - solved.root.y, solved.middle.x - solved.root.x);
    const lowerAngle = Math.atan2(solved.end.y - solved.middle.y, solved.end.x - solved.middle.x);
    const hp = joints.get(hip.id) ?? { jointId: hip.id, rotation: { ...hip.bindRotation } };
    const kp = joints.get(knee.id) ?? { jointId: knee.id, rotation: { ...knee.bindRotation } };
    hp.rotation = { ...hp.rotation, z: upperAngle - baseUpper };
    kp.rotation = { ...kp.rotation, z: lowerAngle - upperAngle - baseLower };
    joints.set(hip.id, hp); joints.set(knee.id, kp);
  }
  return { ...pose, joints: [...joints.values()] };
}
