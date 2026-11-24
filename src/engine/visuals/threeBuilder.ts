import * as THREE from 'three';
import type { SceneElement } from '../../shared/sceneSchema';
import type { VisualBlueprint } from './proceduralBuilder';
import { buildVisualBlueprint } from './proceduralBuilder';

function material(color: string, roughness = 0.72, metalness = 0.08): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
function mesh(geometry: THREE.BufferGeometry, color: string, roughness?: number, metalness?: number): THREE.Mesh {
  return new THREE.Mesh(geometry, material(color, roughness, metalness));
}
function part(group: THREE.Group, geometry: THREE.BufferGeometry, color: string, position: [number, number, number], scale: [number, number, number] = [1, 1, 1], rotation?: [number, number, number], metalness = 0.08): THREE.Mesh {
  const object = mesh(geometry, color, 0.62, metalness);
  object.position.set(...position);
  object.scale.set(...scale);
  if (rotation) object.rotation.set(...rotation);
  group.add(object);
  return object;
}
function seededRandom(seedText: string): () => number {
  let seed = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) seed = Math.imul(seed ^ seedText.charCodeAt(i), 16777619);
  return () => {
    seed += 0x6D2B79F5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
function particles(color: string, seed: string): THREE.Points {
  const random = seededRandom(seed);
  const geometry = new THREE.BufferGeometry();
  const points = new Float32Array(180);
  for (let i = 0; i < points.length; i += 3) {
    points[i] = (random() - 0.5) * 2;
    points[i + 1] = (random() - 0.5) * 2;
    points[i + 2] = (random() - 0.5) * 2;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ color, size: 0.055, sizeAttenuation: true }));
}
function addSemanticLayer(group: THREE.Group, role: string, primitive: VisualBlueprint['primitive'], color: string, index: number, seed: string): void {
  const offset = index * 0.045;
  const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number) =>
    part(group, new THREE.BoxGeometry(1, 1, 1), color, [x, y + offset, z], [sx, sy, sz]);
  if (role.includes('planet-body')) {
    part(group, new THREE.SphereGeometry(0.9, 40, 28), color, [0, offset, 0], [1, 1, 1], undefined, 0.18);
    return;
  }
  if (role.includes('orbital-ring') || role.includes('glow')) {
    part(group, new THREE.TorusGeometry(1.12, 0.075, 12, 64), color, [0, offset, 0], [1.35, 1, 1], [Math.PI / 2.8, 0, 0], 0.35);
    return;
  }
  if (role.includes('structure')) {
    box(0, 0.65, 0, 1.15, 1.3, 0.85);
    return;
  }
  if (role.includes('windows')) {
    for (let row = 0; row < 3; row += 1) for (let col = -1; col <= 1; col += 1) {
      box(col * 0.29, 0.35 + row * 0.31, 0.435, 0.12, 0.16, 0.025);
    }
    return;
  }
  if (role.includes('entrance')) {
    box(0, 0.2, 0.46, 0.24, 0.42, 0.04);
    return;
  }
  if (role.includes('chassis')) {
    box(0, 0.28, 0, 1.65, 0.38, 0.72);
    box(0.12, 0.58, 0, 0.82, 0.34, 0.62);
    for (const x of [-0.55, 0.55]) for (const z of [-0.39, 0.39]) {
      part(group, new THREE.CylinderGeometry(0.18, 0.18, 0.12, 20), '#171c27', [x, 0.18 + offset, z], [1, 1, 1], [Math.PI / 2, 0, 0]);
    }
    return;
  }
  if (role.includes('glass')) {
    box(0.12, 0.6, 0, 0.72, 0.27, 0.58);
    return;
  }
  if (role.includes('lights')) {
    for (const x of [-0.72, 0.72]) part(group, new THREE.SphereGeometry(0.09, 12, 10), color, [x, 0.36 + offset, 0.18], [1, 0.7, 0.55], undefined, 0.2);
    return;
  }
  if (role.includes('rotors')) {
    for (const x of [-0.55, 0.55]) for (const z of [-0.42, 0.42]) {
      part(group, new THREE.CylinderGeometry(0.035, 0.035, 0.16, 10), color, [x, 0.42 + offset, z]);
      part(group, new THREE.TorusGeometry(0.2, 0.025, 8, 24), color, [x, 0.53 + offset, z], [1, 1, 0.75]);
    }
    return;
  }
  if (role.includes('trunks')) {
    part(group, new THREE.CylinderGeometry(0.12, 0.18, 1.1, 12), color, [0, 0.35 + offset, 0]);
    return;
  }
  if (role.includes('canopies')) {
    part(group, new THREE.IcosahedronGeometry(0.62, 1), color, [0, 1.05 + offset, 0], [1, 1.15, 1]);
    return;
  }
  if (role.includes('mountain')) {
    part(group, new THREE.ConeGeometry(0.85, 1.7, 5), color, [0, 0.75 + offset, 0], [1.3, 1, 0.85]);
    return;
  }
  if (role.includes('snow-or-highlight')) {
    part(group, new THREE.ConeGeometry(0.36, 0.58, 5), color, [0, 1.42 + offset, 0], [1.2, 1, 0.9]);
    return;
  }
  if (role.includes('road-surface')) {
    part(group, new THREE.PlaneGeometry(5, 3), color, [0, offset, 0], [1, 1, 1], [-Math.PI / 2, 0, 0]);
    return;
  }
  if (role.includes('lane-markings')) {
    for (let x = -1.8; x <= 1.8; x += 0.9) box(x, 0.012, 0, 0.42, 0.018, 0.055);
    return;
  }
  if (role.includes('typography') || role.includes('brand-type')) {
    box(0, 0, 0, 1.8, 0.18, 0.06);
    return;
  }
  if (role.includes('emblem')) {
    part(group, new THREE.CylinderGeometry(0.55, 0.55, 0.12, 6), color, [0, offset, 0], [1, 1, 1], [Math.PI / 2, 0, 0], 0.3);
    return;
  }
  let object: THREE.Object3D;
  switch (primitive) {
    case 'plane': object = mesh(new THREE.PlaneGeometry(4, 4), color); break;
    case 'sphere': object = mesh(new THREE.SphereGeometry(0.8, 24, 16), color); break;
    case 'cylinder': object = mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.4, 16), color); break;
    case 'cone': object = mesh(new THREE.ConeGeometry(0.65, 1.5, 16), color); break;
    case 'torus': object = mesh(new THREE.TorusGeometry(0.8, 0.12, 10, 32), color); break;
    case 'particles': object = particles(color, seed); break;
    case 'text': object = mesh(new THREE.BoxGeometry(1.6, 0.16, 0.08), color); break;
    case 'box':
    case 'composite':
    default: object = mesh(new THREE.BoxGeometry(1.2, 1.2, 0.7), color); break;
  }
  object.position.y = offset;
  group.add(object);
}

