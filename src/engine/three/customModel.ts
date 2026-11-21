import * as THREE from 'three';
import {
  CUSTOM_MODEL_SHAPES,
  CustomModelPart,
  CustomModelShape,
  CustomModelSpec,
  CustomMotionAxis,
  CustomPartMotionType,
  SceneElement,
} from '../../shared/sceneSchema';

interface CustomPartMotionConfig {
  type: CustomPartMotionType;
  axis: CustomMotionAxis;
  speed: number;
  amplitude: number;
}

interface CustomMotionPartEntry {
  mesh: THREE.Mesh;
  basePos: THREE.Vector3;
  baseRot: THREE.Euler;
  baseScale: THREE.Vector3;
  motion: CustomPartMotionConfig;
}

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();

const ALLOWED_SHAPE_SET = new Set<string>(CUSTOM_MODEL_SHAPES);

function clamp(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, val));
}

function createGeometryForPartShape(
  shape: CustomModelShape
): THREE.BufferGeometry | null {
  switch (shape) {
    case 'box':
      return new THREE.BoxGeometry(1, 1, 1);
    case 'sphere':
      return new THREE.SphereGeometry(0.5, 24, 18);
    case 'cylinder':
      return new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
    case 'cone':
      return new THREE.ConeGeometry(0.5, 1, 24);
    case 'capsule':
      return new THREE.CapsuleGeometry(0.25, 0.5, 6, 16);
    case 'torus':
      return new THREE.TorusGeometry(0.38, 0.12, 14, 32);
    case 'plane':
      return new THREE.PlaneGeometry(1, 1);
    default:
      return null;
  }
}

function getEulerAxis(euler: THREE.Euler, axis: CustomMotionAxis): number {
  if (axis === 'x') return euler.x;
  if (axis === 'y') return euler.y;
  return euler.z;
}

function setEulerAxis(euler: THREE.Euler, axis: CustomMotionAxis, value: number): void {
  if (axis === 'x') euler.x = value;
  else if (axis === 'y') euler.y = value;
  else euler.z = value;
}

function getVecAxis(vec: THREE.Vector3, axis: CustomMotionAxis): number {
  if (axis === 'x') return vec.x;
  if (axis === 'y') return vec.y;
  return vec.z;
}

function setVecAxis(vec: THREE.Vector3, axis: CustomMotionAxis, value: number): void {
  if (axis === 'x') vec.x = value;
  else if (axis === 'y') vec.y = value;
  else vec.z = value;
}

function createPartMesh(
  part: CustomModelPart
): { mesh: THREE.Mesh; motionEntry?: CustomMotionPartEntry } | null {
  if (!ALLOWED_SHAPE_SET.has(part.shape)) {
    return null;
  }

  const geometry = createGeometryForPartShape(part.shape);
  if (!geometry) return null;

  const opacity = clamp(part.opacity ?? 1, 0, 1);
  const hasEmissive = Boolean(part.emissive);
  const emissiveIntensity = hasEmissive
    ? clamp(part.emissiveIntensity ?? 1, 0, 5)
    : 0;

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(part.color),
    roughness: clamp(part.roughness ?? 0.55, 0, 1),
    metalness: clamp(part.metalness ?? 0.1, 0, 1),
    emissive: hasEmissive
      ? new THREE.Color(part.emissive)
      : new THREE.Color(0x000000),
    emissiveIntensity,
    opacity,
    transparent: opacity < 0.999,
    depthWrite: opacity >= 0.99,
    side: part.shape === 'plane' ? THREE.DoubleSide : THREE.FrontSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = part.id;
  mesh.position.set(part.px, part.py, part.pz);
  mesh.rotation.set(
    THREE.MathUtils.degToRad(part.rxDeg),
    THREE.MathUtils.degToRad(part.ryDeg),
    THREE.MathUtils.degToRad(part.rzDeg)
  );
  mesh.scale.set(part.sx, part.sy, part.sz);
  mesh.castShadow = opacity >= 0.5;
  mesh.receiveShadow = true;

  if (part.motionType && part.motionType !== 'none') {
    return {
      mesh,
      motionEntry: {
        mesh,
        basePos: mesh.position.clone(),
        baseRot: mesh.rotation.clone(),
        baseScale: mesh.scale.clone(),
        motion: {
          type: part.motionType,
          axis: part.motionAxis ?? 'y',
          speed: part.motionSpeed ?? 1,
          amplitude: part.motionAmplitude ?? 0.2,
        },
      },
    };
  }

  return { mesh };
}

/**
 * Safely constructs a multi-part Three.js Group from a flat `CustomModelSpec`
 * using only the 7 whitelisted primitive shapes and MeshStandardMaterial.
 * Fits the assembled model bounding box to `el.size3d` when provided.
 */
