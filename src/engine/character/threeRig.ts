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

/** Creates a hierarchical Three.js skeleton using the native rig's local joint offsets. */
export function createThreeRigRuntime(rig: CharacterRig, options: ThreeRigOptions = {}): ThreeRigRuntime {
  const validation = validateCharacterRig(rig);
  if (!validation.valid) throw new Error(`Cannot build Three.js rig: ${validation.errors.join(' ')}`);
  const unitScale = options.unitScale ?? 1;
  const root = new THREE.Group();
  root.name = `rig:${rig.id}`;
  const joints = new Map<string, THREE.Group>();
  const bones = new Map<string, THREE.Mesh>();
  const byId = new Map(rig.joints.map((joint) => [joint.id, joint]));
  for (const joint of rig.joints) {
    const group = new THREE.Group();
    group.name = joint.name;
    group.position.set(
      joint.bindPosition.x * unitScale,
      joint.bindPosition.y * unitScale,
      joint.bindPosition.z * unitScale
    );
    const parent = joint.parentId ? joints.get(joint.parentId) : root;
    if (!parent) throw new Error(`Rig parent must be created before child: ${joint.id}`);
    parent.add(group);
    joints.set(joint.id, group);
    if (options.showBones !== false && joint.parentId && joint.length > 0) {
      const parentJoint = byId.get(joint.parentId);
      const direction = new THREE.Vector3(
        joint.bindPosition.x * unitScale,
        joint.bindPosition.y * unitScale,
        joint.bindPosition.z * unitScale
      );
      const length = direction.length() || joint.length * unitScale;
      const geometry = new THREE.CylinderGeometry(
        options.boneRadius ?? 0.025,
        options.boneRadius ?? 0.035,
        length,
        8
      );
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x67e8f9 }));
      mesh.name = `bone:${joint.id}`;
      if (direction.lengthSq() > 0) {
        mesh.position.copy(direction.clone().multiplyScalar(0.5));
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
      } else {
        mesh.position.y = length / 2;
      }
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
    if (!object || !rotation) continue;
    object.rotation.set(rotation.x, rotation.y, rotation.z);
  }
  runtime.root.updateMatrixWorld(true);
}

/** Updates local positions too, allowing retargeted rigs to change proportions at runtime. */
export function updateThreeRigFromPose(
  runtime: ThreeRigRuntime,
  rig: CharacterRig,
  pose: CharacterPose,
  unitScale = 1
): void {
  applyPoseToThreeRig(runtime, rig, pose);
  const poseById = new Map(pose.joints.map((item) => [item.jointId, item]));
  for (const joint of rig.joints) {
    const override = poseById.get(joint.id)?.position;
    if (!override) continue;
    const object = runtime.joints.get(joint.id);
    object?.position.set(override.x * unitScale, override.y * unitScale, override.z * unitScale);
  }
  runtime.root.updateMatrixWorld(true);
}
