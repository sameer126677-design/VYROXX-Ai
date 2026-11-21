import * as THREE from 'three';
import {
  Scene3DConfig,
  SceneElement,
  VisualStyle,
} from '../../shared/sceneSchema';
import {
  createAsphaltTexture,
  createSeededRng,
  createSoftParticleTexture,
  createTrackTexture,
  hashSeed,
} from './materials';
import {
  createBuildingGroup,
  createDroneGroup,
  createForestInstancedGroup,
  createHumanoidRig,
  createMountainRangeGroup,
  createPlanetGroup,
  createProductShowcaseGroup,
  createSkylineCluster,
  createVehicleGroup,
} from './models';
import { attachExternalAssetIntoContainer } from './assetLoader';
import { createCustomModelGroup } from './customModel';
import {
  applyVisualStyleToObject,
  createShaderMaterialFromSpec,
} from './styleRegistry';

export interface ObjectBuildContext {
  scene3d?: Scene3DConfig;
  visualStyle: VisualStyle;
  hasRoad: boolean;
  maxAnisotropy: number;
  fetchProtectedAssetBytes?: (storagePath: string) => Promise<ArrayBuffer>;
}

export type ObjectBuilderFn = (
  el: SceneElement,
  ctx: ObjectBuildContext
) => THREE.Group | null;

const objectBuilderRegistry = new Map<string, ObjectBuilderFn>();

export function registerObjectBuilder(
  kind: string,
  builder: ObjectBuilderFn
): void {
  objectBuilderRegistry.set(kind, builder);
}

export function unregisterObjectBuilder(kind: string): boolean {
  return objectBuilderRegistry.delete(kind);
}

export function getRegisteredObjectKinds(): string[] {
  return Array.from(objectBuilderRegistry.keys());
}

const characterBuilder: ObjectBuilderFn = (el) => {
  return createHumanoidRig(
    el,
    el.characterSpec || {
      archetype: el.kind === 'creature' ? 'zombie' : 'citizen',
      pose: el.variant === 'running' ? 'running' : 'walking',
      expression: 'determined',
      armorStyle: 'tactical',
      armorColor: el.colorPrimary,
      secondaryGearColor: el.colorSecondary,
      headgear: 'none',
      visorColor: el.accentColor,
      cloakOrCoat: false,
      cloakColor: el.colorSecondary,
      weaponOrGear: 'none',
      hairColor: '#1e293b',
      detailLevel: 'high',
    }
  );
};

registerObjectBuilder('character', characterBuilder);
registerObjectBuilder('creature', characterBuilder);

registerObjectBuilder('building', (el, ctx) => {
  return createBuildingGroup(
    el,
    el.buildingSpec3d || {
      floors: 6,
      style: 'modern-glass',
      hasDoorway: false,
      doorwaySide: 'front',
      doorwayWidth: 2.2,
      doorwayHeight: 3,
      doorwayOpen: true,
      interiorLit: true,
      interiorColor: el.accentColor,
    },
    ctx.maxAnisotropy
  );
});

registerObjectBuilder('skyline', (el, ctx) => {
  return createSkylineCluster(el, ctx.maxAnisotropy);
});

registerObjectBuilder('vehicle', (el) => {
  return createVehicleGroup(
    el,
    el.vehicleSpec || {
      subKind: 'sports-car',
      speedLines: true,
      headlights: true,
      exhaustFlame: true,
      wheelSpin: true,
      numberTag: '',
    }
  );
});

registerObjectBuilder('planet', (el) => {
  return createPlanetGroup(
    el,
    el.planetSpec || {
      bodyRole: 'planet',
      radiusScale: 1,
      hasRings: false,
      ringColor: el.accentColor,
      orbitCenterX: 0.5,
      orbitCenterY: 0.5,
      orbitRadiusX: 0,
      orbitRadiusY: 0,
      orbitStartAngle: 0,
      showOrbitPath: false,
      showLabel: false,
      surfaceStyle: 'rocky',
    }
  );
});

