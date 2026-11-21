import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import * as THREE from 'three';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import {
  AnimationScenePlan,
  is3DScenePlan,
  normalizeScenePlan,
  resolveSceneVisualStyle,
} from '../src/shared/sceneSchema';
import { validateUploadBytes } from '../src/shared/uploadValidation';
import { ThreeSceneRuntime } from '../src/engine/three/ThreeSceneRuntime';
import { evaluatePhysicsState } from '../src/engine/three/physics';
import {
  getRegisteredStyleNames,
  registerStyleAdapter,
} from '../src/engine/three/styleRegistry';
import {
  getRegisteredObjectKinds,
  registerObjectBuilder,
  unregisterObjectBuilder,
} from '../src/engine/three/objectRegistry';
import { parseGlbArrayBuffer } from '../src/engine/three/assetLoader';
import { renderScenePlanFrame } from '../src/engine/safeRenderer';

process.env.VYROXX_DISABLE_AUTOSTART = 'true';

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL: ${name} ->`, err instanceof Error ? err.stack || err.message : err);
  }
}

function makeBaseSegment(overrides: Record<string, unknown>) {
  return {
    id: 'scene_1',
    title: 'Multi-Style Scene',
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

function mustNormalize(raw: Record<string, unknown>): AnimationScenePlan {
  const res = normalizeScenePlan(raw);
  if (!res.ok) {
    assert.fail(res.error);
  }
  return res.data;
}

/**
 * Builds a spec-compliant glTF 2.0 binary (.glb) containing a single triangle mesh
 * of height 2.0m spanning y=[0..2], x=[0..1], z=[0..0].
 */
function buildMinimalGlbTriangle(): Uint8Array {
  // 3 vertices * 3 floats * 4 bytes = 36 bytes
  const binBuf = new ArrayBuffer(36);
  const f32 = new Float32Array(binBuf);
  f32.set([
    0.0, 0.0, 0.0,
    1.0, 0.0, 0.0,
    0.5, 2.0, 0.0,
  ]);
  const binBytes = new Uint8Array(binBuf);

  const gltfJson = {
    asset: { version: '2.0', generator: 'vyroxx-test-builder' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'TestTriangleNode' }],
    meshes: [
      {
        name: 'TestTriangleMesh',
        primitives: [
          {
            attributes: { POSITION: 0 },
            mode: 4,
          },
        ],
      },
    ],
    buffers: [{ byteLength: binBytes.length }],
    bufferViews: [
      {
        buffer: 0,
        byteOffset: 0,
        byteLength: binBytes.length,
        target: 34962,
      },
    ],
    accessors: [
      {
        bufferView: 0,
        byteOffset: 0,
        componentType: 5126, // FLOAT
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [1, 2, 0],
      },
    ],
  };

  const jsonRaw = Buffer.from(JSON.stringify(gltfJson), 'utf8');
  const jsonPadLen = (4 - (jsonRaw.length % 4)) % 4;
  const jsonChunkBytes = Buffer.concat([
    jsonRaw,
    Buffer.alloc(jsonPadLen, 0x20),
  ]);

  const totalLen = 12 + 8 + jsonChunkBytes.length + 8 + binBytes.length;
  const out = Buffer.alloc(totalLen);
  let offset = 0;

  // Header
  out.write('glTF', offset, 4, 'ascii');
  offset += 4;
  out.writeUInt32LE(2, offset); // version 2
  offset += 4;
  out.writeUInt32LE(totalLen, offset);
  offset += 4;

  // JSON chunk
  out.writeUInt32LE(jsonChunkBytes.length, offset);
  offset += 4;
  out.writeUInt32LE(0x4e4f534a, offset); // "JSON"
  offset += 4;
  jsonChunkBytes.copy(out, offset);
  offset += jsonChunkBytes.length;

  // BIN chunk
  out.writeUInt32LE(binBytes.length, offset);
  offset += 4;
  out.writeUInt32LE(0x004e4942, offset); // "BIN\0"
  offset += 4;
  Buffer.from(binBytes).copy(out, offset);

  return new Uint8Array(out);
}

/**
 * Lightweight mock CanvasRenderingContext2D recording draw commands to verify 2D multi-style passes.
 */
function createMockCanvas2DContext() {
  const calls: string[] = [];
  const noop = () => {};
  const grad = { addColorStop: noop };
  const ctx = {
    canvas: { width: 1280, height: 720 },
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    font: '16px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    shadowColor: 'transparent',
    shadowBlur: 0,
    imageSmoothingEnabled: true,
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    translate: () => calls.push('translate'),
    rotate: () => calls.push('rotate'),
    scale: () => calls.push('scale'),
    beginPath: () => calls.push('beginPath'),
    closePath: () => calls.push('closePath'),
    moveTo: () => calls.push('moveTo'),
    lineTo: () => calls.push('lineTo'),
    quadraticCurveTo: () => calls.push('quadraticCurveTo'),
    bezierCurveTo: () => calls.push('bezierCurveTo'),
    arc: () => calls.push('arc'),
    ellipse: () => calls.push('ellipse'),
    rect: () => calls.push('rect'),
    roundRect: () => calls.push('roundRect'),
    clip: () => calls.push('clip'),
    setLineDash: noop,
    fill: () => calls.push('fill'),
    stroke: () => calls.push(`stroke:w=${ctx.lineWidth}:${String(ctx.strokeStyle)}`),
    fillRect: () => calls.push('fillRect'),
    strokeRect: () => calls.push('strokeRect'),
    clearRect: () => calls.push('clearRect'),
    fillText: (t: string) => calls.push(`fillText:${t}`),
    strokeText: (t: string) => calls.push(`strokeText:${t}`),
    measureText: (t: string) => ({ width: t.length * 8 }),
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    drawImage: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

async function main() {
  console.log('=== VYROXX Extensible Multi-Style Animation Platform Test Suite ===\n');

  // 1. Dynamic Renderer Routing across Styles (2D vs 3D)
  await runTest(
    'Multi-Style Routing: vector-motion/cartoon-2d/pixel-retro -> 2D; anime-cel/low-poly/realistic-pbr/hologram-shader -> 3D',
    () => {
      const twoDStyles = ['vector-motion', 'cartoon-2d', 'pixel-retro', 'abstract-generative'] as const;
      for (const style of twoDStyles) {
        const plan = mustNormalize({
          planVersion: 1,
          visualStyle: style,
          title: `${style} Scene`,
          summary: '2D style test',
          scenes: [
            makeBaseSegment({
              visualStyle: style,
              elements: [
                {
                  id: 'el_chart',
                  kind: style === 'vector-motion' ? 'chart' : 'character',
                  label: 'Subject',
                  x: 0.5,
                  y: 0.65,
                  scale: 1,
                  colorPrimary: '#22d3ee',
                  colorSecondary: '#0f172a',
                  accentColor: '#f59e0b',
                  variant: 'running',
                  count: 1,
                  depth: 0.7,
                  motion: { type: 'static', speed: 1, amplitude: 0.1, direction: 1 },
                },
              ],
            }),
          ],
        });
        assert.equal(plan.renderMode, '2d', `${style} must route to 2d renderMode`);
        assert.equal(is3DScenePlan(plan), false, `${style} must not force 3D runtime`);
        assert.equal(resolveSceneVisualStyle(plan, plan.scenes[0]), style);
      }

      const threeDStyles = ['realistic-pbr', 'anime-cel', 'low-poly', 'stylized-3d', 'hologram-shader'] as const;
      for (const style of threeDStyles) {
        const plan = mustNormalize({
          planVersion: 1,
          visualStyle: style,
          title: `${style} Scene`,
          summary: '3D style test',
          scenes: [
            makeBaseSegment({
              visualStyle: style,
              elements: [
                {
                  id: 'el_hero',
                  kind: 'character',
                  label: 'Hero',
                  x: 0.5,
                  y: 0.7,
                  scale: 1,
                  colorPrimary: '#ef4444',
                  colorSecondary: '#1e293b',
                  accentColor: '#22d3ee',
                  variant: 'running',
                  count: 1,
                  depth: 0.8,
                  pos3d: { x: 0, y: 0, z: 0 },
                  motion: { type: 'static', speed: 1, amplitude: 0.1, direction: 1 },
                },
              ],
            }),
          ],
        });
        assert.equal(plan.renderMode, '3d', `${style} must route to 3d renderMode`);
        assert.equal(is3DScenePlan(plan), true, `${style} must route to Three.js engine`);
        assert.equal(resolveSceneVisualStyle(plan, plan.scenes[0]), style);
      }
    }
  );

  // 2. Anime Cel-Shading (MeshToonMaterial + Inverted-Hull Outlines) vs Low-Poly FlatShading vs PBR
  await runTest(
    '3D Style Adapters: anime-cel builds MeshToonMaterial + outlines, low-poly enables flatShading, realistic-pbr keeps Standard/Physical',
    () => {
      const buildCharacterInStyle = (visualStyle: string) => {
        const plan = mustNormalize({
          planVersion: 1,
          renderMode: '3d',
          visualStyle,
          title: `Style ${visualStyle}`,
          summary: 'Material inspection',
          scenes: [
            makeBaseSegment({
              visualStyle,
              elements: [
                {
                  id: 'hero_rig',
                  kind: 'character',
                  label: 'Hero',
                  x: 0.5,
                  y: 0.7,
                  scale: 1,
                  colorPrimary: '#dc2626',
                  colorSecondary: '#1e293b',
                  accentColor: '#22d3ee',
                  variant: 'idle',
                  count: 1,
                  depth: 0.8,
                  pos3d: { x: 0, y: 0, z: 0 },
                  motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
                },
              ],
            }),
          ],
        });
        const runtime = new ThreeSceneRuntime(plan, 1280, 720);
        const snap = runtime.inspectSceneAtTime(0.5);
        runtime.dispose();
        return snap;
      };

      const animeSnap = buildCharacterInStyle('anime-cel');
      const animeEl = animeSnap.elements[0];
      assert.equal(animeSnap.visualStyle, 'anime-cel');
      assert.ok(animeEl.materialTypes.includes('MeshToonMaterial'), 'anime-cel must convert meshes to MeshToonMaterial');
      assert.ok(animeEl.outlineMeshCount > 0, 'anime-cel must attach inverted-hull outline meshes');

      const lowPolySnap = buildCharacterInStyle('low-poly');
      const lowPolyEl = lowPolySnap.elements[0];
      assert.equal(lowPolySnap.visualStyle, 'low-poly');
      assert.equal(lowPolyEl.hasFlatShading, true, 'low-poly must enable flatShading');

      const pbrSnap = buildCharacterInStyle('realistic-pbr');
      const pbrEl = pbrSnap.elements[0];
      assert.equal(pbrSnap.visualStyle, 'realistic-pbr');
      assert.equal(pbrEl.outlineMeshCount, 0, 'realistic-pbr must not attach cel outlines');
      assert.ok(
        pbrEl.materialTypes.includes('MeshStandardMaterial') ||
          pbrEl.materialTypes.includes('MeshPhysicalMaterial'),
        'realistic-pbr must preserve PBR materials'
      );
    }
  );

  // 3. Custom GLSL Shaders (hologram-shader / shader-fx) + Live uTime Uniform Progression
  await runTest(
    'Custom GLSL ShaderMaterial: fresnel-hologram / energy-plasma / water-waves build ShaderMaterial & advance uTime',
    () => {
      const plan = mustNormalize({
        planVersion: 1,
        renderMode: '3d',
        visualStyle: 'hologram-shader',
        title: 'Shader Lab',
        summary: 'GLSL shader showcase',
        scenes: [
          makeBaseSegment({
            visualStyle: 'hologram-shader',
            elements: [
              {
                id: 'holo_core',
                kind: 'shader-fx',
                label: 'Hologram Core',
                x: 0.5,
                y: 0.5,
                scale: 1,
                colorPrimary: '#22d3ee',
                colorSecondary: '#6366f1',
                accentColor: '#38bdf8',
                variant: 'glowing',
                count: 1,
                depth: 0.7,
                pos3d: { x: 0, y: 2, z: 0 },
                size3d: { w: 2.5, h: 2.5, d: 2.5 },
                proceduralGeometry: 'torus-knot',
                shaderSpec: {
                  preset: 'fresnel-hologram',
                  primaryColor: '#22d3ee',
                  secondaryColor: '#6366f1',
                  speed: 1.5,
                  intensity: 1.4,
                },
                motion: { type: 'static', speed: 1, amplitude: 0, direction: 1 },
              },
              {
                id: 'wave_mesh',
                kind: 'procedural-mesh',
                label: 'Plasma Ocean',
                x: 0.5,
                y: 0.8,
                scale: 1,
                colorPrimary: '#0ea5e9',
                colorSecondary: '#020617',
                accentColor: '#38bdf8',
                variant: 'glowing',
                count: 1,
                depth: 0.5,
                pos3d: { x: 0, y: 0.2, z: 0 },
                size3d: { w: 12, h: 1, d: 12 },
                proceduralGeometry: 'wave-plane',
                shaderSpec: {
                  preset: 'water-waves',
                  primaryColor: '#0ea5e9',
                  secondaryColor: '#e0f2fe',
                  speed: 2.0,
                  intensity: 1.2,
                },
                motion: { type: 'static', speed: 1, amplitude: 0, direction: 1 },
              },
            ],
          }),
        ],
      });

      const runtime = new ThreeSceneRuntime(plan, 1280, 720);
      const snapEarly = runtime.inspectSceneAtTime(0.5);
      const snapLate = runtime.inspectSceneAtTime(2.5);

      const holoEarly = snapEarly.elements.find((e) => e.id === 'holo_core')!;
      const holoLate = snapLate.elements.find((e) => e.id === 'holo_core')!;
      const waveLate = snapLate.elements.find((e) => e.id === 'wave_mesh')!;

      assert.equal(holoEarly.hasShaderMaterial, true);
      assert.equal(waveLate.hasShaderMaterial, true);
      assert.ok(holoEarly.shaderTimeUniform !== null);
      assert.ok(holoLate.shaderTimeUniform !== null);
      assert.ok(
        holoLate.shaderTimeUniform! > holoEarly.shaderTimeUniform!,
        'ShaderMaterial uTime uniform must advance strictly over playback time'
      );

      runtime.dispose();
    }
  );

  // 4. Deterministic Physics Solver (Bounce + Squash/Stretch + Damped Spring)
  await runTest(
    'Deterministic Physics Solver: bounce obeys gravity & restitution damping; spring oscillates & decays; integrates in ThreeSceneRuntime',
    () => {
      const bounceSpec = {
        mode: 'bounce' as const,
        gravity: -16,
        restitution: 0.72,
        groundY: 0,
        squashStretch: true,
      };
      const basePos = { x: 0, y: 5, z: 0 };

      const s0 = evaluatePhysicsState(bounceSpec, basePos, 0);
      assert.equal(s0.y, 5);

      // Sample trajectory from t=0 to t=3s
      const ys: number[] = [];
      let minScaleY = 1;
      for (let t = 0; t <= 3.0; t += 0.02) {
        const state = evaluatePhysicsState(bounceSpec, basePos, t);
        ys.push(state.y);
        assert.ok(state.y >= -0.001, 'Bounce must never penetrate below groundY');
        if (state.scaleY < minScaleY) {
          minScaleY = state.scaleY;
        }
      }
      assert.ok(minScaleY < 0.99, 'Squash-and-stretch must compress Y scale on impact');
      const latePeak = Math.max(...ys.slice(Math.floor(ys.length * 0.6)));
      assert.ok(latePeak < 5, 'Restitution < 1 must cause subsequent bounce peaks to decay below 5m');

      const springSpec = {
        mode: 'spring' as const,
        springK: 18,
        damping: 0.9,
        amplitude: 3,
      };
      const earlyDisp = Math.abs(evaluatePhysicsState(springSpec, { x: 0, y: 0, z: 0 }, 0.05).y);
      const lateDisp = Math.abs(evaluatePhysicsState(springSpec, { x: 0, y: 0, z: 0 }, 5.0).y);
      assert.ok(lateDisp < earlyDisp, 'Damped spring must decay toward equilibrium');

      // Verify ThreeSceneRuntime moves element via physicsSpec
      const plan = mustNormalize({
        planVersion: 1,
        renderMode: '3d',
        title: 'Physics Bounce',
        summary: 'Bouncing ball physics',
        scenes: [
          makeBaseSegment({
            elements: [
              {
                id: 'bouncy_orb',
                kind: 'procedural-mesh',
                label: 'Bouncy Orb',
                x: 0.5,
                y: 0.5,
                scale: 1,
                colorPrimary: '#f97316',
                colorSecondary: '#0f172a',
                accentColor: '#fde047',
                variant: 'idle',
                count: 1,
                depth: 0.7,
                pos3d: { x: 0, y: 4.5, z: 0 },
                size3d: { w: 1, h: 1, d: 1 },
                proceduralGeometry: 'sphere',
                physicsSpec: bounceSpec,
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
              },
            ],
          }),
        ],
      });

      const runtime = new ThreeSceneRuntime(plan, 1280, 720);
      const pStart = runtime.inspectSceneAtTime(0).elements[0].worldPosition.y;
      const pMid = runtime.inspectSceneAtTime(0.45).elements[0].worldPosition.y;
      assert.ok(pMid < pStart, 'Physics-driven 3D element must fall under gravity');
      runtime.dispose();
    }
  );

  // 5. Real Binary .glb Validation + Three.js GLTFLoader.parse Normalization
  await runTest(
    'Real glTF 2.0 (.glb) Binary Upload Validation & Three.js GLTFLoader Parsing + Normalization',
    async () => {
      const glbBytes = buildMinimalGlbTriangle();

      // Magic-byte validator accepts valid .glb and rejects spoofed payload
      assert.equal(validateUploadBytes('mecha.glb', 'model/gltf-binary', glbBytes).ok, true);
      assert.equal(
        validateUploadBytes('mecha.glb', 'application/octet-stream', glbBytes).ok,
        true
      );
      assert.equal(
        validateUploadBytes(
          'fake.glb',
          'model/gltf-binary',
          new TextEncoder().encode('<html>not a glb</html>')
        ).ok,
        false
      );

      // Parse directly via Three.js GLTFLoader
      const ab = new Uint8Array(glbBytes).buffer;
      const parsed = await parseGlbArrayBuffer(ab, { normalizeHeight: 3.0 });
      assert.equal(parsed.meshCount, 1, 'GLB loader must parse 1 triangle mesh');

      const box = new THREE.Box3().setFromObject(parsed.group);
      const size = new THREE.Vector3();
      box.getSize(size);
      assert.ok(Math.abs(size.y - 3.0) < 0.01, `Expected normalized height 3.0, got ${size.y}`);
      assert.ok(Math.abs(box.min.y) < 0.01, `Expected grounded min.y ≈ 0, got ${box.min.y}`);

      // Also verify inlineDataUri inside ThreeSceneRuntime hydrates asynchronously
      const b64 = Buffer.from(glbBytes).toString('base64');
      const plan = mustNormalize({
        planVersion: 1,
        renderMode: '3d',
        visualStyle: 'stylized-3d',
        title: 'GLB Runtime Scene',
        summary: 'External GLB loaded into ThreeSceneRuntime',
        scenes: [
          makeBaseSegment({
            elements: [
              {
                id: 'ext_glb',
                kind: 'external-asset',
                label: 'Custom GLB',
                x: 0.5,
                y: 0.5,
                scale: 1,
                colorPrimary: '#38bdf8',
                colorSecondary: '#0f172a',
                accentColor: '#f59e0b',
                variant: 'idle',
                count: 1,
                depth: 0.8,
                pos3d: { x: 0, y: 0, z: 0 },
                assetRef: {
                  format: 'glb',
                  inlineDataUri: `data:model/gltf-binary;base64,${b64}`,
                  normalizeHeight: 4.0,
                },
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
              },
            ],
          }),
        ],
      });

      const runtime = new ThreeSceneRuntime(plan, 1280, 720);
      runtime.seekTime(0.2);
      // Give GLTFLoader microtask/promise a tick to resolve hydration
      await new Promise((r) => setTimeout(r, 40));
      const snap = runtime.inspectSceneAtTime(0.2);
      const extEl = snap.elements.find((e) => e.id === 'ext_glb')!;
      assert.ok(extEl.meshCount >= 1, 'Hydrated GLB mesh must exist in runtime scene');
      assert.ok(
        Math.abs(extEl.boundingBoxMax.y - 4.0) < 0.05,
        `Runtime hydrated GLB height must normalize to 4.0, got ${extEl.boundingBoxMax.y}`
      );
      runtime.dispose();
    }
  );

  // 6. Extensible Plugin Registries (Custom Object Builder & Custom Style Adapter)
  await runTest(
    'Extensible Registry APIs: custom object builder and custom style adapter integrate cleanly into ThreeSceneRuntime',
    () => {
      assert.ok(getRegisteredObjectKinds().includes('character'));
      assert.ok(getRegisteredObjectKinds().includes('procedural-mesh'));
      assert.ok(getRegisteredObjectKinds().includes('shader-fx'));
      assert.ok(getRegisteredObjectKinds().includes('external-asset'));
      assert.ok(getRegisteredStyleNames().includes('anime-cel'));
      assert.ok(getRegisteredStyleNames().includes('low-poly'));

      let customAdapterCalled = false;
      registerStyleAdapter('custom-wireframe-accent' as unknown as import('../src/shared/sceneSchema').VisualStyle, (root) => {
        customAdapterCalled = root.children.length >= 0;
      });
      // Immediately register a custom object kind without touching ThreeSceneRuntime internals
      registerObjectBuilder('custom-mecha-turret', (el) => {
        const g = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.CylinderGeometry(0.8, 1.0, 2.2, 12),
          new THREE.MeshStandardMaterial({ color: el.colorPrimary })
        );
        body.position.y = 1.1;
        g.add(body);
        return g;
      });

      const plan = mustNormalize({
        planVersion: 1,
        renderMode: '3d',
        visualStyle: 'realistic-pbr',
        title: 'Plugin Test',
        summary: 'Custom registry element',
        scenes: [
          makeBaseSegment({
            elements: [
              {
                id: 'turret_1',
                kind: 'prop', // normalized kind; now test calling custom builder directly or checking registration
                label: 'Turret',
                x: 0.5,
                y: 0.7,
                scale: 1,
                colorPrimary: '#38bdf8',
                colorSecondary: '#0f172a',
                accentColor: '#22d3ee',
                variant: 'idle',
                count: 1,
                depth: 0.8,
                pos3d: { x: 2, y: 0, z: 0 },
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
              },
            ],
          }),
        ],
      });

      // Inject custom kind and style post-normalization to simulate plugin extension
      (plan.scenes[0].elements[0] as unknown as { kind: string }).kind = 'custom-mecha-turret';
      (plan as unknown as { visualStyle: string }).visualStyle = 'custom-wireframe-accent';
      const runtime = new ThreeSceneRuntime(plan, 1280, 720);
      const snap = runtime.inspectSceneAtTime(0.1);
      assert.equal(snap.elements[0].meshCount, 1, 'Custom registered builder mesh must render inside ThreeSceneRuntime');
      assert.equal(customAdapterCalled, true, 'Custom registered style adapter must execute during build');
      runtime.dispose();

      unregisterObjectBuilder('custom-mecha-turret');
      assert.equal(getRegisteredObjectKinds().includes('custom-mecha-turret'), false);
    }
  );

  // 7. 2D Multi-Style Canvas Renderer Verification (cartoon-2d & abstract-generative & procedural-mesh/shader-fx)
  await runTest(
    '2D Multi-Style Engine: cartoon-2d ink strokes, abstract-generative wave field, and 2D physics execute without errors',
    () => {
      const cartoonPlan = mustNormalize({
        planVersion: 1,
        renderMode: '2d',
        visualStyle: 'cartoon-2d',
        title: 'Cartoon Dash',
        summary: '2D cartoon test',
        scenes: [
          makeBaseSegment({
            visualStyle: 'cartoon-2d',
            elements: [
              {
                id: 'c1',
                kind: 'character',
                label: 'Cartoon Hero',
                x: 0.5,
                y: 0.72,
                scale: 1,
                colorPrimary: '#f43f5e',
                colorSecondary: '#1e293b',
                accentColor: '#fde047',
                variant: 'running',
                count: 1,
                depth: 0.8,
                physicsSpec: {
                  mode: 'bounce',
                  gravity: -14,
                  restitution: 0.7,
                  groundY: 0,
                  squashStretch: true,
                },
                motion: { type: 'static', speed: 1, amplitude: 0.1, direction: 1 },
              },
            ],
          }),
        ],
      });

      const mockCartoon = createMockCanvas2DContext();
      renderScenePlanFrame(mockCartoon.ctx, cartoonPlan, 1280, 720, 0.8);
      assert.ok(mockCartoon.calls.length > 15, 'Cartoon 2D render must emit drawing operations');

      const abstractPlan = mustNormalize({
        planVersion: 1,
        renderMode: '2d',
        visualStyle: 'abstract-generative',
        title: 'Harmonic Waves',
        summary: 'Generative 2D shader/mesh',
        scenes: [
          makeBaseSegment({
            visualStyle: 'abstract-generative',
            elements: [
              {
                id: 'abs_1',
                kind: 'shader-fx',
                label: 'Plasma',
                x: 0.5,
                y: 0.5,
                scale: 1,
                colorPrimary: '#22d3ee',
                colorSecondary: '#0f172a',
                accentColor: '#a855f7',
                variant: 'glowing',
                count: 1,
                depth: 0.6,
                proceduralGeometry: 'torus-knot',
                shaderSpec: { preset: 'energy-plasma' },
                motion: { type: 'pulse', speed: 1, amplitude: 0.2, direction: 1 },
              },
            ],
          }),
        ],
      });

      const mockAbstract = createMockCanvas2DContext();
      renderScenePlanFrame(mockAbstract.ctx, abstractPlan, 1280, 720, 1.2);
      assert.ok(
        mockAbstract.calls.some((c) => c.startsWith('stroke:')),
        'Abstract generative render must emit vector wave/mesh strokes'
      );
    }
  );

  // 8. Server /api/assets/upload End-to-End Test for Valid & Invalid .glb / .gltf
  await runTest(
    'Express /api/assets/upload: accepts valid .glb & .gltf and rejects spoofed .glb payloads',
    async () => {
      const { createVyroxxApiApp } = await import('../server');
      const { publicKey, privateKey } = await generateKeyPair('RS256');
      const publicJwk = await exportJWK(publicKey);
      publicJwk.kid = 'glb-test-key';
      publicJwk.alg = 'RS256';
      publicJwk.use = 'sig';

      const jwks = createLocalJWKSet({ keys: [publicJwk] });
      const testStorageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vyroxx-glb-'));
      const testProjectId = 'vyroxx-glb-proj';

      const token = await new SignJWT({ email: 'creator@example.com', email_verified: true })
        .setProtectedHeader({ alg: 'RS256', kid: 'glb-test-key' })
        .setSubject('user_glb_01')
        .setIssuer(`https://securetoken.google.com/${testProjectId}`)
        .setAudience(testProjectId)
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
        .sign(privateKey);

      const { app } = createVyroxxApiApp({
        storageRoot: testStorageRoot,
        projectId: testProjectId,
        jwks,
        isProd: false,
      });

      const server = app.listen(0, '127.0.0.1');
      try {
        await new Promise<void>((resolve) => server.once('listening', () => resolve()));
        const port = (server.address() as AddressInfo).port;
        const base = `http://127.0.0.1:${port}`;

        const validGlb = buildMinimalGlbTriangle();
        const upGlb = await fetch(`${base}/api/assets/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fileName: 'character.glb',
            mimeType: 'application/octet-stream',
            base64Data: Buffer.from(validGlb).toString('base64'),
          }),
        });
        assert.equal(upGlb.status, 200, 'Valid .glb with application/octet-stream must upload');

        const validGltf = JSON.stringify({
          asset: { version: '2.0' },
          scenes: [{ nodes: [] }],
        });
        const upGltf = await fetch(`${base}/api/assets/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fileName: 'prop.gltf',
            mimeType: 'model/gltf+json',
            base64Data: Buffer.from(validGltf, 'utf8').toString('base64'),
          }),
        });
        assert.equal(upGltf.status, 200, 'Valid .gltf must upload');

        const spoofedGlb = await fetch(`${base}/api/assets/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fileName: 'malware.glb',
            mimeType: 'application/octet-stream',
            base64Data: Buffer.from('MZ\x90\x00ThisIsAnExeNotAGlb').toString('base64'),
          }),
        });
        assert.equal(spoofedGlb.status, 400, 'Spoofed .glb without glTF v2 header must return 400');
      } finally {
        server.close();
        fs.rmSync(testStorageRoot, { recursive: true, force: true });
      }
    }
  );

  console.log(`\nMulti-Style Platform Test Summary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
