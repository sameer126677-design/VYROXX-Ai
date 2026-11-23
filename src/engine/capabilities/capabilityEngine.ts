import type { AnimationScenePlan, SceneElement } from '../../shared/sceneSchema';

export type CapabilityId =
  | 'canvas-2d'
  | 'three-3d'
  | 'semantic-environments'
  | 'character-animation'
  | 'camera-direction'
  | 'procedural-geometry'
  | 'shader-effects'
  | 'physics'
  | 'typography'
  | 'charts-data'
  | 'external-assets';

export type RecommendedAssist = 'local-render' | 'image-model' | 'video-model';

export interface CapabilityDecision {
  capability: CapabilityId;
  reason: string;
  sceneIds: string[];
}

export interface CreationExecutionPlan {
  version: 1;
  renderMode: '2d' | '3d';
  recommendedAssist: RecommendedAssist;
  decisions: CapabilityDecision[];
  notes: string[];
}

const ELEMENT_CAPABILITIES: Partial<Record<SceneElement['kind'], CapabilityId[]>> = {
  skyline: ['canvas-2d', 'semantic-environments'],
  mountains: ['canvas-2d', 'semantic-environments'],
  trees: ['canvas-2d', 'semantic-environments'],
  clouds: ['canvas-2d', 'semantic-environments'],
  'sun-moon': ['canvas-2d', 'semantic-environments'],
  'grid-floor': ['canvas-2d', 'three-3d'],
  character: ['canvas-2d', 'character-animation'],
  creature: ['canvas-2d', 'character-animation'],
  vehicle: ['canvas-2d', 'three-3d'],
  drone: ['canvas-2d', 'three-3d'],
  planet: ['canvas-2d', 'three-3d'],
  chart: ['canvas-2d', 'charts-data'],
  text: ['canvas-2d', 'typography'],
  logo: ['canvas-2d', 'typography'],
  road: ['canvas-2d', 'three-3d'],
  'particle-burst': ['canvas-2d', 'three-3d'],
  prop: ['canvas-2d', 'three-3d'],
  'energy-ring': ['canvas-2d', 'three-3d', 'shader-effects'],
  'light-beam': ['canvas-2d', 'three-3d', 'shader-effects'],
  building: ['canvas-2d', 'three-3d', 'semantic-environments'],
  product: ['three-3d'],
  'procedural-mesh': ['three-3d', 'procedural-geometry'],
  'shader-fx': ['three-3d', 'shader-effects'],
  'external-asset': ['external-assets'],
  custom: ['three-3d', 'procedural-geometry'],
};

const CAPABILITY_REASONS: Record<CapabilityId, string> = {
  'canvas-2d': 'Render 2D motion graphics and vector scene elements.',
  'three-3d': 'Render spatial objects, materials, and 3D scenes.',
  'semantic-environments': 'Build recognizable environment layers from semantic scene elements.',
  'character-animation': 'Animate characters and creatures with identity and pose continuity.',
  'camera-direction': 'Apply scene camera movement and shot progression.',
  'procedural-geometry': 'Create supported geometry and custom procedural models.',
  'shader-effects': 'Render supported shader and energy effects.',
  physics: 'Evaluate supported deterministic physics behaviours.',
  typography: 'Render titles, labels, and logo-style graphic content.',
  'charts-data': 'Render structured chart and data visualizations.',
  'external-assets': 'Load a user-provided or generated external asset.',
};

function addDecision(
  map: Map<CapabilityId, Set<string>>,
  capability: CapabilityId,
  sceneId: string
): void {
  const scenes = map.get(capability) ?? new Set<string>();
  scenes.add(sceneId);
  map.set(capability, scenes);
}

/**
 * Converts a validated scene plan into an explicit execution decision.
 * This first version only routes work to capabilities already implemented in VYROXX;
 * external model choices are recommendations, not API calls.
 */
export function buildCreationExecutionPlan(
  prompt: string,
  plan: AnimationScenePlan
): CreationExecutionPlan {
  const decisions = new Map<CapabilityId, Set<string>>();
  const is3d = plan.renderMode === '3d' || plan.scenes.some((scene) => Boolean(scene.scene3d));
  const baseRenderer: CapabilityId = is3d ? 'three-3d' : 'canvas-2d';

  for (const scene of plan.scenes) {
    addDecision(decisions, baseRenderer, scene.id);
    addDecision(decisions, 'camera-direction', scene.id);

    for (const element of scene.elements) {
      for (const capability of ELEMENT_CAPABILITIES[element.kind] ?? []) {
        addDecision(decisions, capability, scene.id);
      }
      if (element.physicsSpec && element.physicsSpec.mode !== 'none') {
        addDecision(decisions, 'physics', scene.id);
      }
      if (element.shaderSpec && element.shaderSpec.preset !== 'none') {
        addDecision(decisions, 'shader-effects', scene.id);
      }
      if (element.customModelSpec) {
        addDecision(decisions, 'procedural-geometry', scene.id);
      }
    }
  }

  const normalizedPrompt = prompt.toLowerCase();
  const notes: string[] = [];
  let recommendedAssist: RecommendedAssist = 'local-render';

  const asksForGeneratedStill =
    /photorealistic (?:image|still|portrait)|generate (?:an? )?(?:image|picture)|image generation|realistic product photo/.test(normalizedPrompt);
  const asksForGenerativeVideo =
    /live.action footage|photorealistic video|real footage|unrestricted video generation|complex fluid simulation|realistic human acting/.test(normalizedPrompt);

  if (asksForGenerativeVideo) {
    recommendedAssist = 'video-model';
    notes.push('Prompt suggests visuals beyond the current deterministic renderer; an external video model may be needed for the requested fidelity.');
  } else if (asksForGeneratedStill) {
    recommendedAssist = 'image-model';
    notes.push('Prompt requests a generated still image; an image model may be useful as an asset source.');
  }

  if (plan.scenes.some((scene) => scene.elements.some((element) => element.kind === 'external-asset'))) {
    notes.push('The scene plan references external assets; confirm that each asset is available before rendering.');
  }

  return {
    version: 1,
    renderMode: is3d ? '3d' : '2d',
    recommendedAssist,
    decisions: [...decisions.entries()].map(([capability, sceneIds]) => ({
      capability,
      reason: CAPABILITY_REASONS[capability],
      sceneIds: [...sceneIds],
    })),
    notes,
  };
}