registerObjectBuilder('drone', (el) => {
  return createDroneGroup(
    el,
    el.droneSpec || {
      rotorCount: 4,
      hasSearchlight: true,
      searchlightColor: el.accentColor,
      searchlightAngleDeg: 18,
      statusLedColor: '#ef4444',
    }
  );
});

registerObjectBuilder('product', (el) => {
  return createProductShowcaseGroup(
    el,
    el.productSpec3d || {
      productType: 'watch',
      materialFinish: 'brushed-metal',
      hasPedestal: true,
      turntableSpin: false,
    }
  );
});

registerObjectBuilder('mountains', (el) => createMountainRangeGroup(el));
registerObjectBuilder('trees', (el, ctx) =>
  createForestInstancedGroup(el, ctx.hasRoad)
);

registerObjectBuilder('road', (el, ctx) => {
  const s3d = ctx.scene3d;
  const roadGroup = new THREE.Group();
  roadGroup.name = `road_${el.id}`;
  const roadW = el.size3d?.w ?? (el.roadSpec?.lanes ?? 2) * 4.4;
  const roadLen = el.size3d?.d ?? 160;
  const isTrack = s3d?.environment === 'racetrack';
  const roadTex = isTrack
    ? createTrackTexture(
        el.colorSecondary || '#111827',
        el.accentColor || '#ef4444',
        ctx.maxAnisotropy
      )
    : createAsphaltTexture(
        el.colorSecondary || '#111827',
        el.colorPrimary || '#f8fafc',
        el.roadSpec?.lanes ?? 2,
        ctx.maxAnisotropy
      );
  const roadMesh = new THREE.Mesh(
    new THREE.BoxGeometry(roadW, 0.08, roadLen),
    new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: el.roadSpec?.wetReflections ? 0.18 : 0.68,
      metalness: el.roadSpec?.wetReflections ? 0.35 : 0.08,
    })
  );
  roadMesh.position.y = 0.04;
  roadMesh.receiveShadow = true;
  roadMesh.userData.skipOutline = true;
  roadGroup.add(roadMesh);

  if (s3d?.environment === 'street' || s3d?.environment === 'city') {
    const walkMat = new THREE.MeshStandardMaterial({
      color: '#334155',
      roughness: 0.85,
    });
    for (const side of [-1, 1]) {
      const sidewalk = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.18, roadLen),
        walkMat
      );
      sidewalk.position.set(side * (roadW / 2 + 1.6), 0.09, 0);
      sidewalk.receiveShadow = true;
      sidewalk.userData.skipOutline = true;
      roadGroup.add(sidewalk);

      const poleMat = new THREE.MeshStandardMaterial({
        color: '#1e293b',
        metalness: 0.75,
        roughness: 0.35,
      });
      const bulbMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(el.accentColor || '#fde68a'),
        emissive: new THREE.Color(el.accentColor || '#fde68a'),
        emissiveIntensity: 2.2,
      });
      for (let lz = -50; lz <= 50; lz += 20) {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.11, 5.2, 8),
          poleMat
        );
        pole.position.set(side * (roadW / 2 + 0.7), 2.6, lz);
        pole.castShadow = true;
        const arm = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 0.09, 0.09),
          poleMat
        );
        arm.position.set(side * (roadW / 2 + 0.25), 5.15, lz);
        const lamp = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 10, 8),
          bulbMat
        );
        lamp.position.set(side * (roadW / 2 - 0.22), 5.05, lz);
        roadGroup.add(pole, arm, lamp);
      }
    }
  }
  return roadGroup;
});

registerObjectBuilder('energy-ring', (el) => {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.2 * el.scale, 0.12, 16, 48),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(el.colorPrimary),
      emissive: new THREE.Color(el.accentColor),
      emissiveIntensity: 1.8,
    })
  );
  ring.position.y = 2.4 * el.scale;
  g.add(ring);
  return g;
});

