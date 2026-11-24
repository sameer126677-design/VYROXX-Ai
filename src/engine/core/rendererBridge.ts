import type { AnimationScenePlan, SceneElement } from '../../shared/sceneSchema';
import type { ExportConfig } from '../../types';
import type { CreationDocument, EngineNode } from './types';
import { renderScenePlanFrame, type RenderOptions } from '../safeRenderer';
import { exportRenderedAnimation, type ExportResult } from '../videoExporter';

function syncNodeToElement(node: EngineNode): SceneElement | null {
  if (!node.sourceElement) return null;
  const source = node.sourceElement;
  const position = node.transform.position;
  const rotation = node.transform.rotation;
  return {
    ...source,
    x: Math.max(-0.3, Math.min(1.3, position.x / 28 + 0.5)),
    y: source.y,
    scale: Math.max(0.15, Math.min(3.5, (node.transform.scale.x + node.transform.scale.y + node.transform.scale.z) / 3)),
    opacity: Math.max(0, Math.min(1, node.visible ? node.opacity : 0)),
    rotationDeg: rotation.z,
    pos3d: { ...position },
    rot3d: { ...rotation },
  };
}

/**
 * Compatibility bridge: native node transforms and visibility are synchronized
 * into the existing scene schema without mutating the CreationDocument.
 */
export function toAnimationScenePlan(document: CreationDocument): AnimationScenePlan {
  return {
    planVersion: 1,
    renderMode: document.renderMode,
    visualStyle: document.visualStyle as AnimationScenePlan['visualStyle'],
    title: document.title,
    summary: document.summary,
    width: document.timeline.width,
    height: document.timeline.height,
    fps: document.timeline.fps,
    totalDurationSec: document.timeline.durationSec,
    scenes: document.scenes.map((scene) => ({
      ...scene.sourceSegment,
      elements: scene.nodes.map(syncNodeToElement).filter((element): element is SceneElement => element !== null),
    })),
    visualContinuity: document.continuity,
  };
}

export function renderCreationDocumentFrame(
  ctx: CanvasRenderingContext2D,
  document: CreationDocument,
  width: number,
  height: number,
  timeSec: number,
  options?: RenderOptions
): void {
  renderScenePlanFrame(ctx, toAnimationScenePlan(document), width, height, timeSec, options);
}

export function exportCreationDocument(
  document: CreationDocument,
  config: ExportConfig,
  onProgress: (percent: number, stageLabel: string) => void,
  signal?: AbortSignal
): Promise<ExportResult> {
  return exportRenderedAnimation(toAnimationScenePlan(document), config, onProgress, signal);
}
