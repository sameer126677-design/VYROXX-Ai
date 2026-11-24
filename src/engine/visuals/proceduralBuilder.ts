import type { SceneElement } from '../../shared/sceneSchema';
import type { EngineNode, EngineScene } from '../core/types';

export type ProceduralPrimitive = 'plane' | 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'particles' | 'text' | 'composite';
export interface VisualBlueprint {
  id: string;
  sourceNodeId: string;
  primitive: ProceduralPrimitive;
  label: string;
  palette: string[];
  transform: EngineNode['transform'];
  detail: 'low' | 'medium' | 'high';
  layers: Array<{ id: string; role: string; primitive: ProceduralPrimitive; color: string; depth: number }>;
  source: 'procedural' | 'asset-required';
}
const PRIMITIVE_BY_KIND: Partial<Record<SceneElement['kind'], ProceduralPrimitive>> = {
  skyline: 'composite', mountains: 'composite', trees: 'composite', clouds: 'composite',
  'sun-moon': 'sphere', 'grid-floor': 'plane', character: 'composite', creature: 'composite',
  vehicle: 'composite', drone: 'composite', planet: 'sphere', chart: 'composite',
  text: 'text', logo: 'composite', road: 'plane', 'particle-burst': 'particles',
  prop: 'composite', 'energy-ring': 'torus', 'light-beam': 'cylinder',
  building: 'composite', product: 'composite', 'procedural-mesh': 'composite',
  'shader-fx': 'particles', 'external-asset': 'composite', custom: 'composite',
};
function layersFor(element: SceneElement): VisualBlueprint['layers'] {
  const base = element.colorPrimary;
  const secondary = element.colorSecondary;
  const accent = element.accentColor;
  const add = (role: string, primitive: ProceduralPrimitive, color: string, depth: number) => ({
    id: `${element.id}-${role}`, role, primitive, color, depth,
  });
  switch (element.kind) {
    case 'character':
    case 'creature':
      return [add('body', 'composite', base, 0), add('gear', 'composite', secondary, 0.08), add('accent', 'sphere', accent, 0.14)];
    case 'planet':
      return [add('planet-body', 'sphere', base, 0), ...(element.planetSpec?.hasRings ? [add('orbital-ring', 'torus', element.planetSpec.ringColor, 0.1)] : [])];
    case 'building':
      return [add('structure', 'box', base, 0), add('windows', 'box', secondary, 0.06), add('entrance', 'box', accent, 0.12)];
    case 'vehicle':
      return [add('chassis', 'composite', base, 0), add('glass', 'box', secondary, 0.08), add('lights', 'sphere', accent, 0.14)];
    case 'drone':
      return [add('body', 'box', base, 0), add('rotors', 'torus', secondary, 0.08), add('status-light', 'sphere', accent, 0.14)];
    case 'skyline':
      return [add('far-buildings', 'box', secondary, -0.1), add('near-buildings', 'box', base, 0), add('windows', 'box', accent, 0.08)];
    case 'trees':
      return [add('trunks', 'cylinder', secondary, 0), add('canopies', 'sphere', base, 0.08)];
    case 'mountains':
      return [add('mountain-ridges', 'composite', base, 0), add('snow-or-highlight', 'cone', secondary, 0.06)];
    case 'clouds':
      return [add('cloud-clusters', 'sphere', base, 0)];
    case 'road':
      return [add('road-surface', 'plane', base, 0), add('lane-markings', 'plane', secondary, 0.04)];
    case 'logo':
      return [add('emblem', 'composite', base, 0), add('brand-type', 'text', secondary, 0.08), add('glow', 'torus', accent, 0.12)];
    case 'text':
      return [add('typography', 'text', base, 0)];
    default:
      return [add('primary-form', PRIMITIVE_BY_KIND[element.kind] ?? 'composite', base, 0), add('secondary-detail', 'composite', secondary, 0.06), add('accent-detail', 'sphere', accent, 0.12)];
  }
}

/** Converts planner elements into deterministic, renderer-neutral visual blueprints. */
export function buildVisualBlueprint(element: SceneElement): VisualBlueprint {
  const needsAsset = element.kind === 'external-asset' && !element.assetRef;
  return {
    id: `visual-${element.id}`,
    sourceNodeId: element.id,
    primitive: PRIMITIVE_BY_KIND[element.kind] ?? 'composite',
    label: element.label,
    palette: [element.colorPrimary, element.colorSecondary, element.accentColor],
    transform: {
      position: element.pos3d ?? { x: (element.x - 0.5) * 28, y: 0, z: (1 - element.depth) * -36 },
      rotation: element.rot3d ?? { x: 0, y: 0, z: element.rotationDeg ?? 0 },
      scale: { x: element.scale, y: element.scale, z: element.scale },
    },
    detail: element.kind === 'character' || element.kind === 'product' ? 'high' : 'medium',
    layers: layersFor(element),
    source: needsAsset ? 'asset-required' : 'procedural',
  };
}
export function buildSceneVisualBlueprints(scene: EngineScene): VisualBlueprint[] {
  return scene.nodes.flatMap((node) => node.sourceElement ? [buildVisualBlueprint(node.sourceElement)] : []);
}