export function createCustomModelGroup(
  el: SceneElement,
  spec?: CustomModelSpec
): THREE.Group {
  const root = new THREE.Group();
  root.name = `custom_${el.id}`;

  const resolvedSpec = spec ?? el.customModelSpec;
  const motionEntries: CustomMotionPartEntry[] = [];
  root.userData.rig = { type: 'custom' as const };
  root.userData.customMotionParts = motionEntries;

  if (!resolvedSpec || !Array.isArray(resolvedSpec.parts)) {
    return root;
  }

  const modelInner = new THREE.Group();
  modelInner.name = `custom_inner_${el.id}`;
  const cappedParts = resolvedSpec.parts.slice(0, 40);

  for (const part of cappedParts) {
    const created = createPartMesh(part);
    if (!created) continue;
    modelInner.add(created.mesh);
    if (created.motionEntry) {
      motionEntries.push(created.motionEntry);
    }
  }

  if (modelInner.children.length === 0) {
    return root;
  }

  modelInner.updateMatrixWorld(true);
  _box.setFromObject(modelInner);

  if (!_box.isEmpty()) {
    _box.getSize(_size);

    if (el.size3d) {
      const validScales: number[] = [];
      const rawSx = _size.x > 0.02 ? el.size3d.w / _size.x : 0;
      const rawSy = _size.y > 0.02 ? el.size3d.h / _size.y : 0;
      const rawSz = _size.z > 0.02 ? el.size3d.d / _size.z : 0;
      if (rawSx > 0) validScales.push(rawSx);
      if (rawSy > 0) validScales.push(rawSy);
      if (rawSz > 0) validScales.push(rawSz);
      const fallbackScale =
        validScales.length > 0
          ? validScales.reduce((a, b) => a + b, 0) / validScales.length
          : 1;

      modelInner.scale.set(
        rawSx > 0 ? rawSx : fallbackScale,
        rawSy > 0 ? rawSy : fallbackScale,
        rawSz > 0 ? rawSz : fallbackScale
      );
    } else if (el.scale !== 1) {
      modelInner.scale.setScalar(el.scale);
    }

    modelInner.updateMatrixWorld(true);
    _box.setFromObject(modelInner);
    _box.getCenter(_center);
    modelInner.position.x -= _center.x;
    modelInner.position.z -= _center.z;
    modelInner.position.y -= _box.min.y;
  }

  root.add(modelInner);
  return root;
}

/**
 * Deterministic per-frame animator for `customModelSpec` flat part motions.
 * Always evaluates relative to the part's base transform so timeline scrubbing works accurately.
 */
export function animateCustomModel(
  group: THREE.Group,
  timeSec: number
): void {
  const entries = group.userData.customMotionParts as
    | CustomMotionPartEntry[]
    | undefined;
  if (!entries || entries.length === 0) return;

  for (let i = 0; i < entries.length; i++) {
    const { mesh, basePos, baseRot, baseScale, motion } = entries[i];
    mesh.position.copy(basePos);
    mesh.rotation.copy(baseRot);
    mesh.scale.copy(baseScale);

    if (motion.type === 'none') continue;

    const phase = timeSec * motion.speed;
    const axis = motion.axis;

    switch (motion.type) {
      case 'sway':
        setEulerAxis(
          mesh.rotation,
          axis,
          getEulerAxis(baseRot, axis) + Math.sin(phase) * motion.amplitude
        );
        break;
      case 'rotate':
        setEulerAxis(mesh.rotation, axis, getEulerAxis(baseRot, axis) + phase);
        break;
      case 'bob':
        setVecAxis(
          mesh.position,
          axis,
          getVecAxis(basePos, axis) + Math.sin(phase) * motion.amplitude
        );
        break;
      case 'pulse': {
        const factor = Math.max(0.05, 1 + Math.sin(phase) * motion.amplitude);
        setVecAxis(mesh.scale, axis, getVecAxis(baseScale, axis) * factor);
        break;
      }
    }
  }
}

function disposeMaterialAndTextures(mat: THREE.Material): void {
  const record = mat as unknown as Record<string, unknown>;
  for (const val of Object.values(record)) {
    if (val && typeof val === 'object' && 'isTexture' in val) {
      (val as THREE.Texture).dispose();
    }
  }
  mat.dispose();
}

/**
 * Disposes all geometries, materials, and attached textures inside a custom model group.
 */
export function disposeCustomModel(group: THREE.Group): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry && typeof mesh.geometry.dispose === 'function') {
      mesh.geometry.dispose();
    }
    const matOrMats = mesh.material;
    if (Array.isArray(matOrMats)) {
      for (const m of matOrMats) {
        disposeMaterialAndTextures(m);
      }
    } else if (matOrMats) {
      disposeMaterialAndTextures(matOrMats);
    }
  });
  group.userData.customMotionParts = [];
}
