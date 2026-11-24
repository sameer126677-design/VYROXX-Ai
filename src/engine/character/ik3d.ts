import type { Vec3 } from '../core/types';
import type { CharacterPose, CharacterRig } from './rig';
import { applyCharacterPose, validateCharacterRig } from './rig';

export interface Quaternion { x: number; y: number; z: number; w: number; }
export interface IK3DResult { root: Vec3; middle: Vec3; end: Vec3; reachable: boolean; distance: number; }
export interface WorldJointTransform3D { jointId: string; position: Vec3; rotation: Vec3; quaternion: Quaternion; }

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (v: Vec3, s: number): Vec3 => ({ x: v.x * s, y: v.y * s, z: v.z * s });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const length = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const normalize = (v: Vec3): Vec3 => { const n = length(v) || 1; return scale(v, 1 / n); };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const quaternionIdentity = (): Quaternion => ({ x: 0, y: 0, z: 0, w: 1 });
export function quaternionMultiply(a: Quaternion, b: Quaternion): Quaternion {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}
export function quaternionFromEulerXYZ(rotation: Vec3): Quaternion {
  const hx = rotation.x / 2, hy = rotation.y / 2, hz = rotation.z / 2;
  const sx = Math.sin(hx), cx = Math.cos(hx), sy = Math.sin(hy), cy = Math.cos(hy), sz = Math.sin(hz), cz = Math.cos(hz);
  return {
    x: sx * cy * cz + cx * sy * sz,
    y: cx * sy * cz - sx * cy * sz,
    z: cx * cy * sz + sx * sy * cz,
    w: cx * cy * cz - sx * sy * sz,
  };
}
export function quaternionRotateVector(q: Quaternion, vector: Vec3): Vec3 {
  const u = { x: q.x, y: q.y, z: q.z };
  const uv = cross(u, vector);
  const uuv = cross(u, uv);
  return add(vector, add(scale(uv, 2 * q.w), scale(uuv, 2)));
}
export function quaternionToEulerXYZ(q: Quaternion): Vec3 {
  const sinr = 2 * (q.w * q.x + q.y * q.z);
  const cosr = 1 - 2 * (q.x * q.x + q.y * q.y);
  const sinp = 2 * (q.w * q.y - q.z * q.x);
  const siny = 2 * (q.w * q.z + q.x * q.y);
  const cosy = 1 - 2 * (q.y * q.y + q.z * q.z);
  return {
    x: Math.atan2(sinr, cosr),
    y: Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp),
    z: Math.atan2(siny, cosy),
  };
}

/** Parent-first world transforms with full 3D quaternion rotation composition. */
export function evaluateRigWorldPose3D(rig: CharacterRig, pose: CharacterPose): Map<string, WorldJointTransform3D> {
  const validation = validateCharacterRig(rig);
  if (!validation.valid) throw new Error(`Invalid character rig: ${validation.errors.join(' ')}`);
  const rotations = applyCharacterPose(rig, pose);
  const byId = new Map(rig.joints.map(joint => [joint.id, joint]));
  const output = new Map<string, WorldJointTransform3D>();
  const visiting = new Set<string>();
  const visit = (jointId: string): WorldJointTransform3D => {
    const cached = output.get(jointId);
    if (cached) return cached;
    if (visiting.has(jointId)) throw new Error(`Rig hierarchy cycle at ${jointId}`);
    const joint = byId.get(jointId);
    if (!joint) throw new Error(`Missing rig joint: ${jointId}`);
    visiting.add(jointId);
    const localQuaternion = quaternionFromEulerXYZ(rotations.get(jointId) ?? joint.bindRotation);
    let result: WorldJointTransform3D;
    if (!joint.parentId) {
      result = { jointId, position: { ...joint.bindPosition }, rotation: quaternionToEulerXYZ(localQuaternion), quaternion: localQuaternion };
    } else {
      const parent = visit(joint.parentId);
      const offset = quaternionRotateVector(parent.quaternion, joint.bindPosition);
      const worldQuaternion = quaternionMultiply(parent.quaternion, localQuaternion);
      result = {
        jointId,
        position: add(parent.position, offset),
        rotation: quaternionToEulerXYZ(worldQuaternion),
        quaternion: worldQuaternion,
      };
    }
    visiting.delete(jointId);
    output.set(jointId, result);
    return result;
  };
  rig.joints.forEach(joint => visit(joint.id));
  return output;
}

/**
 * Analytic 3D two-bone IK. pole controls the bend plane; if it is parallel to
 * the root-target axis, a stable fallback axis is selected automatically.
 */
export function solveTwoBoneIK3D(root: Vec3, target: Vec3, upperLength: number, lowerLength: number, pole: Vec3 = { x: 0, y: 0, z: 1 }): IK3DResult {
  const a = Math.max(0.0001, upperLength);
  const b = Math.max(0.0001, lowerLength);
  const delta = sub(target, root);
  const rawDistance = length(delta);
  const direction = rawDistance > 1e-8 ? scale(delta, 1 / rawDistance) : { x: 0, y: -1, z: 0 };
  const minReach = Math.abs(a - b) + 1e-5;
  const maxReach = a + b - 1e-5;
  const distance = clamp(rawDistance, minReach, maxReach);
  let bend = sub(pole, scale(direction, dot(pole, direction)));
  if (length(bend) < 1e-6) {
    const fallback = Math.abs(direction.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    bend = sub(fallback, scale(direction, dot(fallback, direction)));
  }
  bend = normalize(bend);
  const along = (a * a - b * b + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, a * a - along * along));
  const middle = add(root, add(scale(direction, along), scale(bend, height)));
  const end = add(root, scale(direction, distance));
  return { root: { ...root }, middle, end, reachable: rawDistance >= minReach && rawDistance <= maxReach, distance };
}
