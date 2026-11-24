import * as THREE from 'three';
import type { CharacterPose, CharacterRig } from './rig';
import { applyCharacterPose, validateCharacterRig } from './rig';

export interface ThreeRigRuntime {
  root: THREE.Group;
  joints: Map<string, THREE.Group>;
  bones: Map<string, THREE.Mesh>;
}
export interface ThreeRigOptions {
  unitScale?: number;
  showBones?: boolean;
  boneRadius?: number;
}

/** Returns a stable parent-first order and rejects disconnected/cyclic hierarchies. */
export function orderRigJoints(rig: CharacterRig): CharacterRig['joints'] {
  const byId = new Map(rig.joints.map((joint) => [joint.id, joint]));
  const ordered: CharacterRig['joints'] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Rig hierarchy cycle at ${id}`);
    const joint = byId.get(id);
    if (!joint) throw new Error(`Missing rig joint: ${id}`);
    visiting.add(id);
    if (joint.parentId) visit(joint.parentId);
    visiting.delete(id);
    visited.add(id);
    ordered.push(joint);
  };
  rig.joints.forEach((joint) => visit(joint.id));
  return ordered;
}

/** Creates a hierarchical Three.js skeleton using native local joint offsets. */
export function createThreeRigRuntime(rig: CharacterRig, options: ThreeRigOptions = {}): ThreeRigRuntime {
  const validation = validateCharacterRig(rig);
  if (!validation.valid) throw new Error(`Cannot build Three.js rig: ${validation.errors.join(' ')}`);
  const ordered = orderRigJoints(rig);
  const unitScale = options.unitScale ?? 1;
  const root = new THREE.Group();
  root.name = `rig:${rig.id}`;
  const joints = new Map<string, THREE.Group>();
  const bones = new Map<string, THREE.Mesh>();
  const byId = new Map(rig.joints.map((joint) => [joint.id, joint]));
  for (const joint of ordered) {
    const group = new THREE.Group();
    group.name = joint.name;
    group.position.set(joint.bindPosition.x * unitScale, joint.bindPosition.y * unitScale, joint.bindPosition.z * unitScale);
    const parent = joint.parentId ? joints.get(joint.parentId) : root;
    if (!parent) throw new Error(`Unable to resolve parent for rig joint: ${joint.id}`);
    parent.add(group);
    joints.set(joint.id, group);
    if (options.showBones !== false && joint.parentId && joint.length > 0) {
      const parentJoint = byId.get(joint.parentId);
      const direction = new THREE.Vector3(joint.bindPosition.x * unitScale, joint.bindPosition.y * unitScale, joint.bindPosition.z * unitScale);
      const length = direction.length() || joint.length * unitScale;
      const radius = options.boneRadius ?? 0.025;
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.4, length, 8), new THREE.MeshStandardMaterial({ color: 0x67e8f9 }));
      mesh.name = `bone:${joint.id}`;
      if (direction.lengthSq() > 0) {
        mesh.position.copy(direction.clone().multiplyScalar(0.5));
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
      } else mesh.position.y = length / 2;
      (parentJoint ? joints.get(parentJoint.id) : root)?.add(mesh);
      bones.set(joint.id, mesh);
    }
  }
  return { root, joints, bones };
}

/** Applies native local joint rotations to the corresponding Three.js hierarchy. */
export function applyPoseToThreeRig(runtime: ThreeRigRuntime, rig: CharacterRig, pose: CharacterPose): void {
  const rotations = applyCharacterPose(rig, pose);
  for (const joint of rig.joints) {
    const object = runtime.joints.get(joint.id);
    const rotation = rotations.get(joint.id);
    if (object && rotation) object.rotation.set(rotation.x, rotation.y, rotation.z);
  }
  runtime.root.updateMatrixWorld(true);
}

/** Applies rotations and optional local-position overrides from a sampled pose. */
export function updateThreeRigFromPose(runtime: ThreeRigRuntime, rig: CharacterRig, pose: CharacterPose, unitScale = 1): void {
  applyPoseToThreeRig(runtime, rig, pose);
  const poseById = new Map(pose.joints.map((item) => [item.jointId, item]));
  for (const joint of rig.joints) {
    const override = poseById.get(joint.id)?.position;
    if (override) runtime.joints.get(joint.id)?.position.set(override.x * unitScale, override.y * unitScale, override.z * unitScale);
  }
  runtime.root.updateMatrixWorld(true);
}
