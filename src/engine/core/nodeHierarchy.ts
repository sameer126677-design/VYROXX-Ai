import type { EngineNode, EngineScene, Transform3D, Vec3 } from './types';

type Quaternion = { x: number; y: number; z: number; w: number };
const identityTransform = (): Transform3D => ({
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
});
function multiplyQuaternion(a: Quaternion, b: Quaternion): Quaternion {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}
function quaternionFromEuler(rotation: Vec3): Quaternion {
  const x = rotation.x * Math.PI / 360;
  const y = rotation.y * Math.PI / 360;
  const z = rotation.z * Math.PI / 360;
  const c1 = Math.cos(x); const c2 = Math.cos(y); const c3 = Math.cos(z);
  const s1 = Math.sin(x); const s2 = Math.sin(y); const s3 = Math.sin(z);
  return {
    x: s1 * c2 * c3 + c1 * s2 * s3,
    y: c1 * s2 * c3 - s1 * c2 * s3,
    z: c1 * c2 * s3 + s1 * s2 * c3,
    w: c1 * c2 * c3 - s1 * s2 * s3,
  };
}
function eulerFromQuaternion(q: Quaternion): Vec3 {
  const sinr = 2 * (q.w * q.x + q.y * q.z);
  const cosr = 1 - 2 * (q.x * q.x + q.y * q.y);
  const sinp = 2 * (q.w * q.y - q.z * q.x);
  const siny = 2 * (q.w * q.z + q.x * q.y);
  const cosy = 1 - 2 * (q.y * q.y + q.z * q.z);
  return {
    x: Math.atan2(sinr, cosr) * 180 / Math.PI,
    y: (Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp)) * 180 / Math.PI,
    z: Math.atan2(siny, cosy) * 180 / Math.PI,
  };
}
function rotateVector(vector: Vec3, q: Quaternion): Vec3 {
  const p: Quaternion = { x: vector.x, y: vector.y, z: vector.z, w: 0 };
  const inverse: Quaternion = { x: -q.x, y: -q.y, z: -q.z, w: q.w };
  const rotated = multiplyQuaternion(multiplyQuaternion(q, p), inverse);
  return { x: rotated.x, y: rotated.y, z: rotated.z };
}
function compose(parent: Transform3D, local: Transform3D): Transform3D {
  const scaled = {
    x: local.position.x * parent.scale.x,
    y: local.position.y * parent.scale.y,
    z: local.position.z * parent.scale.z,
  };
  const parentRotation = quaternionFromEuler(parent.rotation);
  const offset = rotateVector(scaled, parentRotation);
  return {
    position: {
      x: parent.position.x + offset.x,
      y: parent.position.y + offset.y,
      z: parent.position.z + offset.z,
    },
    rotation: eulerFromQuaternion(multiplyQuaternion(parentRotation, quaternionFromEuler(local.rotation))),
    scale: {
      x: parent.scale.x * local.scale.x,
      y: parent.scale.y * local.scale.y,
      z: parent.scale.z * local.scale.z,
    },
  };
}

/**
 * Evaluates local node transforms into world transforms.
 * Invalid/missing parents and cycles are handled conservatively as roots; quality
 * validation reports those structural problems separately.
 */
export function evaluateSceneNodeHierarchy(scene: EngineScene): EngineNode[] {
  const byId = new Map(scene.nodes.map((node) => [node.id, node]));
  const resolved = new Map<string, EngineNode>();
  const visiting = new Set<string>();
  const resolve = (node: EngineNode): EngineNode => {
    const cached = resolved.get(node.id);
    if (cached) return cached;
    if (visiting.has(node.id)) return { ...node, transform: node.transform };
    visiting.add(node.id);
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    const evaluatedParent = parent && !visiting.has(parent.id) ? resolve(parent) : undefined;
    const parentTransform = evaluatedParent?.transform ?? identityTransform();
    const worldTransform = evaluatedParent
      ? compose(parentTransform, node.transform)
      : node.transform;
    const result: EngineNode = {
      ...node,
      transform: worldTransform,
      visible: node.visible && (evaluatedParent?.visible ?? true),
      opacity: Math.max(0, Math.min(1, node.opacity * (evaluatedParent?.opacity ?? 1))),
    };
    visiting.delete(node.id);
    resolved.set(node.id, result);
    return result;
  };
  return scene.nodes.map(resolve);
}
export function evaluateSceneHierarchy(scene: EngineScene): EngineScene {
  return { ...scene, nodes: evaluateSceneNodeHierarchy(scene) };
}
