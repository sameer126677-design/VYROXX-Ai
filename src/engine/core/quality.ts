import type { CreationDocument, EngineQualityIssue } from './types';

export function inspectCreationDocument(document: CreationDocument): CreationDocument {
  const issues: EngineQualityIssue[] = [];
  const ids = new Set<string>();
  for (const scene of document.scenes) {
    if (scene.nodes.length === 0) issues.push({
      id: `empty-scene-${scene.id}`, severity: 'error', code: 'EMPTY_SCENE',
      message: `Scene "${scene.name}" has no visual nodes.`, sceneId: scene.id,
      repairHint: 'Add at least one visual element or remove the empty scene.',
    });
    for (const node of scene.nodes) {
      if (ids.has(node.id)) issues.push({
        id: `duplicate-${scene.id}-${node.id}`, severity: 'error', code: 'DUPLICATE_NODE_ID',
        message: `Node id "${node.id}" is duplicated in the document.`, sceneId: scene.id, nodeId: node.id,
        repairHint: 'Assign a unique stable id to each scene node.',
      });
      ids.add(node.id);
      if (!Number.isFinite(node.opacity) || node.opacity < 0 || node.opacity > 1) issues.push({
        id: `opacity-${node.id}`, severity: 'warning', code: 'INVALID_OPACITY',
        message: `Node "${node.name}" has opacity outside 0–1.`, sceneId: scene.id, nodeId: node.id,
        repairHint: 'Clamp opacity to the 0–1 range.',
      });
    }
  }
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.filter((issue) => issue.severity === 'warning').length;
  const score = Math.max(0, 100 - errors * 25 - warnings * 8);
  return {
    ...document,
    quality: {
      status: errors ? 'failed' : warnings ? 'needs-review' : 'passed',
      score,
      issues,
      checkedAt: new Date().toISOString(),
    },
  };
}
