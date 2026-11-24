import type { CharacterPose, CharacterRig, JointPose, RigJoint } from './rig';
import { createHumanoidRig, evaluateRigWorldPose, validateCharacterRig } from './rig';

export type CutoutPartKind = 'head' | 'torso' | 'left-arm' | 'right-arm' | 'left-leg' | 'right-leg' | 'other';
export interface CutoutPoint { x: number; y: number; }
export interface CutoutPartManifest {
  id: string;
  kind: CutoutPartKind;
  polygon: CutoutPoint[];
  pivot: CutoutPoint;
  file: string;
}
export interface CutoutRigManifest {
  format: 'vyroxx-character-rig';
  version: 1;
  source: string;
  sourceSize: { width: number; height: number };
  coordinateSpace: 'source-image-pixels';
  parts: CutoutPartManifest[];
}
export interface CutoutLayer {
  id: string;
  kind: CutoutPartKind;
  image: CanvasImageSource;
  pivot: CutoutPoint;
}
export interface CutoutRenderOptions {
  x: number;
  y: number;
  scale?: number;
  opacity?: number;
  rotations?: Map<string, number>;
}

const JOINT_FOR_PART: Partial<Record<CutoutPartKind, string>> = {
  head: 'head',
  torso: 'spine',
  'left-arm': 'left_shoulder',
  'right-arm': 'right_shoulder',
  'left-leg': 'left_hip',
  'right-leg': 'right_hip',
};

function joint(id: string, name: string, parentId: string | null, position: CutoutPoint, width: number, height: number): RigJoint {
  return {
    id, name, parentId,
    bindPosition: { x: position.x / width, y: position.y / height, z: 0 },
    bindRotation: { x: 0, y: 0, z: 0 },
    length: 0,
  };
}

/** Converts the Character Rig Studio's exported manifest into the native joint hierarchy. */
export function rigFromCutoutManifest(manifest: CutoutRigManifest, characterId: string): CharacterRig {
  if (manifest.format !== 'vyroxx-character-rig' || manifest.version !== 1) {
    throw new Error('Unsupported VYROXX cutout rig manifest.');
  }
  const { width, height } = manifest.sourceSize;
  if (!(width > 0 && height > 0)) throw new Error('Cutout rig source dimensions are invalid.');
  const byKind = new Map(manifest.parts.map((part) => [part.kind, part]));
  const fallback = { x: width / 2, y: height / 2 };
  const pivot = (kind: CutoutPartKind) => byKind.get(kind)?.pivot ?? fallback;
  const rig = createHumanoidRig(characterId, `rig-${characterId}`);
  const root = rig.joints.find((item) => item.id === 'root');
  if (root) root.bindPosition = { x: fallback.x / width, y: fallback.y / height, z: 0 };
  const pivotMap: Record<string, CutoutPoint> = {
    spine: pivot('torso'),
    neck: pivot('head'),
    head: pivot('head'),
    left_shoulder: pivot('left-arm'),
    left_elbow: pivot('left-arm'),
    right_shoulder: pivot('right-arm'),
    right_elbow: pivot('right-arm'),
    left_hip: pivot('left-leg'),
    left_knee: pivot('left-leg'),
    right_hip: pivot('right-leg'),
    right_knee: pivot('right-leg'),
  };
  rig.joints = rig.joints.map((item) => {
    const point = pivotMap[item.id];
    if (!point) return item;
    const parent = item.parentId ? pivotMap[item.parentId] : undefined;
    const local = parent ? { x: point.x - parent.x, y: point.y - parent.y } : point;
    return { ...item, bindPosition: { x: local.x / width, y: local.y / height, z: 0 } };
  });
  const validation = validateCharacterRig(rig);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  return rig;
}

/** Produces joint rotations for a cutout character from native motion samples. */
export function cutoutJointRotations(rig: CharacterRig, pose: CharacterPose): Map<string, number> {
  const world = evaluateRigWorldPose(rig, pose);
  return new Map(Array.from(world.entries(), ([id, transform]) => [id, transform.rotation.z]));
}

/**
 * Draws full-canvas transparent cutouts around their authored pivots.
 * Images should retain the original source dimensions so every layer shares
 * one coordinate space. Rotation values are radians.
 */
export function drawCutoutCharacter(
  ctx: CanvasRenderingContext2D,
  layers: CutoutLayer[],
  sourceSize: { width: number; height: number },
  options: CutoutRenderOptions
): void {
  const scale = options.scale ?? 1;
  const opacity = Math.max(0, Math.min(1, options.opacity ?? 1));
  const order: CutoutPartKind[] = ['left-leg', 'right-leg', 'other', 'torso', 'left-arm', 'right-arm', 'head'];
  const sorted = [...layers].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  ctx.save();
  ctx.translate(options.x, options.y);
  ctx.scale(scale, scale);
  ctx.globalAlpha *= opacity;
  for (const layer of sorted) {
    const angle = options.rotations?.get(JOINT_FOR_PART[layer.kind] ?? '') ?? 0;
    ctx.save();
    ctx.translate(layer.pivot.x, layer.pivot.y);
    ctx.rotate(angle);
    ctx.drawImage(layer.image, -layer.pivot.x, -layer.pivot.y, sourceSize.width, sourceSize.height);
    ctx.restore();
  }
  ctx.restore();
}

export function poseFromRotationMap(rig: CharacterRig, rotations: Map<string, number>, frame: number): CharacterPose {
  const joints: JointPose[] = rig.joints.map((item) => ({
    jointId: item.id,
    rotation: { ...item.bindRotation, z: rotations.get(item.id) ?? item.bindRotation.z },
  }));
  return { rigId: rig.id, frame, joints };
}
