import type { CreationDocument, EngineQualityIssue, Transform3D } from './types';
import { inspectCreationDocument, sanitizeTransform } from './quality';

export interface RepairPatch {
  issueId: string;
  action: 'clamp-opacity' | 'sanitize-transform' | 'reassign-node-id' | 'none';
  sceneId?: string;
  nodeId?: string;
  value?: number | string | Transform3D;
}
export interface RepairPlan { patches: RepairPatch[]; unresolved: EngineQualityIssue[]; }

/** Produces explicit, reviewable repairs; hierarchy and identity changes remain manual. */
export function createRepairPlan(document: CreationDocument): RepairPlan {
  const inspected = inspectCreationDocument(document);
  const patches: RepairPatch[] = [];
  const unresolved: EngineQualityIssue[] = [];
  for (const issue of inspected.quality.issues) {
    const scene = issue.sceneId ? document.scenes.find((item) => item.id === issue.sceneId) : undefined;
    const node = scene?.nodes.find((item) => item.id === issue.nodeId);
    if (issue.code === 'INVALID_OPACITY' && scene && node) {
      patches.push({ issueId: issue.id, action: 'clamp-opacity', sceneId: scene.id, nodeId: node.id, value: Number.isFinite(node.opacity) ? Math.max(0, Math.min(1, node.opacity)) : 1 });
    } else if (issue.code === 'INVALID_TRANSFORM' && scene && node) {
      patches.push({ issueId: issue.id, action: 'sanitize-transform', sceneId: scene.id, nodeId: node.id, value: sanitizeTransform(node.transform) });
    } else unresolved.push(issue);
  }
  return { patches, unresolved };
}

export function applyRepairPlan(document: CreationDocument, plan: RepairPlan): CreationDocument {
  const patches = new Map(plan.patches.filter((patch) => patch.sceneId && patch.nodeId).map((patch) => [`${patch.sceneId}:${patch.nodeId}`, patch]));
  const scenes = document.scenes.map((scene) => ({
    ...scene,
    nodes: scene.nodes.map((node) => {
      const patch = patches.get(`${scene.id}:${node.id}`);
      if (!patch) return node;
      if (patch.action === 'clamp-opacity') return { ...node, opacity: Number(patch.value) };
      if (patch.action === 'sanitize-transform') return { ...node, transform: patch.value as Transform3D };
      return node;
    }),
  }));
  return inspectCreationDocument({ ...document, scenes });
}
