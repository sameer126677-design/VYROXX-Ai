import * as THREE from 'three';
import type { EnvironmentPlan, EnvironmentPropPlacement } from '../cinematic/environmentDirector';

function buildSky(plan: EnvironmentPlan): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(450, 32, 18);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(plan.sky.top) },
      horizonColor: { value: new THREE.Color(plan.sky.horizon) },
      bottomColor: { value: new THREE.Color(plan.sky.bottom) },
    },
    vertexShader: `varying vec3 vDirection; void main(){ vDirection = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 bottomColor; varying vec3 vDirection; void main(){ float h = normalize(vDirection).y; vec3 color = h > 0.0 ? mix(horizonColor, topColor, smoothstep(0.0, 0.85, h)) : mix(horizonColor, bottomColor, smoothstep(0.0, -0.65, h)); gl_FragColor = vec4(color, 1.0); }`,
  });
  const sky = new THREE.Mesh(geometry, material);
  sky.name = 'VYROXX_Environment_Sky';
  sky.frustumCulled = false;
  return sky;
}

function buildProp(prop: EnvironmentPropPlacement): THREE.Object3D {
  const group = new THREE.Group();
  group.name = prop.id;
  const mat = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.88 });
  if (prop.kind === 'tree') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1, 8), mat('#594331'));
    trunk.position.y = 0.5;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2, 7), mat(prop.color));
    crown.position.y = 1.8;
    group.add(trunk, crown);
  } else if (prop.kind === 'building') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat(prop.color));
    body.position.y = 0.5;
    group.add(body);
    const windows = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.7, 0.025), new THREE.MeshBasicMaterial({ color: '#fbbf24' }));
    windows.position.set(0, 0.52, 0.51);
    group.add(windows);
  } else if (prop.kind === 'crystal') {
    group.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.8), new THREE.MeshStandardMaterial({ color: prop.color, metalness: 0.35, roughness: 0.28 })));
  } else if (prop.kind === 'mountain') {
    group.add(new THREE.Mesh(new THREE.ConeGeometry(1.8, 4, 6), mat(prop.color)));
  } else {
    group.add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 0), mat(prop.color)));
  }
  group.position.set(prop.position.x, prop.position.y, prop.position.z);
  group.rotation.y = prop.rotationY;
  group.scale.set(prop.scale.x, prop.scale.y, prop.scale.z);
  return group;
}

/** Builds a deterministic sky, ground and procedural world scatter group. */
export function buildThreeEnvironment(plan: EnvironmentPlan): THREE.Group {
  const root = new THREE.Group();
  root.name = 'VYROXX_Procedural_Environment';
  root.add(buildSky(plan));
  if (plan.ground.type !== 'none') {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(plan.ground.size, plan.ground.size),
      new THREE.MeshStandardMaterial({ color: plan.ground.color, roughness: plan.ground.roughness, metalness: plan.ground.metalness })
    );
    ground.name = 'VYROXX_Environment_Ground';
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    ground.receiveShadow = true;
    root.add(ground);
  }
  plan.scatter.forEach((prop) => root.add(buildProp(prop)));
  return root;
}

/** Replaces only the previously generated VYROXX environment group and applies its fog. */
export function replaceThreeEnvironment(scene: THREE.Scene, plan: EnvironmentPlan): THREE.Group {
  const previous = scene.getObjectByName('VYROXX_Procedural_Environment');
  if (previous) {
    scene.remove(previous);
    previous.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => material.dispose());
      }
    });
  }
  const environment = buildThreeEnvironment(plan);
  scene.add(environment);
  scene.fog = plan.atmosphere.fogDensity > 0
    ? new THREE.FogExp2(plan.atmosphere.fogColor, plan.atmosphere.fogDensity)
    : null;
  return environment;
}
