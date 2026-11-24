import type { CreationDocument } from './types';
import { getSceneAtFrame } from './timeline';
import { directSceneCamera, sampleCameraTrack } from '../cinematic/cameraDirector';
import { buildSceneVisualBlueprints } from '../visuals/proceduralBuilder';
import { buildCompositePlan, evaluateCompositeFrame, type CompositeFrame, type CompositePlan } from './compositor';
import { decideImageProviderUse } from './imageProviderPolicy';
import { evaluateSceneHierarchy } from './nodeHierarchy';

export interface EvaluatedFrame {
  frame: number;
  timeSec: number;
  sceneId: string | null;
  localFrame: number;
  blueprints: ReturnType<typeof buildSceneVisualBlueprints>;
  camera: ReturnType<typeof sampleCameraTrack> | null;
  composite: CompositePlan;
  compositeFrame: CompositeFrame;
  imageProvider: ReturnType<typeof decideImageProviderUse>;
}

/** Evaluates deterministic scene, camera and compositor state for a single frame. */
export function evaluateCreationFrame(document: CreationDocument, frame: number): EvaluatedFrame {
  const safeFrame = Math.max(0, Math.min(Math.max(0, document.timeline.totalFrames - 1), Math.floor(frame)));
  const scene = getSceneAtFrame(document.scenes, safeFrame);
  const evaluatedScene = scene ? evaluateSceneHierarchy(scene) : null;
  const cameraTrack = scene ? directSceneCamera(scene, document.timeline.fps) : null;
  const composite = buildCompositePlan(document);
  return {
    frame: safeFrame,
    timeSec: safeFrame / Math.max(1, document.timeline.fps),
    sceneId: scene?.id ?? null,
    localFrame: scene ? safeFrame - scene.startFrame : 0,
    blueprints: evaluatedScene ? buildSceneVisualBlueprints(evaluatedScene) : [],
    camera: cameraTrack ? sampleCameraTrack(cameraTrack, safeFrame) : null,
    composite,
    compositeFrame: evaluateCompositeFrame(composite, safeFrame),
    imageProvider: decideImageProviderUse(document),
  };
}
