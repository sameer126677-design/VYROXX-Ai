import type { CreationDocument, EngineQualityIssue, Transform3D } from './types';

const finiteVec = (value: { x: number; y: number; z: number }) =>
  Number.isFinite(value?.x) && Number.isFinite(value?.y) && Number.isFinite(value?.z);

export function inspectCreationDocument(document: CreationDocument): CreationDocument {
  const issues: EngineQualityIssue[] = [];
  const documentNodeIds = new Set<string>();
  const sceneIds = new Set<string>();
  if (!Number.isFinite(document.timeline.fps) || document.timeline.fps <= 0 ||
      !Number.isFinite(document.timeline.totalFrames) || document.timeline.totalFrames < 1 ||
      !Number.isFinite(document.timeline.width) || document.timeline.width <= 0 ||
      !Number.isFinite(document.timeline.height) || document.timeline.height <= 0) {
    issues.push({ id: 'invalid-timeline', severity: 'error', code: 'INVALID_TIMELINE', message: 'Timeline frame rate, duration or dimensions are invalid.', repairHint: 'Use positive finite FPS, frame count, width and height.' });
  }
  for (const scene of document.scenes) {
    if (sceneIds.has(scene.id)) issues.push({ id: `duplicate-scene-${scene.id}`, severity: 'error', code: 'DUPLICATE_SCENE_ID', message: `Scene id "${scene.id}" is duplicated.`, sceneId: scene.id, repairHint: 'Assign a unique id to each scene.' });
    sceneIds.add(scene.id);
    if (!Number.isFinite(scene.startFrame) || !Number.isFinite(scene.endFrame) || scene.endFrame <= scene.startFrame) {
      issues.push({ id: `invalid-scene-range-${scene.id}`, severity: 'error', code: 'INVALID_SCENE_RANGE', message: `Scene "${scene.name}" has an invalid frame range.`, sceneId: scene.id, repairHint: 'Reflow the timeline from valid positive scene durations.' });
    }
    if (scene.nodes.length === 0) issues.push({
      id: `empty-scene-${scene.id}`, severity: 'error', code: 'EMPTY_SCENE',
      message: `Scene "${scene.name}" has no visual nodes.`, sceneId: scene.id,
      repairHint: 'Add at least one visual element or remove the empty scene.',
    });
    const localIds = new Set(scene.nodes.map((node) => node.id));
    for (const node of scene.nodes) {
      if (documentNodeIds.has(node.id)) issues.push({
        id: `duplicate-${scene.id}-${node.id}`, severity: 'error', code: 'DUPLICATE_NODE_ID',
        message: `Node id "${node.id}" is duplicated in the document.`, sceneId: scene.id, nodeId: node.id,
        repairHint: 'Assign a unique stable id to each scene node.',
      });
      documentNodeIds.add(node.id);
      if (!Number.isFinite(node.opacity) || node.opacity < 0 || node.opacity > 1) issues.push({
        id: `opacity-${scene.id}-${node.id}`, severity: 'warning', code: 'INVALID_OPACITY',
        message: `Node "${node.name}" has opacity outside 0–1.`, sceneId: scene.id, nodeId: node.id,
        repairHint: 'Clamp opacity to the 0–1 range.',
      });
      const transform = node.transform;
      if (!finiteVec(transform.position) || !finiteVec(transform.rotation) || !finiteVec(transform.scale)) issues.push({
        id: `transform-${scene.id}-${node.id}`, severity: 'error', code: 'INVALID_TRANSFORM',
        message: `Node "${node.name}" contains a non-finite transform value.`, sceneId: scene.id, nodeId: node.id,
        repairHint: 'Replace non-finite position and rotation values with zero and scale values with one.',
      });
      if (node.parentId && !localIds.has(node.parentId)) issues.push({
        id: `missing-parent-${scene.id}-${node.id}`, severity: 'warning', code: 'MISSING_NODE_PARENT',
        message: `Node "${node.name}" references a parent that is not in this scene.`, sceneId: scene.id, nodeId: node.id,
        repairHint: 'Attach the node to a valid scene node or make it a root node.',
      });
    }
    const byId = new Map(scene.nodes.map((node) => [node.id, node]));
    for (const node of scene.nodes) {
      const seen = new Set<string>();
      let cursor = node;
      while (cursor.parentId) {
        if (seen.has(cursor.id)) {
          issues.push({ id: `node-cycle-${scene.id}-${node.id}`, severity: 'error', code: 'NODE_HIERARCHY_CYCLE', message: `Node hierarchy contains a cycle involving "${node.id}".`, sceneId: scene.id, nodeId: node.id, repairHint: 'Break the parent cycle so every hierarchy reaches a root node.' });
          break;
        }
        seen.add(cursor.id);
        const parent = byId.get(cursor.parentId);
        if (!parent) break;
        cursor = parent;
      }
    }
  }
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.filter((issue) => issue.severity === 'warning').length;
  const score = Math.max(0, 100 - errors * 25 - warnings * 8);
  return { ...document, quality: {
    status: errors ? 'failed' : warnings ? 'needs-review' : 'passed',
    score, issues, checkedAt: new Date().toISOString(),
  } };
}

export function sanitizeTransform(transform: Transform3D): Transform3D {
  return {
    position: { x: Number.isFinite(transform.position.x) ? transform.position.x : 0, y: Number.isFinite(transform.position.y) ? transform.position.y : 0, z: Number.isFinite(transform.position.z) ? transform.position.z : 0 },
    rotation: { x: Number.isFinite(transform.rotation.x) ? transform.rotation.x : 0, y: Number.isFinite(transform.rotation.y) ? transform.rotation.y : 0, z: Number.isFinite(transform.rotation.z) ? transform.rotation.z : 0 },
    scale: { x: Number.isFinite(transform.scale.x) && transform.scale.x !== 0 ? transform.scale.x : 1, y: Number.isFinite(transform.scale.y) && transform.scale.y !== 0 ? transform.scale.y : 1, z: Number.isFinite(transform.scale.z) && transform.scale.z !== 0 ? transform.scale.z : 1 },
  };
}
