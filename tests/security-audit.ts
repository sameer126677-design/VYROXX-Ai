import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import {
  isSafeAvatarUrl,
  MAX_UPLOAD_BYTES,
  validateUploadBytes,
} from '../src/shared/uploadValidation';
import { validateScenePlan } from '../src/shared/sceneSchema';
import {
  isOriginAllowed,
  PlanRequestSchema,
  resolveSafeUserFilePath,
  SlidingWindowRateLimiter,
} from '../serverSecurity';

process.env.VYROXX_DISABLE_AUTOSTART = 'true';

const ROOT = process.cwd();
const LIVE_URL = process.env.VYROXX_TEST_URL || 'http://127.0.0.1:3000';

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

function collectFiles(dir: string, exts: string[]): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      results.push(...collectFiles(full, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

async function main() {
  console.log('=== VYROXX Comprehensive Security & Privacy Audit Suite ===\n');

  // 1. AGE & CHILD SAFETY CHECKS
  await runTest(
    'Age & Child Safety: No DOB collection inputs or fields in client or rules',
    () => {
      const srcFiles = collectFiles(path.join(ROOT, 'src'), ['.ts', '.tsx']);
      for (const file of srcFiles) {
        const text = fs.readFileSync(file, 'utf8');
        assert.equal(
          /\b(dateOfBirth|birthDate)\b|type=["']date["']|\bdob\s*[:=]/i.test(text),
          false,
          `Unexpected DOB input/field found in ${path.relative(ROOT, file)}`
        );
      }
      const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
      assert.ok(
        rules.includes('data.ageConfirmed18Plus == true'),
        'Firestore rules must require ageConfirmed18Plus == true'
      );
      const authScreens = fs.readFileSync(
        path.join(ROOT, 'src/components/AuthScreens.tsx'),
        'utf8'
      );
      assert.ok(
        authScreens.includes("authView === 'age-consent'"),
        'Must include age-consent onboarding gate'
      );
      assert.ok(
        authScreens.includes('I am under 18'),
        'Must include explicit under-18 block path'
      );
    }
  );

  // 2. API KEY, SECRET & SOURCE MAP ISOLATION
  await runTest(
    'Secret & Sourcemap Isolation: Zero secrets or .map files in client/dist',
    () => {
      const targets = [
        path.join(ROOT, 'index.html'),
        ...collectFiles(path.join(ROOT, 'src'), ['.ts', '.tsx', '.css']),
        ...collectFiles(path.join(ROOT, 'dist'), ['.js', '.html', '.css']),
      ];

      const forbiddenPatterns = [
        /OPENROUTER_API_KEY/,
        /CODECRAFT_API_KEY/,
        /VITE_OPENROUTER/,
        /VITE_CODECRAFT/,
        /PRIVATE KEY-----/,
        /service_account/,
        /securetoken@system/,
      ];

      for (const file of targets) {
        if (!fs.existsSync(file)) continue;
        const content = fs.readFileSync(file, 'utf8');
        for (const pat of forbiddenPatterns) {
          assert.equal(
            pat.test(content),
            false,
            `Forbidden secret pattern ${pat} found in ${path.relative(ROOT, file)}`
          );
        }
      }

      const viteCfg = fs.readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf8');
      assert.ok(
        viteCfg.includes('sourcemap: false'),
        'vite.config.ts must disable production sourcemaps'
      );
      const mapFiles = collectFiles(path.join(ROOT, 'dist'), ['.map']);
      assert.equal(
        mapFiles.length,
        0,
        `Found exposed sourcemap files in dist/: ${mapFiles.join(', ')}`
      );
    }
  );

  // 3. TRACKING, SESSION PRIVACY & PAYMENT SECURITY
  await runTest(
    'Tracking & Payment Privacy: Zero trackers, session replay, or card storage',
    () => {
      const srcFiles = collectFiles(path.join(ROOT, 'src'), ['.ts', '.tsx']);
      const trackerPatterns = [
        /hotjar/i,
        /fullstory/i,
        /mixpanel/i,
        /logrocket/i,
        /gtag\(/i,
        /creditCardNumber|cardCvv|rawCard/i,
      ];
      for (const file of srcFiles) {
        const content = fs.readFileSync(file, 'utf8');
        for (const pat of trackerPatterns) {
          assert.equal(
            pat.test(content),
            false,
            `Forbidden tracker/card pattern ${pat} found in ${path.relative(ROOT, file)}`
          );
        }
      }
      const defaults = fs.readFileSync(path.join(ROOT, 'src/lib/defaults.ts'), 'utf8');
      assert.ok(
        defaults.includes('optionalAnalytics = false'),
        'Analytics consent must default to false (opt-in)'
      );
    }
  );

  // 4. DOM XSS & UNSAFE SINK CHECKS
  await runTest(
    'Frontend XSS Hardening: Zero unsafe DOM sinks, no blob PDF iframe, strict avatar URLs',
    () => {
      const srcFiles = collectFiles(path.join(ROOT, 'src'), ['.ts', '.tsx']);
      const dangerousSinks = [
        /dangerouslySetInnerHTML/,
        /\.innerHTML\s*=/,
        /\beval\s*\(/,
        /\bnew Function\s*\(/,
        /document\.write\s*\(/,
        /window\.open\s*\(/,
      ];
      for (const file of srcFiles) {
        const content = fs.readFileSync(file, 'utf8');
        for (const pat of dangerousSinks) {
          assert.equal(
            pat.test(content),
            false,
            `Unsafe DOM sink ${pat} found in ${path.relative(ROOT, file)}`
          );
        }
      }
      const modals = fs.readFileSync(path.join(ROOT, 'src/components/Modals.tsx'), 'utf8');
      assert.equal(
        modals.includes('<iframe'),
        false,
        'Modals.tsx must not render untrusted blob: PDF inside same-origin <iframe>'
      );

      assert.equal(isSafeAvatarUrl(''), true);
      assert.equal(isSafeAvatarUrl('https://lh3.googleusercontent.com/a/photo.jpg'), true);
      assert.equal(isSafeAvatarUrl('userA/1700000_abcd_avatar.png'), true);
      assert.equal(isSafeAvatarUrl('http://insecure.example/a.png'), false);
      assert.equal(isSafeAvatarUrl('javascript:alert(1)'), false);
      assert.equal(isSafeAvatarUrl('data:image/svg+xml,<svg/>'), false);
      assert.equal(isSafeAvatarUrl('blob:https://example.com/123'), false);
      assert.equal(isSafeAvatarUrl('../etc/passwd'), false);
    }
  );

  // 5. FILE UPLOAD RESTRICTIONS & HARDENED SVG XSS DEFENSE
  await runTest(
    'File Upload Restrictions: Reject executables, fake magic bytes, SVG XSS bypasses, and >20MB',
    () => {
      const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
      assert.equal(validateUploadBytes('hero.png', 'image/png', pngHeader).ok, true);

      const fakePng = new TextEncoder().encode('<html><script>alert(1)</script></html>');
      assert.equal(validateUploadBytes('evil.png', 'image/png', fakePng).ok, false);

      assert.equal(
        validateUploadBytes('payload.exe', 'application/octet-stream', new Uint8Array([0x4d, 0x5a])).ok,
        false
      );

      const badSvgs = [
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        '<svg onload="alert(1)"><circle r="10"/></svg>',
        '<svg><circle/onload=alert(1)></svg>',
        '<svg><iframe src="https://evil.test"></iframe></svg>',
        '<svg><object data="x"></object></svg>',
        '<svg><a href="&#x6a;avascript:alert(1)"><text>x</text></a></svg>',
        '<svg><style>@import url(https://evil.test);</style></svg>',
      ];
      for (const payload of badSvgs) {
        const bytes = new TextEncoder().encode(payload);
        assert.equal(
          validateUploadBytes('xss.svg', 'image/svg+xml', bytes).ok,
          false,
          `SVG XSS payload must be blocked: ${payload}`
        );
      }

      const safeSvg = new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="8"/></svg>'
      );
      assert.equal(validateUploadBytes('safe.svg', 'image/svg+xml', safeSvg).ok, true);

      assert.equal(
        validateUploadBytes('bad.json', 'application/json', new TextEncoder().encode('{bad')).ok,
        false
      );

      const oversized = new Uint8Array(MAX_UPLOAD_BYTES + 1);
      oversized.set(pngHeader, 0);
      assert.equal(validateUploadBytes('huge.png', 'image/png', oversized).ok, false);
    }
  );

  // 6. AI OUTPUT SANDBOX & STRICT PLAN REQUEST SCHEMA
  await runTest(
    'AI Prompt & Output Sandbox: Reject malformed scene plans and z.unknown() prompt-bombs',
    () => {
      assert.equal(validateScenePlan(null).ok, false);
      assert.equal(validateScenePlan({ planVersion: 99, scenes: [] }).ok, false);

      const strictCheck = PlanRequestSchema.safeParse({
        prompt: 'Create a neon chase',
        projectId: 'proj_123',
        existingContinuity: { maliciousInjection: 'A'.repeat(5000) },
      });
      assert.equal(
        strictCheck.success,
        false,
        'PlanRequestSchema must reject arbitrary untyped existingContinuity objects'
      );

      const badProjectId = PlanRequestSchema.safeParse({
        prompt: 'Create a neon chase',
        projectId: '../../etc/passwd',
      });
      assert.equal(badProjectId.success, false, 'PlanRequestSchema must reject invalid projectId');
    }
  );

  // 7. BOUNDED SLIDING-WINDOW RATE LIMITER & PATH/CORS HELPERS
  await runTest(
    'Rate Limiter & Origin/Path Guards: Enforce bounds, pruning, CORS allowlist, and traversal checks',
    () => {
      const limiter = new SlidingWindowRateLimiter(3);
      assert.equal(limiter.check('k1', 2, 1000, 100).allowed, true);
      assert.equal(limiter.check('k1', 2, 1000, 200).allowed, true);
      const blocked = limiter.check('k1', 2, 1000, 300);
      assert.equal(blocked.allowed, false);
      assert.ok(blocked.retryAfterSec >= 1);
      assert.equal(limiter.check('k1', 2, 1000, 1300).allowed, true);

      limiter.check('k2', 2, 1000, 1400);
      limiter.check('k3', 2, 1000, 1400);
      limiter.check('k4', 2, 1000, 1400);
      assert.ok(limiter.size() <= 3, 'RateLimiter must prune/bound bucket map size');

      const allowed = new Set(['https://vyroxx.example.com']);
      assert.equal(isOriginAllowed(undefined, 'localhost:3000', allowed), true);
      assert.equal(
        isOriginAllowed('https://vyroxx.example.com', 'api.example.com', allowed),
        true
      );
      assert.equal(
        isOriginAllowed('https://preview-123.run.app', 'preview-123.run.app', allowed),
        true
      );
      assert.equal(
        isOriginAllowed('https://evil.attacker.test', 'vyroxx.example.com', allowed),
        false
      );

      const rootDir = path.join(ROOT, '.vyroxx_storage');
      assert.equal(resolveSafeUserFilePath(rootDir, 'userA', '../../package.json'), null);
      assert.equal(resolveSafeUserFilePath(rootDir, '../userA', 'a.png'), null);
      assert.ok(resolveSafeUserFilePath(rootDir, 'userA', 'valid_1.png'));
    }
  );

  // 8. FIRESTORE RULES, PASSWORD-FREE SCHEMA & NO HIDDEN ADMIN ROUTES
  await runTest(
    'Database & Privilege Integrity: Strict Firestore isolation, no plaintext passwords, no hidden admin routes',
    () => {
      const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
      assert.ok(rules.includes('allow read, write: if false;'), 'Default-deny net required');
      assert.ok(
        rules.includes('request.auth.token.email_verified == true'),
        'Email verification required'
      );
      assert.ok(rules.includes('allow list: if false;'), 'Users and usernames listing must be blocked');
      assert.ok(
        rules.includes("!(existing().status in ['completed', 'failed'])"),
        'Terminal generation job lock required'
      );
      assert.ok(
        rules.includes("data.username == ('@' + usernameSlug)"),
        'Username claim must match document slug'
      );
      assert.equal(
        rules.includes('isAdmin'),
        false,
        'No unrequested admin role bypass should exist in rules'
      );

      const blueprint = fs.readFileSync(path.join(ROOT, 'firebase-blueprint.json'), 'utf8');
      assert.equal(
        /passwordHash|plaintextPassword|"password"/i.test(blueprint),
        false,
        'Blueprint must not store password fields'
      );

      const serverSrc = fs.readFileSync(path.join(ROOT, 'server.ts'), 'utf8');
      assert.equal(
        /\/api\/admin|\/admin\b/i.test(serverSrc),
        false,
        'No hidden admin routes in server.ts'
      );
    }
  );

  // 9. END-TO-END TWO-USER EXPRESS HTTP SECURITY TESTS (USER A vs USER B)
  await runTest(
    'E2E Multi-User Express Isolation, Auth, CORS, CSP, Rate Limit & Body Limit Checks',
    async () => {
      const { createVyroxxApiApp } = await import('../server');
      const { publicKey, privateKey } = await generateKeyPair('RS256');
      const publicJwk = await exportJWK(publicKey);
      publicJwk.kid = 'test-key-1';
      publicJwk.alg = 'RS256';
      publicJwk.use = 'sig';

      const jwks = createLocalJWKSet({ keys: [publicJwk] });
      const testStorageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vyroxx-sec-'));
      const testProjectId = 'vyroxx-test-proj';

      const signToken = (sub: string, emailVerified: boolean, expOffsetSec = 3600) =>
        new SignJWT({ email: `${sub}@example.com`, email_verified: emailVerified })
          .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
          .setSubject(sub)
          .setIssuer(`https://securetoken.google.com/${testProjectId}`)
          .setAudience(testProjectId)
          .setIssuedAt()
          .setExpirationTime(Math.floor(Date.now() / 1000) + expOffsetSec)
          .sign(privateKey);

      const tokenUserA = await signToken('user_alpha_001', true);
      const tokenUserB = await signToken('user_beta_002', true);
      const tokenUnverified = await signToken('user_unverified', false);
      const tokenExpired = await signToken('user_expired', true, -60);

      const { app } = createVyroxxApiApp({
        storageRoot: testStorageRoot,
        projectId: testProjectId,
        jwks,
        allowedOrigins: new Set(['https://vyroxx.example.com']),
        isProd: true,
        ipRateLimitMax: 25,
      });

      const server = app.listen(0, '127.0.0.1');
      try {
        await new Promise<void>((resolve) => server.once('listening', () => resolve()));
        const port = (server.address() as AddressInfo).port;
        const base = `http://127.0.0.1:${port}`;

        // A. Production CSP & HSTS headers
        const healthRes = await fetch(`${base}/api/health`);
        assert.equal(healthRes.status, 200);
        const csp = healthRes.headers.get('content-security-policy') || '';
        assert.ok(csp.includes("script-src 'self'"), 'Prod CSP must restrict script-src to self');
        assert.equal(
          csp.includes("script-src 'self' 'unsafe-inline'"),
          false,
          'Prod CSP script-src must not allow unsafe-inline'
        );
        assert.ok(csp.includes("object-src 'none'"));
        assert.ok(csp.includes('frame-ancestors'));
        assert.ok(healthRes.headers.get('strict-transport-security'));
        assert.equal(healthRes.headers.get('x-powered-by'), null);

        // B. CORS untrusted origin rejected with 403; trusted origin allowed on OPTIONS
        const badCorsRes = await fetch(`${base}/api/health`, {
          headers: { Origin: 'https://evil.attacker.test' },
        });
        assert.equal(badCorsRes.status, 403);
        assert.equal(badCorsRes.headers.get('access-control-allow-origin'), null);

        const goodPreflight = await fetch(`${base}/api/ai/plan-scene`, {
          method: 'OPTIONS',
          headers: { Origin: 'https://vyroxx.example.com' },
        });
        assert.equal(goodPreflight.status, 204);
        assert.equal(
          goodPreflight.headers.get('access-control-allow-origin'),
          'https://vyroxx.example.com'
        );

        // C. Expired and unverified tokens rejected
        const expRes = await fetch(`${base}/api/account/storage`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${tokenExpired}` },
        });
        assert.equal(expRes.status, 401);

        const unverifiedRes = await fetch(`${base}/api/account/storage`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${tokenUnverified}` },
        });
        assert.equal(unverifiedRes.status, 403);

        // D. 256KB body limit & strict schema enforcement on /api/ai/plan-scene
        const oversizedAiRes = await fetch(`${base}/api/ai/plan-scene`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenUserA}`,
          },
          body: JSON.stringify({
            prompt: 'A'.repeat(300_000),
            projectId: 'proj_1',
          }),
        });
        assert.equal(oversizedAiRes.status, 413, 'Oversized AI payload must return 413');

        const promptBombRes = await fetch(`${base}/api/ai/plan-scene`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenUserA}`,
          },
          body: JSON.stringify({
            prompt: 'Make a sunset scene',
            projectId: 'proj_1',
            existingContinuity: { unexpectedField: 'inject' },
          }),
        });
        assert.equal(promptBombRes.status, 400, 'Malformed continuity schema must return 400');

        // E. Two-user cross-tenant file isolation (User A uploads, User B blocked from GET & DELETE)
        const pngBytes = Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        ]);
        const upA = await fetch(`${base}/api/assets/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenUserA}`,
          },
          body: JSON.stringify({
            fileName: 'secret_a.png',
            mimeType: 'image/png',
            base64Data: pngBytes.toString('base64'),
          }),
        });
        assert.equal(upA.status, 200);
        const upAData = (await upA.json()) as { storagePath: string };
        assert.ok(upAData.storagePath.startsWith('user_alpha_001/'));

        const upB = await fetch(`${base}/api/assets/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenUserB}`,
          },
          body: JSON.stringify({
            fileName: 'secret_b.png',
            mimeType: 'image/png',
            base64Data: pngBytes.toString('base64'),
          }),
        });
        assert.equal(upB.status, 200);
        const upBData = (await upB.json()) as { storagePath: string };

        // User A can read own asset with sandbox CSP
        const getA = await fetch(`${base}/api/assets/file/${upAData.storagePath}`, {
          headers: { Authorization: `Bearer ${tokenUserA}` },
        });
        assert.equal(getA.status, 200);
        assert.equal(
          getA.headers.get('content-security-policy'),
          "default-src 'none'; sandbox"
        );
        assert.equal(getA.headers.get('cache-control'), 'private, no-store');

        // User B CANNOT read or delete User A's asset (403)
        const crossGet = await fetch(`${base}/api/assets/file/${upAData.storagePath}`, {
          headers: { Authorization: `Bearer ${tokenUserB}` },
        });
        assert.equal(crossGet.status, 403, 'User B reading User A asset must return 403');

        const crossDel = await fetch(`${base}/api/assets/file/${upAData.storagePath}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${tokenUserB}` },
        });
        assert.equal(crossDel.status, 403, 'User B deleting User A asset must return 403');

        // User A wiping own account storage leaves User B's asset untouched
        const wipeA = await fetch(`${base}/api/account/storage`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${tokenUserA}` },
        });
        assert.equal(wipeA.status, 200);

        const getAAfterWipe = await fetch(`${base}/api/assets/file/${upAData.storagePath}`, {
          headers: { Authorization: `Bearer ${tokenUserA}` },
        });
        assert.equal(getAAfterWipe.status, 404);

        const getBAfterWipeA = await fetch(`${base}/api/assets/file/${upBData.storagePath}`, {
          headers: { Authorization: `Bearer ${tokenUserB}` },
        });
        assert.equal(getBAfterWipeA.status, 200, 'User B asset must remain intact after User A wipes storage');

        // F. Rate limit (429) enforcement after exceeding ipRateLimitMax (25)
        let saw429 = false;
        for (let i = 0; i < 20; i++) {
          const r = await fetch(`${base}/api/health`);
          if (r.status === 429) {
            saw429 = true;
            assert.ok(r.headers.get('retry-after'));
            break;
          }
        }
        assert.equal(saw429, true, 'Pre-auth IP rate limiter must return 429 once limit exceeded');
      } finally {
        server.close();
        fs.rmSync(testStorageRoot, { recursive: true, force: true });
      }
    }
  );

  // 10. LIVE SERVER PORT 3000 HTTP VERIFICATION
  let liveReachable = false;
  try {
    const h = await fetch(`${LIVE_URL}/api/health`);
    liveReachable = h.ok;
  } catch {
    liveReachable = false;
  }

  if (liveReachable) {
    await runTest(
      'Live Server Unauthorized Access: Protected endpoints reject missing Bearer token with 401',
      async () => {
        const endpoints: { method: string; path: string; body?: unknown }[] = [
          {
            method: 'POST',
            path: '/api/ai/plan-scene',
            body: { prompt: 'test', projectId: 'p1' },
          },
          {
            method: 'POST',
            path: '/api/assets/upload',
            body: { fileName: 'a.txt', mimeType: 'text/plain', base64Data: 'QQ==' },
          },
          { method: 'GET', path: '/api/assets/file/otherUser123/secret.png' },
          { method: 'DELETE', path: '/api/assets/file/otherUser123/secret.png' },
          { method: 'DELETE', path: '/api/account/storage' },
        ];
        for (const ep of endpoints) {
          const res = await fetch(`${LIVE_URL}${ep.path}`, {
            method: ep.method,
            headers: ep.body ? { 'Content-Type': 'application/json' } : undefined,
            body: ep.body ? JSON.stringify(ep.body) : undefined,
          });
          assert.equal(
            res.status,
            401,
            `${ep.method} ${ep.path} expected 401, got ${res.status}`
          );
        }
      }
    );

    await runTest(
      'Live Server Auth Bypass: Forged unsigned JWT (alg: none) rejected with 401',
      async () => {
        const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
          'base64url'
        );
        const payload = Buffer.from(
          JSON.stringify({
            sub: 'victim_uid',
            email_verified: true,
            aud: 'vocal-victory-qkx2q',
            iss: 'https://securetoken.google.com/vocal-victory-qkx2q',
            exp: Math.floor(Date.now() / 1000) + 3600,
          })
        ).toString('base64url');
        const forgedJwt = `${header}.${payload}.`;

        const res = await fetch(`${LIVE_URL}/api/ai/plan-scene`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${forgedJwt}`,
          },
          body: JSON.stringify({ prompt: 'test', projectId: 'proj_1' }),
        });
        assert.equal(res.status, 401, `Forged JWT should return 401, got ${res.status}`);
      }
    );

    await runTest(
      'Live Server Security Headers, CORS & Path Traversal Protection',
      async () => {
        const res = await fetch(`${LIVE_URL}/api/assets/file/userA/..%2F..%2Fpackage.json`);
        assert.equal(res.status, 401, 'Unauthenticated path traversal blocked');
        assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
        assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
        assert.equal(
          res.headers.get('cross-origin-opener-policy'),
          'same-origin-allow-popups'
        );
        assert.ok(res.headers.get('content-security-policy')?.includes('frame-ancestors'));
        assert.equal(res.headers.get('x-powered-by'), null);

        const badOrigin = await fetch(`${LIVE_URL}/api/health`, {
          headers: { Origin: 'https://evil.attacker.test' },
        });
        assert.equal(badOrigin.status, 403, 'Untrusted CORS origin must be rejected');
      }
    );
  } else {
    console.log('INFO: Live server not reachable on port 3000; skipping live HTTP checks.');
  }

  console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
