import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import {
  AnimationScenePlan,
  createDefaultVisualContinuity,
  validateScenePlan,
} from '../src/shared/sceneSchema';

process.env.VYROXX_DISABLE_AUTOSTART = 'true';

const LIVE_PROMPTS: Array<{ id: string; prompt: string; editPrompt: string }> = [
  {
    id: 'financial_graph',
    prompt:
      'Create a professional animated financial revenue growth graph with labeled axes, quarterly numerical values, a gradually accelerating cyan line, a moving marker, and a final $10 Million highlight.',
    editPrompt: 'Make the graph line smoother and zoom the camera in slightly.',
  },
  {
    id: 'post_apocalyptic',
    prompt:
      'Create a post-apocalyptic ruined city with a lone survivor running past debris and an eerie flying drone scanning with a light.',
    editPrompt:
      'Make the survivor a detailed Wasteland Ranger with crimson armor and a glowing cyan visor.',
  },
  {
    id: 'car_racing',
    prompt: 'Create a cinematic high-speed car racing animation at night with two cars and nitro.',
    editPrompt: 'Make the lead racing car crimson red and add sparks.',
  },
  {
    id: 'cyberpunk_walk',
    prompt: 'Create a 2D character walking through a rainy neon cyberpunk street.',
    editPrompt: 'Give the character an umbrella and add a patrolling drone above.',
  },
  {
    id: 'solar_system',
    prompt: 'Create a solar system animation with the glowing sun and orbiting planets including Earth and ringed Saturn.',
    editPrompt: 'Make the camera zoom in toward Saturn.',
  },
  {
    id: 'logo_reveal',
    prompt: 'Create a professional animated logo reveal for NOVA STUDIO with tagline Future In Motion.',
    editPrompt: 'Make the emblem hexagon shaped with cyan glow.',
  },
];

async function main() {
  const hasOpenrouter = Boolean(
    process.env.OPENROUTER_API_KEY &&
      process.env.OPENROUTER_API_KEY !== 'MY_OPENROUTER_API_KEY' &&
      process.env.OPENROUTER_API_KEY !== 'OPENROUTER_API_KEY'
  );
  const hasCodecraft = Boolean(
    process.env.CODECRAFT_API_KEY &&
      process.env.CODECRAFT_API_KEY !== 'MY_CODECRAFT_API_KEY' &&
      process.env.CODECRAFT_API_KEY !== 'CODECRAFT_API_KEY'
  );

  if (!hasOpenrouter && !hasCodecraft) {
    console.log(
      'SKIPPED LIVE LLM CALLS: Neither OPENROUTER_API_KEY nor CODECRAFT_API_KEY is configured in the shell environment.'
    );
    console.log(
      'Run `OPENROUTER_API_KEY=... CODECRAFT_API_KEY=... npx tsx tests/live-e2e-verify.ts` to execute all 6 live prompts + natural-language edits.'
    );
    return;
  }

  console.log(
    `Running REAL end-to-end tests via centralized aiService.ts (OpenRouter configured=${hasOpenrouter}, CodeCraft configured=${hasCodecraft})`
  );

  const { createVyroxxApiApp } = await import('../server');
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = 'live-e2e-1';
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';
  const jwks = createLocalJWKSet({ keys: [publicJwk] });
  const testStorageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vyroxx-live-'));
  const testProjectId = 'vyroxx-live-proj';

  const token = await new SignJWT({
    email: 'live-tester@example.com',
    email_verified: true,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'live-e2e-1' })
    .setSubject('live_uid_1')
    .setIssuer(`https://securetoken.google.com/${testProjectId}`)
    .setAudience(testProjectId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(privateKey);

  const { app } = createVyroxxApiApp({
    storageRoot: testStorageRoot,
    projectId: testProjectId,
    jwks,
    allowedOrigins: new Set(['http://127.0.0.1:3000']),
    isProd: false,
  });

  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    const port = (server.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}`;

    for (const item of LIVE_PROMPTS) {
      const r1 = await fetch(`${base}/api/ai/plan-scene`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: item.prompt,
          projectId: `proj_${item.id}`,
          existingContinuity: createDefaultVisualContinuity(),
          currentScenePlan: null,
        }),
      });
      assert.equal(r1.status, 200, `${item.id} initial request failed with ${r1.status}`);
      const d1 = (await r1.json()) as { assistantMessage: string; scenePlan: AnimationScenePlan };
      assert.equal(validateScenePlan(d1.scenePlan).ok, true);
      const kinds = d1.scenePlan.scenes.flatMap((s) => s.elements.map((e) => e.kind));
      console.log(`PASS [${item.id}] initial kinds=${Array.from(new Set(kinds)).join(',')}`);

      const r2 = await fetch(`${base}/api/ai/plan-scene`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: item.editPrompt,
          projectId: `proj_${item.id}`,
          conversationHistory: [
            { role: 'user', content: item.prompt },
            { role: 'assistant', content: d1.assistantMessage },
          ],
          existingContinuity: d1.scenePlan.visualContinuity,
          currentScenePlan: d1.scenePlan,
        }),
      });
      assert.equal(r2.status, 200, `${item.id} edit request failed with ${r2.status}`);
      const d2 = (await r2.json()) as { assistantMessage: string; scenePlan: AnimationScenePlan };
      assert.equal(validateScenePlan(d2.scenePlan).ok, true);
      const editKinds = d2.scenePlan.scenes.flatMap((s) => s.elements.map((e) => e.kind));
      console.log(`PASS [${item.id}] edited kinds=${Array.from(new Set(editKinds)).join(',')}`);
    }
  } finally {
    server.close();
    fs.rmSync(testStorageRoot, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