registerObjectBuilder('sun-moon', (el) => {
  const g = new THREE.Group();
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(4.2 * el.scale, 24, 18),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(el.colorPrimary) })
  );
  orb.userData.skipOutline = true;
  g.add(orb);
  return g;
});

// Parametric procedural 3D meshes (sphere, cube, torus, cone, icosahedron, torus-knot, wave-plane)
// Bottom of every geometry rests cleanly at local y = 0 for accurate ground-plane physics collisions!
registerObjectBuilder('procedural-mesh', (el, ctx) => {
  const group = new THREE.Group();
  group.name = `procedural_${el.id}`;
  const kind = el.proceduralGeometry ?? 'sphere';
  const w = el.size3d?.w ?? 1.4 * el.scale;
  const h = el.size3d?.h ?? 1.4 * el.scale;
  const d = el.size3d?.d ?? 1.4 * el.scale;
  const lowPoly = ctx.visualStyle === 'low-poly';
  const seg = lowPoly ? 6 : 28;

  let geo: THREE.BufferGeometry;
  let offsetY = h * 0.5;
  if (kind === 'sphere') {
    const r = Math.min(w, h, d) * 0.5;
    geo = new THREE.SphereGeometry(r, lowPoly ? 8 : 28, lowPoly ? 6 : 20);
    offsetY = r;
  } else if (kind === 'torus') {
    const major = w * 0.45;
    const tube = Math.max(0.12, w * 0.15);
    geo = new THREE.TorusGeometry(major, tube, lowPoly ? 6 : 18, lowPoly ? 12 : 42);
    offsetY = major + tube;
  } else if (kind === 'torus-knot') {
    const r = Math.min(w, h) * 0.36;
    geo = new THREE.TorusKnotGeometry(r, r * 0.32, lowPoly ? 32 : 84, lowPoly ? 6 : 14);
    offsetY = r * 1.45;
  } else if (kind === 'cone') {
    geo = new THREE.ConeGeometry(w * 0.5, h, seg);
    offsetY = h * 0.5;
  } else if (kind === 'cylinder') {
    geo = new THREE.CylinderGeometry(w * 0.45, w * 0.45, h, seg);
    offsetY = h * 0.5;
  } else if (kind === 'icosahedron') {
    const r = Math.min(w, h, d) * 0.52;
    geo = new THREE.IcosahedronGeometry(r, lowPoly ? 0 : 1);
    offsetY = r;
  } else if (kind === 'wave-plane') {
    geo = new THREE.PlaneGeometry(w * 4, d * 4, 36, 36);
    geo.rotateX(-Math.PI / 2);
    offsetY = 0.2;
  } else {
    geo = new THREE.BoxGeometry(w, h, d);
    offsetY = h * 0.5;
  }

  const mat =
    el.shaderSpec && el.shaderSpec.preset !== 'none' && el.shaderSpec.preset !== 'toon-outline'
      ? createShaderMaterialFromSpec({
          preset: el.shaderSpec.preset,
          primaryColor: el.shaderSpec.primaryColor || el.colorPrimary,
          secondaryColor: el.shaderSpec.secondaryColor || el.accentColor,
          speed: el.shaderSpec.speed,
          intensity: el.shaderSpec.intensity,
        })
      : new THREE.MeshStandardMaterial({
          color: new THREE.Color(el.colorPrimary),
          roughness: lowPoly ? 0.72 : 0.28,
          metalness: 0.25,
          flatShading: lowPoly,
        });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = offsetY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
});

