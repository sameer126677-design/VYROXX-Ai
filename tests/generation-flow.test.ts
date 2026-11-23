import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import {
  createDefaultVisualContinuity,
  EMPTY_VISUAL_CONTINUITY,
  mergeVisualContinuity,
  normalizeHexColor,
  normalizeScenePlan,
  normalizeVisualContinuity,
  validateScenePlan,
} from '../src/shared/sceneSchema';

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
    console.error(`FAIL: ${name} ->`, err instanceof Error ? err.message : err);
  }
}

function buildValidApocalypsePlan(overrides: Record<string, unknown> = {}) {
  return {
    planVersion: 1,
    title: 'Ruined City Evacuation',
    summary: 'A lone survivor sprints through crumbling skyscrapers as undead pursuers close in under ash clouds.',
    width: 1280,
    height: 720,
    fps: 30,
    totalDurationSec: 8,
    scenes: [
      {
        id: 'scene_1',
        title: 'Ashen Boulevard Sprint',
        durationSec: 8,
        transition: 'fade',
        background: {
          mode: 'scene',
          solidColor: '#090d16',
          skyTop: '#1c1917',
          skyBottom: '#451a03',
          horizonColor: '#9a3412',
          groundColor: '#18181b',
          groundElevation: 0.72,
        },
        camera: {
          motion: 'follow-subject',
          intensity: 0.5,
        },
        lighting: {
          mood: 'eerie-ash',
          ambientAlpha: 0.3,
          bloomColor: '#f97316',
          volumetricRays: true,
          vignette: 0.45,
        },
        weather: {
          type: 'ash',
          density: 0.65,
          windX: -0.3,
        },
        elements: [
          {
            id: 'skyline_1',
            kind: 'skyline',
            label: 'Ruined City Skyline',
            x: 0.5,
            y: 0.48,
            scale: 1.1,
            colorPrimary: '#27272a',
            colorSecondary: '#18181b',
            accentColor: '#f97316',
            variant: 'ruined',
            count: 8,
            depth: 0.2,
            motion: { type: 'pan-parallax', speed: 0.4, amplitude: 0.08, direction: -1 },
          },
          {
            id: 'survivor_1',
            kind: 'character',
            label: 'Survivor',
            x: 0.62,
            y: 0.72,
            scale: 1,
            colorPrimary: '#38bdf8',
            colorSecondary: '#0f172a',
            accentColor: '#fde68a',
            variant: 'running',
            count: 1,
            depth: 0.85,
            motion: { type: 'chase', speed: 1.8, amplitude: 0.12, direction: 1 },
          },
          {
            id: 'zombies_1',
            kind: 'creature',
            label: 'Zombie Pack',
            x: 0.3,
            y: 0.72,
            scale: 0.95,
            colorPrimary: '#4d7c0f',
            colorSecondary: '#1a2e05',
            accentColor: '#ef4444',
            variant: 'chasing',
            count: 3,
            depth: 0.8,
            motion: { type: 'chase', speed: 1.7, amplitude: 0.1, direction: 1 },
          },
        ],
      },
    ],
    visualContinuity: {
      artStyle: 'Gritty Atmospheric 2D Vector',
      colorPalette: ['#1c1917', '#9a3412', '#38bdf8', '#4d7c0f'],
      environmentRules: 'Shattered concrete towers under ember-lit ash skies.',
      lightingStyle: 'Warm ember rim light against deep charcoal silhouettes',
      characterBible: [
        {
          name: 'Kael',
          role: 'Survivor',
          appearance: 'Blue tactical jacket, hood, agile running silhouette',
          primaryColor: '#38bdf8',
          secondaryColor: '#0f172a',
        },
      ],
      propReferences: ['Collapsed overpass', 'Abandoned streetlamps'],
    },
    ...overrides,
  };
}

