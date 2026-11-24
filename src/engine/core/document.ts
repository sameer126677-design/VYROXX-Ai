import type { AnimationScenePlan, SceneElement, SceneSegment } from '../../shared/sceneSchema';
import type { CreationDocument, EngineNode, EngineScene, EngineRequirement } from './types';
import { VYROXX_DOCUMENT_VERSION } from './types';

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}
function toNode(element: SceneElement, index: number): EngineNode {
  return {
    id: element.id,
    kind: element.kind,
    name: element.label,
    parentId: null,
    visible: true,
    locked: false,
    transform: {
      position: element.pos3d ?? { x: (element.x - 0.5) * 28, y: 0, z: (1 - element.depth) * -36 },
      rotation: element.rot3d ?? { x: 0, y: 0, z: finite(element.rotationDeg ?? 0, 0) },
      scale: { x: element.scale, y: element.scale, z: element.scale },
    },
    opacity: finite(element.opacity ?? 1, 1),
    zIndex: index,
    sourceElement: element,
    assetRefs: element.assetRef ? [{
      id: element.assetRef.id ?? element.id,
      source: 'user',
      mimeType: element.assetRef.mimeType,
      storagePath: element.assetRef.storagePath,
    }] : [],
    tags: [element.kind, element.variant],
  };
}
function toScene(segment: SceneSegment, index: number, fps: number, visualStyle: string): EngineScene {
  const startFrame = index === 0 ? 0 : 0;
  const endFrame = startFrame + Math.max(1, Math.round(segment.durationSec * fps));
  return {
    id: segment.id,
    name: segment.title,
    durationSec: segment.durationSec,
    startFrame,
    endFrame,
    transition: segment.transition,
    visualStyle: segment.visualStyle ?? visualStyle,
    background: segment.background,
    lighting: segment.lighting,
    weather: segment.weather,
    camera: { motion: segment.camera.motion, intensity: segment.camera.intensity },
    nodes: segment.elements.map(toNode),
    sourceSegment: segment,
  };
}

/** Creates the versioned native engine document without mutating the AI model's plan. */
export function createCreationDocument(
  prompt: string,
  plan: AnimationScenePlan,
  options: { id?: string; createdAt?: string; planner?: CreationDocument['metadata']['planner'] } = {}
): CreationDocument {
  const fps = Math.max(1, Math.round(finite(plan.fps, 30)));
  let frameCursor = 0;
  const scenes = plan.scenes.map((segment, index) => {
    const scene = toScene(segment, index, fps, plan.visualStyle ?? 'vector-motion');
    scene.startFrame = frameCursor;
    scene.endFrame = frameCursor + Math.max(1, Math.round(segment.durationSec * fps));
    frameCursor = scene.endFrame;
    return scene;
  });
  const requirements: EngineRequirement[] = [
    { id: 'timeline-valid', description: 'Timeline has valid dimensions, frame rate and duration.', category: 'technical', importance: 'must', satisfied: plan.width > 0 && plan.height > 0 && fps > 0 },
    { id: 'scene-content', description: 'Every scene contains at least one visual node.', category: 'visual', importance: 'must', satisfied: scenes.every((scene) => scene.nodes.length > 0) },
    { id: 'continuity-bible', description: 'A visual continuity bible is available to downstream stages.', category: 'continuity', importance: 'should', satisfied: Boolean(plan.visualContinuity) },
  ];
  return {
    documentVersion: VYROXX_DOCUMENT_VERSION,
    id: options.id ?? `vx-${Date.now().toString(36)}`,
    title: plan.title,
    prompt,
    summary: plan.summary,
    timeline: {
      fps,
      totalFrames: frameCursor,
      durationSec: frameCursor / fps,
      width: Math.round(finite(plan.width, 1920)),
      height: Math.round(finite(plan.height, 1080)),
    },
    renderMode: plan.renderMode ?? (plan.scenes.some((scene) => Boolean(scene.scene3d)) ? '3d' : '2d'),
    visualStyle: plan.visualStyle ?? 'vector-motion',
    scenes,
    requirements,
    assets: scenes.flatMap((scene) => scene.nodes.flatMap((node) => node.assetRefs)),
    continuity: plan.visualContinuity,
    quality: { status: 'not-run', score: null, issues: [] },
    metadata: {
      createdAt: options.createdAt ?? new Date().toISOString(),
      source: 'scene-plan',
      planner: options.planner ?? 'existing-ai-model',
      imageProviderRequested: false,
    },
  };
}

/** Rebuilds frame ranges after a scene duration is edited. */
export function reflowTimeline(document: CreationDocument): CreationDocument {
  let cursor = 0;
  const scenes = document.scenes.map((scene) => {
    const length = Math.max(1, Math.round(scene.durationSec * document.timeline.fps));
    const next = { ...scene, startFrame: cursor, endFrame: cursor + length };
    cursor += length;
    return next;
  });
  return {
    ...document,
    scenes,
    timeline: { ...document.timeline, totalFrames: cursor, durationSec: cursor / document.timeline.fps },
  };
}
