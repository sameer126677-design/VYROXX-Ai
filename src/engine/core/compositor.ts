import type { CreationDocument, EngineScene } from './types';

export interface CompositeLayer {
  id: string;
  sceneId: string;
  nodeId: string;
  order: number;
  opacity: number;
  startFrame: number;
  endFrame: number;
  blendMode: 'normal';
}
export interface CompositePlan {
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  layers: CompositeLayer[];
  transitions: Array<{ fromSceneId: string; toSceneId: string; startFrame: number; durationFrames: number; type: EngineScene['transition'] }>;
}

/** Creates a renderer-neutral layer stack and explicit transition windows. */
export function buildCompositePlan(document: CreationDocument): CompositePlan {
  const layers: CompositeLayer[] = [];
  const transitions: CompositePlan['transitions'] = [];
  for (let index = 0; index < document.scenes.length; index += 1) {
    const scene = document.scenes[index];
    for (const node of scene.nodes) {
      layers.push({
        id: `layer-${scene.id}-${node.id}`,
        sceneId: scene.id,
        nodeId: node.id,
        order: node.zIndex,
        opacity: node.opacity,
        startFrame: scene.startFrame,
        endFrame: scene.endFrame,
        blendMode: 'normal',
      });
    }
    const next = document.scenes[index + 1];
    if (next && scene.transition !== 'cut') {
      transitions.push({
        fromSceneId: scene.id,
        toSceneId: next.id,
        startFrame: Math.max(scene.startFrame, scene.endFrame - Math.min(Math.round(document.timeline.fps * 0.65), Math.round((scene.endFrame - scene.startFrame) * 0.25))),
        durationFrames: Math.min(Math.round(document.timeline.fps * 0.65), Math.round((scene.endFrame - scene.startFrame) * 0.25)),
        type: scene.transition,
      });
    }
  }
  return {
    width: document.timeline.width,
    height: document.timeline.height,
    fps: document.timeline.fps,
    totalFrames: document.timeline.totalFrames,
    layers: layers.sort((a, b) => a.startFrame - b.startFrame || a.order - b.order),
    transitions,
  };
}
