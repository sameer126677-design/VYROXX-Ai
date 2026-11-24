import type { CreationDocument, EngineQualityIssue } from './types';
import { inspectCreationDocument } from './quality';

export interface RepairPatch {
  issueId: string;
  action: 'clamp-opacity' | 'reassign-node-id' | 'none';
  sceneId?: string;
  nodeId?: string;
  value?: number | string;
}
export interface RepairPlan { patches: RepairPatch[]; unresolved: EngineQualityIssue[]; }

/** Produces explicit, reviewable repair suggestions; it never silently rewrites the project. */
export function createRepairPlan(document: CreationDocument): RepairPlan {
  const inspected = inspectCreationDocument(document);
  const patches: RepairPatch[] = [];
  const unresolved: EngineQualityIssue[] = [];
  for (const issue of inspected.quality.issues) {
    if (issue.code === 'INVALID_OPACITY' && issue.sceneId && issue.nodeId) {
      const scene = document.scenes.find((item) => item.id === issue.sceneId);
      const node = scene?.nodes.find((item) => item.id === issue.nodeId);
      patches.push({
        issueId: issue.id,
        action: 'clamp-opacity',
        sceneId: issue.sceneId,
        nodeId: issue.nodeId,
        value: Math.max(0, Math.min(1, Number(node?.opacity ?? 1))),
      });
    } else unresolved.push(issue);
  }
  return { patches, unresolved };
}

export function applyRepairPlan(document: CreationDocument, plan: RepairPlan): CreationDocument {
  const patchByNode = new Map(plan.patches.filter((patch) => patch.action === 'clamp-opacity' && patch.sceneId && patch.nodeId).map((patch) => [`${patch.sceneId}:${patch.nodeId}`, Number(patch.value)]));
  const scenes = document.scenes.map((scene) => ({
    ...scene,
    nodes: scene.nodes.map((node) => {
      const value = patchByNode.get(`${scene.id}:${node.id}`);
      return value === undefined ? node : { ...node, opacity: value };
    }),
  }));
  return inspectCreationDocument({ ...document, scenes });
}