// Custom GLSL Shader FX Builder (holograms, energy plasma orbs/portals, ocean wave surfaces, neon grids)
registerObjectBuilder('shader-fx', (el) => {
  const group = new THREE.Group();
  group.name = `shader_fx_${el.id}`;
  const spec = el.shaderSpec || {
    preset: 'energy-plasma' as const,
    primaryColor: el.colorPrimary,
    secondaryColor: el.accentColor,
    speed: 1.2,
    intensity: 1.5,
  };
  const preset = spec.preset === 'none' ? 'energy-plasma' : spec.preset;

  const w = el.size3d?.w ?? 3.6 * el.scale;
  const h = el.size3d?.h ?? 3.6 * el.scale;
  const d = el.size3d?.d ?? 3.6 * el.scale;

  let geo: THREE.BufferGeometry;
  let yOffset = h * 0.5;
  if (preset === 'water-waves' || preset === 'neon-grid') {
    geo = new THREE.PlaneGeometry(Math.max(8, w * 4), Math.max(8, d * 4), 48, 48);
    if (preset === 'neon-grid') {
      geo.rotateX(-Math.PI / 2);
      yOffset = 0.06;
    } else {
      geo.rotateX(-Math.PI / 2);
      yOffset = 0.35;
    }
  } else if (preset === 'fresnel-hologram') {
    geo = new THREE.TorusKnotGeometry(Math.min(w, h) * 0.32, Math.min(w, h) * 0.1, 96, 16);
    yOffset = h * 0.55;
  } else {
    geo = new THREE.SphereGeometry(Math.min(w, h, d) * 0.45, 36, 28);
    yOffset = h * 0.55;
  }

  const mat = createShaderMaterialFromSpec({
    preset,
    primaryColor: spec.primaryColor || el.colorPrimary,
    secondaryColor: spec.secondaryColor || el.accentColor,
    speed: spec.speed,
    intensity: spec.intensity,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = yOffset;
  mesh.userData.skipOutline = true;
  group.add(mesh);
  return group;
});

// External .glb / .gltf 3D Asset Builder via Three.js GLTFLoader
registerObjectBuilder('external-asset', (el, ctx) => {
  const group = new THREE.Group();
  group.name = `external_asset_${el.id}`;
  if (el.assetRef) {
    attachExternalAssetIntoContainer(
      group,
      el.assetRef,
      ctx.fetchProtectedAssetBytes
    );
  } else {
    const fallback = new THREE.Mesh(
      new THREE.BoxGeometry(1.4 * el.scale, 1.4 * el.scale, 1.4 * el.scale),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(el.colorPrimary),
        roughness: 0.45,
        metalness: 0.35,
      })
    );
    fallback.position.y = 0.7 * el.scale;
    group.add(fallback);
  }
  return group;
});

registerObjectBuilder('custom', (el) => {
  return createCustomModelGroup(el, el.customModelSpec);
});

registerObjectBuilder('clouds', (el) => {
  const group = new THREE.Group();
  group.name = `clouds_${el.id}`;
  const rng = createSeededRng(hashSeed(`clouds:${el.id}`));
  const clusterCount = Math.max(1, Math.min(6, el.count));
  const cloudMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(el.colorPrimary || '#f1f5f9'),
    emissive: new THREE.Color(el.colorSecondary || '#334155'),
    emissiveIntensity: 0.12,
    roughness: 0.94,
    metalness: 0.02,
    transparent: true,
    opacity: el.opacity ?? 0.86,
  });

  const puffOffsets: Array<[number, number, number, number]> = [
    [0, 0.35, 0, 1.15],
    [-0.95, 0.15, 0.18, 0.88],
    [0.95, 0.18, -0.12, 0.9],
    [-0.45, 0.65, -0.2, 0.78],
    [0.5, 0.58, 0.22, 0.82],
    [0, 0.12, 0.72, 0.7],
  ];

  for (let c = 0; c < clusterCount; c++) {
    const cluster = new THREE.Group();
    const spreadX = clusterCount === 1 ? 0 : (c - (clusterCount - 1) * 0.5) * 6.5 + (rng() - 0.5) * 2.2;
    const spreadY = clusterCount === 1 ? 0 : (rng() - 0.5) * 2.4;
    const spreadZ = clusterCount === 1 ? 0 : (rng() - 0.5) * 6.0;
    cluster.position.set(spreadX, spreadY, spreadZ);

    const baseR = (1.1 + rng() * 0.4) * el.scale;
    for (const [ox, oy, oz, rMul] of puffOffsets) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(baseR * rMul, 16, 12),
        cloudMat
      );
      puff.position.set(ox * baseR, oy * baseR, oz * baseR);
      puff.scale.set(1.15, 0.85, 1.0);
      puff.userData.skipOutline = true;
      cluster.add(puff);
    }
    group.add(cluster);
  }

  if (el.size3d) {
    const box = new THREE.Box3().setFromObject(group);
    const sz = new THREE.Vector3();
    box.getSize(sz);
    if (sz.x > 0.05 && sz.y > 0.05 && sz.z > 0.05) {
      group.scale.set(el.size3d.w / sz.x, el.size3d.h / sz.y, el.size3d.d / sz.z);
    }
  }
  return group;
});

