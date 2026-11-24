import type { Vec3 } from '../core/types';

export interface RigJoint {
  id: string;
  name: string;
  parentId: string | null;
  bindPosition: Vec3;
  bindRotation: Vec3;
  length: number;
  limits?: { min: Vec3; max: Vec3 };
}
export interface CharacterRig {
  id: string;
  characterId: string;
  rootJointId: string;
  joints: RigJoint[];
  version: 1;
}
export interface JointPose { jointId: string; rotation: Vec3; position?: Vec3; }
export interface CharacterPose { rigId: string; frame: number; joints: JointPose[]; }
export interface RigValidation { valid: boolean; errors: string[]; }
export interface WorldJointTransform { jointId: string; position: Vec3; rotation: Vec3; }
export interface IK2DResult { root: { x: number; y: number }; middle: { x: number; y: number }; end: { x: number; y: number }; reachable: boolean; }

/** Validates hierarchy integrity before animation or export. */
export function validateCharacterRig(rig: CharacterRig): RigValidation {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const joint of rig.joints) {
    if (ids.has(joint.id)) errors.push(`Duplicate joint id: ${joint.id}`);
    ids.add(joint.id);
    if (!Number.isFinite(joint.length) || joint.length < 0) errors.push(`Invalid bone length: ${joint.id}`);
  }
  if (!ids.has(rig.rootJointId)) errors.push('Root joint does not exist.');
  for (const joint of rig.joints) {
    if (joint.parentId && !ids.has(joint.parentId)) errors.push(`Missing parent "${joint.parentId}" for "${joint.id}".`);
    if (joint.parentId === joint.id) errors.push(`Joint "${joint.id}" cannot parent itself.`);
  }
  const byId = new Map(rig.joints.map((joint) => [joint.id, joint]));
  for (const joint of rig.joints) {
    const visited = new Set<string>();
    let cursor: RigJoint | undefined = joint;
    while (cursor?.parentId) {
      if (visited.has(cursor.id)) { errors.push(`Hierarchy cycle detected at "${cursor.id}".`); break; }
      visited.add(cursor.id);
      cursor = byId.get(cursor.parentId);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function clampJointRotation(rotation: Vec3, limits?: RigJoint['limits']): Vec3 {
  if (!limits) return { ...rotation };
  return {
    x: Math.max(limits.min.x, Math.min(limits.max.x, rotation.x)),
    y: Math.max(limits.min.y, Math.min(limits.max.y, rotation.y)),
    z: Math.max(limits.min.z, Math.min(limits.max.z, rotation.z)),
  };
}

/** Applies a pose while preserving unspecified joints at their bind rotations. */
export function applyCharacterPose(rig: CharacterRig, pose: CharacterPose): Map<string, Vec3> {
  const validation = validateCharacterRig(rig);
  if (!validation.valid) throw new Error(`Invalid character rig: ${validation.errors.join(' ')}`);
  if (pose.rigId !== rig.id) throw new Error('Pose rig id does not match the target rig.');
  const poseById = new Map(pose.joints.map((joint) => [joint.jointId, joint]));
  return new Map(rig.joints.map((joint) => {
    const keyed = poseById.get(joint.id);
    return [joint.id, clampJointRotation(keyed?.rotation ?? joint.bindRotation, joint.limits)];
  }));
}

/**
 * Evaluates the hierarchy in parent-first order. Rotations are Euler radians;
 * positions are accumulated in the parent frame with Z rotation in the XY plane.
 */
export function evaluateRigWorldPose(rig: CharacterRig, pose: CharacterPose): Map<string, WorldJointTransform> {
  const rotations = applyCharacterPose(rig, pose);
  const byId = new Map(rig.joints.map((joint) => [joint.id, joint]));
  const output = new Map<string, WorldJointTransform>();
  const visiting = new Set<string>();
  const evaluate = (joint: RigJoint): WorldJointTransform => {
    const cached = output.get(joint.id);
    if (cached) return cached;
    if (visiting.has(joint.id)) throw new Error(`Rig hierarchy cycle at ${joint.id}`);
    visiting.add(joint.id);
    const localRotation = rotations.get(joint.id) ?? joint.bindRotation;
    const localPosition = joint.bindPosition;
    let result: WorldJointTransform;
    if (!joint.parentId) {
      result = { jointId: joint.id, position: { ...localPosition }, rotation: { ...localRotation } };
    } else {
      const parent = byId.get(joint.parentId);
      if (!parent) throw new Error(`Missing parent ${joint.parentId}`);
      const parentWorld = evaluate(parent);
      const angle = parentWorld.rotation.z;
      const c = Math.cos(angle), s = Math.sin(angle);
      const rotated = {
        x: localPosition.x * c - localPosition.y * s,
        y: localPosition.x * s + localPosition.y * c,
        z: localPosition.z,
      };
      result = {
        jointId: joint.id,
        position: {
          x: parentWorld.position.x + rotated.x,
          y: parentWorld.position.y + rotated.y,
          z: parentWorld.position.z + rotated.z,
        },
        rotation: {
          x: parentWorld.rotation.x + localRotation.x,
          y: parentWorld.rotation.y + localRotation.y,
          z: parentWorld.rotation.z + localRotation.z,
        },
      };
    }
    visiting.delete(joint.id);
    output.set(joint.id, result);
    return result;
  };
  rig.joints.forEach(evaluate);
  return output;
}

/** Analytic two-bone IK solver for 2D limbs; clamps unreachable targets to the limb's reach. */
export function solveTwoBoneIK2D(
  root: { x: number; y: number },
  target: { x: number; y: number },
  upperLength: number,
  lowerLength: number,
  bendDirection: 1 | -1 = 1
): IK2DResult {
  const a = Math.max(0.0001, upperLength);
  const b = Math.max(0.0001, lowerLength);
  const dx = target.x - root.x, dy = target.y - root.y;
  const rawDistance = Math.hypot(dx, dy);
  const minReach = Math.abs(a - b) + 0.0001;
  const maxReach = a + b - 0.0001;
  const distance = Math.max(minReach, Math.min(maxReach, rawDistance));
  const angleToTarget = Math.atan2(dy, dx);
  const rootOffset = Math.acos(Math.max(-1, Math.min(1, (a * a + distance * distance - b * b) / (2 * a * distance))));
  const rootAngle = angleToTarget + bendDirection * rootOffset;
  const middle = { x: root.x + Math.cos(rootAngle) * a, y: root.y + Math.sin(rootAngle) * a };
  const endAngle = Math.atan2(target.y - middle.y, target.x - middle.x);
  return {
    root: { ...root }, middle,
    end: { x: middle.x + Math.cos(endAngle) * b, y: middle.y + Math.sin(endAngle) * b },
    reachable: rawDistance >= minReach && rawDistance <= maxReach,
  };
}

/** Builds a minimal humanoid hierarchy as a starting point for rig authoring. */
export function createHumanoidRig(characterId: string, rigId = `rig-${characterId}`): CharacterRig {
  const joint = (id: string, name: string, parentId: string | null, x: number, y: number, z: number, length: number): RigJoint => ({
    id, name, parentId, bindPosition: { x, y, z }, bindRotation: { x: 0, y: 0, z: 0 }, length,
  });
  return {
    id: rigId, characterId, version: 1, rootJointId: 'root',
    joints: [
      joint('root', 'Root', null, 0, 0, 0, 0),
      joint('spine', 'Spine', 'root', 0, 0.45, 0, 0.55),
      joint('neck', 'Neck', 'spine', 0, 0.55, 0, 0.16),
      joint('head', 'Head', 'neck', 0, 0.18, 0, 0.22),
      joint('left_shoulder', 'Left shoulder', 'spine', -0.28, 0.42, 0, 0.28),
      joint('left_elbow', 'Left elbow', 'left_shoulder', -0.28, -0.28, 0, 0.3),
      joint('left_wrist', 'Left wrist', 'left_elbow', -0.05, -0.30, 0, 0.12),
      joint('right_shoulder', 'Right shoulder', 'spine', 0.28, 0.42, 0, 0.28),
      joint('right_elbow', 'Right elbow', 'right_shoulder', 0.28, -0.28, 0, 0.3),
      joint('right_wrist', 'Right wrist', 'right_elbow', 0.05, -0.30, 0, 0.12),
      joint('left_hip', 'Left hip', 'root', -0.16, -0.08, 0, 0.42),
      joint('left_knee', 'Left knee', 'left_hip', 0, -0.42, 0, 0.42),
      joint('left_ankle', 'Left ankle', 'left_knee', 0, -0.38, 0.07, 0.12),
      joint('right_hip', 'Right hip', 'root', 0.16, -0.08, 0, 0.42),
      joint('right_knee', 'Right knee', 'right_hip', 0, -0.42, 0, 0.42),
      joint('right_ankle', 'Right ankle', 'right_knee', 0, -0.38, 0.07, 0.12),
    ],
  };
}
