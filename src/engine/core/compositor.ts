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
export interface ActiveCompositeLayer extends CompositeLayer { frameOpacity: number; }
export interface CompositeFrame {
  frame: number;
  activeLayers: ActiveCompositeLayer[];
  activeSceneIds: string[];
  transition: { fromSceneId: string; toSceneId: string; progress: number; type: EngineScene['transition'] } | null;
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
        opacity: node.visible ? Math.max(0, Math.min(1, node.opacity)) : 0,
        startFrame: scene.startFrame,
        endFrame: scene.endFrame,
        blendMode: 'normal',
      });
    }
    const next = document.scenes[index + 1];
    if (next && scene.transition !== 'cut') {
      const durationFrames = Math.max(1, Math.min(
        Math.round(document.timeline.fps * 0.65),
        Math.round((scene.endFrame - scene.startFrame) * 0.25)
      ));
      transitions.push({
        fromSceneId: scene.id,
        toSceneId: next.id,
        startFrame: Math.max(scene.startFrame, scene.endFrame - durationFrames),
        durationFrames,
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

/** Evaluates visibility and transition alpha for one frame without mutating the plan. */
export function evaluateCompositeFrame(plan: CompositePlan, frame: number): CompositeFrame {
  const safeFrame = Math.max(0, Math.min(Math.max(0, plan.totalFrames - 1), Math.floor(frame)));
  const transition = plan.transitions.find((item) =>
    safeFrame >= item.startFrame && safeFrame < item.startFrame + item.durationFrames
  );
  const progress = transition
    ? Math.max(0, Math.min(1, (safeFrame - transition.startFrame) / Math.max(1, transition.durationFrames)))
    : 0;
  const activeSceneIds = new Set<string>();
  const activeLayers = plan.layers
    .filter((layer) => safeFrame >= layer.startFrame && safeFrame < layer.endFrame && layer.opacity > 0)
    .map((layer) => {
      let frameOpacity = layer.opacity;
      if (transition?.type === 'fade') {
        if (layer.sceneId === transition.fromSceneId) frameOpacity *= 1 - progress;
        if (layer.sceneId === transition.toSceneId) frameOpacity *= progress;
      } else if (transition?.type === 'pan-wipe' && layer.sceneId === transition.toSceneId) {
        frameOpacity *= progress;
      }
      if (frameOpacity > 0) activeSceneIds.add(layer.sceneId);
      return { ...layer, frameOpacity };
    })
    .filter((layer) => layer.frameOpacity > 0)
    .sort((a, b) => a.order - b.order);
  return {
    frame: safeFrame,
    activeLayers,
    activeSceneIds: Array.from(activeSceneIds),
    transition: transition ? {
      fromSceneId: transition.fromSceneId,
      toSceneId: transition.toSceneId,
      progress,
      type: transition.type,
    } : null,
  };
}
