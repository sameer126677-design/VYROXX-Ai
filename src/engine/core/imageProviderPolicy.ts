import type { CreationDocument, EngineScene } from './types';

export interface ImageProviderDecision {
  required: boolean;
  reason: string;
  sceneIds: string[];
  nodeIds: string[];
  purpose: 'character' | 'environment' | 'prop' | 'texture' | 'keyframe' | 'other';
}
const GENERATED_STILL_TERMS = /photorealistic|photo-real|realistic portrait|product photo|texture map|seamless texture|image reference|hand-painted background/i;

/** Evaluates explicit fidelity/asset needs. It does not call an image provider. */
export function decideImageProviderUse(document: CreationDocument): ImageProviderDecision {
  const sceneIds = new Set<string>();
  const nodeIds = new Set<string>();
  let purpose: ImageProviderDecision['purpose'] = 'other';
  let reason = 'Current scene elements can be constructed by the local VYROXX visual pipeline.';
  for (const scene of document.scenes) {
    for (const node of scene.nodes) {
      const source = node.sourceElement;
      if (node.kind === 'external-asset' && node.assetRefs.length === 0) {
        sceneIds.add(scene.id); nodeIds.add(node.id); purpose = 'other';
        reason = 'A scene element explicitly references an external asset that has not been supplied.';
      }
      const text = [node.name, source?.label, source?.textSpec?.text].filter(Boolean).join(' ');
      if (GENERATED_STILL_TERMS.test(text)) {
        sceneIds.add(scene.id); nodeIds.add(node.id);
        purpose = node.kind === 'character' ? 'character' : node.kind === 'building' || node.kind === 'skyline' ? 'environment' : 'other';
        reason = 'The request includes a still-image fidelity or texture requirement that may benefit from image generation.';
      }
    }
  }
  return { required: nodeIds.size > 0, reason, sceneIds: [...sceneIds], nodeIds: [...nodeIds], purpose };
}
