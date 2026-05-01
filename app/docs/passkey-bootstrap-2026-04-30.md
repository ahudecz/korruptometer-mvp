# Bootstrap-admin passkey enrolment — 2026-04-30

Launch-gate T130. Verifies the bootstrap admin can register a WebAuthn
passkey and that admin-gated routes refuse access without a fresh ≤30-min
assertion (FR-041, SC-018).

## Status

`PENDING` — must be exercised on staging before spec-Phase-2 ships.

## Procedure

1. **Set** `BOOTSTRAP_ADMIN_EMAIL` to the editor-in-chief's email in
   Vercel preview secrets.
2. **Deploy** the preview branch. The seed runs on first request and
   upserts the editor row.
3. **Sign in** at `/admin/login` via magic link. The middleware allows
   the session.
4. **Enrol** a passkey at `/admin/security/passkey`:
   * The page calls `navigator.credentials.create({ publicKey: ... })` with
     `userVerification: 'required'`.
   * The credential ID + publicKey are persisted via
     `POST /api/admin/webauthn/register`.
5. **Step-up assertion**: navigate to `/admin/editors`. The middleware
   redirects to a passkey assertion modal. Tap the YubiKey / phone
   passkey. The middleware sets a fresh-assertion cookie valid 30 min.
6. **Time-out test**: wait 31 min, navigate to `/admin/editors` again.
   Confirm the middleware rejects with 401 and prompts re-assertion.

## Evidence

| Field | Value |
|-------|-------|
| Admin email | _to be recorded_ |
| Credential ID | _to be recorded_ (sha256 only — never the raw value) |
| First assertion timestamp | _to be recorded_ |
| 30-min timeout enforced | _PASS / FAIL_ |
| Operator | _to be recorded_ |
| Notes | |

## Recurrence

Re-rehearse after any change to the WebAuthn server code or the middleware
gating. Annual rehearsal otherwise.
