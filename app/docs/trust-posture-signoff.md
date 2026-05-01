# Trust-posture sign-off

The text rendered on `/bejelentes` (`app/apps/web/app/bejelentes/trust-copy.tsx`)
is editorially gated. This document captures the sign-off for each version.

## Phase 2 (truthful, modest)

```
A bejelentésed a szerkesztőséghez kerül titkosítva, csak ők férnek hozzá az
adatbázisban. Az IP-címedet az adatbázisban nem tároljuk; CDN- és
platformszintű hozzáférési naplók ideiglenesen rögzíthetik, ezeket
legfeljebb 7 napig őrizzük. Súlyosan bizalmas anyagokhoz használj
Tor-böngészőt.
```

| Field | Value |
|-------|-------|
| Active when | `SUBMISSIONS_SEALED_BOX_ENABLED = false` (default) |
| Last reviewed | 2026-04-30 (launch-gate T128) |
| Editorial sign-off | _pending — editor-in-chief countersigns at launch_ |
| Snapshot test | `app/apps/web/tests/e2e/submission-form-copy.spec.ts` |

## Phase 4 (strong promise)

```
Beérkezésed végpont-titkosítva tároljuk és csak a szerkesztőség férhet
hozzá. Az IP-címedet az adatbázisban nem tároljuk; CDN- és platformszintű
hozzáférési naplók ideiglenesen rögzíthetik, ezeket legfeljebb 7 napig
őrizzük. Súlyosan bizalmas anyagokhoz használj Tor-böngészőt.
```

| Field | Value |
|-------|-------|
| Active when | `SUBMISSIONS_SEALED_BOX_ENABLED = true` |
| Ships in | the same release as `0009_submissions_sealed_box_columns.sql` and the rotation infra |
| Editorial sign-off | _pending — editor-in-chief countersigns at Phase 4 launch_ |
| Snapshot test | `app/apps/web/tests/e2e/submission-form-copy.spec.ts` (flag-aware, T213) |

## Why two versions

Phase 2 ships a server-held key — a server compromise reveals plaintext.
The honest claim is "csak a szerkesztőség férhet hozzá" with no
end-to-end-encryption claim.

Phase 4 ships sealed-box: the application server has no key material.
The honest claim is "Beérkezésed végpont-titkosítva tároljuk".

We never ship the strong promise before the schema migration that backs it.

## Sign-off record

Append a row each time either version of the copy is changed in production
(via flag flip, deploy with new copy, or any edit to `trust-copy.tsx`):

| Date | Active version | Approver | Notes |
|------|----------------|----------|-------|
| (placeholder) | | | |
