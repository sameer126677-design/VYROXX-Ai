import * as THREE from 'three';
import type { SceneElement } from '../../shared/sceneSchema';
import type { VisualBlueprint } from './proceduralBuilder';
import { buildVisualBlueprint } from './proceduralBuilder';

function material(color: string, roughness = 0.72): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.08 });
}
function mesh(geometry: THREE.BufferGeometry, color: string): THREE.Mesh {
  return new THREE.Mesh(geometry, material(color));
}
function addPrimitive(group: THREE.Group, primitive: VisualBlueprint['primitive'], color: string, index: number): void {
  const offset = index * 0.08;
  let object: THREE.Object3D;
  switch (primitive) {
    case 'plane': object = mesh(new THREE.PlaneGeometry(4, 4), color); break;
    case 'sphere': object = mesh(new THREE.SphereGeometry(0.8, 24, 16), color); break;
    case 'cylinder': object = mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.4, 16), color); break;
    case 'cone': object = mesh(new THREE.ConeGeometry(0.65, 1.5, 16), color); break;
    case 'torus': object = mesh(new THREE.TorusGeometry(0.8, 0.12, 10, 32), color); break;
    case 'particles': {
      const geometry = new THREE.BufferGeometry();
      const points = new Float32Array(90);
      for (let i = 0; i < points.length; i += 3) {
        points[i] = (Math.random() - 0.5) * 2;
        points[i + 1] = (Math.random() - 0.5) * 2;
        points[i + 2] = (Math.random() - 0.5) * 2;
      }
      geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
      object = new THREE.Points(geometry, new THREE.PointsMaterial({ color, size: 0.06 }));
      break;
    }
    case 'text':
      object = mesh(new THREE.BoxGeometry(1.6, 0.16, 0.08), color);
      break;
    case 'box':
    case 'composite':
    default: object = mesh(new THREE.BoxGeometry(1.2, 1.2, 0.7), color); break;
  }
  object.position.y = offset;
  group.add(object);
}

/** Builds actual Three.js geometry from a deterministic blueprint. */
export function buildThreeObjectFromBlueprint(blueprint: VisualBlueprint): THREE.Group {
  const group = new THREE.Group();
  group.name = blueprint.label;
  blueprint.layers.forEach((layer, index) => addPrimitive(group, layer.primitive, layer.color, index));
  group.position.set(blueprint.transform.position.x, blueprint.transform.position.y, blueprint.transform.position.z);
  group.rotation.set(
    THREE.MathUtils.degToRad(blueprint.transform.rotation.x),
    THREE.MathUtils.degToRad(blueprint.transform.rotation.y),
    THREE.MathUtils.degToRad(blueprint.transform.rotation.z)
  );
  group.scale.set(blueprint.transform.scale.x, blueprint.transform.scale.y, blueprint.transform.scale.z);
  return group;
}
export function buildThreeObjectForElement(element: SceneElement): THREE.Group {
  return buildThreeObjectFromBlueprint(buildVisualBlueprint(element));
}