async function main() {
  console.log('=== VYROXX AI Generation & Visual Continuity Verification ===\n');

  // 1. Project Initialization & Safe Continuity Defaults
  await runTest(
    'Project Initialization: Safe default & partial/legacy visualContinuity normalization',
    () => {
      const fresh1 = createDefaultVisualContinuity();
      const fresh2 = createDefaultVisualContinuity();
      fresh1.characterBible.push({
        name: 'Test',
        role: 'Lead',
        appearance: 'Jacket',
        primaryColor: '#38bdf8',
        secondaryColor: '#0f172a',
      });
      assert.equal(fresh2.characterBible.length, 0, 'Fresh default must not share mutable arrays');

      assert.deepEqual(normalizeVisualContinuity(undefined), EMPTY_VISUAL_CONTINUITY);
      assert.deepEqual(normalizeVisualContinuity(null), EMPTY_VISUAL_CONTINUITY);
      assert.deepEqual(normalizeVisualContinuity({}), EMPTY_VISUAL_CONTINUITY);

      const legacyPartial = normalizeVisualContinuity({
        artStyle: 'Retro Noir',
        colorPalette: ['#abc'], // 3-digit hex & only 1 color
      });
      assert.equal(legacyPartial.artStyle, 'Retro Noir');
      assert.equal(legacyPartial.colorPalette.length, 2);
      assert.equal(legacyPartial.colorPalette[0], '#aabbcc');
      assert.equal(normalizeHexColor('#38BDF8', '#000000'), '#38bdf8');
      assert.equal(normalizeHexColor('rgba(1,2,3,0.5)', '#112233'), '#112233');
    }
  );

  // 2. Scene Plan Normalization & Anti-Fabrication Guarantees
  await runTest(
    'Scene Validation: Normalize minor quirks while rejecting empty/malformed plans without fabricating scenes',
    () => {
      assert.equal(normalizeScenePlan(undefined).ok, false);
      assert.equal(normalizeScenePlan(null).ok, false);
      assert.equal(normalizeScenePlan({}).ok, false);
      assert.equal(normalizeScenePlan({ scenes: [] }).ok, false);
      assert.equal(normalizeScenePlan({ scenes: [{ id: 's1', elements: [] }] }).ok, false);

      // AI omitted visualContinuity & used 3-digit hex + uppercase enums + out-of-range x
      const quirkyPlan = buildValidApocalypsePlan();
      delete (quirkyPlan as Record<string, unknown>).visualContinuity;
      quirkyPlan.scenes[0].transition = 'FADE';
      quirkyPlan.scenes[0].elements[0].x = 4.2;
      quirkyPlan.scenes[0].elements[0].colorPrimary = '#abc';

      const fallbackContinuity = createDefaultVisualContinuity();
      fallbackContinuity.artStyle = 'Existing Project Style';
      const normalized = normalizeScenePlan(quirkyPlan, {
        width: 1920,
        height: 1080,
        fps: 60,
        fallbackContinuity,
      });

      assert.equal(normalized.ok, true);
      if (normalized.ok) {
        assert.equal(normalized.data.width, 1920);
        assert.equal(normalized.data.fps, 60);
        assert.equal(normalized.data.scenes[0].transition, 'fade');
        assert.equal(normalized.data.scenes[0].elements[0].x, 1.3);
        assert.equal(normalized.data.scenes[0].elements[0].colorPrimary, '#aabbcc');
        assert.equal(normalized.data.visualContinuity.artStyle, 'Existing Project Style');
        assert.equal(validateScenePlan(normalized.data).ok, true);
      }
    }
  );

  // 3. Visual Continuity Preservation Across Follow-Ups vs New Projects
  await runTest(
    'Visual Continuity: Preserve character bible on follow-up edits while isolating new projects',
    () => {
      const initialPlan = buildValidApocalypsePlan();
      const established = initialPlan.visualContinuity;

      // Follow-up AI omits characterBible because user just asked "Add heavy rain"
      const followUpPartial = {
        artStyle: 'Gritty Atmospheric 2D Vector',
        colorPalette: ['#020617', '#38bdf8', '#94a3b8'],
        environmentRules: 'Shattered concrete towers in pouring rain.',
        lightingStyle: 'Cool rain highlights with ember glow',
        characterBible: [],
        propReferences: ['Storm puddles'],
      };

      const merged = mergeVisualContinuity(established, followUpPartial);
      assert.equal(merged.characterBible.length, 1);
      assert.equal(merged.characterBible[0].name, 'Kael');
      assert.ok(merged.propReferences.includes('Collapsed overpass'));
      assert.ok(merged.propReferences.includes('Storm puddles'));

      // Brand-new Project 2 starts fresh without Project 1's characters
      const project2Continuity = mergeVisualContinuity(null, {
        artStyle: 'Neon Cyberpunk',
        colorPalette: ['#09090b', '#ec4899'],
        environmentRules: 'Rain-slick neon alleys.',
        lightingStyle: 'Magenta-cyan neon rim light',
        characterBible: [
          {
            name: 'Nova',
            role: 'Courier',
            appearance: 'Cybernetic visor and hover jacket',
            primaryColor: '#ec4899',
            secondaryColor: '#06b6d4',
          },
        ],
        propReferences: ['Hover bike'],
      });
      assert.equal(project2Continuity.characterBible.length, 1);
      assert.equal(project2Continuity.characterBible[0].name, 'Nova');
    }
  );

  // 4. Full Express /api/ai/plan-scene Integration Tests (CodeCraft CHAIN[0], Failover, Continuity, Missing Key)
  await runTest(
    'Express /api/ai/plan-scene: Uses CHAIN[0] (CodeCraft), fails over to CHAIN[1..2], preserves continuity, handles invalid/missing keys cleanly',
    async () => {
      const { AI_UNAVAILABLE_USER_MESSAGE, CHAIN, createVyroxxApiApp } = await import(
        '../server'
      );
      const { publicKey, privateKey } = await generateKeyPair('RS256');
      const publicJwk = await exportJWK(publicKey);
      publicJwk.kid = 'gen-test-1';
      publicJwk.alg = 'RS256';
      publicJwk.use = 'sig';

      const jwks = createLocalJWKSet({ keys: [publicJwk] });
      const testStorageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vyroxx-gen-'));
      const testProjectId = 'vyroxx-gen-proj';

      const token = await new SignJWT({
        email: 'creator@example.com',
        email_verified: true,
      })
        .setProtectedHeader({ alg: 'RS256', kid: 'gen-test-1' })
        .setSubject('creator_uid_1')
        .setIssuer(`https://securetoken.google.com/${testProjectId}`)
        .setAudience(testProjectId)
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
        .sign(privateKey);

      let mode:
        | 'valid_first'
        | 'transient_then_valid'
        | 'followup_missing_chars'
        | 'always_malformed' = 'valid_first';
      let callsMade = 0;
      const chainRequested: Array<{ url: string; model: string }> = [];

      const mockFetch: typeof fetch = async (input, init) => {
        callsMade++;
        const url = typeof input === 'string' ? input : input.toString();
        const parsedBody = JSON.parse(String(init?.body || '{}')) as { model?: string };
        chainRequested.push({ url, model: parsedBody.model || '' });

        if (mode === 'always_malformed') {
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: '{"assistantMessage":"broken","scenePlan":{"scenes":[]}}',
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (mode === 'transient_then_valid' && callsMade === 1) {
          return new Response(
            JSON.stringify({ error: { message: 'Service Unavailable' } }),
            { status: 503 }
          );
        }
        if (mode === 'followup_missing_chars') {
          const plan = buildValidApocalypsePlan();
          plan.scenes[0].weather = { type: 'rain', density: 0.8, windX: -0.2 };
          plan.visualContinuity.characterBible = []; // Simulate AI forgetting to echo characters
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      assistantMessage: 'Added heavy rain while preserving Kael.',
                      scenePlan: plan,
                    }),
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    assistantMessage: 'Created your apocalypse chase scene.',
                    scenePlan: buildValidApocalypsePlan(),
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const { app } = createVyroxxApiApp({
        storageRoot: testStorageRoot,
        projectId: testProjectId,
        jwks,
        allowedOrigins: new Set(['http://127.0.0.1:3000']),
        isProd: false,
        fetchFn: mockFetch,
        codecraftApiKey: 'cc-gen-test-key',
      });

      const server = app.listen(0, '127.0.0.1');
      try {
        await new Promise<void>((resolve) => server.once('listening', () => resolve()));
        const port = (server.address() as AddressInfo).port;
        const base = `http://127.0.0.1:${port}`;

        // A. Valid "Create an apocalypse scene." prompt -> 200 using CHAIN[0] (CodeCraft)
        mode = 'valid_first';
        callsMade = 0;
        chainRequested.length = 0;
        const r1 = await fetch(`${base}/api/ai/plan-scene`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            prompt: 'Create an apocalypse scene.',
            projectId: 'proj_apoc_1',
            existingContinuity: createDefaultVisualContinuity(),
            currentScenePlan: null,
          }),
        });
        assert.equal(r1.status, 200);
        const d1 = (await r1.json()) as {
          assistantMessage: string;
          scenePlan: ReturnType<typeof buildValidApocalypsePlan>;
        };
        assert.deepEqual(chainRequested, [
          {
            url: 'https://codecraftapi.com/v1/chat/completions',
            model: CHAIN[0].model,
          },
        ]);
        assert.ok(d1.scenePlan.visualContinuity);
        assert.equal(d1.scenePlan.visualContinuity.characterBible[0].name, 'Kael');
        assert.equal(validateScenePlan(d1.scenePlan).ok, true);

        // B. Follow-up prompt preserves established characterBible even if AI omits it
        mode = 'followup_missing_chars';
        const r2 = await fetch(`${base}/api/ai/plan-scene`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            prompt: 'Add heavy rain to the scene',
            projectId: 'proj_apoc_1',
            existingContinuity: d1.scenePlan.visualContinuity,
            currentScenePlan: d1.scenePlan,
          }),
        });
        assert.equal(r2.status, 200);
        const d2 = (await r2.json()) as {
          scenePlan: ReturnType<typeof buildValidApocalypsePlan>;
        };
        assert.equal(d2.scenePlan.scenes[0].weather.type, 'rain');
        assert.equal(d2.scenePlan.visualContinuity.characterBible.length, 1);
        assert.equal(d2.scenePlan.visualContinuity.characterBible[0].name, 'Kael');

        // C. Transient 503 on CHAIN[0] automatically fails over to CHAIN[1] (CodeCraft)
        mode = 'transient_then_valid';
        callsMade = 0;
        chainRequested.length = 0;
        const r3 = await fetch(`${base}/api/ai/plan-scene`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            prompt: 'Failover apocalypse scene',
            projectId: 'proj_apoc_retry',
            existingContinuity: createDefaultVisualContinuity(),
            currentScenePlan: null,
          }),
        });
        assert.equal(r3.status, 200);
        assert.deepEqual(chainRequested, [
          { url: 'https://codecraftapi.com/v1/chat/completions', model: CHAIN[0].model },
          { url: 'https://codecraftapi.com/v1/chat/completions', model: CHAIN[1].model },
        ]);

        // D. Malformed empty-scenes AI output across all 3 CHAIN items fails cleanly with 503 user message
        mode = 'always_malformed';
        callsMade = 0;
        chainRequested.length = 0;
        const r4 = await fetch(`${base}/api/ai/plan-scene`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            prompt: 'Broken output test',
            projectId: 'proj_broken',
          }),
        });
        assert.equal(r4.status, 503);
        const d4 = (await r4.json()) as { error: string };
        assert.equal(d4.error, AI_UNAVAILABLE_USER_MESSAGE);
        assert.deepEqual(
          chainRequested.map((c) => c.model),
          CHAIN.map((c) => c.model)
        );
      } finally {
        server.close();
      }

      // E. Missing CODECRAFT_API_KEY -> 503 with clean user message
      const prevCcKey = process.env.CODECRAFT_API_KEY;
      delete process.env.CODECRAFT_API_KEY;
      const { app: noKeyApp } = createVyroxxApiApp({
        storageRoot: testStorageRoot,
        projectId: testProjectId,
        jwks,
        allowedOrigins: new Set(['http://127.0.0.1:3000']),
        isProd: false,
        codecraftApiKey: '',
      });
      const noKeyServer = noKeyApp.listen(0, '127.0.0.1');
      try {
        await new Promise<void>((resolve) => noKeyServer.once('listening', () => resolve()));
        const noKeyPort = (noKeyServer.address() as AddressInfo).port;
        const r5 = await fetch(`http://127.0.0.1:${noKeyPort}/api/ai/plan-scene`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            prompt: 'Key check',
            projectId: 'proj_key_check',
          }),
        });
        assert.equal(r5.status, 503);
        const d5 = (await r5.json()) as { error: string };
        assert.equal(d5.error, AI_UNAVAILABLE_USER_MESSAGE);
      } finally {
        if (prevCcKey !== undefined) process.env.CODECRAFT_API_KEY = prevCcKey;
        noKeyServer.close();
        fs.rmSync(testStorageRoot, { recursive: true, force: true });
      }
    }
  );

  // 5. Centralized aiService.ts Integration Tests (CodeCraft 3-Step CHAIN Fallback)
  await runTest(
    'Centralized aiService.ts: Executes CodeCraft strictly in CHAIN order, logs provider/model, handles 401/402/404/429/5xx/network/timeout/empty',
    async () => {
      const { createVyroxxApiApp } = await import('../server');
      const {
        AI_REQUEST_TIMEOUT_MS,
        AI_UNAVAILABLE_USER_MESSAGE,
        CHAIN,
        CODECRAFT_BASE_URL,
      } = await import('../aiService');

      assert.equal(CODECRAFT_BASE_URL, 'https://codecraftapi.com/v1');
      assert.equal(AI_REQUEST_TIMEOUT_MS, 60_000);
      assert.deepEqual([...CHAIN], [
        { provider: 'codecraft', model: 'claude-fable-5' },
        { provider: 'codecraft', model: 'claude-opus-5.5' },
        { provider: 'codecraft', model: 'claude-sonnet-5' },
      ]);

      const { publicKey, privateKey } = await generateKeyPair('RS256');
      const publicJwk = await exportJWK(publicKey);
      publicJwk.kid = 'cc-test-1';
      publicJwk.alg = 'RS256';
      publicJwk.use = 'sig';

      const jwks = createLocalJWKSet({ keys: [publicJwk] });
      const testStorageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vyroxx-cc-'));
      const testProjectId = 'vyroxx-cc-proj';

      const token = await new SignJWT({
        email: 'cc-creator@example.com',
        email_verified: true,
      })
        .setProtectedHeader({ alg: 'RS256', kid: 'cc-test-1' })
        .setSubject('cc_uid_1')
        .setIssuer(`https://securetoken.google.com/${testProjectId}`)
        .setAudience(testProjectId)
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
        .sign(privateKey);

      type FailureKind =
        | 'err_401'
        | 'err_402'
        | 'err_404'
        | 'err_429'
        | 'err_503'
        | 'err_network'
        | 'err_timeout'
        | 'err_empty';

      type Scenario =
        | { kind: 'first_ok' }
        | { kind: 'fail_first_then_second'; failure: FailureKind }
        | { kind: 'fail_two_then_third' }
        | { kind: 'all_fail' };

      let scenario: Scenario = { kind: 'first_ok' };
      const capturedRequests: Array<{
        url: string;
        auth: string;
        model: string;
        hasSignal: boolean;
        stream: boolean;
        messages: Array<{ role: string; content: string }>;
      }> = [];

      const simulateFailure = async (failure: FailureKind): Promise<Response> => {
        if (failure === 'err_401') {
          return new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), { status: 401 });
        }
        if (failure === 'err_402') {
          return new Response(JSON.stringify({ error: { message: 'Payment required' } }), { status: 402 });
        }
        if (failure === 'err_404') {
          return new Response(JSON.stringify({ error: { message: 'Model not found' } }), { status: 404 });
        }
        if (failure === 'err_429') {
          return new Response(JSON.stringify({ error: { message: 'Rate limit exceeded' } }), { status: 429 });
        }
        if (failure === 'err_503') {
          return new Response(JSON.stringify({ error: { message: 'Service overloaded' } }), { status: 503 });
        }
        if (failure === 'err_network') {
          throw new Error('ECONNRESET: socket hang up');
        }
        if (failure === 'err_timeout') {
          await new Promise((resolve) => setTimeout(resolve, 250));
          return new Response('{}', { status: 200 });
        }
        return new Response(
          JSON.stringify({ choices: [{ message: { content: '   ' } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const mockFetch: typeof fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : input.toString();
        const headers = (init?.headers ?? {}) as Record<string, string>;
        const parsedBody = JSON.parse(String(init?.body || '{}')) as {
          model?: string;
          stream?: boolean;
          messages?: Array<{ role: string; content: string }>;
        };
        const model = parsedBody.model || '';
        capturedRequests.push({
          url,
          auth: headers.Authorization || '',
          model,
          hasSignal: Boolean(init?.signal),
          stream: Boolean(parsedBody.stream),
          messages: parsedBody.messages ?? [],
        });

        if (scenario.kind === 'fail_first_then_second' && model === CHAIN[0].model) {
          return simulateFailure(scenario.failure);
        }
        if (scenario.kind === 'fail_two_then_third') {
          if (model === CHAIN[0].model) return simulateFailure('err_429');
          if (model === CHAIN[1].model) return simulateFailure('err_404');
        }
        if (scenario.kind === 'all_fail') {
          return simulateFailure('err_503');
        }

        const fencedPayload = [
          '```json',
          JSON.stringify({
            assistantMessage: `Generated via ${model}.`,
            scenePlan: buildValidApocalypsePlan(),
          }),
          '```',
        ].join('\n');

        return new Response(
          JSON.stringify({
            choices: [{ message: { content: fencedPayload } }],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      };

      const { app } = createVyroxxApiApp({
        storageRoot: testStorageRoot,
        projectId: testProjectId,
        jwks,
        allowedOrigins: new Set(['http://127.0.0.1:3000']),
        isProd: false,
        fetchFn: mockFetch,
        codecraftApiKey: 'cc-test-key-12345',
        timeoutMs: 60,
      });

      const capturedLogs: string[] = [];
      const capturedWarns: string[] = [];
      const capturedErrors: string[] = [];
      const origLog = console.log;
      const origWarn = console.warn;
      const origError = console.error;
      console.log = (...args: unknown[]) => {
        capturedLogs.push(args.map((a) => String(a)).join(' '));
      };
      console.warn = (...args: unknown[]) => {
        capturedWarns.push(args.map((a) => String(a)).join(' '));
      };
      console.error = (...args: unknown[]) => {
        capturedErrors.push(args.map((a) => String(a)).join(' '));
      };

      const server = app.listen(0, '127.0.0.1');
      try {
        await new Promise<void>((resolve) => server.once('listening', () => resolve()));
        const port = (server.address() as AddressInfo).port;
        const base = `http://127.0.0.1:${port}`;

        const postScene = (projectId: string) =>
          fetch(`${base}/api/ai/plan-scene`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              prompt: 'Create an apocalypse scene.',
              projectId,
              conversationHistory: [{ role: 'user', content: 'Previous turn' }],
            }),
          });

        // A. CHAIN[0] (CodeCraft claude-fable-5) succeeds
        scenario = { kind: 'first_ok' };
        capturedRequests.length = 0;
        capturedLogs.length = 0;
        const rOk = await postScene('proj_cc_ok');
        assert.equal(rOk.status, 200);
        const dOk = (await rOk.json()) as {
          assistantMessage: string;
          scenePlan: ReturnType<typeof buildValidApocalypsePlan>;
        };
        assert.equal(capturedRequests.length, 1);
        assert.equal(capturedRequests[0].url, 'https://codecraftapi.com/v1/chat/completions');
        assert.equal(capturedRequests[0].auth, 'Bearer cc-test-key-12345');
        assert.equal(capturedRequests[0].model, CHAIN[0].model);
        assert.equal(capturedRequests[0].hasSignal, true);
        assert.equal(capturedRequests[0].stream, false);
        assert.equal(capturedRequests[0].messages[0].role, 'system');
        assert.ok(capturedRequests[0].messages[0].content.includes('You are Jarvis'));
        assert.equal(capturedRequests[0].messages[1].role, 'user');
        assert.equal(capturedRequests[0].messages[1].content, 'Previous turn');
        assert.equal(capturedRequests[0].messages[2].role, 'user');
        assert.ok(capturedRequests[0].messages[2].content.includes('Create an apocalypse scene.'));
        assert.equal(dOk.assistantMessage, `Generated via ${CHAIN[0].model}.`);
        assert.equal(validateScenePlan(dOk.scenePlan).ok, true);
        assert.ok(
          capturedLogs.some((line) =>
            line.includes(`provider=codecraft model=${CHAIN[0].model}`)
          ),
          `Expected console log for codecraft/${CHAIN[0].model}, got: ${capturedLogs.join(' | ')}`
        );

        // B. Every failure mode on CHAIN[0] falls back cleanly to CHAIN[1] (claude-opus-5.5)
        const failureModes: FailureKind[] = [
          'err_401',
          'err_402',
          'err_404',
          'err_429',
          'err_503',
          'err_network',
          'err_timeout',
          'err_empty',
        ];
        for (const modeName of failureModes) {
          scenario = { kind: 'fail_first_then_second', failure: modeName };
          capturedRequests.length = 0;
          capturedLogs.length = 0;
          capturedWarns.length = 0;
          const rFb = await postScene(`proj_chain_${modeName}`);
          assert.equal(
            rFb.status,
            200,
            `CHAIN[0] failure (${modeName}) must automatically fall back to CHAIN[1]`
          );
          const dFb = (await rFb.json()) as {
            assistantMessage: string;
            scenePlan: ReturnType<typeof buildValidApocalypsePlan>;
          };
          assert.equal(capturedRequests.length, 2);
          assert.equal(capturedRequests[0].url, 'https://codecraftapi.com/v1/chat/completions');
          assert.equal(capturedRequests[0].auth, 'Bearer cc-test-key-12345');
          assert.equal(capturedRequests[0].model, CHAIN[0].model);
          assert.equal(capturedRequests[1].url, 'https://codecraftapi.com/v1/chat/completions');
          assert.equal(capturedRequests[1].auth, 'Bearer cc-test-key-12345');
          assert.equal(capturedRequests[1].model, CHAIN[1].model);
          assert.equal(dFb.assistantMessage, `Generated via ${CHAIN[1].model}.`);
          assert.equal(validateScenePlan(dFb.scenePlan).ok, true);
          assert.ok(
            capturedWarns.some((line) =>
              line.includes(`Failed: provider=codecraft model=${CHAIN[0].model}`)
            ),
            `Expected warning log for failed codecraft/${CHAIN[0].model} on ${modeName}`
          );
          assert.ok(
            capturedLogs.some((line) =>
              line.includes(`Success: provider=codecraft model=${CHAIN[1].model}`)
            ),
            `Expected success log for fallback codecraft/${CHAIN[1].model} on ${modeName}`
          );
        }

        // C. CHAIN[0] + CHAIN[1] fail -> falls back to CHAIN[2] (claude-sonnet-5) and succeeds
        scenario = { kind: 'fail_two_then_third' };
        capturedRequests.length = 0;
        capturedLogs.length = 0;
        capturedWarns.length = 0;
        const rThird = await postScene('proj_chain_third');
        assert.equal(rThird.status, 200);
        const dThird = (await rThird.json()) as { assistantMessage: string };
        assert.deepEqual(
          capturedRequests.map((r) => r.model),
          CHAIN.map((c) => c.model)
        );
        assert.equal(dThird.assistantMessage, `Generated via ${CHAIN[2].model}.`);
        assert.ok(capturedWarns.some((line) => line.includes(`model=${CHAIN[0].model}`)));
        assert.ok(capturedWarns.some((line) => line.includes(`model=${CHAIN[1].model}`)));
        assert.ok(capturedLogs.some((line) => line.includes(`model=${CHAIN[2].model}`)));

        // D. All 3 CHAIN items fail -> HTTP 503 with exact friendly message
        scenario = { kind: 'all_fail' };
        capturedRequests.length = 0;
        capturedErrors.length = 0;
        const rFailAll = await postScene('proj_chain_all_fail');
        assert.equal(rFailAll.status, 503);
        const dFailAll = (await rFailAll.json()) as { error: string };
        assert.deepEqual(
          capturedRequests.map((r) => r.model),
          CHAIN.map((c) => c.model)
        );
        assert.equal(dFailAll.error, AI_UNAVAILABLE_USER_MESSAGE);
        assert.ok(capturedErrors.some((line) => line.includes('All providers/models failed')));
      } finally {
        console.log = origLog;
        console.warn = origWarn;
        console.error = origError;
        server.close();
        fs.rmSync(testStorageRoot, { recursive: true, force: true });
      }
    }
  );

  // 6. Rich Schema Sub-Specs, Synonym Resolution & Real Canvas 2D Renderer Output Verification
  await runTest(
    'Rich Schema & Renderer Verification: All 6 animation archetypes + natural-language edits render distinct, accurate Canvas 2D geometry & text',
    async () => {
      const { renderScenePlanFrame } = await import('../src/engine/safeRenderer');

      interface RecordedDrawTrace {
        texts: Array<{ text: string; fillStyle: string; x: number; y: number }>;
        fills: string[];
        strokes: string[];
        shadowColors: string[];
        beziers: number;
        arcs: number;
        ellipses: number;
        rects: number;
        lines: number;
      }

      function createRecordingCanvasContext(): {
        ctx: CanvasRenderingContext2D;
        trace: RecordedDrawTrace;
      } {
        const trace: RecordedDrawTrace = {
          texts: [],
          fills: [],
          strokes: [],
          shadowColors: [],
          beziers: 0,
          arcs: 0,
          ellipses: 0,
          rects: 0,
          lines: 0,
        };
        const stateStack: Array<{ fillStyle: unknown; strokeStyle: unknown; shadowColor: string }> = [];
        const stubGrad = { addColorStop: () => {} };
        const ctxObj: Record<string, unknown> = {
          fillStyle: '#000000',
          strokeStyle: '#000000',
          shadowColor: 'transparent',
          shadowBlur: 0,
          lineWidth: 1,
          lineCap: 'butt',
          lineJoin: 'miter',
          globalAlpha: 1,
          font: '12px sans-serif',
          textAlign: 'left',
          textBaseline: 'alphabetic',
          save: () => {
            stateStack.push({
              fillStyle: ctxObj.fillStyle,
              strokeStyle: ctxObj.strokeStyle,
              shadowColor: String(ctxObj.shadowColor),
            });
          },
          restore: () => {
            const prev = stateStack.pop();
            if (prev) {
              ctxObj.fillStyle = prev.fillStyle;
              ctxObj.strokeStyle = prev.strokeStyle;
              ctxObj.shadowColor = prev.shadowColor;
            }
          },
          clearRect: () => {},
          translate: () => {},
          scale: () => {},
          rotate: () => {},
          clip: () => {},
          beginPath: () => {},
          closePath: () => {},
          moveTo: () => {},
          lineTo: () => {
            trace.lines++;
          },
          bezierCurveTo: () => {
            trace.beziers++;
          },
          quadraticCurveTo: () => {
            trace.beziers++;
          },
          arc: () => {
            trace.arcs++;
          },
          ellipse: () => {
            trace.ellipses++;
          },
          rect: () => {
            trace.rects++;
          },
          roundRect: () => {
            trace.rects++;
          },
          fillRect: () => {
            trace.rects++;
            if (typeof ctxObj.fillStyle === 'string') trace.fills.push(ctxObj.fillStyle.toLowerCase());
          },
          strokeRect: () => {
            trace.rects++;
            if (typeof ctxObj.strokeStyle === 'string') trace.strokes.push(ctxObj.strokeStyle.toLowerCase());
          },
          fill: () => {
            if (typeof ctxObj.fillStyle === 'string') trace.fills.push(ctxObj.fillStyle.toLowerCase());
            if (String(ctxObj.shadowColor) !== 'transparent') {
              trace.shadowColors.push(String(ctxObj.shadowColor).toLowerCase());
            }
          },
          stroke: () => {
            if (typeof ctxObj.strokeStyle === 'string') trace.strokes.push(ctxObj.strokeStyle.toLowerCase());
            if (String(ctxObj.shadowColor) !== 'transparent') {
              trace.shadowColors.push(String(ctxObj.shadowColor).toLowerCase());
            }
          },
          fillText: (text: string, x: number, y: number) => {
            trace.texts.push({
              text: String(text),
              fillStyle: typeof ctxObj.fillStyle === 'string' ? ctxObj.fillStyle.toLowerCase() : 'gradient',
              x,
              y,
            });
          },
          measureText: (text: string) => ({ width: String(text).length * 8 }),
          setLineDash: () => {},
          createLinearGradient: () => stubGrad,
          createRadialGradient: () => stubGrad,
        };
        return { ctx: ctxObj as unknown as CanvasRenderingContext2D, trace };
      }

      // A. Financial Growth Graph (labeled axes, accelerating cyan curve, moving marker, $10 Million highlight)
      const chartNormalized = normalizeScenePlan({
        planVersion: 1,
        title: 'Revenue Acceleration',
        summary: 'Financial growth graph hitting $10 Million',
        scenes: [
          {
            id: 's1',
            title: 'Growth Curve',
            durationSec: 8,
            transition: 'fade',
            background: { mode: 'solid', solidColor: '#050814' },
            camera: { motion: 'static', intensity: 0.2 },
            lighting: { mood: 'cinematic', ambientAlpha: 0.2, bloomColor: '#22d3ee', volumetricRays: false, vignette: 0.3 },
            weather: { type: 'none', density: 0, windX: 0 },
            elements: [
              {
                id: 'rev_chart',
                kind: 'line-graph', // synonym test -> resolves to 'chart'
                label: 'Annual Revenue Growth',
                x: 0.5,
                y: 0.52,
                scale: 1,
                colorPrimary: '#22d3ee',
                colorSecondary: '#0f172a',
                accentColor: '#e2e8f0',
                variant: 'futuristic',
                count: 1,
                depth: 0.6,
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
                chartSpec: {
                  chartType: 'line',
                  title: 'Annual Revenue Growth',
                  xAxisLabel: 'Quarter',
                  yAxisLabel: 'Revenue ($M)',
                  valuePrefix: '$',
                  valueSuffix: 'M',
                  smoothCurve: true,
                  easing: 'accelerate',
                  showGrid: true,
                  showAreaFill: true,
                  showMovingMarker: true,
                  highlightFinalBadge: '$10 Million',
                  points: [
                    { label: 'Q1', value: 0.8 },
                    { label: 'Q2', value: 1.5 },
                    { label: 'Q3', value: 2.9 },
                    { label: 'Q4', value: 4.8 },
                    { label: 'Q5', value: 7.2 },
                    { label: 'Q6', value: 10.0 },
                  ],
                },
              },
            ],
          },
        ],
      });
      assert.equal(chartNormalized.ok, true);
      if (chartNormalized.ok) {
        assert.equal(chartNormalized.data.scenes[0].elements[0].kind, 'chart');
        const late = createRecordingCanvasContext();
        renderScenePlanFrame(late.ctx, chartNormalized.data, 1280, 720, 6.8);
        const renderedLabels = late.trace.texts.map((t) => t.text);
        assert.ok(renderedLabels.includes('Annual Revenue Growth'), 'Chart title must render');
        assert.ok(renderedLabels.includes('Q1') && renderedLabels.includes('Q6'), 'X-axis labels must render');
        assert.ok(renderedLabels.includes('$10 Million'), 'Final $10 Million milestone badge must render');
        assert.ok(late.trace.beziers > 0, 'Smooth curve must draw cubic bezier segments');
        assert.ok(late.trace.strokes.includes('#22d3ee'), 'Cyan graph curve stroke must be present');

        // Verify animation progression from t=1.5s to t=6.8s
        const early = createRecordingCanvasContext();
        renderScenePlanFrame(early.ctx, chartNormalized.data, 1280, 720, 1.5);
        assert.ok(
          !early.trace.texts.some((t) => t.text === '$10 Million'),
          '$10 Million badge should appear only as curve reaches milestone'
        );
      }

      // B. Post-Apocalyptic Scene + Natural-Language Edit: Wasteland Ranger (crimson armor + glowing cyan visor) + Drone
      const apocBase = normalizeScenePlan({
        planVersion: 1,
        title: 'Ruined City',
        summary: 'Survivor in ruined city',
        scenes: [
          {
            id: 's1',
            title: 'City Ruins',
            durationSec: 8,
            transition: 'fade',
            background: { mode: 'scene', skyTop: '#1c1917', skyBottom: '#451a03', horizonColor: '#9a3412', groundColor: '#18181b', groundElevation: 0.72 },
            camera: { motion: 'pan-right', intensity: 0.3 },
            lighting: { mood: 'eerie-ash', ambientAlpha: 0.3, bloomColor: '#f97316', volumetricRays: true, vignette: 0.45 },
            weather: { type: 'ash', density: 0.6, windX: -0.2 },
            elements: [
              {
                id: 'skyline_1',
                kind: 'skyline',
                label: 'Ruined Towers',
                x: 0.5,
                y: 0.48,
                scale: 1,
                colorPrimary: '#27272a',
                colorSecondary: '#18181b',
                accentColor: '#f97316',
                variant: 'ruined',
                count: 7,
                depth: 0.2,
                motion: { type: 'pan-parallax', speed: 0.4, amplitude: 0.08, direction: -1 },
              },
              {
                id: 'hero_1',
                kind: 'character',
                label: 'Wasteland Ranger',
                x: 0.45,
                y: 0.72,
                scale: 1.2,
                colorPrimary: '#dc2626',
                colorSecondary: '#1e293b',
                accentColor: '#22d3ee',
                variant: 'running',
                count: 1,
                depth: 0.85,
                motion: { type: 'chase', speed: 1.5, amplitude: 0.1, direction: 1 },
                characterSpec: {
                  archetype: 'ranger',
                  pose: 'running',
                  expression: 'determined',
                  armorStyle: 'heavy-plate',
                  armorColor: '#dc2626',
                  secondaryGearColor: '#1e293b',
                  headgear: 'visor-helmet',
                  visorColor: '#22d3ee',
                  cloakOrCoat: true,
                  cloakColor: '#0f172a',
                  weaponOrGear: 'rifle',
                  hairColor: '#1e293b',
                  detailLevel: 'hero',
                },
              },
              {
                id: 'drone_1',
                kind: 'quadcopter', // synonym test -> resolves to 'drone'
                label: 'Eerie Patrol Drone',
                x: 0.7,
                y: 0.28,
                scale: 1,
                colorPrimary: '#334155',
                colorSecondary: '#0f172a',
                accentColor: '#22d3ee',
                variant: 'hovering',
                count: 1,
                depth: 0.8,
                motion: { type: 'bob', speed: 1.2, amplitude: 0.08, direction: -1 },
              },
            ],
          },
        ],
      });
      assert.equal(apocBase.ok, true);
      if (apocBase.ok) {
        assert.equal(apocBase.data.scenes[0].elements[2].kind, 'drone');
        const apocTrace = createRecordingCanvasContext();
        renderScenePlanFrame(apocTrace.ctx, apocBase.data, 1280, 720, 2.0);
        assert.ok(apocTrace.trace.fills.includes('#dc2626'), 'Crimson armor fill must render');
        assert.ok(apocTrace.trace.fills.includes('#22d3ee'), 'Glowing cyan visor / optical lens must render');
        assert.ok(apocTrace.trace.shadowColors.includes('#22d3ee'), 'Visor & scanner glow must render');
        assert.ok(apocTrace.trace.ellipses >= 4, 'Drone quadcopter must render spinning rotor ellipses');
      }

      // C. Car Racing -> aerodynamic chassis, spinning wheels, nitro exhaust, numberTag, speed lines & track
      const racingPlan = normalizeScenePlan({
        planVersion: 1,
        title: 'Midnight Apex Race',
        summary: 'Racing car tearing down illuminated track',
        scenes: [
          {
            id: 'r1',
            title: 'Straightaway',
            durationSec: 6,
            transition: 'cut',
            background: { mode: 'scene', groundElevation: 0.65 },
            camera: { motion: 'follow-subject', intensity: 0.5 },
            lighting: { mood: 'neon', ambientAlpha: 0.2, bloomColor: '#38bdf8', volumetricRays: false, vignette: 0.4 },
            weather: { type: 'sparks', density: 0.3, windX: -0.6 },
            elements: [
              { id: 'track', kind: 'road', label: 'Circuit Track', x: 0.5, y: 0.65, scale: 1, colorPrimary: '#f8fafc', colorSecondary: '#111827', accentColor: '#ef4444', variant: 'cinematic', count: 1, depth: 0.3, motion: { type: 'static', speed: 2, amplitude: 0, direction: 1 } },
              { id: 'car_1', kind: 'race-car', label: 'Apex GT #07', x: 0.4, y: 0.78, scale: 1.2, colorPrimary: '#ef4444', colorSecondary: '#0f172a', accentColor: '#38bdf8', variant: 'running', count: 1, depth: 0.85, motion: { type: 'move-horizontal', speed: 2.2, amplitude: 0.1, direction: 1 }, vehicleSpec: { subKind: 'racing-car', speedLines: true, headlights: true, exhaustFlame: true, wheelSpin: true, numberTag: '07' } },
            ],
          },
        ],
      });
      assert.equal(racingPlan.ok, true);
      if (racingPlan.ok) {
        assert.equal(racingPlan.data.scenes[0].elements[1].kind, 'vehicle');
        assert.equal(racingPlan.data.scenes[0].elements[1].vehicleSpec?.subKind, 'racing-car');
        const rTrace = createRecordingCanvasContext();
        renderScenePlanFrame(rTrace.ctx, racingPlan.data, 1280, 720, 1.8);
        assert.ok(rTrace.trace.fills.includes('#ef4444'), 'Crimson racing car chassis must render');
        assert.ok(rTrace.trace.texts.some((t) => t.text === '07'), 'Racing car number tag must render');
        assert.ok(rTrace.trace.arcs >= 2, 'Racing car must render spinning wheels');
        assert.ok(rTrace.trace.lines > 0, 'Racing car speed lines & wheel spokes must render');
        assert.ok(rTrace.trace.rects > 2, 'Track road dashes must render');
      }

      // D. 2D Character Walking Through Rainy Cyberpunk Street -> wet neon road, rain strokes, neon skyline, trench-coat character w/ cyber-optics
      const cyberWalkPlan = normalizeScenePlan({
        planVersion: 1,
        title: 'Neo-Rain Midnight Stroll',
        summary: 'A cybernetic detective walks down a rainy neon street',
        scenes: [
          {
            id: 'cw1',
            title: 'Neon Boulevard Rain',
            durationSec: 8,
            transition: 'fade',
            background: { mode: 'scene', skyTop: '#020617', skyBottom: '#1e1b4b', horizonColor: '#be185d', groundColor: '#090d16', groundElevation: 0.68 },
            camera: { motion: 'pan-right', intensity: 0.35 },
            lighting: { mood: 'neon', ambientAlpha: 0.25, bloomColor: '#ec4899', volumetricRays: true, vignette: 0.45 },
            weather: { type: 'rain', density: 0.85, windX: -0.25 },
            elements: [
              { id: 'cyber_sky', kind: 'skyline', label: 'Cyberpunk Skyline', x: 0.5, y: 0.48, scale: 1.05, colorPrimary: '#0f172a', colorSecondary: '#020617', accentColor: '#ec4899', variant: 'cyberpunk', count: 8, depth: 0.2, motion: { type: 'pan-parallax', speed: 0.3, amplitude: 0.06, direction: -1 } },
              { id: 'wet_road', kind: 'road', label: 'Wet Neon Street', x: 0.5, y: 0.68, scale: 1, colorPrimary: '#38bdf8', colorSecondary: '#090d16', accentColor: '#ec4899', variant: 'cyberpunk', count: 1, depth: 0.35, motion: { type: 'static', speed: 1, amplitude: 0, direction: 1 }, roadSpec: { perspective: 'wet-neon', lanes: 2, scrollSpeed: 1.4, wetReflections: true } },
              { id: 'walker_1', kind: 'character', label: 'Cyber Detective', x: 0.42, y: 0.74, scale: 1.15, colorPrimary: '#0ea5e9', colorSecondary: '#0f172a', accentColor: '#ec4899', variant: 'walking', count: 1, depth: 0.85, motion: { type: 'move-horizontal', speed: 0.7, amplitude: 0.1, direction: 1 }, characterSpec: { archetype: 'cyberpunk', pose: 'walking', expression: 'calm', armorStyle: 'trench-coat', armorColor: '#0ea5e9', secondaryGearColor: '#1e293b', headgear: 'cyber-optics', visorColor: '#22d3ee', cloakOrCoat: true, cloakColor: '#0f172a', weaponOrGear: 'umbrella', hairColor: '#334155', detailLevel: 'hero' } },
            ],
          },
        ],
      });
      assert.equal(cyberWalkPlan.ok, true);
      if (cyberWalkPlan.ok) {
        const cwTrace = createRecordingCanvasContext();
        renderScenePlanFrame(cwTrace.ctx, cyberWalkPlan.data, 1280, 720, 2.4);
        assert.ok(cwTrace.trace.lines >= 80, 'Heavy cyberpunk rain streaks & articulated limbs must render');
        assert.ok(cwTrace.trace.rects >= 16, 'Wet neon puddle reflections and neon tower windows must render');
        assert.ok(cwTrace.trace.beziers >= 1, 'Flowing trench coat bezier curve must render');
        assert.ok(cwTrace.trace.fills.includes('#0ea5e9'), 'Cyber trench coat & umbrella fill must render');
        assert.ok(cwTrace.trace.shadowColors.includes('#22d3ee'), 'Glowing cyber-optics must render');
      }

      // E. Solar System with Orbiting Planets -> positions genuinely advance over time
      const solarPlan = normalizeScenePlan({
        planVersion: 1,
        title: 'Solar System',
        summary: 'Sun with orbiting Earth and Saturn',
        scenes: [
          {
            id: 'sol1',
            title: 'Planetary Orbits',
            durationSec: 10,
            transition: 'fade',
            background: { mode: 'scene', groundElevation: 0.98 },
            camera: { motion: 'static', intensity: 0 },
            lighting: { mood: 'cinematic', ambientAlpha: 0.15, bloomColor: '#f59e0b', volumetricRays: false, vignette: 0.3 },
            weather: { type: 'stars', density: 0.7, windX: 0 },
            elements: [
              { id: 'sun', kind: 'planet', label: 'Sun', x: 0.5, y: 0.5, scale: 1.2, colorPrimary: '#f59e0b', colorSecondary: '#b45309', accentColor: '#fef08a', variant: 'glowing', count: 1, depth: 0.5, motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 }, planetSpec: { bodyRole: 'star', radiusScale: 1.8, surfaceStyle: 'sun-corona' } },
              { id: 'saturn', kind: 'planet', label: 'Saturn', x: 0.78, y: 0.5, scale: 1, colorPrimary: '#eab308', colorSecondary: '#713f12', accentColor: '#fde68a', variant: 'idle', count: 1, depth: 0.7, motion: { type: 'orbit', speed: 1.4, amplitude: 0.25, direction: 1 }, planetSpec: { bodyRole: 'planet', radiusScale: 1.1, hasRings: true, ringColor: '#fde68a', orbitCenterX: 0.5, orbitCenterY: 0.5, orbitRadiusX: 0.3, orbitRadiusY: 0.18, orbitStartAngle: 0, showOrbitPath: true, showLabel: true, surfaceStyle: 'gas-bands' } },
            ],
          },
        ],
      });
      assert.equal(solarPlan.ok, true);
      if (solarPlan.ok) {
        const t0 = createRecordingCanvasContext();
        const t3 = createRecordingCanvasContext();
        renderScenePlanFrame(t0.ctx, solarPlan.data, 1280, 720, 0);
        renderScenePlanFrame(t3.ctx, solarPlan.data, 1280, 720, 3.0);
        const saturnAt0 = t0.trace.texts.find((t) => t.text === 'Saturn');
        const saturnAt3 = t3.trace.texts.find((t) => t.text === 'Saturn');
        assert.ok(saturnAt0 && saturnAt3, 'Saturn label must render');
        assert.notEqual(Math.round(saturnAt0!.x), Math.round(saturnAt3!.x), 'Saturn must orbit smoothly over time');
      }

      // F. Animated Logo Reveal -> renders emblem + brand text + tagline
      const logoPlan = normalizeScenePlan({
        planVersion: 1,
        title: 'VYROXX Brand Reveal',
        summary: 'Logo reveal with tagline',
        scenes: [
          {
            id: 'logo1',
            title: 'Crest Assemble',
            durationSec: 6,
            transition: 'fade',
            background: { mode: 'solid', solidColor: '#040814' },
            camera: { motion: 'zoom-in', intensity: 0.25 },
            lighting: { mood: 'neon', ambientAlpha: 0.2, bloomColor: '#38bdf8', volumetricRays: true, vignette: 0.35 },
            weather: { type: 'none', density: 0, windX: 0 },
            elements: [
              { id: 'brand', kind: 'logo', label: 'VYROXX', x: 0.5, y: 0.5, scale: 1.15, colorPrimary: '#0ea5e9', colorSecondary: '#020617', accentColor: '#22d3ee', variant: 'glowing', count: 1, depth: 0.8, motion: { type: 'pulse', speed: 1, amplitude: 0.08, direction: 1 }, logoSpec: { brandText: 'VYROXX', tagline: 'The Ultimate AI Creation Workspace', emblemShape: 'wing-v', revealStyle: 'assemble' } },
            ],
          },
        ],
      });
      assert.equal(logoPlan.ok, true);
      if (logoPlan.ok) {
        const lTrace = createRecordingCanvasContext();
        renderScenePlanFrame(lTrace.ctx, logoPlan.data, 1280, 720, 3.2);
        const labels = lTrace.trace.texts.map((t) => t.text);
        assert.ok(labels.includes('VYROXX'), 'Logo brand text must render');
        assert.ok(labels.includes('The Ultimate AI Creation Workspace'), 'Logo tagline must render');
      }

      // G. Surgical Natural-Language Edit Simulation -> transforming existing character via continuity/appearance + spec visibly alters rendered Canvas 2D output while preserving skyline
      const initialSurvivorPlan = normalizeScenePlan(buildValidApocalypsePlan());
      assert.equal(initialSurvivorPlan.ok, true);
      if (initialSurvivorPlan.ok) {
        const beforeTrace = createRecordingCanvasContext();
        renderScenePlanFrame(beforeTrace.ctx, initialSurvivorPlan.data, 1280, 720, 1.5);
        assert.ok(beforeTrace.trace.fills.includes('#38bdf8'), 'Initial survivor renders with blue tactical jacket');
        assert.ok(!beforeTrace.trace.fills.includes('#dc2626'), 'Initial survivor must not yet have crimson armor');

        // Simulate user saying: "Turn the survivor into a detailed Wasteland Ranger with crimson armor and a glowing cyan visor"
        const { characterSpec: _oldSpec, ...survivorWithoutOldSpec } =
          initialSurvivorPlan.data.scenes[0].elements[1];
        void _oldSpec;
        const editedRaw = buildValidApocalypsePlan({
          scenes: [
            {
              ...initialSurvivorPlan.data.scenes[0],
              elements: [
                initialSurvivorPlan.data.scenes[0].elements[0], // skyline preserved
                {
                  ...survivorWithoutOldSpec,
                  label: 'Wasteland Ranger',
                  colorPrimary: '#dc2626',
                  accentColor: '#22d3ee',
                  // Omitted characterSpec to verify hydration from updated bible/label guarantees crimson + cyan visor
                },
                initialSurvivorPlan.data.scenes[0].elements[2], // zombies preserved
              ],
            },
          ],
          visualContinuity: mergeVisualContinuity(initialSurvivorPlan.data.visualContinuity, {
            characterBible: [
              {
                name: 'Wasteland Ranger',
                role: 'Protagonist',
                appearance: 'Heavy crimson armor plates, helmet with glowing cyan visor, tactical cloak',
                primaryColor: '#dc2626',
                secondaryColor: '#0f172a',
              },
            ],
          }),
        });
        const editedNormalized = normalizeScenePlan(editedRaw);
        assert.equal(editedNormalized.ok, true);
        if (editedNormalized.ok) {
          assert.equal(editedNormalized.data.scenes[0].elements[0].id, 'skyline_1', 'Existing skyline preserved after edit');
          assert.equal(editedNormalized.data.scenes[0].elements[1].characterSpec?.headgear, 'visor-helmet');
          assert.equal(editedNormalized.data.scenes[0].elements[1].characterSpec?.visorColor, '#22d3ee');
          assert.equal(editedNormalized.data.scenes[0].elements[1].characterSpec?.armorColor, '#dc2626');

          const afterTrace = createRecordingCanvasContext();
          renderScenePlanFrame(afterTrace.ctx, editedNormalized.data, 1280, 720, 1.5);
          assert.ok(afterTrace.trace.fills.includes('#dc2626'), 'Edited Wasteland Ranger renders crimson armor');
          assert.ok(afterTrace.trace.fills.includes('#22d3ee'), 'Edited Wasteland Ranger renders glowing cyan visor');
          assert.ok(afterTrace.trace.shadowColors.includes('#22d3ee'), 'Edited visor glow shadow must render');
        }
      }
    }
  );

  // 7. CodeCraft Error Mapping & Friendly Client Error Verification
  await runTest(
    'CodeCraft Resilience: Client error mapper preserves clean unavailable message across 503/504/429/timeout',
    async () => {
      const { AI_UNAVAILABLE_USER_MESSAGE } = await import('../aiService');
      const {
        AI_BUSY_FRIENDLY_MESSAGE,
        toFriendlyAiErrorMessage,
      } = await import('../src/lib/apiClient');

      assert.equal(
        AI_BUSY_FRIENDLY_MESSAGE,
        'AI abhi available nahi hai, thodi der baad try karein.'
      );
      assert.equal(AI_UNAVAILABLE_USER_MESSAGE, AI_BUSY_FRIENDLY_MESSAGE);

      assert.equal(
        toFriendlyAiErrorMessage(AI_UNAVAILABLE_USER_MESSAGE, 503),
        AI_UNAVAILABLE_USER_MESSAGE
      );
      assert.equal(
        toFriendlyAiErrorMessage('503 Service Unavailable: upstream busy', 503),
        AI_BUSY_FRIENDLY_MESSAGE
      );
      assert.equal(
        toFriendlyAiErrorMessage('The operation was aborted due to timeout', 504),
        AI_BUSY_FRIENDLY_MESSAGE
      );
      assert.equal(
        toFriendlyAiErrorMessage('429 Too Many Requests'),
        AI_BUSY_FRIENDLY_MESSAGE
      );
    }
  );

  // 8. Phase 1c: CodeCraft customModelSpec normalization, schema guidance, broken part drop & prop fallback
  await runTest(
    'PHASE 1c Custom AI Generation: Realistic flat CodeCraft customModelSpec normalizes cleanly, bad parts drop, invalid spec falls back to prop',
    async () => {
      const { createVyroxxApiApp } = await import('../server');
      const { publicKey, privateKey } = await generateKeyPair('RS256');
      const publicJwk = await exportJWK(publicKey);
      publicJwk.kid = 'p1c-test-1';
      publicJwk.alg = 'RS256';
      publicJwk.use = 'sig';

      const jwks = createLocalJWKSet({ keys: [publicJwk] });
      const testStorageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vyroxx-p1c-'));
      const testProjectId = 'vyroxx-p1c-proj';

      const token = await new SignJWT({
        email: 'p1c@example.com',
        email_verified: true,
      })
        .setProtectedHeader({ alg: 'RS256', kid: 'p1c-test-1' })
        .setSubject('p1c_uid_1')
        .setIssuer(`https://securetoken.google.com/${testProjectId}`)
        .setAudience(testProjectId)
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
        .sign(privateKey);

      // A. Realistic AI response: flat parts, optional fields omitted, plus 2 broken parts mixed in
      const customModelRawPlan = {
        planVersion: 1,
        renderMode: '3d',
        visualStyle: 'realistic-pbr',
        title: 'Bioluminescent Jellyfish',
        summary: 'A glowing custom 3D jellyfish floating in deep water',
        width: 1280,
        height: 720,
        fps: 30,
        totalDurationSec: 8,
        scenes: [
          {
            id: 'scene_1',
            title: 'Abyssal Drift',
            durationSec: 8,
            transition: 'fade',
            background: {
              mode: 'scene',
              solidColor: '#020617',
              skyTop: '#020617',
              skyBottom: '#082f49',
              horizonColor: '#0c4a6e',
              groundColor: '#020617',
              groundElevation: 0.72,
            },
            camera: { motion: 'static', intensity: 0.3 },
            lighting: {
              mood: 'cinematic',
              ambientAlpha: 0.35,
              bloomColor: '#22d3ee',
              volumetricRays: true,
              vignette: 0.35,
            },
            weather: { type: 'none', density: 0, windX: 0 },
            scene3d: {
              environment: 'wasteland',
              groundType: 'none',
              camera3d: {
                projection: 'perspective',
                shotType: 'wide',
                fov: 50,
                position: { x: 4, y: 2, z: 6 },
                target: { x: 0, y: 1, z: 0 },
                motion: 'static',
              },
            },
            elements: [
              {
                id: 'jelly_hero',
                kind: 'custom',
                label: 'Glowing Jellyfish',
                x: 0.5,
                y: 0.5,
                scale: 1,
                colorPrimary: '#22d3ee',
                colorSecondary: '#0e7490',
                accentColor: '#a5f3fc',
                variant: 'glowing',
                count: 1,
                depth: 0.5,
                pos3d: { x: 0, y: 0.5, z: 0 },
                size3d: { w: 1.8, h: 2.6, d: 1.8 },
                motion: { type: 'bob', speed: 0.8, amplitude: 0.1, direction: 1 },
                customModelSpec: {
                  description: 'Translucent jellyfish dome and swaying tentacles',
                  parts: [
                    // Minimal required-only part (optional rotation, roughness, metalness, opacity, motion omitted)
                    {
                      id: 'bell_dome',
                      shape: 'sphere',
                      px: 0,
                      py: 0.6,
                      pz: 0,
                      sx: 1.6,
                      sy: 1.0,
                      sz: 1.6,
                      color: '#06b6d4',
                      emissive: '#22d3ee',
                    },
                    // Broken part 1: unsupported shape -> must be dropped without failing scene
                    {
                      id: 'bad_shape_part',
                      shape: 'hyperboloid',
                      px: 0,
                      py: 0,
                      pz: 0,
                      sx: 1,
                      sy: 1,
                      sz: 1,
                      color: '#ff0000',
                    },
                    // Broken part 2: non-numeric coordinate -> must be dropped without failing scene
                    {
                      id: 'bad_num_part',
                      shape: 'cylinder',
                      px: 'not_a_number',
                      py: 0,
                      pz: 0,
                      sx: 0.2,
                      sy: 1.2,
                      sz: 0.2,
                      color: '#38bdf8',
                    },
                    // Valid animated tentacle with optional fields omitted
                    {
                      id: 'tentacle_center',
                      shape: 'capsule',
                      px: 0,
                      py: -0.5,
                      pz: 0,
                      sx: 0.18,
                      sy: 1.4,
                      sz: 0.18,
                      color: '#67e8f9',
                      motionType: 'sway',
                      motionAxis: 'z',
                    },
                  ],
                },
              },
              // Second element: completely invalid customModelSpec (only bad parts) -> must fall back to "prop"
              {
                id: 'broken_custom_fallback',
                kind: 'custom',
                label: 'Broken Relic',
                x: 0.3,
                y: 0.6,
                scale: 1,
                colorPrimary: '#94a3b8',
                colorSecondary: '#1e293b',
                accentColor: '#38bdf8',
                variant: 'idle',
                count: 1,
                depth: 0.5,
                motion: { type: 'static', speed: 0, amplitude: 0, direction: 1 },
                customModelSpec: {
                  description: 'All invalid parts',
                  parts: [
                    {
                      id: 'invalid_only',
                      shape: 'nurbs_patch',
                      px: 0,
                      py: 0,
                      pz: 0,
                      sx: 1,
                      sy: 1,
                      sz: 1,
                      color: '#ffffff',
                    },
                  ],
                },
              },
            ],
          },
        ],
        visualContinuity: {
          artStyle: 'Bioluminescent 3D PBR',
          colorPalette: ['#020617', '#22d3ee', '#a5f3fc'],
          environmentRules: 'Deep abyssal ocean.',
          lightingStyle: 'Glowing cyan bioluminescence',
          characterBible: [],
          propReferences: ['Glowing Jellyfish'],
        },
      };

      const directNorm = normalizeScenePlan(customModelRawPlan);
      assert.equal(directNorm.ok, true, 'Normalization must succeed after dropping broken parts');
      if (directNorm.ok) {
        const hero = directNorm.data.scenes[0].elements[0];
        assert.equal(hero.kind, 'custom');
        assert.equal(hero.customModelSpec?.parts.length, 2, '2 valid parts kept, 2 broken parts dropped');
        assert.equal(hero.customModelSpec?.parts[0].id, 'bell_dome');
        assert.equal(hero.customModelSpec?.parts[0].rxDeg, 0, 'Missing optional rxDeg defaults to 0');
        assert.equal(hero.customModelSpec?.parts[0].roughness, 0.55, 'Missing optional roughness defaults cleanly');
        assert.equal(hero.customModelSpec?.parts[0].opacity, 1, 'Missing optional opacity defaults to 1');
        assert.equal(hero.customModelSpec?.parts[0].motionType, 'none', 'Missing optional motionType defaults to none');
        assert.equal(hero.customModelSpec?.parts[1].id, 'tentacle_center');
        assert.equal(hero.customModelSpec?.parts[1].motionType, 'sway');

        const fallbackEl = directNorm.data.scenes[0].elements[1];
        assert.equal(
          fallbackEl.kind,
          'prop',
          'All-invalid customModelSpec must safely fall back to kind="prop" without failing the scene'
        );
        assert.equal(fallbackEl.customModelSpec, undefined);
      }

      // B. Verify system message includes customModelSpec schema & rules
      const capturedSystemPrompts: string[] = [];
      const { app } = createVyroxxApiApp({
        projectId: testProjectId,
        jwks,
        storageRoot: testStorageRoot,
        allowedOrigins: new Set(['http://127.0.0.1:3000']),
        isProd: false,
        codecraftApiKey: 'cc-p1c-test-key',
        fetchFn: async (_input, init) => {
          const parsedBody = JSON.parse(String(init?.body || '{}')) as {
            messages?: Array<{ role: string; content: string }>;
          };
          const sysMsg = parsedBody.messages?.find((m) => m.role === 'system')?.content || '';
          capturedSystemPrompts.push(sysMsg);
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      assistantMessage: 'Built a bioluminescent 3D jellyfish.',
                      scenePlan: customModelRawPlan,
                    }),
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        },
      });

      const server = app.listen(0, '127.0.0.1');
      try {
        await new Promise<void>((resolve) => server.once('listening', () => resolve()));
        const port = (server.address() as AddressInfo).port;
        const res = await fetch(`http://127.0.0.1:${port}/api/ai/plan-scene`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            prompt: 'Create a glowing deep-sea jellyfish',
            projectId: 'proj_p1c_1',
          }),
        });
        assert.equal(res.status, 200);
        const body = (await res.json()) as { scenePlan: { scenes: Array<{ elements: Array<{ kind: string }> }> } };
        assert.equal(body.scenePlan.scenes[0].elements[0].kind, 'custom');
        assert.equal(body.scenePlan.scenes[0].elements[1].kind, 'prop');

        assert.ok(capturedSystemPrompts.length > 0, 'Expected CodeCraft system prompt to be captured');
        const sysInst = capturedSystemPrompts[0];
        assert.ok(sysInst.includes('CUSTOM 3D OBJECTS'), 'SYSTEM_INSTRUCTION must include CUSTOM 3D OBJECTS guidance');
        assert.ok(sysInst.includes('14-24'), 'SYSTEM_INSTRUCTION must require 14-24 parts');
        assert.ok(sysInst.includes('body axis along +x'), 'SYSTEM_INSTRUCTION must specify body axis along +x with head at +x');
        assert.equal(sysInst.includes('front faces +z'), false, 'Old front faces +z rule must be removed');
        assert.ok(sysInst.includes('focusPartId'), 'SYSTEM_INSTRUCTION and schema addendum must include focusPartId');
        assert.ok(sysInst.includes('whale_body'), 'SYSTEM_INSTRUCTION must include condensed devWhale example');
        assert.ok(sysInst.includes('customModelSpec'), 'STRUCTURED_JSON_FORMAT_ADDENDUM must include customModelSpec');
        assert.ok(sysInst.includes('Underwater scenes:'), 'SYSTEM_INSTRUCTION must include underwater atmosphere rules');
        assert.ok(sysInst.includes('between 0.5 and 0.8'), 'SYSTEM_INSTRUCTION must recommend volumetricRays 0.5-0.8 for underwater scenes');
        assert.ok(sysInst.includes('flattened ellipsoids'), 'SYSTEM_INSTRUCTION must require flattened ellipsoids for flippers/flukes');
        assert.ok(sysInst.includes('never a large black "box"'), 'SYSTEM_INSTRUCTION must forbid large black box mouths');
      } finally {
        server.close();
        fs.rmSync(testStorageRoot, { recursive: true, force: true });
      }
    }
  );

  console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
