import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  AnimationScenePlan,
  is3DScenePlan,
  normalizeScenePlan,
  validateScenePlan,
} from '../src/shared/sceneSchema';
import { ThreeSceneRuntime } from '../src/engine/three/ThreeSceneRuntime';
import {
  animateCustomModel,
  createCustomModelGroup,
  disposeCustomModel,
} from '../src/engine/three/customModel';
import { getRegisteredObjectKinds } from '../src/engine/three/objectRegistry';
import { createVehicleGroup, VehicleRigData } from '../src/engine/three/models';
import {
  frameCustomCloseUpCamera,
  frameCustomEstablishingCamera,
  frameCustomFocusEndCamera,
  resolveCustomFocusPart,
} from '../src/engine/three/cameraRig';
import { createSoftParticleTexture } from '../src/engine/three/materials';
import { DEV_WHALE_SCENE_PLAN } from './fixtures/devWhale';

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL: ${name} ->`, err instanceof Error ? err.message : err);
  }
}

function makeBaseSegment(overrides: Record<string, unknown>) {
  return {
    id: 'scene_1',
    title: '3D Spatial Scene',
    durationSec: 6,
    transition: 'fade',
    background: {
      mode: 'scene',
      solidColor: '#050814',
      skyTop: '#020617',
      skyBottom: '#0f172a',
      horizonColor: '#1e293b',
      groundColor: '#0f172a',
      groundElevation: 0.72,
    },
    camera: { motion: 'static', intensity: 0.4 },
    lighting: {
      mood: 'cinematic',
      ambientAlpha: 0.3,
      bloomColor: '#38bdf8',
      volumetricRays: true,
      vignette: 0.35,
    },
    weather: { type: 'none', density: 0, windX: 0 },
    ...overrides,
  };
}

function mustNormalize3D(raw: Record<string, unknown>): AnimationScenePlan {
  const res = normalizeScenePlan(raw);
  if (!res.ok) {
    assert.fail(res.error);
  }
  assert.equal(is3DScenePlan(res.data), true, 'Plan must route to Three.js 3D engine');
  return res.data;
}

async function main() {
  console.log('=== VYROXX True Spatial 3D Animation Engine Verification ===\n');

  // Scenario 1: Realistic 3D human character walking through a street
  await runTest(
    'Scenario 1: 3D articulated human character walking down a 3D street with perspective & joint motion',
    () => {
      const plan = mustNormalize3D({
        planVersion: 1,
        renderMode: '3d',
        title: 'Midnight Street Walk',
        summary: '3D human walking along an illuminated street',
        scenes: [
          makeBaseSegment({
            scene3d: {
              environment: 'street',
              groundType: 'asphalt',
              groundSize: 160,
              fogColor: '#0f172a',
              fogDensity: 0.01,
              sunElevationDeg: 28,
              sunAzimuthDeg: 40,
              sunIntensity: 1.5,
              ambientIntensity: 0.8,
              camera3d: {
                projection: 'perspective',
                shotType: 'tracking',
                fov: 50,
                position: { x: 4.5, y: 2.3, z: 13 },
                target: { x: 0, y: 1.2, z: 5 },
                motion: 'follow-subject',
                orbitRadius: 10,
                orbitSpeed: 0,
                followElementId: 'walker_hero',
                followOffset: { x: 4.2, y: 2.1, z: 7.5 },
              },
            },
            elements: [
              {
                id: 'street_road',
                kind: 'road',
                label: 'Main Boulevard',
                x: 0.5,
                y: 0.7,
                scale: 1,
                colorPrimary: '#e2e8f0',
                colorSecondary: '#111827',
                accentColor: '#fde68a',
                variant: 'cinematic',
                count: 1,
                depth: 0.5,
                pos3d: { x: 0, y: 0, z: 0 },
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
                roadSpec: { perspective: 'perspective', lanes: 2, scrollSpeed: 0, wetReflections: false },
              },
              {
                id: 'street_skyline',
                kind: 'skyline',
                label: 'City Block',
                x: 0.5,
                y: 0.5,
                scale: 1,
                colorPrimary: '#1e293b',
                colorSecondary: '#0f172a',
                accentColor: '#38bdf8',
                variant: 'cinematic',
                count: 6,
                depth: 0.3,
                pos3d: { x: 0, y: 0, z: 0 },
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
              },
              {
                id: 'walker_hero',
                kind: 'character',
                label: 'Street Walker',
                x: 0.5,
                y: 0.7,
                scale: 1,
                colorPrimary: '#38bdf8',
                colorSecondary: '#0f172a',
                accentColor: '#22d3ee',
                variant: 'walking',
                count: 1,
                depth: 0.8,
                pos3d: { x: 0, y: 0, z: 8 },
                path3d: [
                  { t: 0, x: 0, y: 0, z: 8 },
                  { t: 1, x: 0, y: 0, z: -10 },
                ],
                motion: { type: 'static', speed: 1.2, amplitude: 0.1, direction: 1 },
                characterSpec: {
                  archetype: 'citizen',
                  pose: 'walking',
                  expression: 'calm',
                  armorStyle: 'trench-coat',
                  armorColor: '#38bdf8',
                  secondaryGearColor: '#0f172a',
                  headgear: 'none',
                  visorColor: '#22d3ee',
                  cloakOrCoat: true,
                  cloakColor: '#0f172a',
                  weaponOrGear: 'none',
                  hairColor: '#1e293b',
                  detailLevel: 'hero',
                },
              },
            ],
          }),
        ],
      });

      const rt = new ThreeSceneRuntime(plan);
      const s0 = rt.inspectSceneAtTime(0.0);
      const s1 = rt.inspectSceneAtTime(1.5);
      const s2 = rt.inspectSceneAtTime(4.5);

      const char0 = s0.elements.find((e) => e.id === 'walker_hero')!;
      const char1 = s1.elements.find((e) => e.id === 'walker_hero')!;
      const char2 = s2.elements.find((e) => e.id === 'walker_hero')!;

      assert.ok(char0.meshCount >= 10, 'Humanoid rig must consist of >=10 articulated 3D meshes');
      assert.ok(Math.abs(char0.boundingBoxMin.y) < 0.25, 'Character feet must touch ground y=0');
      assert.ok(char2.worldPosition.z < char1.worldPosition.z && char1.worldPosition.z < char0.worldPosition.z, 'Character must walk forward in 3D Z space');
      assert.ok(
        Math.abs(char1.jointSample!.leftHipX - char2.jointSample!.leftHipX) > 0.05 ||
          Math.abs(char1.jointSample!.leftHipX - char1.jointSample!.rightHipX) > 0.05,
        'Character hip/knee joints must articulate across walk cycle'
      );
      assert.ok(s2.cameraPosition.z < s0.cameraPosition.z, 'Tracking camera must follow walker down street');
      rt.dispose();
    }
  );

  // Scenario 2: Cinematic 3D city with tall buildings, roads, and correct perspective
  await runTest(
    'Scenario 2: Cinematic 3D city with tall buildings, roads, depth & genuine perspective convergence',
    () => {
      const plan = mustNormalize3D({
        planVersion: 1,
        renderMode: '3d',
        title: 'Metropolis Perspective',
        summary: '3D skyscrapers along boulevard with dolly perspective shift',
        scenes: [
          makeBaseSegment({
            scene3d: {
              environment: 'city',
              groundType: 'asphalt',
              groundSize: 220,
              fogColor: '#0f172a',
              fogDensity: 0.006,
              sunElevationDeg: 35,
              sunAzimuthDeg: 30,
              sunIntensity: 1.8,
              ambientIntensity: 0.85,
              camera3d: {
                projection: 'perspective',
                shotType: 'wide',
                fov: 58,
                position: { x: 0, y: 4, z: 24 },
                target: { x: 0, y: 8, z: -20 },
                endPosition: { x: 8, y: 12, z: 10 },
                endTarget: { x: 0, y: 10, z: -20 },
                motion: 'dolly-in',
                orbitRadius: 20,
                orbitSpeed: 0,
              },
            },
            elements: [
              {
                id: 'city_road',
                kind: 'road',
                label: 'Avenue',
                x: 0.5,
                y: 0.7,
                scale: 1,
                colorPrimary: '#f8fafc',
                colorSecondary: '#0f172a',
                accentColor: '#38bdf8',
                variant: 'cinematic',
                count: 1,
                depth: 0.5,
                pos3d: { x: 0, y: 0, z: -10 },
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
              },
              {
                id: 'near_tower',
                kind: 'building',
                label: 'Foreground Tower',
                x: 0.25,
                y: 0.5,
                scale: 1,
                colorPrimary: '#1e293b',
                colorSecondary: '#0f172a',
                accentColor: '#38bdf8',
                variant: 'futuristic',
                count: 1,
                depth: 0.8,
                pos3d: { x: -10, y: 0, z: 2 },
                size3d: { w: 7, h: 28, d: 7 },
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
              },
              {
                id: 'far_tower',
                kind: 'building',
                label: 'Distant Tower',
                x: 0.75,
                y: 0.5,
                scale: 1,
                colorPrimary: '#1e293b',
                colorSecondary: '#0f172a',
                accentColor: '#ec4899',
                variant: 'neon',
                count: 1,
                depth: 0.2,
                pos3d: { x: 10, y: 0, z: -42 },
                size3d: { w: 7, h: 28, d: 7 },
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
              },
            ],
          }),
        ],
      });

      const rt = new ThreeSceneRuntime(plan);
      const snapStart = rt.inspectSceneAtTime(0);
      const snapMid = rt.inspectSceneAtTime(3.0);

      assert.equal(snapStart.cameraType, 'perspective');
      const near = snapStart.elements.find((e) => e.id === 'near_tower')!;
      const far = snapStart.elements.find((e) => e.id === 'far_tower')!;
      // Both towers sit at x = ±10m, but far tower projects much closer to horizontal center due to 3D perspective convergence!
      const nearDistFromCenter = Math.abs(near.projected.ndcX);
      const farDistFromCenter = Math.abs(far.projected.ndcX);
      assert.ok(
        farDistFromCenter < nearDistFromCenter,
        `Perspective convergence failed: near |ndcX|=${nearDistFromCenter}, far |ndcX|=${farDistFromCenter}`
      );
      assert.ok(near.projected.distanceToCamera < far.projected.distanceToCamera);

      // Camera move alters 2D screen projections cleanly
      const farMid = snapMid.elements.find((e) => e.id === 'far_tower')!;
      assert.ok(
        Math.abs(farMid.projected.screenX - far.projected.screenX) > 15,
        'Moving 3D camera must change projected screen coordinates'
      );
      rt.dispose();
    }
  );

  // Scenario 3: Spaceship flying around a large planet
  await runTest(
    'Scenario 3: Spaceship flying around a large 3D planet with front/back depth occlusion',
    () => {
      const plan = mustNormalize3D({
        planVersion: 1,
        renderMode: '3d',
        title: 'Orbital Flyby',
        summary: 'Starfighter orbiting a ringed planet in deep space',
        scenes: [
          makeBaseSegment({
            weather: { type: 'stars', density: 0.8, windX: 0 },
            scene3d: {
              environment: 'space',
              groundType: 'none',
              groundSize: 200,
              fogColor: '#020617',
              fogDensity: 0,
              sunElevationDeg: 35,
              sunAzimuthDeg: 55,
              sunIntensity: 2.2,
              ambientIntensity: 0.6,
              camera3d: {
                projection: 'perspective',
                shotType: 'wide',
                fov: 50,
                position: { x: 0, y: 6, z: 32 },
                target: { x: 0, y: 0, z: 0 },
                motion: 'static',
                orbitRadius: 32,
                orbitSpeed: 0,
              },
            },
            elements: [
              {
                id: 'planet_main',
                kind: 'planet',
                label: 'Aurelia Prime',
                x: 0.5,
                y: 0.5,
                scale: 1.6,
                colorPrimary: '#3b82f6',
                colorSecondary: '#1e3a8a',
                accentColor: '#38bdf8',
                variant: 'cinematic',
                count: 1,
                depth: 0.5,
                pos3d: { x: 0, y: 0, z: 0 },
                motion: { type: 'static', speed: 0.4, amplitude: 0, direction: 1 },
                planetSpec: {
                  bodyRole: 'planet',
                  radiusScale: 1.2,
                  hasRings: true,
                  ringColor: '#38bdf8',
                  orbitCenterX: 0.5,
                  orbitCenterY: 0.5,
                  orbitRadiusX: 0,
                  orbitRadiusY: 0,
                  orbitStartAngle: 0,
                  showOrbitPath: false,
                  showLabel: false,
                  surfaceStyle: 'earth-like',
                },
              },
              {
                id: 'hero_ship',
                kind: 'vehicle',
                label: 'Valkyrie Interceptor',
                x: 0.5,
                y: 0.5,
                scale: 0.9,
                colorPrimary: '#e2e8f0',
                colorSecondary: '#1e293b',
                accentColor: '#22d3ee',
                variant: 'flying',
                count: 1,
                depth: 0.8,
                pos3d: { x: 16, y: 1, z: 0 },
                path3d: [
                  { t: 0.0, x: 0, y: 1, z: 16 },
                  { t: 0.25, x: 16, y: 1.5, z: 0 },
                  { t: 0.5, x: 0, y: 1, z: -16 },
                  { t: 0.75, x: -16, y: 0.5, z: 0 },
                  { t: 1.0, x: 0, y: 1, z: 16 },
                ],
                motion: { type: 'orbit', speed: 1, amplitude: 0.35, direction: 1 },
                vehicleSpec: {
                  subKind: 'spaceship',
                  speedLines: false,
                  headlights: false,
                  exhaustFlame: true,
                  wheelSpin: false,
                  numberTag: '',
                },
              },
            ],
          }),
        ],
      });

      const rt = new ThreeSceneRuntime(plan);
      const frontSnap = rt.inspectSceneAtTime(0); // ship at z=+16 (closer to cam at z=+32)
      const sideSnap = rt.inspectSceneAtTime(1.5); // ship at x=+16, z=0
      const backSnap = rt.inspectSceneAtTime(3.0); // ship at z=-16 (behind planet)

      const shipFront = frontSnap.elements.find((e) => e.id === 'hero_ship')!;
      const planetFront = frontSnap.elements.find((e) => e.id === 'planet_main')!;
      const shipSide = sideSnap.elements.find((e) => e.id === 'hero_ship')!;
      const shipBack = backSnap.elements.find((e) => e.id === 'hero_ship')!;
      const planetBack = backSnap.elements.find((e) => e.id === 'planet_main')!;

      assert.ok(shipFront.meshCount >= 7, 'Spaceship must have multi-part fuselage/wings/thrusters');
      assert.ok(
        shipFront.projected.distanceToCamera < planetFront.projected.distanceToCamera,
        'At t=0 spaceship must be in front of planet relative to camera'
      );
      assert.ok(
        shipBack.projected.distanceToCamera > planetBack.projected.distanceToCamera,
        'At t=3s spaceship must orbit behind planet (depth occlusion check)'
      );
      assert.ok(shipSide.worldPosition.x > 10, 'Spaceship must sweep laterally around planet');
      rt.dispose();
    }
  );

  // Scenario 4: 3D car racing scene with moving camera tracking
  await runTest(
    'Scenario 4: 3D car racing scene with spinning wheels & moving camera tracking',
    () => {
      const plan = mustNormalize3D({
        planVersion: 1,
        renderMode: '3d',
        title: 'Apex 3D Circuit',
        summary: 'High-speed racing car tracked by a 3D chase camera',
        scenes: [
          makeBaseSegment({
            scene3d: {
              environment: 'racetrack',
              groundType: 'track',
              groundSize: 220,
              fogColor: '#0f172a',
              fogDensity: 0.005,
              sunElevationDeg: 30,
              sunAzimuthDeg: 25,
              sunIntensity: 1.9,
              ambientIntensity: 0.8,
              camera3d: {
                projection: 'perspective',
                shotType: 'tracking',
                fov: 56,
                position: { x: 4, y: 2.5, z: 32 },
                target: { x: 0, y: 1, z: 24 },
                motion: 'tracking',
                orbitRadius: 10,
                orbitSpeed: 0,
                followElementId: 'race_car',
                followOffset: { x: 3.8, y: 2.2, z: 8.5 },
              },
            },
            elements: [
              {
                id: 'track_1',
                kind: 'road',
                label: 'Circuit Straight',
                x: 0.5,
                y: 0.7,
                scale: 1,
                colorPrimary: '#f8fafc',
                colorSecondary: '#111827',
                accentColor: '#ef4444',
                variant: 'cinematic',
                count: 1,
                depth: 0.5,
                pos3d: { x: 0, y: 0, z: -10 },
                size3d: { w: 12, h: 1, d: 180 },
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
              },
              {
                id: 'race_car',
                kind: 'vehicle',
                label: 'Apex GT #01',
                x: 0.5,
                y: 0.7,
                scale: 1.1,
                colorPrimary: '#ef4444',
                colorSecondary: '#0f172a',
                accentColor: '#38bdf8',
                variant: 'running',
                count: 1,
                depth: 0.85,
                pos3d: { x: 0, y: 0, z: 24 },
                path3d: [
                  { t: 0, x: 0, y: 0, z: 24 },
                  { t: 1, x: 0, y: 0, z: -48 },
                ],
                motion: { type: 'static', speed: 2.5, amplitude: 0, direction: 1 },
                vehicleSpec: {
                  subKind: 'racing-car',
                  speedLines: true,
                  headlights: true,
                  exhaustFlame: true,
                  wheelSpin: true,
                  numberTag: '01',
                },
              },
            ],
          }),
        ],
      });

      const rt = new ThreeSceneRuntime(plan);
      const t0 = rt.inspectSceneAtTime(0);
      const tEnd = rt.inspectSceneAtTime(5.4);
      const car0 = t0.elements.find((e) => e.id === 'race_car')!;
      const carEnd = tEnd.elements.find((e) => e.id === 'race_car')!;

      assert.ok(car0.meshCount >= 12, '3D car must contain chassis, canopy, spoiler, lights, and 4 wheel assemblies');
      assert.ok(car0.worldPosition.z - carEnd.worldPosition.z > 55, 'Car must cover >55m down track');
      assert.ok(t0.cameraPosition.z - tEnd.cameraPosition.z > 55, 'Tracking camera must move in lockstep with racing car');
      assert.ok(carEnd.projected.inFront, 'Car must remain framed in front of tracking camera');
      rt.dispose();
    }
  );

  // Scenario 5: Cinematic forest with trees, mountains, fog, and depth
  await runTest(
    'Scenario 5: Cinematic 3D forest with InstancedMesh trees, displaced mountains, exponential fog & depth',
    () => {
      const plan = mustNormalize3D({
        planVersion: 1,
        renderMode: '3d',
        title: 'Misty Alpine Pinewood',
        summary: 'Dense misty forest beneath jagged mountain peaks',
        scenes: [
          makeBaseSegment({
            weather: { type: 'fog', density: 0.75, windX: 0.1 },
            scene3d: {
              environment: 'forest',
              groundType: 'grass',
              groundSize: 240,
              fogColor: '#334155',
              fogDensity: 0.022,
              sunElevationDeg: 22,
              sunAzimuthDeg: -30,
              sunIntensity: 1.7,
              ambientIntensity: 0.75,
              camera3d: {
                projection: 'perspective',
                shotType: 'wide',
                fov: 52,
                position: { x: 0, y: 4.5, z: 32 },
                target: { x: 0, y: 5, z: -20 },
                endPosition: { x: 0, y: 4.5, z: 16 },
                endTarget: { x: 0, y: 6, z: -25 },
                motion: 'dolly-in',
                orbitRadius: 20,
                orbitSpeed: 0,
              },
            },
            elements: [
              {
                id: 'forest_trees',
                kind: 'trees',
                label: 'Pine Forest',
                x: 0.5,
                y: 0.7,
                scale: 1.1,
                colorPrimary: '#15803d',
                colorSecondary: '#451a03',
                accentColor: '#22c55e',
                variant: 'organic',
                count: 10,
                depth: 0.6,
                pos3d: { x: 0, y: 0, z: -4 },
                size3d: { w: 90, h: 8, d: 80 },
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
              },
              {
                id: 'alpine_peaks',
                kind: 'mountains',
                label: 'Northern Peaks',
                x: 0.5,
                y: 0.45,
                scale: 1.2,
                colorPrimary: '#475569',
                colorSecondary: '#1e293b',
                accentColor: '#e2e8f0',
                variant: 'cinematic',
                count: 1,
                depth: 0.1,
                pos3d: { x: 0, y: 0, z: -68 },
                size3d: { w: 200, h: 42, d: 70 },
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
              },
            ],
          }),
        ],
      });

      const rt = new ThreeSceneRuntime(plan);
      const snap = rt.inspectSceneAtTime(1.5);
      const trees = snap.elements.find((e) => e.id === 'forest_trees')!;
      const mountains = snap.elements.find((e) => e.id === 'alpine_peaks')!;

      assert.equal(snap.hasFog, true, 'Atmospheric FogExp2 must be enabled');
      assert.ok(snap.fogDensity >= 0.02, 'Forest fog density must match config');
      assert.ok(trees.instancedTotalCount >= 100, 'Forest must use InstancedMesh for dense multi-part trees');
      assert.ok(mountains.boundingBoxMax.y >= 18, 'Displaced mountains must rise significantly above ground');
      assert.ok(
        trees.projected.distanceToCamera < mountains.projected.distanceToCamera,
        'Forest must sit cleanly in front of distant mountains'
      );
      rt.dispose();
    }
  );

  // Scenario 6: Character entering a building through a doorway
  await runTest(
    'Scenario 6: Character walking from outside through an open 3D doorway into building interior',
    () => {
      const plan = mustNormalize3D({
        planVersion: 1,
        renderMode: '3d',
        title: 'Threshold Entry',
        summary: 'A visitor walks along the plaza and steps through a lit open doorway into a building',
        scenes: [
          makeBaseSegment({
            scene3d: {
              environment: 'street',
              groundType: 'asphalt',
              groundSize: 120,
              fogColor: '#0f172a',
              fogDensity: 0.004,
              sunElevationDeg: 38,
              sunAzimuthDeg: 25,
              sunIntensity: 1.6,
              ambientIntensity: 0.8,
              camera3d: {
                projection: 'perspective',
                shotType: 'over-the-shoulder',
                fov: 50,
                position: { x: 4.5, y: 2.6, z: 11 },
                target: { x: 0, y: 1.6, z: -6 },
                motion: 'static',
                orbitRadius: 12,
                orbitSpeed: 0,
              },
            },
            elements: [
              {
                id: 'entry_building',
                kind: 'building',
                label: 'Lit Headquarters Building',
                x: 0.5,
                y: 0.6,
                scale: 1,
                colorPrimary: '#334155',
                colorSecondary: '#0f172a',
                accentColor: '#fde68a',
                variant: 'cinematic',
                count: 1,
                depth: 0.4,
                pos3d: { x: 0, y: 0, z: -10 },
                size3d: { w: 10, h: 6.5, d: 10 },
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
                buildingSpec3d: {
                  floors: 2,
                  style: 'concrete',
                  hasDoorway: true,
                  doorwaySide: 'front',
                  doorwayWidth: 2.6,
                  doorwayHeight: 3.2,
                  doorwayOpen: true,
                  interiorLit: true,
                  interiorColor: '#fde68a',
                },
              },
              {
                id: 'entering_char',
                kind: 'character',
                label: 'Courier entering building',
                x: 0.5,
                y: 0.72,
                scale: 1,
                colorPrimary: '#dc2626',
                colorSecondary: '#1e293b',
                accentColor: '#22d3ee',
                variant: 'walking',
                count: 1,
                depth: 0.85,
                pos3d: { x: 0, y: 0, z: 5 },
                path3d: [
                  { t: 0, x: 0, y: 0, z: 5 },
                  { t: 0.5, x: 0, y: 0, z: -5 }, // exact doorway portal threshold (z = -10 + 10/2)
                  { t: 1, x: 0, y: 0, z: -11 }, // fully inside building interior!
                ],
                motion: { type: 'static', speed: 1, amplitude: 0, direction: 1 },
              },
            ],
          }),
        ],
      });

      const rt = new ThreeSceneRuntime(plan);
      const tOutside = rt.inspectSceneAtTime(0);
      const tThreshold = rt.inspectSceneAtTime(3.0);
      const tInside = rt.inspectSceneAtTime(5.95);

      const bldg = tOutside.elements.find((e) => e.id === 'entry_building')!;
      const cOut = tOutside.elements.find((e) => e.id === 'entering_char')!;
      const cMid = tThreshold.elements.find((e) => e.id === 'entering_char')!;
      const cIn = tInside.elements.find((e) => e.id === 'entering_char')!;

      assert.equal(bldg.doorwayInfo?.hasDoorway, true);
      const charWidth = cOut.boundingBoxMax.x - cOut.boundingBoxMin.x;
      const charHeight = cOut.boundingBoxMax.y - cOut.boundingBoxMin.y;
      assert.ok(
        bldg.doorwayInfo!.doorwayWidth > charWidth + 0.5,
        `Doorway width (${bldg.doorwayInfo!.doorwayWidth}m) must exceed character width (${charWidth.toFixed(2)}m)`
      );
      assert.ok(
        bldg.doorwayInfo!.doorwayHeight > charHeight + 0.5,
        `Doorway height (${bldg.doorwayInfo!.doorwayHeight}m) must exceed character height (${charHeight.toFixed(2)}m)`
      );
      assert.ok(cOut.worldPosition.z > bldg.boundingBoxMax.z, 'At t=0 character must start outside building');
      assert.ok(Math.abs(cMid.worldPosition.z - bldg.boundingBoxMax.z) < 0.6, 'At midpoint character crosses doorway portal');
      assert.ok(
        cIn.worldPosition.z < bldg.boundingBoxMax.z &&
          cIn.worldPosition.z > bldg.boundingBoxMin.z,
        'At end character must be inside building interior bounds'
      );
      rt.dispose();
    }
  );

  // Scenario 7: Low-angle camera shot of a giant robot
  await runTest(
    'Scenario 7: Dramatic low-angle camera shot looking up at a towering giant robot',
    () => {
      const plan = mustNormalize3D({
        planVersion: 1,
        renderMode: '3d',
        title: 'Colossus Awakening',
        summary: 'Dramatic upward low-angle shot of a 16-meter mech titan',
        scenes: [
          makeBaseSegment({
            scene3d: {
              environment: 'wasteland',
              groundType: 'dirt',
              groundSize: 160,
              fogColor: '#451a03',
              fogDensity: 0.008,
              sunElevationDeg: 24,
              sunAzimuthDeg: 40,
              sunIntensity: 2.0,
              ambientIntensity: 0.75,
              camera3d: {
                projection: 'perspective',
                shotType: 'low-angle',
                fov: 58,
                position: { x: 5.5, y: 1.4, z: 16 },
                target: { x: 0, y: 9.5, z: 0 },
                endPosition: { x: 3.5, y: 1.2, z: 13 },
                endTarget: { x: 0, y: 10.5, z: 0 },
                motion: 'dolly-in',
                orbitRadius: 16,
                orbitSpeed: 0,
              },
            },
            elements: [
              {
                id: 'giant_titan',
                kind: 'character',
                label: 'Colossus Titan Robot',
                x: 0.5,
                y: 0.7,
                scale: 3.5,
                colorPrimary: '#dc2626',
                colorSecondary: '#1e293b',
                accentColor: '#22d3ee',
                variant: 'armored',
                count: 1,
                depth: 0.7,
                pos3d: { x: 0, y: 0, z: 0 },
                size3d: { w: 6, h: 16, d: 5 },
                motion: { type: 'static', speed: 0.6, amplitude: 0, direction: 1 },
                characterSpec: {
                  archetype: 'robot',
                  pose: 'idle',
                  expression: 'fierce',
                  armorStyle: 'heavy-plate',
                  armorColor: '#dc2626',
                  secondaryGearColor: '#1e293b',
                  headgear: 'visor-helmet',
                  visorColor: '#22d3ee',
                  cloakOrCoat: false,
                  cloakColor: '#0f172a',
                  weaponOrGear: 'none',
                  hairColor: '#1e293b',
                  detailLevel: 'hero',
                },
              },
            ],
          }),
        ],
      });

      const rt = new ThreeSceneRuntime(plan);
      const snap = rt.inspectSceneAtTime(2.0);
      const titan = snap.elements.find((e) => e.id === 'giant_titan')!;
      const titanHeight = titan.boundingBoxMax.y - titan.boundingBoxMin.y;

      assert.ok(titanHeight >= 14, `Giant robot must tower >=14m (got ${titanHeight.toFixed(2)}m)`);
      assert.ok(
        snap.cameraPosition.y < 2.0 && snap.cameraTarget.y > 8.0,
        'Low-angle shot must place camera near ground looking sharply upward'
      );
      assert.ok(titan.projected.inFront && Math.abs(titan.projected.ndcX) <= 0.85, 'Robot must be framed cleanly in view');
      assert.ok(titan.meshCount >= 14, 'Robot rig must contain multi-part mech geometry');
      rt.dispose();
    }
  );

  // Scenario 8: Realistic product animation with camera orbit and reflective materials
  await runTest(
    'Scenario 8: Studio 3D product animation with metallic/glass PBR materials & continuous camera orbit',
    () => {
      const plan = mustNormalize3D({
        planVersion: 1,
        renderMode: '3d',
        title: 'Chronograph Studio Reveal',
        summary: '360 orbit showcase of a brushed-metal & sapphire glass luxury watch',
        scenes: [
          makeBaseSegment({
            scene3d: {
              environment: 'studio',
              groundType: 'studio-floor',
              groundSize: 80,
              fogColor: '#050814',
              fogDensity: 0,
              sunElevationDeg: 52,
              sunAzimuthDeg: 35,
              sunIntensity: 2.2,
              ambientIntensity: 0.9,
              camera3d: {
                projection: 'perspective',
                shotType: 'orbit',
                fov: 42,
                position: { x: 0, y: 2.4, z: 6.0 },
                target: { x: 0, y: 1.5, z: 0 },
                motion: 'orbit',
                orbitRadius: 6.0,
                orbitSpeed: 0.9,
              },
            },
            elements: [
              {
                id: 'hero_watch',
                kind: 'product',
                label: 'Apex Titanium Watch',
                x: 0.5,
                y: 0.55,
                scale: 1.15,
                colorPrimary: '#94a3b8',
                colorSecondary: '#0f172a',
                accentColor: '#38bdf8',
                variant: 'cinematic',
                count: 1,
                depth: 0.8,
                pos3d: { x: 0, y: 0, z: 0 },
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
                productSpec3d: {
                  productType: 'watch',
                  materialFinish: 'brushed-metal',
                  hasPedestal: true,
                  turntableSpin: false,
                },
              },
            ],
          }),
        ],
      });

      const rt = new ThreeSceneRuntime(plan);

      // Verify reflective PBR physical materials exist on hero product
      let physicalMatCount = 0;
      let reflectiveMetalFound = false;
      rt.scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh && mesh.material instanceof THREE.MeshPhysicalMaterial) {
          physicalMatCount++;
          if (mesh.material.metalness >= 0.8 || mesh.material.transmission > 0.4) {
            reflectiveMetalFound = true;
          }
        }
      });
      assert.ok(physicalMatCount >= 3, 'Product showcase must use MeshPhysicalMaterial shaders');
      assert.equal(reflectiveMetalFound, true, 'Must include high-metalness or transmissive glass materials');

      const s0 = rt.inspectSceneAtTime(0);
      const s1 = rt.inspectSceneAtTime(1.5);
      const s2 = rt.inspectSceneAtTime(3.0);

      assert.ok(s0.lightCount >= 4, 'Studio must configure multi-light rig + softboxes');
      const r0 = Math.hypot(s0.cameraPosition.x, s0.cameraPosition.z);
      const r1 = Math.hypot(s1.cameraPosition.x, s1.cameraPosition.z);
      const r2 = Math.hypot(s2.cameraPosition.x, s2.cameraPosition.z);
      assert.ok(Math.abs(r0 - 6.0) < 0.05 && Math.abs(r1 - 6.0) < 0.05 && Math.abs(r2 - 6.0) < 0.05, 'Camera orbit must maintain steady 6.0m radius');

      const ang0 = Math.atan2(s0.cameraPosition.x, s0.cameraPosition.z);
      const ang1 = Math.atan2(s1.cameraPosition.x, s1.cameraPosition.z);
      assert.ok(Math.abs(ang1 - ang0) > 0.8, 'Orbiting camera azimuth must rotate continuously around product');
      rt.dispose();
    }
  );

  // Scenario 9: 2D Financial Chart Preservation (Hybrid Compatibility)
  await runTest(
    'Scenario 9: Hybrid Compatibility — 2D Financial Growth Charts remain routed to Canvas 2D renderer',
    () => {
      const chartRes = normalizeScenePlan({
        planVersion: 1,
        renderMode: '2d',
        title: 'Revenue Growth',
        summary: 'Financial growth to $10 Million',
        scenes: [
          makeBaseSegment({
            background: { mode: 'solid', solidColor: '#050814' },
            elements: [
              {
                id: 'chart_1',
                kind: 'chart',
                label: 'Revenue Chart',
                x: 0.5,
                y: 0.5,
                scale: 1,
                colorPrimary: '#22d3ee',
                colorSecondary: '#0f172a',
                accentColor: '#e2e8f0',
                variant: 'futuristic',
                count: 1,
                depth: 0.5,
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
                chartSpec: {
                  chartType: 'line',
                  title: 'Revenue Growth',
                  xAxisLabel: 'Quarter',
                  yAxisLabel: 'USD ($M)',
                  valuePrefix: '$',
                  valueSuffix: 'M',
                  smoothCurve: true,
                  easing: 'accelerate',
                  showGrid: true,
                  showAreaFill: true,
                  showMovingMarker: true,
                  highlightFinalBadge: '$10 Million',
                  points: [
                    { label: 'Q1', value: 1 },
                    { label: 'Q2', value: 3 },
                    { label: 'Q3', value: 6 },
                    { label: 'Q4', value: 10 },
                  ],
                },
              },
            ],
          }),
        ],
      });
      assert.equal(chartRes.ok, true);
      if (chartRes.ok) {
        assert.equal(chartRes.data.renderMode, '2d');
        assert.equal(is3DScenePlan(chartRes.data), false, '2D charts must NOT be hijacked into 3D WebGL');
      }
    }
  );

  // Scenario 10: Flat customModelSpec passes validation, normalizes flat fields, and preserves kind="custom"
  await runTest(
    'Scenario 10: Flat customModelSpec passes validation, normalizes all flat fields, and preserves kind="custom"',
    () => {
      const plan = mustNormalize3D({
        planVersion: 1,
        renderMode: '3d',
        visualStyle: 'realistic-pbr',
        title: 'Swimming Oceanic Whale',
        summary: 'Multi-part flat custom 3D whale with animated tail fluke and beacon eye',
        scenes: [
          makeBaseSegment({
            elements: [
              {
                id: 'hero_whale',
                kind: 'whale', // Unknown raw kind with valid customModelSpec MUST stay 'custom', never 'prop'
                label: 'Blue Whale',
                x: 0.5,
                y: 0.5,
                scale: 1,
                colorPrimary: '#1d4ed8',
                colorSecondary: '#0f172a',
                accentColor: '#38bdf8',
                variant: 'organic',
                count: 1,
                depth: 0.8,
                pos3d: { x: 0, y: 0, z: 0 },
                size3d: { w: 4, h: 3, d: 10 },
                motion: { type: 'static', speed: 1, amplitude: 0, direction: 1 },
                customModelSpec: {
                  description: 'Streamlined blue whale with flat-encoded animated parts',
                  parts: [
                    {
                      id: 'torso',
                      shape: 'capsule',
                      px: 0, py: 1.0, pz: 0,
                      rxDeg: 90, ryDeg: 0, rzDeg: 0,
                      sx: 1.6, sy: 3.4, sz: 1.4,
                      color: '#1d4ed8',
                      roughness: 0.35,
                      metalness: 0.1,
                      emissiveIntensity: 0,
                      opacity: 1,
                      motionType: 'none',
                      motionAxis: 'y',
                      motionSpeed: 0,
                      motionAmplitude: 0,
                    },
                    {
                      id: 'tail_fluke',
                      shape: 'box',
                      px: 0, py: 1.0, pz: -2.4,
                      rxDeg: 0, ryDeg: 0, rzDeg: 0,
                      sx: 2.0, sy: 0.18, sz: 0.9,
                      color: '#1e40af',
                      roughness: 0.4,
                      metalness: 0.1,
                      emissiveIntensity: 0,
                      opacity: 1,
                      motionType: 'sway',
                      motionAxis: 'x',
                      motionSpeed: 3.0,
                      motionAmplitude: 0.45,
                    },
                    {
                      id: 'beacon_eye',
                      shape: 'sphere',
                      px: 0.75, py: 1.1, pz: 1.1,
                      rxDeg: 0, ryDeg: 0, rzDeg: 0,
                      sx: 0.2, sy: 0.2, sz: 0.2,
                      color: '#38bdf8',
                      roughness: 0.2,
                      metalness: 0.8,
                      emissive: '#22d3ee',
                      emissiveIntensity: 2.0,
                      opacity: 0.85,
                      motionType: 'pulse',
                      motionAxis: 'y',
                      motionSpeed: 2.5,
                      motionAmplitude: 0.35,
                    },
                    {
                      id: 'sonar_ring',
                      shape: 'torus',
                      px: 0, py: 1.0, pz: 2.0,
                      rxDeg: 0, ryDeg: 0, rzDeg: 0,
                      sx: 0.8, sy: 0.8, sz: 0.8,
                      color: '#38bdf8',
                      roughness: 0.25,
                      metalness: 0.5,
                      emissiveIntensity: 0,
                      opacity: 0.75,
                      motionType: 'rotate',
                      motionAxis: 'z',
                      motionSpeed: 2.2,
                      motionAmplitude: 1,
                    },
                    {
                      id: 'fin_tip',
                      shape: 'cone',
                      px: 0, py: 1.7, pz: -0.4,
                      rxDeg: -15, ryDeg: 0, rzDeg: 0,
                      sx: 0.25, sy: 0.7, sz: 0.6,
                      color: '#1e3a8a',
                      roughness: 0.45,
                      metalness: 0.05,
                      emissiveIntensity: 0,
                      opacity: 1,
                      motionType: 'bob',
                      motionAxis: 'y',
                      motionSpeed: 2.0,
                      motionAmplitude: 0.25,
                    },
                  ],
                },
              },
            ],
          }),
        ],
      });

      const normalizedWhale = plan.scenes[0].elements[0];
      assert.equal(normalizedWhale.kind, 'custom', 'Valid customModelSpec must keep kind="custom" rather than coercing to "prop"');
      const parts = normalizedWhale.customModelSpec!.parts;
      assert.equal(parts.length, 5);
      assert.equal(parts[0].motionType, 'none');
      assert.equal(parts[0].rxDeg, 90);
      assert.equal(parts[2].emissive, '#22d3ee');
      assert.equal(parts[2].emissiveIntensity, 2.0);
      assert.equal(parts[2].opacity, 0.85);
      assert.equal(parts[1].motionType, 'sway');
      assert.equal(parts[1].motionAxis, 'x');
      assert.equal(parts[1].motionSpeed, 3.0);
      assert.equal(parts[1].motionAmplitude, 0.45);
      // Verify part objects are strictly flat (no nested object properties)
      for (const part of parts) {
        for (const [k, v] of Object.entries(part)) {
          assert.notEqual(typeof v, 'object', `CustomModelPart.${k} must be flat primitive, not nested object`);
        }
      }

      // Also verify kind="prop" with valid customModelSpec is promoted to "custom" and never coerced back to "prop"
      const propWithSpec = mustNormalize3D({
        planVersion: 1,
        renderMode: '3d',
        title: 'Custom Prop Override',
        summary: 'Keep custom when valid customModelSpec exists',
        scenes: [
          makeBaseSegment({
            elements: [
              {
                id: 'custom_lantern',
                kind: 'prop',
                label: 'Glowing Lantern',
                x: 0.5,
                y: 0.5,
                scale: 1,
                colorPrimary: '#f59e0b',
                colorSecondary: '#0f172a',
                accentColor: '#fde68a',
                variant: 'glowing',
                count: 1,
                depth: 0.5,
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
                customModelSpec: {
                  description: 'Flat brass lantern',
                  parts: [
                    {
                      id: 'glass_core',
                      shape: 'cylinder',
                      px: 0, py: 0.5, pz: 0,
                      rxDeg: 0, ryDeg: 0, rzDeg: 0,
                      sx: 0.5, sy: 0.8, sz: 0.5,
                      color: '#fde68a',
                      roughness: 0.2,
                      metalness: 0.1,
                      emissive: '#f59e0b',
                      emissiveIntensity: 2.5,
                      opacity: 0.9,
                      motionType: 'none',
                      motionAxis: 'y',
                      motionSpeed: 0,
                      motionAmplitude: 0,
                    },
                  ],
                },
              },
            ],
          }),
        ],
      });
      assert.equal(propWithSpec.scenes[0].elements[0].kind, 'custom');
    }
  );

  // Scenario 11: Strict rejection of invalid shapes & clamping of oversized (>40) flat customModelSpec
  await runTest(
    'Scenario 11: Invalid shapes rejected, >40 parts rejected/clamped, out-of-range numbers clamped safely',
    () => {
      const basePart = {
        id: 'p1',
        shape: 'box',
        px: 0,
        py: 0,
        pz: 0,
        rxDeg: 0,
        ryDeg: 0,
        rzDeg: 0,
        sx: 1,
        sy: 1,
        sz: 1,
        color: '#38bdf8',
        roughness: 0.5,
        metalness: 0.2,
        emissiveIntensity: 0,
        opacity: 1,
        motionType: 'none',
        motionAxis: 'y',
        motionSpeed: 0,
        motionAmplitude: 0,
      };

      // (1) Direct schema validation must REJECT unknown shape
      const invalidShapeRes = validateScenePlan({
        planVersion: 1,
        renderMode: '3d',
        title: 'Invalid Custom Shape',
        summary: 'Should reject unknown shape',
        width: 1280,
        height: 720,
        fps: 30,
        totalDurationSec: 5,
        scenes: [
          makeBaseSegment({
            elements: [
              {
                id: 'bad_custom',
                kind: 'custom',
                label: 'Bad Shape',
                x: 0.5,
                y: 0.5,
                scale: 1,
                colorPrimary: '#38bdf8',
                colorSecondary: '#0f172a',
                accentColor: '#e2e8f0',
                variant: 'idle',
                count: 1,
                depth: 0.5,
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
                customModelSpec: {
                  description: 'Contains unsupported shape',
                  parts: [{ ...basePart, shape: 'icosahedron-hack' }],
                },
              },
            ],
          }),
        ],
        visualContinuity: {
          artStyle: 'Realistic PBR',
          colorPalette: ['#071124', '#38bdf8'],
          environmentRules: 'Standard',
          lightingStyle: 'Studio',
          characterBible: [],
          propReferences: [],
        },
      });
      assert.equal(invalidShapeRes.ok, false, 'validateScenePlan must strictly reject unknown custom shapes');

      // (2) Direct schema validation must REJECT >40 parts
      const tooManyPartsRes = validateScenePlan({
        planVersion: 1,
        renderMode: '3d',
        title: 'Oversized Parts Array',
        summary: 'Should reject >40 parts',
        width: 1280,
        height: 720,
        fps: 30,
        totalDurationSec: 5,
        scenes: [
          makeBaseSegment({
            elements: [
              {
                id: 'too_many_custom',
                kind: 'custom',
                label: 'Too Many Parts',
                x: 0.5,
                y: 0.5,
                scale: 1,
                colorPrimary: '#38bdf8',
                colorSecondary: '#0f172a',
                accentColor: '#e2e8f0',
                variant: 'idle',
                count: 1,
                depth: 0.5,
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
                customModelSpec: {
                  description: 'Too many parts',
                  parts: Array.from({ length: 41 }, (_, i) => ({ ...basePart, id: `p_${i}` })),
                },
              },
            ],
          }),
        ],
        visualContinuity: {
          artStyle: 'Realistic PBR',
          colorPalette: ['#071124', '#38bdf8'],
          environmentRules: 'Standard',
          lightingStyle: 'Studio',
          characterBible: [],
          propReferences: [],
        },
      });
      assert.equal(tooManyPartsRes.ok, false, 'validateScenePlan must reject >40 parts');

      // (3) Normalizer drops unknown shapes, clamps >40 parts to <=40, and clamps numeric & hex ranges
      const oversizedParts = Array.from({ length: 55 }, (_, i) => ({
        id: `part_${i}`,
        shape: i === 0 ? 'script_injection' : i % 2 === 0 ? 'cylinder' : 'plane',
        px: 9999,
        py: -9999,
        pz: 12,
        rxDeg: 1200,
        ryDeg: 0,
        rzDeg: -1200,
        sx: -5,
        sy: 500,
        sz: 1,
        color: 'NOT_A_HEX',
        roughness: 9,
        metalness: -2,
        emissive: '#f0a',
        emissiveIntensity: 99,
        opacity: 4,
        motionType: 'bob',
        motionAxis: 'y',
        motionSpeed: 200,
        motionAmplitude: 999,
      }));

      const clampedRes = normalizeScenePlan({
        planVersion: 1,
        renderMode: '3d',
        title: 'Clamped Custom Model',
        summary: 'Oversized parts and out-of-range fields',
        scenes: [
          makeBaseSegment({
            elements: [
              {
                id: 'clamped_custom',
                kind: 'custom',
                label: 'Clamped Object',
                x: 0.5,
                y: 0.5,
                scale: 1,
                colorPrimary: '#38bdf8',
                colorSecondary: '#0f172a',
                accentColor: '#e2e8f0',
                variant: 'idle',
                count: 1,
                depth: 0.5,
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
                customModelSpec: {
                  description: 'X'.repeat(350),
                  parts: oversizedParts,
                },
              },
            ],
          }),
        ],
      });

      assert.equal(clampedRes.ok, true);
      if (clampedRes.ok) {
        const spec = clampedRes.data.scenes[0].elements[0].customModelSpec!;
        assert.ok(spec.description.length <= 200, 'Description must clamp to <= 200 chars');
        assert.ok(spec.parts.length <= 40, 'Parts count must clamp to <= 40');
        assert.equal(spec.parts[0].id, 'part_1', 'Invalid shape part_0 must be rejected, not coerced');
        assert.equal(spec.parts[0].px, 50, 'px must clamp to +50');
        assert.equal(spec.parts[0].py, -50, 'py must clamp to -50');
        assert.equal(spec.parts[0].rxDeg, 360, 'rxDeg must clamp to +360');
        assert.equal(spec.parts[0].rzDeg, -360, 'rzDeg must clamp to -360');
        assert.equal(spec.parts[0].sx, 0.01, 'sx must clamp to >= 0.01');
        assert.equal(spec.parts[0].sy, 50, 'sy must clamp to <= 50');
        assert.equal(spec.parts[0].roughness, 1);
        assert.equal(spec.parts[0].metalness, 0);
        assert.equal(spec.parts[0].emissive, '#ff00aa', '3-digit hex must normalize to 6-digit hex');
        assert.equal(spec.parts[0].emissiveIntensity, 5);
        assert.equal(spec.parts[0].opacity, 1);
        assert.equal(spec.parts[0].motionType, 'bob');
        assert.equal(spec.parts[0].motionSpeed, 20);
        assert.equal(spec.parts[0].motionAmplitude, 20);
        assert.match(spec.parts[0].color, /^#[0-9a-f]{6}$/);
      }
    }
  );

  // Scenario 12: Existing prop / built-in kinds remain unchanged when customModelSpec is absent
  await runTest(
    'Scenario 12: Existing prop and specialized built-in kinds remain untouched without customModelSpec',
    () => {
      const plan = mustNormalize3D({
        planVersion: 1,
        renderMode: '3d',
        title: 'Standard Prop + Drone',
        summary: 'Backwards-compatibility check',
        scenes: [
          makeBaseSegment({
            elements: [
              {
                id: 'plain_prop',
                kind: 'unknown_thing',
                label: 'Crate',
                x: 0.4,
                y: 0.7,
                scale: 1,
                colorPrimary: '#94a3b8',
                colorSecondary: '#1e293b',
                accentColor: '#38bdf8',
                variant: 'idle',
                count: 1,
                depth: 0.5,
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
              },
              {
                id: 'scout_drone',
                kind: 'drone',
                label: 'Scout Drone',
                x: 0.6,
                y: 0.4,
                scale: 1,
                colorPrimary: '#cbd5e1',
                colorSecondary: '#0f172a',
                accentColor: '#22d3ee',
                variant: 'hovering',
                count: 1,
                depth: 0.6,
                motion: { type: 'bob', speed: 1, amplitude: 0.1, direction: 1 },
              },
            ],
          }),
        ],
      });

      assert.equal(plan.scenes[0].elements[0].kind, 'prop');
      assert.equal(plan.scenes[0].elements[1].kind, 'drone');
      const rt = new ThreeSceneRuntime(plan);
      const snap = rt.inspectSceneAtTime(0.5);
      assert.equal(snap.elements[0].meshCount, 2, 'Default prop retains its base + glowing cap geometry');
      assert.ok(snap.elements[1].meshCount >= 5, 'Drone retains its rotor & searchlight rig');
      rt.dispose();
    }
  );

  // Scenario 13: Phase 1b/1e custom model runtime rendering, animation, camera move, and disposal (devWhale)
  await runTest(
    'Scenario 13: Phase 1b/1e customModel renders 18-part organic devWhale, animates tail sway, dollys camera to eye, and disposes cleanly',
    () => {
      const val = validateScenePlan(DEV_WHALE_SCENE_PLAN);
      assert.equal(val.ok, true, 'DEV_WHALE_SCENE_PLAN must pass validateScenePlan');

      const norm = mustNormalize3D(DEV_WHALE_SCENE_PLAN as unknown as Record<string, unknown>);
      const whaleEl = norm.scenes[0].elements[0];
      assert.equal(whaleEl.kind, 'custom');
      const expectedPartCount = 18;
      assert.equal(whaleEl.customModelSpec?.parts.length, expectedPartCount);
      assert.equal(
        whaleEl.customModelSpec?.parts.some((p) => p.shape === 'box'),
        false,
        'Organic devWhale must not use hard box parts for flippers, mouth, or fins'
      );

      // Direct createCustomModelGroup checks (part count + size3d bounding box fit)
      const directGroup = createCustomModelGroup(whaleEl);
      const meshes: THREE.Mesh[] = [];
      directGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) meshes.push(obj as THREE.Mesh);
      });
      assert.equal(meshes.length, expectedPartCount, 'Expected 18 meshes built for devWhale');

      const box = new THREE.Box3().setFromObject(directGroup);
      const size = new THREE.Vector3();
      box.getSize(size);
      assert.ok(Math.abs(size.x - 4.2) < 0.05, `Expected fitted width ~4.2, got ${size.x}`);
      assert.ok(Math.abs(size.y - 3.2) < 0.05, `Expected fitted height ~3.2, got ${size.y}`);
      assert.ok(Math.abs(size.z - 10.5) < 0.05, `Expected fitted depth ~10.5, got ${size.z}`);

      // Verify tail fluke sways deterministically via animateCustomModel
      const fluke0 = meshes.find((m) => m.name === 'whale_tail_fluke_left');
      assert.ok(fluke0, 'Expected whale_tail_fluke_left mesh');
      animateCustomModel(directGroup, 0);
      const rot0 = fluke0.rotation.x;
      animateCustomModel(directGroup, 0.8);
      const rot1 = fluke0.rotation.x;
      assert.notEqual(rot0, rot1, 'Tail fluke x-rotation must sway between t=0 and t=0.8');

      // Verify disposeCustomModel disposes all geometries and materials
      let disposedGeos = 0;
      let disposedMats = 0;
      for (const m of meshes) {
        const origGeoDispose = m.geometry.dispose.bind(m.geometry);
        m.geometry.dispose = () => {
          disposedGeos++;
          origGeoDispose();
        };
        const mat = m.material as THREE.Material;
        const origMatDispose = mat.dispose.bind(mat);
        mat.dispose = () => {
          disposedMats++;
          origMatDispose();
        };
      }
      disposeCustomModel(directGroup);
      assert.equal(disposedGeos, expectedPartCount, 'All 18 geometries must be disposed');
      assert.equal(disposedMats, expectedPartCount, 'All 18 materials must be disposed');
      assert.deepEqual(directGroup.userData.customMotionParts, []);

      // Verify ThreeSceneRuntime integration (case 'custom' + animateCustomModel + dolly-in camera to eye)
      const rt = new ThreeSceneRuntime(norm);
      const snapStart = rt.inspectSceneAtTime(0);
      assert.equal(snapStart.elements.length, 1);
      assert.equal(snapStart.elements[0].kind, 'custom');
      assert.equal(snapStart.elements[0].meshCount, expectedPartCount);
      const startDistToTarget = Math.hypot(
        snapStart.cameraPosition.x - snapStart.cameraTarget.x,
        snapStart.cameraPosition.y - snapStart.cameraTarget.y,
        snapStart.cameraPosition.z - snapStart.cameraTarget.z
      );
      assert.ok(
        startDistToTarget > 12,
        `Camera starts wide at 3/4 establishing distance (> 12m), got ${startDistToTarget.toFixed(2)}m`
      );

      // Inspect animated tail inside runtime scene graph at t=0 vs t=0.8
      rt.seekTime(0);
      const rtFluke = rt.scene.getObjectByName('whale_tail_fluke_left') as THREE.Mesh | undefined;
      assert.ok(rtFluke, 'Runtime scene must contain whale_tail_fluke_left');
      const rtFlukeRot0 = rtFluke.rotation.x;

      const snapEnd = rt.inspectSceneAtTime(7.99);
      const rtFlukeRot1 = rtFluke.rotation.x;
      assert.notEqual(rtFlukeRot0, rtFlukeRot1, 'Runtime must animate custom model parts per frame');
      const endDistToTarget = Math.hypot(
        snapEnd.cameraPosition.x - snapEnd.cameraTarget.x,
        snapEnd.cameraPosition.y - snapEnd.cameraTarget.y,
        snapEnd.cameraPosition.z - snapEnd.cameraTarget.z
      );
      assert.ok(
        endDistToTarget < startDistToTarget * 0.25,
        `End distance (${endDistToTarget.toFixed(2)}m) must be < 25% of start distance (${startDistToTarget.toFixed(2)}m)`
      );
      assert.ok(
        snapEnd.cameraPosition.z < 6,
        `Camera must dolly close to the eye (z < 6), got z=${snapEnd.cameraPosition.z}`
      );
      assert.ok(
        snapEnd.cameraTarget.z > 2,
        `Camera target must move toward eye (z > 2), got z=${snapEnd.cameraTarget.z}`
      );

      rt.dispose();
    }
  );

  // Scenario 14: Phase 1c bounding-box camera framing (~50% viewport fill in wide shot)
  await runTest(
    'Scenario 14: Wide-shot camera frames custom element from bounding box so object fills ~50% of frame',
    () => {
      const makeCustomSizePlan = (w: number, h: number, d: number) =>
        mustNormalize3D({
          planVersion: 1,
          renderMode: '3d',
          title: `Custom Wide Frame ${w}x${h}x${d}`,
          summary: 'Bounding box camera framing verification',
          scenes: [
            makeBaseSegment({
              scene3d: {
                environment: 'studio',
                groundType: 'studio-floor',
                camera3d: {
                  projection: 'perspective',
                  shotType: 'wide',
                  fov: 50,
                  position: { x: 2, y: 2, z: 20 }, // deliberate generic guess; wide framing adjusts from bbox
                  target: { x: 0, y: 1, z: 0 },
                  motion: 'static',
                },
              },
              elements: [
                {
                  id: 'framed_custom',
                  kind: 'custom',
                  label: 'Framed Creature',
                  x: 0.5,
                  y: 0.5,
                  scale: 1,
                  colorPrimary: '#1d4ed8',
                  colorSecondary: '#0f172a',
                  accentColor: '#38bdf8',
                  variant: 'organic',
                  count: 1,
                  depth: 0.5,
                  pos3d: { x: 0, y: 0, z: 0 },
                  size3d: { w, h, d },
                  motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
                  customModelSpec: {
                    description: 'Test creature for wide camera framing',
                    parts: [
                      {
                        id: 'body',
                        shape: 'capsule',
                        px: 0,
                        py: 0,
                        pz: 0,
                        rxDeg: 90,
                        sx: 1,
                        sy: 2,
                        sz: 1,
                        color: '#1d4ed8',
                      },
                    ],
                  },
                },
              ],
            }),
          ],
        });

      const measureViewportFill = (rt: ThreeSceneRuntime, elementId: string) => {
        const snap = rt.inspectSceneAtTime(0);
        const elSnap = snap.elements.find((e) => e.id === elementId)!;
        const min = elSnap.boundingBoxMin;
        const max = elSnap.boundingBoxMax;
        const corners = [
          new THREE.Vector3(min.x, min.y, min.z),
          new THREE.Vector3(min.x, min.y, max.z),
          new THREE.Vector3(min.x, max.y, min.z),
          new THREE.Vector3(min.x, max.y, max.z),
          new THREE.Vector3(max.x, min.y, min.z),
          new THREE.Vector3(max.x, min.y, max.z),
          new THREE.Vector3(max.x, max.y, min.z),
          new THREE.Vector3(max.x, max.y, max.z),
        ];
        let minNdcX = Infinity;
        let maxNdcX = -Infinity;
        let minNdcY = Infinity;
        let maxNdcY = -Infinity;
        for (const c of corners) {
          const p = c.project(rt.camera);
          minNdcX = Math.min(minNdcX, p.x);
          maxNdcX = Math.max(maxNdcX, p.x);
          minNdcY = Math.min(minNdcY, p.y);
          maxNdcY = Math.max(maxNdcY, p.y);
        }
        return Math.max((maxNdcX - minNdcX) * 0.5, (maxNdcY - minNdcY) * 0.5);
      };

      const bigRt = new ThreeSceneRuntime(makeCustomSizePlan(8, 6, 16));
      const bigFill = measureViewportFill(bigRt, 'framed_custom');
      assert.ok(
        bigFill >= 0.44 && bigFill <= 0.56,
        `Large custom object (8x6x16) should fill ~50% of wide frame, got ${(bigFill * 100).toFixed(1)}%`
      );
      bigRt.dispose();

      const smallRt = new ThreeSceneRuntime(makeCustomSizePlan(0.6, 0.9, 0.6));
      const smallFill = measureViewportFill(smallRt, 'framed_custom');
      assert.ok(
        smallFill >= 0.44 && smallFill <= 0.72,
        `Small custom object (0.6x0.9x0.6) should frame cleanly in wide shot, got ${(smallFill * 100).toFixed(1)}%`
      );
      smallRt.dispose();
    }
  );

  // Scenario 15: Phase A Fix 1 — Registered builders for clouds, grid-floor, particle-burst, light-beam (no prop fallback)
  await runTest(
    'Scenario 15: Phase A Fix 1 — clouds, grid-floor, particle-burst & light-beam have dedicated 3D builders',
    () => {
      const kinds = getRegisteredObjectKinds();
      for (const expectedKind of ['clouds', 'grid-floor', 'particle-burst', 'light-beam']) {
        assert.ok(kinds.includes(expectedKind), `${expectedKind} must be registered in objectRegistry`);
      }

      const plan = mustNormalize3D({
        planVersion: 1,
        renderMode: '3d',
        title: 'Atmosphere & FX Kinds',
        summary: 'Verify specialized builders for clouds, grid-floor, particle-burst, and light-beam',
        scenes: [
          makeBaseSegment({
            elements: [
              {
                id: 'el_clouds',
                kind: 'clouds',
                label: 'Storm Clouds',
                x: 0.5, y: 0.2, scale: 1,
                colorPrimary: '#e2e8f0', colorSecondary: '#475569', accentColor: '#94a3b8',
                variant: 'cinematic', count: 2, depth: 0.3,
                pos3d: { x: 0, y: 12, z: -10 },
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
              },
              {
                id: 'el_grid',
                kind: 'grid-floor',
                label: 'Cyber Grid Floor',
                x: 0.5, y: 0.8, scale: 1,
                colorPrimary: '#334155', colorSecondary: '#0f172a', accentColor: '#22d3ee',
                variant: 'neon', count: 1, depth: 0.5,
                pos3d: { x: 0, y: 0, z: 0 },
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
              },
              {
                id: 'el_burst',
                kind: 'particle-burst',
                label: 'Spark Burst',
                x: 0.5, y: 0.5, scale: 1,
                colorPrimary: '#f97316', colorSecondary: '#0f172a', accentColor: '#fde047',
                variant: 'glowing', count: 2, depth: 0.7,
                pos3d: { x: -3, y: 1, z: 0 },
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
              },
              {
                id: 'el_beam',
                kind: 'light-beam',
                label: 'Spotlight Shaft',
                x: 0.5, y: 0.4, scale: 1,
                colorPrimary: '#e0f2fe', colorSecondary: '#0f172a', accentColor: '#38bdf8',
                variant: 'glowing', count: 1, depth: 0.7,
                pos3d: { x: 3, y: 0, z: 0 },
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
              },
            ],
          }),
        ],
      });

      const rt = new ThreeSceneRuntime(plan);
      const snap = rt.inspectSceneAtTime(0.5);
      const cloudsEl = snap.elements.find((e) => e.id === 'el_clouds')!;
      const gridEl = snap.elements.find((e) => e.id === 'el_grid')!;
      const burstEl = snap.elements.find((e) => e.id === 'el_burst')!;
      const beamEl = snap.elements.find((e) => e.id === 'el_beam')!;

      assert.ok(cloudsEl.meshCount >= 10, `clouds must render soft sphere cluster (got ${cloudsEl.meshCount} meshes)`);
      assert.ok(gridEl.meshCount >= 1, 'grid-floor must render plane + GridHelper');
      assert.ok(rt.scene.getObjectByName('grid_floor_el_grid')?.children.some((c) => c instanceof THREE.GridHelper), 'grid-floor must contain GridHelper');
      assert.ok(burstEl.meshCount >= 10, `particle-burst must render burst shards + points (got ${burstEl.meshCount})`);
      assert.ok(rt.scene.getObjectByName('particle_burst_el_burst')?.children.some((c) => c instanceof THREE.Points), 'particle-burst must contain THREE.Points');
      assert.equal(beamEl.meshCount, 3, 'light-beam must render outer cone, inner core & emitter cap');
      rt.dispose();
    }
  );

  // Scenario 16: Phase A Fix 2 — Missing renderMode defaults to 3D whenever 3D fields exist; explicit '2d' stays 2D
  await runTest(
    'Scenario 16: Phase A Fix 2 — Omitted renderMode with 3D fields chooses 3D; explicit renderMode="2d" stays 2D',
    () => {
      const withPos3d = normalizeScenePlan({
        planVersion: 1,
        visualStyle: 'cartoon-2d',
        title: 'Omitted RenderMode + pos3d',
        summary: 'Has pos3d/size3d without renderMode',
        scenes: [
          makeBaseSegment({
            elements: [
              {
                id: 'bike_1',
                kind: 'vehicle',
                label: 'Cartoon Bicycle',
                x: 0.5, y: 0.6, scale: 1,
                colorPrimary: '#ef4444', colorSecondary: '#1e293b', accentColor: '#f59e0b',
                variant: 'running', count: 1, depth: 0.8,
                pos3d: { x: 0, y: 0, z: 0 },
                size3d: { w: 0.8, h: 1.2, d: 2.2 },
                motion: { type: 'static', speed: 1, amplitude: 0, direction: 1 },
              },
            ],
          }),
        ],
      });
      assert.equal(withPos3d.ok, true);
      if (withPos3d.ok) {
        assert.equal(withPos3d.data.renderMode, '3d', 'Omitted renderMode with pos3d/size3d must normalize to 3d');
        assert.equal(is3DScenePlan(withPos3d.data), true, 'is3DScenePlan must select 3D when renderMode is omitted and 3D fields exist');
      }

      const withSize3dOnly = normalizeScenePlan({
        planVersion: 1,
        title: 'Omitted RenderMode + size3d',
        summary: 'Only size3d present',
        scenes: [
          makeBaseSegment({
            elements: [
              {
                id: 'prop_3d',
                kind: 'prop',
                label: 'Sized Crate',
                x: 0.5, y: 0.5, scale: 1,
                colorPrimary: '#38bdf8', colorSecondary: '#0f172a', accentColor: '#e2e8f0',
                variant: 'idle', count: 1, depth: 0.5,
                size3d: { w: 2, h: 3, d: 2 },
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
              },
            ],
          }),
        ],
      });
      assert.equal(withSize3dOnly.ok, true);
      if (withSize3dOnly.ok) {
        assert.equal(withSize3dOnly.data.renderMode, '3d');
        assert.equal(is3DScenePlan(withSize3dOnly.data), true);
      }

      const explicit2D = normalizeScenePlan({
        planVersion: 1,
        renderMode: '2d',
        title: 'Explicit 2D Override',
        summary: 'Explicit 2d stays 2d even with pos3d',
        scenes: [
          makeBaseSegment({
            elements: [
              {
                id: 'char_2d',
                kind: 'character',
                label: 'Hero',
                x: 0.5, y: 0.65, scale: 1,
                colorPrimary: '#38bdf8', colorSecondary: '#0f172a', accentColor: '#e2e8f0',
                variant: 'walking', count: 1, depth: 0.8,
                pos3d: { x: 0, y: 0, z: 0 },
                motion: { type: 'static', speed: 1, amplitude: 0, direction: 1 },
              },
            ],
          }),
        ],
      });
      assert.equal(explicit2D.ok, true);
      if (explicit2D.ok) {
        assert.equal(explicit2D.data.renderMode, '2d');
        assert.equal(is3DScenePlan(explicit2D.data), false, 'Explicit renderMode="2d" must remain 2D');
      }
    }
  );

  // Scenario 17: Phase A Fix 3 — Auto-framing & closer default camera across character, vehicle, building & multi-object scenes
  await runTest(
    'Scenario 17: Phase A Fix 3 — Character, vehicle, building & multi-object scenes auto-frame to ~50%+ viewport fill',
    () => {
      const measureElementHeightFill = (rt: ThreeSceneRuntime, elementIds: string[]) => {
        rt.inspectSceneAtTime(0);
        const box = new THREE.Box3();
        const tmp = new THREE.Box3();
        for (const id of elementIds) {
          const snap = rt.inspectSceneAtTime(0).elements.find((e) => e.id === id)!;
          tmp.set(
            new THREE.Vector3(snap.boundingBoxMin.x, snap.boundingBoxMin.y, snap.boundingBoxMin.z),
            new THREE.Vector3(snap.boundingBoxMax.x, snap.boundingBoxMax.y, snap.boundingBoxMax.z)
          );
          box.union(tmp);
        }
        const corners = [
          new THREE.Vector3(box.min.x, box.min.y, box.min.z),
          new THREE.Vector3(box.min.x, box.min.y, box.max.z),
          new THREE.Vector3(box.min.x, box.max.y, box.min.z),
          new THREE.Vector3(box.min.x, box.max.y, box.max.z),
          new THREE.Vector3(box.max.x, box.min.y, box.min.z),
          new THREE.Vector3(box.max.x, box.min.y, box.max.z),
          new THREE.Vector3(box.max.x, box.max.y, box.min.z),
          new THREE.Vector3(box.max.x, box.max.y, box.max.z),
        ];
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const c of corners) {
          const p = c.project(rt.camera);
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        }
        return {
          heightFill: (maxY - minY) * 0.5,
          maxFill: Math.max((maxX - minX) * 0.5, (maxY - minY) * 0.5),
        };
      };

      // A. Character with omitted camera3d (tests close default camera in normalizeScene3DConfig + runtime framing)
      const charPlan = mustNormalize3D({
        planVersion: 1,
        renderMode: '3d',
        title: 'Solo Character Framing',
        summary: 'Character without explicit camera coords',
        scenes: [
          makeBaseSegment({
            elements: [
              {
                id: 'hero_char',
                kind: 'character',
                label: 'Hero Survivor',
                x: 0.5, y: 0.7, scale: 1,
                colorPrimary: '#38bdf8', colorSecondary: '#0f172a', accentColor: '#22d3ee',
                variant: 'idle', count: 1, depth: 0.8,
                pos3d: { x: 0, y: 0, z: 0 },
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
              },
            ],
          }),
        ],
      });
      const defaultCamDist = Math.hypot(
        charPlan.scenes[0].scene3d!.camera3d.position.x,
        charPlan.scenes[0].scene3d!.camera3d.position.y,
        charPlan.scenes[0].scene3d!.camera3d.position.z
      );
      assert.ok(defaultCamDist < 7, `Default character camera must be brought closer (got ${defaultCamDist.toFixed(2)}m)`);
      const charRt = new ThreeSceneRuntime(charPlan);
      const charFill = measureElementHeightFill(charRt, ['hero_char']);
      assert.ok(charFill.heightFill >= 0.48, `Character should fill >= ~50% height (got ${(charFill.heightFill * 100).toFixed(1)}%)`);
      charRt.dispose();

      // B. Vehicle (distant default guess overridden by runtime auto-framing)
      const bikePlan = mustNormalize3D({
        planVersion: 1,
        renderMode: '3d',
        title: 'Bicycle Framing',
        summary: 'Bike with far initial camera guess',
        scenes: [
          makeBaseSegment({
            scene3d: {
              environment: 'street',
              groundType: 'asphalt',
              camera3d: {
                projection: 'perspective',
                shotType: 'wide',
                fov: 52,
                position: { x: 4, y: 3, z: 22 },
                target: { x: 0, y: 0.5, z: 0 },
                motion: 'static',
              },
            },
            elements: [
              {
                id: 'hero_bike',
                kind: 'vehicle',
                label: 'Cartoon Bicycle',
                x: 0.5, y: 0.7, scale: 1,
                colorPrimary: '#ef4444', colorSecondary: '#1e293b', accentColor: '#f59e0b',
                variant: 'running', count: 1, depth: 0.8,
                pos3d: { x: 0, y: 0, z: 0 },
                motion: { type: 'static', speed: 1, amplitude: 0, direction: 1 },
              },
            ],
          }),
        ],
      });
      const bikeRt = new ThreeSceneRuntime(bikePlan);
      const bikeFill = measureElementHeightFill(bikeRt, ['hero_bike']);
      assert.ok(bikeFill.maxFill >= 0.48 && bikeFill.maxFill <= 0.62, `Vehicle must frame cleanly around ~54% (got ${(bikeFill.maxFill * 100).toFixed(1)}%)`);
      bikeRt.dispose();

      // C. Building (solo 18m building with too-close default guess -> frames to ~54%)
      const bldgPlan = mustNormalize3D({
        planVersion: 1,
        renderMode: '3d',
        title: 'Hospital Building Framing',
        summary: 'Single building auto-framed',
        scenes: [
          makeBaseSegment({
            elements: [
              {
                id: 'hospital_bldg',
                kind: 'building',
                label: 'Horror Hospital',
                x: 0.5, y: 0.5, scale: 1,
                colorPrimary: '#475569', colorSecondary: '#1e293b', accentColor: '#ef4444',
                variant: 'ruined', count: 1, depth: 0.5,
                pos3d: { x: 0, y: 0, z: 0 },
                size3d: { w: 12, h: 16, d: 10 },
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
              },
            ],
          }),
        ],
      });
      const bldgRt = new ThreeSceneRuntime(bldgPlan);
      const bldgFill = measureElementHeightFill(bldgRt, ['hospital_bldg']);
      assert.ok(bldgFill.heightFill >= 0.46 && bldgFill.heightFill <= 0.64, `Building must frame cleanly (~54% height), got ${(bldgFill.heightFill * 100).toFixed(1)}%`);
      bldgRt.dispose();

      // D. Multi-object scene (character + creature) frames both cleanly
      const multiPlan = mustNormalize3D({
        planVersion: 1,
        renderMode: '3d',
        title: 'Multi-Object Chase Frame',
        summary: 'Hero and pursuer framed together',
        scenes: [
          makeBaseSegment({
            elements: [
              {
                id: 'hero_a',
                kind: 'character',
                label: 'Survivor',
                x: 0.4, y: 0.7, scale: 1,
                colorPrimary: '#38bdf8', colorSecondary: '#0f172a', accentColor: '#22d3ee',
                variant: 'idle', count: 1, depth: 0.8,
                pos3d: { x: -1.4, y: 0, z: 0 },
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
              },
              {
                id: 'hero_b',
                kind: 'creature',
                label: 'Zombie',
                x: 0.6, y: 0.7, scale: 1,
                colorPrimary: '#4d7c0f', colorSecondary: '#1a2e05', accentColor: '#ef4444',
                variant: 'idle', count: 1, depth: 0.8,
                pos3d: { x: 1.4, y: 0, z: 0 },
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
              },
            ],
          }),
        ],
      });
      const multiRt = new ThreeSceneRuntime(multiPlan);
      const multiFill = measureElementHeightFill(multiRt, ['hero_a', 'hero_b']);
      assert.ok(multiFill.maxFill >= 0.48 && multiFill.maxFill <= 0.62, `Multi-object group must frame cleanly (~54%), got ${(multiFill.maxFill * 100).toFixed(1)}%`);
      multiRt.dispose();
    }
  );

  // Scenario 18: Phase A Fix 4 — createVehicleGroup 'hover-bike' renders 2 wheels, frame, handlebar, seat (not 4-wheeled car)
  await runTest(
    'Scenario 18: Phase A Fix 4 — hover-bike renders 2 wheels, frame, handlebar & seat instead of 4-wheeled car',
    () => {
      const plan = mustNormalize3D({
        planVersion: 1,
        renderMode: '3d',
        title: 'Bicycle Ride',
        summary: '2-wheeled bike check',
        scenes: [
          makeBaseSegment({
            elements: [
              {
                id: 'my_bike',
                kind: 'vehicle',
                label: 'Cartoon Bicycle',
                x: 0.5, y: 0.7, scale: 1,
                colorPrimary: '#ef4444', colorSecondary: '#1e293b', accentColor: '#f59e0b',
                variant: 'running', count: 1, depth: 0.8,
                pos3d: { x: 0, y: 0, z: 0 },
                motion: { type: 'static', speed: 1.5, amplitude: 0, direction: 1 },
              },
            ],
          }),
        ],
      });

      const bikeEl = plan.scenes[0].elements[0];
      assert.equal(bikeEl.vehicleSpec?.subKind, 'hover-bike');

      const bikeGroup = createVehicleGroup(bikeEl, bikeEl.vehicleSpec!);
      const rig = bikeGroup.userData.rig as VehicleRigData;
      assert.equal(rig.type, 'vehicle');
      assert.equal(rig.subKind, 'hover-bike');
      assert.equal(rig.wheels.length, 2, 'hover-bike must have exactly 2 wheels, not 4');
      assert.ok(bikeGroup.getObjectByName('bike_seat'), 'hover-bike must include a seat');
      assert.ok(bikeGroup.getObjectByName('bike_handlebar'), 'hover-bike must include a handlebar');

      const rt = new ThreeSceneRuntime(plan);
      const snap = rt.inspectSceneAtTime(0.5);
      const bSnap = snap.elements.find((e) => e.id === 'my_bike')!;
      assert.ok(bSnap.boundingBoxMax.x - bSnap.boundingBoxMin.x < 1.0, 'Bike width must stay narrow (<1.0m), unlike a wide car');
      assert.ok(Math.abs(bSnap.boundingBoxMin.y) < 0.05, 'Bike tires must sit flush on ground y=0');
      rt.dispose();
    }
  );

  // Scenario 19: Phase 1d camera helper unit tests (bounding-sphere 50% width distance, 60 deg 3/4 angle, focus part close-up target)
  await runTest(
    'Scenario 19: Phase 1d camera helpers — bounding-sphere 50% width distance, 60° 3/4 angle & focus part close-up target',
    () => {
      const fovDeg = 50;
      const aspect = 16 / 9;
      const tanHalfH = Math.tan(THREE.MathUtils.degToRad(fovDeg) * 0.5) * aspect;

      // A. X-longest horizontal subject (whale along +X) with straight-on +X AI hint MUST still sit at ~60 deg 3/4 view
      const whaleBox = new THREE.Box3(
        new THREE.Vector3(-6, 0, -2.1),
        new THREE.Vector3(6, 2.8, 2.1)
      );
      const estX = frameCustomEstablishingCamera(whaleBox, fovDeg, aspect, {
        hintDirection: new THREE.Vector3(30, 0, 0), // terrible straight-on hint
      });
      assert.ok(
        Math.abs(estX.horizontalAngleFromLongestDeg - 60) < 1.5,
        `Expected ~60° from longest axis (+X), got ${estX.horizontalAngleFromLongestDeg.toFixed(2)}°`
      );
      assert.ok(
        estX.position.y > estX.target.y + 0.5,
        'Establishing camera must sit slightly above subject center'
      );
      const expectedCenter = whaleBox.getCenter(new THREE.Vector3());
      assert.ok(
        estX.target.distanceTo(expectedCenter) < 0.01,
        'Establishing camera must target subject center'
      );
      const sphereWidthFillX =
        Math.tan(Math.asin(estX.boundingSphere.radius / estX.distance)) / tanHalfH;
      assert.ok(
        Math.abs(sphereWidthFillX - 0.5) < 0.03,
        `Bounding sphere must fill ~50% of frame width, got ${(sphereWidthFillX * 100).toFixed(1)}%`
      );

      // B. Z-longest horizontal subject with straight-on +Z AI hint MUST still sit at ~60 deg from Z
      const zBox = new THREE.Box3(
        new THREE.Vector3(-1.5, 0, -5),
        new THREE.Vector3(1.5, 2.0, 5)
      );
      const estZ = frameCustomEstablishingCamera(zBox, fovDeg, aspect, {
        hintDirection: new THREE.Vector3(0, 0, 25),
      });
      assert.ok(
        Math.abs(estZ.horizontalAngleFromLongestDeg - 60) < 1.5,
        `Expected ~60° from longest axis (+Z), got ${estZ.horizontalAngleFromLongestDeg.toFixed(2)}°`
      );
      const sphereWidthFillZ =
        Math.tan(Math.asin(estZ.boundingSphere.radius / estZ.distance)) / tanHalfH;
      assert.ok(
        Math.abs(sphereWidthFillZ - 0.5) < 0.03,
        `Z-longest sphere must fill ~50% of frame width, got ${(sphereWidthFillZ * 100).toFixed(1)}%`
      );

      // C. Tiny bounding box (tiny size3d) still scales camera right in so sphere fills ~50% width
      const tinyBox = new THREE.Box3(
        new THREE.Vector3(-0.08, 0, -0.03),
        new THREE.Vector3(0.08, 0.04, 0.03)
      );
      const estTiny = frameCustomEstablishingCamera(tinyBox, fovDeg, aspect);
      const sphereWidthFillTiny =
        Math.tan(Math.asin(estTiny.boundingSphere.radius / estTiny.distance)) / tanHalfH;
      assert.ok(
        Math.abs(sphereWidthFillTiny - 0.5) < 0.03,
        `Tiny bounding sphere must still fill ~50% of frame width, got ${(sphereWidthFillTiny * 100).toFixed(1)}%`
      );

      // D. Close-up helper targets focus part world center and ends at ~1.5x part size from outer side
      const eyeBox = new THREE.Box3(
        new THREE.Vector3(3.16, 1.45, 0.72),
        new THREE.Vector3(3.44, 1.71, 0.96)
      );
      const closeUp = frameCustomCloseUpCamera(whaleBox, eyeBox, fovDeg, aspect);
      const eyeCenter = eyeBox.getCenter(new THREE.Vector3());
      const eyeSize = Math.max(0.28, 0.26, 0.24);
      assert.ok(closeUp.target.distanceTo(eyeCenter) < 0.005, 'Close-up start target must equal focus part center');
      assert.ok(closeUp.endTarget.distanceTo(eyeCenter) < 0.005, 'Close-up end target must equal focus part center');
      assert.ok(
        Math.abs(closeUp.endDistance - eyeSize * 1.5) < 0.02,
        `Close-up must end at ~1.5x part size (${(eyeSize * 1.5).toFixed(3)}), got ${closeUp.endDistance.toFixed(3)}`
      );
      assert.ok(closeUp.startDistance > closeUp.endDistance * 2.5, 'Close-up must dolly inward toward focus part');
      assert.ok(
        closeUp.endPosition.z > eyeCenter.z,
        'Close-up approach for +Z eye must stay on the outer (+Z) side of the head'
      );
    }
  );

  // Scenario 20: Phase 1d focusPartId validation (valid kept, missing/nonexistent ignored)
  await runTest(
    'Scenario 20: Phase 1d focusPartId validation keeps valid part id and ignores nonexistent ids',
    () => {
      const makeFocusPlan = (focusPartId: unknown) =>
        normalizeScenePlan({
          planVersion: 1,
          renderMode: '3d',
          title: 'Focus Part Validation',
          summary: 'Validate customModelSpec.focusPartId',
          scenes: [
            makeBaseSegment({
              elements: [
                {
                  id: 'whale_focus',
                  kind: 'custom',
                  label: 'Blue Whale',
                  x: 0.5, y: 0.5, scale: 1,
                  colorPrimary: '#1d4ed8', colorSecondary: '#0f172a', accentColor: '#bae6fd',
                  variant: 'organic', count: 1, depth: 0.7,
                  pos3d: { x: 0, y: 1, z: 0 },
                  size3d: { w: 12, h: 2.8, d: 4.2 },
                  motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
                  customModelSpec: {
                    description: 'Whale with eye focus part',
                    ...(focusPartId !== undefined ? { focusPartId } : {}),
                    parts: [
                      { id: 'whale_body', shape: 'sphere', px: 0, py: 0, pz: 0, sx: 8, sy: 2, sz: 2.2, color: '#1d4ed8' },
                      { id: 'eye_left', shape: 'sphere', px: 3.2, py: 0.2, pz: 0.9, sx: 0.3, sy: 0.3, sz: 0.25, color: '#f8fafc' },
                    ],
                  },
                },
              ],
            }),
          ],
        });

      const validRes = makeFocusPlan('eye_left');
      assert.equal(validRes.ok, true);
      if (validRes.ok) {
        assert.equal(validRes.data.scenes[0].elements[0].customModelSpec?.focusPartId, 'eye_left');
        assert.equal(validateScenePlan(validRes.data).ok, true, 'Validated plan with focusPartId must pass strict schema');
      }

      const invalidRes = makeFocusPlan('missing_part_999');
      assert.equal(invalidRes.ok, true, 'Unknown focusPartId must not reject the whole scene');
      if (invalidRes.ok) {
        assert.equal(
          invalidRes.data.scenes[0].elements[0].customModelSpec?.focusPartId,
          undefined,
          'Nonexistent focusPartId must be ignored/omitted'
        );
      }

      const emptyRes = makeFocusPlan('   ');
      assert.equal(emptyRes.ok, true);
      if (emptyRes.ok) {
        assert.equal(emptyRes.data.scenes[0].elements[0].customModelSpec?.focusPartId, undefined);
      }
    }
  );

  // Scenario 21: Phase 1d runtime establishing + close-up focus-part dolly overriding tiny size3d and AI camera guesses
  await runTest(
    'Scenario 21: Phase 1d runtime overrides tiny size3d & AI camera guesses for establishing 3/4 view and focus-part close-up dolly',
    () => {
      const whaleParts = [
        { id: 'whale_head', shape: 'sphere', px: 3.4, py: 0.1, pz: 0, sx: 3.2, sy: 1.55, sz: 1.75, color: '#1e40af' },
        { id: 'whale_body', shape: 'sphere', px: 1.0, py: 0.12, pz: 0, sx: 3.8, sy: 2.1, sz: 2.2, color: '#1d4ed8' },
        { id: 'whale_tail', shape: 'sphere', px: -3.2, py: 0.04, pz: 0, sx: 3.0, sy: 1.1, sz: 1.1, color: '#1e3a8a' },
        { id: 'eye_left', shape: 'sphere', px: 3.3, py: 0.18, pz: 0.85, sx: 0.28, sy: 0.26, sz: 0.22, color: '#f8fafc' },
        { id: 'pupil_left', shape: 'sphere', px: 3.32, py: 0.18, pz: 0.93, sx: 0.14, sy: 0.14, sz: 0.12, color: '#020617' },
      ];

      const plan = mustNormalize3D({
        planVersion: 1,
        renderMode: '3d',
        title: 'Whale Establishing + Eye Close-Up',
        summary: 'Two-shot Phase 1d framing verification',
        scenes: [
          makeBaseSegment({
            id: 'shot_wide',
            durationSec: 5,
            scene3d: {
              environment: 'wasteland',
              groundType: 'none',
              camera3d: {
                projection: 'perspective',
                shotType: 'wide',
                fov: 50,
                position: { x: 25, y: 0, z: 0 }, // bad straight-along-longest-axis AI guess
                target: { x: 0, y: 0, z: 0 },
                endPosition: { x: 18, y: 0, z: 0 },
                endTarget: { x: 0, y: 0, z: 0 },
                motion: 'dolly-in',
              },
            },
            elements: [
              {
                id: 'tiny_whale',
                kind: 'custom',
                label: 'Blue Whale',
                x: 0.5, y: 0.5, scale: 1,
                colorPrimary: '#1d4ed8', colorSecondary: '#0f172a', accentColor: '#bae6fd',
                variant: 'organic', count: 1, depth: 0.7,
                pos3d: { x: 0, y: 0.2, z: 0 },
                size3d: { w: 0.24, h: 0.06, d: 0.08 }, // tiny size3d
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
                customModelSpec: {
                  description: 'Tiny whale testing camera override',
                  focusPartId: 'eye_left',
                  parts: whaleParts,
                },
              },
            ],
          }),
          makeBaseSegment({
            id: 'shot_closeup',
            durationSec: 5,
            scene3d: {
              environment: 'wasteland',
              groundType: 'none',
              camera3d: {
                projection: 'perspective',
                shotType: 'close-up',
                fov: 46,
                position: { x: 0, y: 12, z: 30 }, // bogus AI camera guess
                target: { x: 0, y: 0, z: 0 },
                motion: 'static',
              },
            },
            elements: [
              {
                id: 'hero_whale',
                kind: 'custom',
                label: 'Blue Whale',
                x: 0.5, y: 0.5, scale: 1,
                colorPrimary: '#1d4ed8', colorSecondary: '#0f172a', accentColor: '#bae6fd',
                variant: 'organic', count: 1, depth: 0.7,
                pos3d: { x: 0, y: 1.0, z: 0 },
                size3d: { w: 12, h: 2.8, d: 4.2 },
                motion: { type: 'bob', speed: 0.6, amplitude: 0.08, direction: 1 },
                customModelSpec: {
                  description: 'Full-size whale with bobbing eye focus tracking',
                  focusPartId: 'eye_left',
                  parts: whaleParts,
                },
              },
            ],
          }),
        ],
      });

      const rt = new ThreeSceneRuntime(plan);

      // Shot 1 (t=0): Establishing wide shot overrides tiny size3d & straight-on AI numbers
      const sWide = rt.inspectSceneAtTime(0);
      const wEl = sWide.elements[0];
      const wBox = new THREE.Box3(
        new THREE.Vector3(wEl.boundingBoxMin.x, wEl.boundingBoxMin.y, wEl.boundingBoxMin.z),
        new THREE.Vector3(wEl.boundingBoxMax.x, wEl.boundingBoxMax.y, wEl.boundingBoxMax.z)
      );
      const wSphere = wBox.getBoundingSphere(new THREE.Sphere());
      const camVec = new THREE.Vector3(
        sWide.cameraPosition.x - sWide.cameraTarget.x,
        sWide.cameraPosition.y - sWide.cameraTarget.y,
        sWide.cameraPosition.z - sWide.cameraTarget.z
      );
      const horizAngleDeg = THREE.MathUtils.radToDeg(
        Math.acos(Math.abs(camVec.x) / Math.hypot(camVec.x, camVec.z))
      );
      assert.ok(
        Math.abs(horizAngleDeg - 60) < 2.5,
        `Wide shot must override straight-on AI camera to ~60° 3/4 view, got ${horizAngleDeg.toFixed(1)}°`
      );
      const tanHalfH = Math.tan(THREE.MathUtils.degToRad(sWide.cameraFov) * 0.5) * (16 / 9);
      const actualWidthFill = Math.tan(Math.asin(wSphere.radius / camVec.length())) / tanHalfH;
      assert.ok(
        Math.abs(actualWidthFill - 0.5) < 0.04,
        `Tiny size3d custom subject must still fill ~50% of frame width, got ${(actualWidthFill * 100).toFixed(1)}%`
      );

      // Shot 2 (t=5.0 -> t=9.95): Close-up dollys toward live eye_left world position, ending at ~1.5x eye size
      const sCloseStart = rt.inspectSceneAtTime(5.05);
      const eyeMeshStart = rt.scene.getObjectByName('eye_left')!;
      assert.ok(eyeMeshStart, 'eye_left mesh must exist in close-up shot');
      const eyeBoxStart = new THREE.Box3().setFromObject(eyeMeshStart);
      const eyeCenterStart = eyeBoxStart.getCenter(new THREE.Vector3());
      const eyeSizeVec = eyeBoxStart.getSize(new THREE.Vector3());
      const eyeWorldSize = Math.max(eyeSizeVec.x, eyeSizeVec.y, eyeSizeVec.z);

      const startTargetErr = new THREE.Vector3(
        sCloseStart.cameraTarget.x,
        sCloseStart.cameraTarget.y,
        sCloseStart.cameraTarget.z
      ).distanceTo(eyeCenterStart);
      assert.ok(startTargetErr < 0.05, `Close-up start lookAt must lock on eye_left (err=${startTargetErr.toFixed(3)})`);

      const sCloseEnd = rt.inspectSceneAtTime(9.99);
      const eyeMeshEnd = rt.scene.getObjectByName('eye_left')!;
      const eyeCenterEnd = new THREE.Box3().setFromObject(eyeMeshEnd).getCenter(new THREE.Vector3());
      const endTargetErr = new THREE.Vector3(
        sCloseEnd.cameraTarget.x,
        sCloseEnd.cameraTarget.y,
        sCloseEnd.cameraTarget.z
      ).distanceTo(eyeCenterEnd);
      assert.ok(endTargetErr < 0.05, `Close-up end lookAt must track live eye_left (err=${endTargetErr.toFixed(3)})`);

      const startDist = new THREE.Vector3(
        sCloseStart.cameraPosition.x,
        sCloseStart.cameraPosition.y,
        sCloseStart.cameraPosition.z
      ).distanceTo(eyeCenterStart);
      const endDist = new THREE.Vector3(
        sCloseEnd.cameraPosition.x,
        sCloseEnd.cameraPosition.y,
        sCloseEnd.cameraPosition.z
      ).distanceTo(eyeCenterEnd);
      assert.ok(startDist > endDist * 2, 'Close-up camera must dolly inward toward eye_left');
      assert.ok(
        Math.abs(endDist - eyeWorldSize * 1.5) < 0.08,
        `Close-up must end at ~1.5x eye size (${(eyeWorldSize * 1.5).toFixed(3)}), got ${endDist.toFixed(3)}`
      );

      rt.dispose();
    }
  );

  // Scenario 22: Phase 1d round soft radial-gradient marine-snow particle sprites (not squares)
  await runTest(
    'Scenario 22: Phase 1d marine-snow weather & burst particles use soft radial-gradient circular sprites',
    () => {
      const tex = createSoftParticleTexture(32);
      assert.ok(tex instanceof THREE.DataTexture, 'Headless soft particle texture must be a radial DataTexture');
      const img = tex.image as { data: Uint8Array; width: number; height: number };
      const cornerAlpha = img.data[3]; // pixel (0, 0)
      const centerIdx = (16 * 32 + 16) * 4;
      const centerAlpha = img.data[centerIdx + 3];
      assert.equal(cornerAlpha, 0, 'Soft particle sprite corners must be fully transparent (round, not square)');
      assert.ok(centerAlpha >= 240, `Soft particle sprite center must be opaque (~255), got ${centerAlpha}`);
      tex.dispose();

      const plan = mustNormalize3D({
        planVersion: 1,
        renderMode: '3d',
        title: 'Marine Snow Ocean',
        summary: 'Verify round soft sprites on snow weather and particle-burst',
        scenes: [
          makeBaseSegment({
            weather: { type: 'snow', density: 0.6, windX: 0.05 },
            elements: [
              {
                id: 'marine_burst',
                kind: 'particle-burst',
                label: 'Bioluminescent Plankton',
                x: 0.5, y: 0.5, scale: 1,
                colorPrimary: '#38bdf8', colorSecondary: '#0284c7', accentColor: '#e0f2fe',
                variant: 'glowing', count: 3, depth: 0.6,
                pos3d: { x: 0, y: 2, z: 0 },
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
              },
            ],
          }),
        ],
      });

      const rt = new ThreeSceneRuntime(plan);
      const weatherPts = rt.scene.getObjectByName('weather_snow') as THREE.Points | undefined;
      assert.ok(weatherPts && weatherPts.isPoints, 'weather_snow Points must exist');
      const weatherMat = weatherPts.material as THREE.PointsMaterial;
      assert.ok(weatherMat.map, 'Marine-snow weather PointsMaterial must attach radial sprite texture map');
      assert.equal(weatherMat.transparent, true);
      assert.equal(weatherMat.depthWrite, false);

      let burstPointsMat: THREE.PointsMaterial | null = null;
      rt.scene.traverse((obj) => {
        if ((obj as THREE.Points).isPoints && obj.name !== 'weather_snow' && obj.name !== 'starfield') {
          burstPointsMat = (obj as THREE.Points).material as THREE.PointsMaterial;
        }
      });
      assert.ok(burstPointsMat && (burstPointsMat as THREE.PointsMaterial).map, 'particle-burst PointsMaterial must attach soft radial sprite map');
      rt.dispose();
    }
  );

  // Scenario 23: Phase 1d.2 devWhale fixture — 3/4 start hold (0-40%), smooth ease-in-out dolly (40-100%), endDist < 25% startDist, lookAt near eye
  await runTest(
    'Scenario 23: Phase 1d.2 devWhale dollies during last 60% so end distance < 25% of start distance and lookAt locks onto eye',
    () => {
      const norm = mustNormalize3D(DEV_WHALE_SCENE_PLAN as unknown as Record<string, unknown>);
      const rt = new ThreeSceneRuntime(norm);

      const s0 = rt.inspectSceneAtTime(0);
      const sHold = rt.inspectSceneAtTime(3.0); // 37.5% of 8s -> still holding establishing shot
      const sMid = rt.inspectSceneAtTime(5.6); // 70% of 8s -> midpoint of last-60% dolly
      const sEnd = rt.inspectSceneAtTime(7.99); // ~100% of 8s -> end shot at ~1.5x eye size

      const distOf = (s: ReturnType<ThreeSceneRuntime['inspectSceneAtTime']>) =>
        Math.hypot(
          s.cameraPosition.x - s.cameraTarget.x,
          s.cameraPosition.y - s.cameraTarget.y,
          s.cameraPosition.z - s.cameraTarget.z
        );

      const startDist = distOf(s0);
      const holdDist = distOf(sHold);
      const midDist = distOf(sMid);
      const endDist = distOf(sEnd);

      // First 40% holds the establishing framing distance
      assert.ok(
        Math.abs(holdDist - startDist) < 0.05,
        `Camera must hold establishing distance during first 40% (t=0: ${startDist.toFixed(3)}m vs t=3.0: ${holdDist.toFixed(3)}m)`
      );
      // Midpoint of last 60% has moved substantially inward
      assert.ok(
        midDist < startDist * 0.75 && midDist > endDist * 2,
        `Mid-dolly distance (${midDist.toFixed(3)}m) must sit smoothly between start (${startDist.toFixed(3)}m) and end (${endDist.toFixed(3)}m)`
      );
      // End distance must be < 25% of start distance
      assert.ok(
        endDist < startDist * 0.25,
        `devWhale end distance (${endDist.toFixed(3)}m) must be < 25% of start distance (${startDist.toFixed(3)}m)`
      );

      // Verify lookAt at end is near the eye part (whale_eye_sclera)
      const eyeMesh = rt.scene.getObjectByName('whale_eye_sclera');
      assert.ok(eyeMesh, 'whale_eye_sclera mesh must exist');
      const eyeBox = new THREE.Box3().setFromObject(eyeMesh);
      const eyeCenter = eyeBox.getCenter(new THREE.Vector3());
      const eyeDims = eyeBox.getSize(new THREE.Vector3());
      const eyeSize = Math.max(eyeDims.x, eyeDims.y, eyeDims.z);

      const lookAtErr = new THREE.Vector3(
        sEnd.cameraTarget.x,
        sEnd.cameraTarget.y,
        sEnd.cameraTarget.z
      ).distanceTo(eyeCenter);
      assert.ok(
        lookAtErr < 0.05,
        `devWhale end lookAt must be near eye part (err=${lookAtErr.toFixed(4)}m)`
      );
      assert.ok(
        Math.abs(endDist - eyeSize * 1.5) < 0.08,
        `devWhale end distance (${endDist.toFixed(3)}m) must be ~1.5x eye size (${(eyeSize * 1.5).toFixed(3)}m)`
      );
      console.log(
        `  [devWhale metrics] startDist=${startDist.toFixed(2)}m, midDist=${midDist.toFixed(2)}m, endDist=${endDist.toFixed(2)}m (${((endDist / startDist) * 100).toFixed(1)}%), eyeSize=${eyeSize.toFixed(2)}m, lookAtErr=${lookAtErr.toFixed(4)}m`
      );
      rt.dispose();
    }
  );

  // Scenario 24: Phase 1d.2 fallback when focusPartId is invalid/missing (closest "eye" part -> highest-x head part) + AI keyframe override immunity
  await runTest(
    'Scenario 24: Phase 1d.2 invalid focusPartId falls back to closest eye part, else highest-x head part, overriding AI camera keyframes',
    () => {
      // Part A: Invalid focusPartId on a two-eyed whale with AI static/tracking wide camera -> picks eye closest to start camera
      const twoEyePlan = mustNormalize3D({
        planVersion: 1,
        renderMode: '3d',
        title: 'Invalid focusPartId Two-Eye Fallback',
        summary: 'Single-segment wide static AI plan with bogus focusPartId',
        scenes: [
          makeBaseSegment({
            id: 'ai_whale_wide_static',
            durationSec: 10,
            scene3d: {
              environment: 'wasteland',
              groundType: 'none',
              camera3d: {
                projection: 'perspective',
                shotType: 'wide',
                fov: 50,
                position: { x: 18, y: 1, z: 22 }, // AI wide static keyframes that MUST NOT block dolly
                target: { x: 0, y: 0, z: 0 },
                endPosition: { x: 18, y: 1, z: 22 },
                endTarget: { x: 0, y: 0, z: 0 },
                motion: 'static',
              },
            },
            elements: [
              {
                id: 'fallback_whale',
                kind: 'custom',
                label: 'Blue Whale',
                x: 0.5, y: 0.5, scale: 1,
                colorPrimary: '#1d4ed8', colorSecondary: '#0f172a', accentColor: '#bae6fd',
                variant: 'organic', count: 1, depth: 0.7,
                pos3d: { x: 0, y: 0, z: 0 },
                size3d: { w: 12, h: 3, d: 4 },
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
                customModelSpec: {
                  description: 'Whale with invalid focusPartId and both left/right eyes',
                  focusPartId: 'nonexistent_eye_id',
                  parts: [
                    { id: 'body_mid', shape: 'sphere', px: 0, py: 0, pz: 0, sx: 6.0, sy: 2.2, sz: 2.2, color: '#1d4ed8' },
                    { id: 'head_front', shape: 'sphere', px: 3.5, py: 0, pz: 0, sx: 3.2, sy: 1.9, sz: 1.9, color: '#1e40af' },
                    { id: 'tail_back', shape: 'sphere', px: -4.0, py: 0, pz: 0, sx: 3.0, sy: 1.0, sz: 1.2, color: '#1e3a8a' },
                    { id: 'eye_right', shape: 'sphere', px: 3.6, py: 0.2, pz: -0.95, sx: 0.32, sy: 0.3, sz: 0.26, color: '#f8fafc' },
                    { id: 'eye_left', shape: 'sphere', px: 3.6, py: 0.2, pz: 0.95, sx: 0.32, sy: 0.3, sz: 0.26, color: '#f8fafc' },
                  ],
                },
              },
            ],
          }),
        ],
      });

      // Also inject raw invalid focusPartId directly to verify runtime fallback even without normalization stripping
      twoEyePlan.scenes[0].elements[0].customModelSpec!.focusPartId = 'still_invalid_id';

      const rtEye = new ThreeSceneRuntime(twoEyePlan);
      const eStart = rtEye.inspectSceneAtTime(0);
      const eEnd = rtEye.inspectSceneAtTime(9.99);

      // Start camera is on +z side, so eye_left (pz=+0.95) is closer than eye_right (pz=-0.95)
      const eyeLeft = rtEye.scene.getObjectByName('eye_left')!;
      const eyeLeftBox = new THREE.Box3().setFromObject(eyeLeft);
      const eyeLeftCenter = eyeLeftBox.getCenter(new THREE.Vector3());
      const eyeLeftDims = eyeLeftBox.getSize(new THREE.Vector3());
      const eyeLeftSize = Math.max(eyeLeftDims.x, eyeLeftDims.y, eyeLeftDims.z);

      const startDist = Math.hypot(
        eStart.cameraPosition.x - eStart.cameraTarget.x,
        eStart.cameraPosition.y - eStart.cameraTarget.y,
        eStart.cameraPosition.z - eStart.cameraTarget.z
      );
      const endDist = Math.hypot(
        eEnd.cameraPosition.x - eEnd.cameraTarget.x,
        eEnd.cameraPosition.y - eEnd.cameraTarget.y,
        eEnd.cameraPosition.z - eEnd.cameraTarget.z
      );
      assert.ok(
        endDist < startDist * 0.25,
        `Invalid focusPartId fallback must still dolly in (<25% of startDist): start=${startDist.toFixed(2)}m, end=${endDist.toFixed(2)}m`
      );
      const eyeErr = new THREE.Vector3(
        eEnd.cameraTarget.x,
        eEnd.cameraTarget.y,
        eEnd.cameraTarget.z
      ).distanceTo(eyeLeftCenter);
      assert.ok(
        eyeErr < 0.05,
        `Fallback must pick eye_left (closest to +z start camera), got lookAt err=${eyeErr.toFixed(4)}m`
      );
      assert.ok(
        eEnd.cameraPosition.z > eyeLeftCenter.z,
        `End camera must stay on the +z side of the head it was already viewing from`
      );
      assert.ok(
        Math.abs(endDist - eyeLeftSize * 1.5) < 0.08,
        `End distance (${endDist.toFixed(3)}m) must be ~1.5x eye size (${(eyeLeftSize * 1.5).toFixed(3)}m)`
      );
      rtEye.dispose();

      // Part B: Invalid focusPartId on a custom model with NO "eye" parts -> falls back to highest-X part (head)
      const noEyePlan = mustNormalize3D({
        planVersion: 1,
        renderMode: '3d',
        title: 'No-Eye Highest-X Head Fallback',
        summary: 'Verifies highest-X head fallback when no eye parts exist and AI motion is tracking',
        scenes: [
          makeBaseSegment({
            id: 'ai_no_eye_tracking',
            durationSec: 6,
            scene3d: {
              environment: 'studio',
              groundType: 'studio-floor',
              camera3d: {
                projection: 'perspective',
                shotType: 'tracking',
                fov: 50,
                position: { x: 0, y: 2, z: 20 },
                target: { x: 0, y: 1, z: 0 },
                motion: 'tracking', // Must NOT skip custom dolly helper
              },
            },
            elements: [
              {
                id: 'eyeless_sub',
                kind: 'custom',
                label: 'Submarine',
                x: 0.5, y: 0.5, scale: 1,
                colorPrimary: '#475569', colorSecondary: '#0f172a', accentColor: '#38bdf8',
                variant: 'futuristic', count: 1, depth: 0.7,
                pos3d: { x: 0, y: 0, z: 0 },
                size3d: { w: 10, h: 2.5, d: 2.5 },
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
                customModelSpec: {
                  description: 'Submarine with no eye parts',
                  parts: [
                    { id: 'stern_prop', shape: 'cylinder', px: -4.2, py: 0, pz: 0, sx: 0.6, sy: 0.8, sz: 0.6, color: '#334155' },
                    { id: 'hull_core', shape: 'sphere', px: 0, py: 0, pz: 0, sx: 7.5, sy: 2.5, sz: 2.5, color: '#475569' },
                    { id: 'bow_dome', shape: 'sphere', px: 4.1, py: 0, pz: 0, sx: 0.9, sy: 0.9, sz: 0.9, color: '#38bdf8' },
                  ],
                },
              },
            ],
          }),
        ],
      });
      noEyePlan.scenes[0].elements[0].customModelSpec!.focusPartId = 'bad_part_name';

      const rtNoEye = new ThreeSceneRuntime(noEyePlan);
      const customObj = rtNoEye.scene.getObjectByName('custom_eyeless_sub')!;
      const resolvedHead = resolveCustomFocusPart(
        customObj,
        'bad_part_name',
        new THREE.Vector3(6, 3, 10)
      );
      assert.equal(resolvedHead.matchedAiFocusPart, false);
      assert.equal(resolvedHead.source, 'fallback-head-max-x');
      assert.equal(resolvedHead.partId, 'bow_dome', 'Without eye parts, must pick part with highest x (bow_dome)');

      const neStart = rtNoEye.inspectSceneAtTime(0);
      const neEnd = rtNoEye.inspectSceneAtTime(5.99);
      const bowMesh = rtNoEye.scene.getObjectByName('bow_dome')!;
      const bowBoxMeasured = new THREE.Box3().setFromObject(bowMesh);
      const bowCenter = bowBoxMeasured.getCenter(new THREE.Vector3());
      const bowDims = bowBoxMeasured.getSize(new THREE.Vector3());
      const bowSize = Math.max(bowDims.x, bowDims.y, bowDims.z);
      const bowErr = new THREE.Vector3(
        neEnd.cameraTarget.x,
        neEnd.cameraTarget.y,
        neEnd.cameraTarget.z
      ).distanceTo(bowCenter);
      assert.ok(bowErr < 0.05, `Highest-x fallback must look at bow_dome (err=${bowErr.toFixed(4)}m)`);

      const neStartDist = Math.hypot(
        neStart.cameraPosition.x - neStart.cameraTarget.x,
        neStart.cameraPosition.y - neStart.cameraTarget.y,
        neStart.cameraPosition.z - neStart.cameraTarget.z
      );
      const neEndDist = Math.hypot(
        neEnd.cameraPosition.x - neEnd.cameraTarget.x,
        neEnd.cameraPosition.y - neEnd.cameraTarget.y,
        neEnd.cameraPosition.z - neEnd.cameraTarget.z
      );
      assert.ok(
        Math.abs(neEndDist - bowSize * 1.5) < 0.08,
        `No-eye fallback end distance (${neEndDist.toFixed(3)}m) must be ~1.5x bow_dome size (${(bowSize * 1.5).toFixed(3)}m)`
      );
      assert.ok(
        neEndDist < neStartDist * 0.25,
        `No-eye highest-x fallback must dolly in cleanly (<25% of startDist): start=${neStartDist.toFixed(2)}m, end=${neEndDist.toFixed(2)}m`
      );

      // Direct unit check on frameCustomFocusEndCamera preserving viewing side
      const subBox = new THREE.Box3().setFromObject(customObj);
      const bowBox = new THREE.Box3().setFromObject(bowMesh);
      const endCheck = frameCustomFocusEndCamera(subBox, bowBox, new THREE.Vector3(6, 3, -10));
      assert.ok(endCheck.position.z < bowCenter.z, 'End camera must stay on the -z side when start camera was on -z');
      rtNoEye.dispose();
    }
  );

  // Scenario 25: Phase 1e underwater atmosphere (exponential fog, vertical sky gradient, swaying additive light shafts, moving caustics, vignette, marine snow) & seekTime determinism
  await runTest(
    'Scenario 25: Phase 1e underwater plan creates FogExp2, light shafts, vertical gradient, caustics & vignette, and seekTime(t) is strictly deterministic',
    () => {
      const norm = mustNormalize3D(DEV_WHALE_SCENE_PLAN as unknown as Record<string, unknown>);
      assert.equal(norm.scenes[0].lighting.volumetricRays, 0.7, 'Numeric volumetricRays 0.7 must survive normalization');

      const rt = new ThreeSceneRuntime(norm);
      rt.seekTime(2.5);

      // 1. Exponential fog from plan's blue-green fogColor & fogDensity
      assert.ok(rt.scene.fog instanceof THREE.FogExp2, 'Underwater scene must create THREE.FogExp2');
      const fog = rt.scene.fog as THREE.FogExp2;
      assert.ok(Math.abs(fog.density - 0.022) < 0.0005, `Expected fogDensity 0.022, got ${fog.density}`);
      assert.equal(fog.color.getHexString(), '063a4f', 'FogExp2 must use plan blue-green fogColor');

      // 2. Vertical background gradient from skyTop to skyBottom
      const skyDome = rt.scene.getObjectByName('sky_dome') as THREE.Mesh | undefined;
      assert.ok(skyDome && skyDome.material instanceof THREE.ShaderMaterial, 'sky_dome gradient shader mesh must exist');
      const skyMat = skyDome.material as THREE.ShaderMaterial;
      assert.equal((skyMat.uniforms.topColor.value as THREE.Color).getHexString(), '0c4a6e');
      assert.equal((skyMat.uniforms.bottomColor.value as THREE.Color).getHexString(), '020c1b');
      assert.equal(skyMat.depthTest, false, 'Background vertical gradient must render behind scene via clip-space quad');

      // 3. Translucent additive volumetric light shafts (3 to 5 cones from above) that sway with time
      const shaftGroup = rt.scene.getObjectByName('volumetric_light_shafts') as THREE.Group | undefined;
      assert.ok(shaftGroup, 'Underwater plan with volumetricRays must create volumetric_light_shafts group');
      const shaftMeshes = shaftGroup.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh);
      assert.ok(
        shaftMeshes.length >= 3 && shaftMeshes.length <= 5,
        `Expected 3..5 volumetric light shaft meshes, got ${shaftMeshes.length}`
      );
      for (const shaft of shaftMeshes) {
        const mat = shaft.material as THREE.MeshBasicMaterial;
        assert.equal(mat.transparent, true, 'Light shaft material must be transparent');
        assert.equal(mat.blending, THREE.AdditiveBlending, 'Light shaft material must use AdditiveBlending');
        assert.equal(mat.depthWrite, false, 'Light shaft material must disable depthWrite');
        assert.ok(mat.opacity > 0.02 && mat.opacity < 0.5, `Light shaft opacity should be subtle translucent, got ${mat.opacity}`);
      }

      // 4. Shadowless moving caustic lights
      const caustic1 = rt.scene.getObjectByName('caustic_light_1') as THREE.PointLight | undefined;
      const caustic2 = rt.scene.getObjectByName('caustic_light_2') as THREE.PointLight | undefined;
      assert.ok(caustic1 && caustic2, 'Underwater scene must create caustic_light_1 and caustic_light_2');
      assert.equal(caustic1.castShadow, false, 'Caustic lights must stay shadowless for Software GL');
      assert.equal(caustic2.castShadow, false, 'Caustic lights must stay shadowless for Software GL');

      // 5. Vignette overlay & existing round marine-snow particles
      const vignetteMesh = rt.scene.getObjectByName('vignette_overlay') as THREE.Mesh | undefined;
      assert.ok(vignetteMesh, 'Non-zero lighting.vignette must create vignette_overlay quad');
      const marineSnow = rt.scene.getObjectByName('weather_snow') as THREE.Points | undefined;
      assert.ok(marineSnow, 'Marine snow weather particles must remain active');
      assert.ok((marineSnow.material as THREE.PointsMaterial).map, 'Marine snow must retain round radial sprite texture');

      // 6. Verify shafts sway and caustics move over time
      const shaftRotAt2_5 = shaftMeshes[0].rotation.z;
      const causticPosAt2_5 = caustic1.position.clone();
      rt.seekTime(5.2);
      assert.notEqual(shaftMeshes[0].rotation.z, shaftRotAt2_5, 'Light shafts must sway over time');
      assert.ok(
        caustic1.position.distanceTo(causticPosAt2_5) > 0.05,
        'Caustic light must drift deterministically over time'
      );

      // 7. Strict determinism: calling seekTime(t) twice (with an intervening jump) produces identical camera & object transforms
      const captureDeterministicState = (t: number) => {
        rt.seekTime(t);
        const snap = rt.inspectSceneAtTime(t);
        const whale = rt.scene.getObjectByName('custom_dev_blue_whale')!;
        const fluke = rt.scene.getObjectByName('whale_tail_fluke_left')!;
        return {
          camPos: { x: rt.camera.position.x, y: rt.camera.position.y, z: rt.camera.position.z },
          camQuat: {
            x: rt.camera.quaternion.x,
            y: rt.camera.quaternion.y,
            z: rt.camera.quaternion.z,
            w: rt.camera.quaternion.w,
          },
          camTarget: snap.cameraTarget,
          whalePos: { x: whale.position.x, y: whale.position.y, z: whale.position.z },
          whaleRot: { x: whale.rotation.x, y: whale.rotation.y, z: whale.rotation.z },
          flukeRot: { x: fluke.rotation.x, y: fluke.rotation.y, z: fluke.rotation.z },
          shafts: shaftMeshes.map((s) => ({
            rz: s.rotation.z,
            rx: s.rotation.x,
            op: (s.material as THREE.MeshBasicMaterial).opacity,
          })),
          caustics: [caustic1, caustic2].map((l) => ({
            x: l.position.x,
            y: l.position.y,
            z: l.position.z,
            intensity: l.intensity,
          })),
        };
      };

      const pass1 = captureDeterministicState(4.35);
      rt.seekTime(0.75); // seek elsewhere first to prove no stateful accumulation/drift
      const pass2 = captureDeterministicState(4.35);
      assert.deepEqual(pass2, pass1, 'Calling seekTime(t) twice must yield identical camera, object, light-shaft & caustic transforms');

      // 8. Verify volumetricRays: 0 suppresses light shafts cleanly
      const noRaysPlan = mustNormalize3D({
        ...DEV_WHALE_SCENE_PLAN,
        scenes: [
          {
            ...DEV_WHALE_SCENE_PLAN.scenes[0],
            lighting: { ...DEV_WHALE_SCENE_PLAN.scenes[0].lighting, volumetricRays: 0, vignette: 0 },
          },
        ],
      } as unknown as Record<string, unknown>);
      const rtNoRays = new ThreeSceneRuntime(noRaysPlan);
      assert.equal(rtNoRays.scene.getObjectByName('volumetric_light_shafts'), undefined, 'volumetricRays=0 must not create light shafts');
      assert.equal(rtNoRays.scene.getObjectByName('vignette_overlay'), undefined, 'vignette=0 must not create vignette overlay');
      rtNoRays.dispose();
      rt.dispose();
    }
  );

  console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