registerObjectBuilder('grid-floor', (el) => {
  const group = new THREE.Group();
  group.name = `grid_floor_${el.id}`;
  const w = el.size3d?.w ?? 40 * el.scale;
  const d = el.size3d?.d ?? 40 * el.scale;
  const gridSize = Math.max(w, d);
  const divisions = Math.max(8, Math.min(60, Math.round(gridSize / 2)));

  const basePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(el.colorSecondary || '#0f172a'),
      roughness: 0.72,
      metalness: 0.2,
      transparent: true,
      opacity: el.opacity ?? 0.45,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
  );
  basePlane.rotation.x = -Math.PI / 2;
  basePlane.receiveShadow = true;
  basePlane.userData.skipOutline = true;
  group.add(basePlane);

  const grid = new THREE.GridHelper(
    gridSize,
    divisions,
    new THREE.Color(el.accentColor || '#38bdf8'),
    new THREE.Color(el.colorPrimary || '#334155')
  );
  grid.position.y = 0.02;
  if (Math.abs(w - d) > 0.1) {
    grid.scale.set(w / gridSize, 1, d / gridSize);
  }
  group.add(grid);
  return group;
});

registerObjectBuilder('particle-burst', (el) => {
  const group = new THREE.Group();
  group.name = `particle_burst_${el.id}`;
  const rng = createSeededRng(hashSeed(`burst:${el.id}`));
  const radius = el.size3d
    ? Math.max(0.5, Math.max(el.size3d.w, el.size3d.h, el.size3d.d) * 0.5)
    : 2.2 * el.scale;

  const pointCount = Math.min(240, 80 + el.count * 16);
  const positions = new Float32Array(pointCount * 3);
  for (let i = 0; i < pointCount; i++) {
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    const r = (0.15 + Math.pow(rng(), 0.65) * 0.85) * radius;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = Math.max(0.08, radius * 0.45 + r * Math.cos(phi));
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const pointsGeo = new THREE.BufferGeometry();
  pointsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pointsMat = new THREE.PointsMaterial({
    color: new THREE.Color(el.accentColor || el.colorPrimary),
    size: Math.max(0.1, 0.18 * el.scale),
    map: createSoftParticleTexture(64),
    transparent: true,
    opacity: el.opacity ?? 0.9,
    alphaTest: 0.01,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(pointsGeo, pointsMat);
  group.add(points);

  const shardCount = Math.min(20, 8 + el.count * 2);
  const shardGeo = new THREE.IcosahedronGeometry(Math.max(0.06, 0.1 * el.scale), 0);
  const shardMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(el.colorPrimary),
    emissive: new THREE.Color(el.accentColor || el.colorPrimary),
    emissiveIntensity: 2.0,
    roughness: 0.25,
    transparent: true,
    opacity: el.opacity ?? 0.92,
  });
  for (let i = 0; i < shardCount; i++) {
    const theta = (i / shardCount) * Math.PI * 2 + rng() * 0.4;
    const phi = 0.25 + rng() * (Math.PI * 0.65);
    const r = (0.3 + rng() * 0.6) * radius;
    const shard = new THREE.Mesh(shardGeo, shardMat);
    shard.position.set(
      r * Math.sin(phi) * Math.cos(theta),
      Math.max(0.1, radius * 0.45 + r * Math.cos(phi)),
      r * Math.sin(phi) * Math.sin(theta)
    );
    const s = 0.6 + rng() * 0.8;
    shard.scale.setScalar(s);
    shard.userData.skipOutline = true;
    group.add(shard);
  }

  return group;
});

registerObjectBuilder('light-beam', (el) => {
  const group = new THREE.Group();
  group.name = `light_beam_${el.id}`;
  const h = el.size3d?.h ?? 9.5 * el.scale;
  const w = el.size3d?.w ?? 2.4 * el.scale;
  const rTop = Math.max(0.08, w * 0.18);
  const rBottom = Math.max(0.25, w * 0.5);
  const opacityScale = el.opacity ?? 1;

  const outerBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop, rBottom, h, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(el.accentColor || el.colorPrimary),
      transparent: true,
      opacity: 0.24 * opacityScale,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  outerBeam.position.y = h * 0.5;
  outerBeam.userData.skipOutline = true;

  const innerCore = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop * 0.45, rBottom * 0.42, h, 18, 1, true),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(el.colorPrimary || el.accentColor),
      transparent: true,
      opacity: 0.48 * opacityScale,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  innerCore.position.y = h * 0.5;
  innerCore.userData.skipOutline = true;

  const emitterCap = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop * 1.15, rTop * 1.15, 0.14, 18),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(el.accentColor || '#ffffff'),
      emissive: new THREE.Color(el.accentColor || el.colorPrimary),
      emissiveIntensity: 2.2,
    })
  );
  emitterCap.position.y = h;
  emitterCap.userData.skipOutline = true;

  group.add(outerBeam, innerCore, emitterCap);
  return group;
});