/** Builds deterministic multi-part Three.js geometry from semantic blueprint layers. */
export function buildThreeObjectFromBlueprint(blueprint: VisualBlueprint): THREE.Group {
  const group = new THREE.Group();
  group.name = blueprint.label;
  blueprint.layers.forEach((layer, index) =>
    addSemanticLayer(group, layer.role, layer.primitive, layer.color, index, `${blueprint.id}:${layer.id}`)
  );
  group.position.set(blueprint.transform.position.x, blueprint.transform.position.y, blueprint.transform.position.z);
  group.rotation.set(
    THREE.MathUtils.degToRad(blueprint.transform.rotation.x),
    THREE.MathUtils.degToRad(blueprint.transform.rotation.y),
    THREE.MathUtils.degToRad(blueprint.transform.rotation.z)
  );
  group.scale.set(blueprint.transform.scale.x, blueprint.transform.scale.y, blueprint.transform.scale.z);
  group.visible = blueprint.visible ?? true;
  const opacity = THREE.MathUtils.clamp(blueprint.opacity ?? 1, 0, 1);
  group.traverse((child) => {
    const renderable = child as THREE.Mesh | THREE.Points;
    if (!('material' in renderable) || !renderable.material) return;
    const materials = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
    materials.forEach((entry) => {
      const transparentMaterial = entry as THREE.Material;
      transparentMaterial.transparent = opacity < 1;
      transparentMaterial.opacity = opacity;
      transparentMaterial.depthWrite = opacity >= 1;
    });
  });
  return group;
}
export function buildThreeObjectForElement(element: SceneElement): THREE.Group {
  return buildThreeObjectFromBlueprint(buildVisualBlueprint(element));
}
