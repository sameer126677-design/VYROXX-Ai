import type { CreationDocument } from './types';
import { getSceneAtFrame } from './timeline';
import { directSceneCamera, sampleCameraTrack } from '../cinematic/cameraDirector';
import { buildSceneVisualBlueprints } from '../visuals/proceduralBuilder';
import { buildCompositePlan } from './compositor';
import { decideImageProviderUse } from './imageProviderPolicy';

export interface EvaluatedFrame {
  frame: number;
  timeSec: number;
  sceneId: string | null;
  localFrame: number;
  blueprints: ReturnType<typeof buildSceneVisualBlueprints>;
  camera: ReturnType<typeof sampleCameraTrack> | null;
  composite: ReturnType<typeof buildCompositePlan>;
  imageProvider: ReturnType<typeof decideImageProviderUse>;
}

/** Evaluates all deterministic per-frame direction data without invoking remote models. */
export function evaluateCreationFrame(document: CreationDocument, frame: number): EvaluatedFrame {
  const safeFrame = Math.max(0, Math.min(document.timeline.totalFrames - 1, Math.floor(frame)));
  const scene = getSceneAtFrame(document.scenes, safeFrame);
  const cameraTrack = scene ? directSceneCamera(scene, document.timeline.fps) : null;
  return {
    frame: safeFrame,
    timeSec: safeFrame / document.timeline.fps,
    sceneId: scene?.id ?? null,
    localFrame: scene ? safeFrame - scene.startFrame : 0,
    blueprints: scene ? buildSceneVisualBlueprints(scene) : [],
    camera: cameraTrack ? sampleCameraTrack(cameraTrack, safeFrame) : null,
    composite: buildCompositePlan(document),
    imageProvider: decideImageProviderUse(document),
  };
}
