import type { AnimationScenePlan } from '../../shared/sceneSchema';
import type { ExportConfig } from '../../types';
import type { CreationDocument } from './types';
import { renderScenePlanFrame, type RenderOptions } from '../safeRenderer';
import { exportRenderedAnimation, type ExportResult } from '../videoExporter';

/**
 * Compatibility bridge: the native engine document remains the source of truth,
 * while proven Canvas/Three renderers continue consuming their established schema.
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
    scenes: document.scenes.map((scene) => scene.sourceSegment),
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
