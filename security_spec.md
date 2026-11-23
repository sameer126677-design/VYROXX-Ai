# VYROXX Security & Privacy Verification Specification

## 1. Data & Access Invariants
1. **Strict Ownership Isolation**: Every document under `/users/{userId}` and its subcollections (`projects`, `chats`, `assets`, `generationJobs`) may only be read, created, updated, or deleted when `request.auth != null`, `request.auth.uid == userId`, and `request.auth.token.email_verified == true`.
2. **Age & Child Safety Gate**: Creating `/users/{userId}` requires `ageConfirmed18Plus == true` and `emailVerified == true` without collecting date-of-birth fields. Both email/password signup and first-time Google sign-in enforce explicit 18+ eligibility & consent gating before creating a Firestore profile.
3. **Identity Integrity**: Every document created or updated under `/users/{userId}/...` must embed `userId == request.auth.uid` (or `uid == request.auth.uid` for `/users/{userId}`), and ownership/timestamp fields (`uid`, `userId`, `createdAt`) are immutable after creation.
4. **Server Timestamp Enforcement**: All `createdAt` on create and `updatedAt` on create/update must equal `request.time`.
5. **No Unbounded Arrays or Oversized Strings**: All string fields have explicit `.size()` upper bounds, `preferences` map keys are bounded (`<= 30`), `privacyConsent` conforms strictly to `isValidPrivacyConsent`, and message/version arrays in `chats` are capped (`<= 100` / `<= 50`) to prevent Denial-of-Wallet resource exhaustion.
6. **Username Uniqueness**: `/usernames/{usernameSlug}` requires `isVerified()` on `get`, prohibits `list` operations (preventing user enumeration), and enforces `uid == request.auth.uid` and `username == '@' + usernameSlug` on writes.
7. **Terminal Job Locking**: Once a `generationJobs/{jobId}` reaches `'completed'` or `'failed'`, subsequent client updates are blocked.
8. **Backend Secret & Upload Isolation**: `CODECRAFT_API_KEY` stays strictly server-side; all protected `/api/*` endpoints verify Firebase ID tokens against Google JWKS (`iss`, `aud`, `exp`, `email_verified === true`), enforce `authedUid === uid` on binary asset routes, and verify file extensions, MIME alignment, magic-byte signatures, and SVG XSS sanitization.

## 2. Adversarial Security Test Matrix (Must All Be Blocked / Enforced)
1. Unauthenticated access to `/api/ai/plan-scene`, `/api/assets/upload`, `/api/assets/file/:uid/:file`, `/api/account/storage` -> HTTP 401.
2. Forged/unsigned/tampered JWT authentication bypass attempt -> HTTP 401.
3. Unverified email user (`email_verified: false`) attempting API or Firestore operations -> HTTP 403 / PERMISSION_DENIED.
4. Authenticated User B attempting cross-user asset access or path traversal (`/api/assets/file/userA/..%2F...`) -> HTTP 400 / 403.
5. Client bundle (`src/`, `index.html`, `dist/`) secret & tracker scan -> zero `CODECRAFT_API_KEY`, private keys, or session-replay/keylogger trackers.
6. Spoofed file upload (HTML/JS disguised as `.png`, SVG with `<script>`/`onload=`, unsupported `.exe`, oversized >20MB) -> rejected by `validateUploadBytes`.
7. Unauthenticated or cross-user read/list of `/users/{userId}/projects` -> PERMISSION_DENIED.
8. Creating `/users/{userId}` with `ageConfirmed18Plus: false` or `emailVerified: false` -> PERMISSION_DENIED.
9. Shadow-field injection (`isAdmin: true`) or `preferences` bloat on `/users/{userId}` -> PERMISSION_DENIED.
10. Modifying immutable `createdAt`, `uid`, `userId`, or terminal `generationJobs` (`completed` / `failed`) -> PERMISSION_DENIED.
11. Listing `/usernames` or spoofing `username` mismatch inside `/usernames/{slug}` -> PERMISSION_DENIED.
12. Complete account deletion & storage wipe (`deleteAccountServerStorage` + `deleteAllUserFirestoreData` + `deleteUser`) -> removes user directory and all Firestore subcollections without affecting other users.