registerObjectBuilder('text', () => null);
registerObjectBuilder('chart', () => null);
registerObjectBuilder('logo', () => null);

registerObjectBuilder('prop', (el) => {
  const propGroup = new THREE.Group();
  const w = el.size3d?.w ?? 1.2 * el.scale;
  const h = el.size3d?.h ?? 1.4 * el.scale;
  const d = el.size3d?.d ?? 1.2 * el.scale;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(el.colorPrimary),
      roughness: 0.45,
      metalness: 0.4,
    })
  );
  base.position.y = h / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.86, h * 0.14, d * 0.86),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(el.accentColor),
      emissive: new THREE.Color(el.accentColor),
      emissiveIntensity: 0.8,
    })
  );
  cap.position.y = h + (h * 0.14) / 2;
  propGroup.add(base, cap);
  return propGroup;
});

export function buildObjectForElement(
  el: SceneElement,
  ctx: ObjectBuildContext
): THREE.Group | null {
  const builder =
    objectBuilderRegistry.get(el.kind) ?? objectBuilderRegistry.get('prop');
  if (!builder) return null;

  const built = builder(el, ctx);
  if (!built) return null;

  // Apply scene or element visual style adapter (anime-cel, low-poly, stylized-3d, hologram-shader, realistic-pbr)
  if (
    el.kind !== 'shader-fx' &&
    el.kind !== 'sun-moon' &&
    el.kind !== 'light-beam' &&
    el.kind !== 'particle-burst'
  ) {
    applyVisualStyleToObject(built, ctx.visualStyle, {
      shaderSpec: el.shaderSpec,
    });
  } else if (el.shaderSpec?.preset === 'toon-outline') {
    applyVisualStyleToObject(built, ctx.visualStyle, {
      shaderSpec: el.shaderSpec,
    });
  }

  return built;
}
