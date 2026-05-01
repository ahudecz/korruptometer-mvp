# DSR runbook (data subject requests)

Phase 2 ships the manual mailbox; Phase 3 (US 14) layers the `/admin/dsr` queue
on top so every transition is audit-logged. This runbook documents both paths.

## Intake

Inbound channel: `dpo@korruptometer.hu`. Auto-replies to every message with a
template that explains the 30-day SLA and asks for identity verification
material.

When a request arrives:

1. Open `/admin/dsr` and click **Új DSR**.
2. Choose `kind = access` or `kind = deletion`.
3. Paste the requestor's email — the form hashes it (`subjectEmailHash`) so
   the queue never stores the plaintext address.
4. Notes field captures the verification trail.

## Identity verification

For both `access` and `deletion`:

* Ask the requestor to reply from the same email **and** confirm one piece of
  data we are likely to have (a `KM-NEW-XXXXXX` reference if they submitted a
  tip, or a redacted document the editor shared with them).
* If we hold no PII for that subject — verify by signed reply only and
  proceed to fulfillment.
* If we cannot verify within 14 days, mark the DSR `closed` with
  `notes = "could not verify, no action taken"` and reply.

## Fulfillment templates

### Access

```
Tisztelt [név],

Adatkezelési áttekintés iránti kérésére az alábbiakat válaszoljuk:

– Tárolt adatok: [reporter email-hash, alkalmazott PII-mezők], plus any
  Submission rows where reporterEmailEnc decrypts to the requestor's email.
– Hozzáférés-naplók: az utolsó 7 napra terjedően a Vercel/Better Stack
  hozzáférési naplók tartalmazhatnak forgalmi adatot a fiókhoz kapcsolódóan.
– Megőrzés: jóváhagyott bejelentések PII oszlopai a jóváhagyástól számított
  30 napig megmaradnak, utána automatikus törlés.

Ha bármelyik adat hibás vagy törölni szeretné, válaszoljon erre a levélre.
```

### Deletion

```
Tisztelt [név],

Törlési kérelmét regisztráltuk. Az alábbi 24–72 órán belül:

– A megfelelő Submission rekordokon `purgePiiAt = now()` állítódik, így a
  következő `gdpr.retention-sweep` futás (naponta) a PII oszlopokat NULL-ra
  állítja.
– A `pii.read` audit-rekordok 24 hónapig megmaradnak FR-054 értelmében; ezek
  nem tartalmaznak PII-t, csak a hozzáférés tényét.
– Vercel / Better Stack hozzáférési naplókat a 7 napos rolling törlés
  rendezi, külön beavatkozás nincs.

Visszaigazolást a törlés befejezésekor küldünk.
```

## Audit-log entries

Every queue transition writes a row to `AuditLog`:

| Action | When |
|--------|------|
| `dsr.received` | POST `/api/admin/dsr` |
| `dsr.verified` | PATCH `status='verified'` |
| `dsr.fulfilled` | PATCH `status='fulfilled'` |
| `dsr.closed` | PATCH `status='closed'` |

`actorEditorId`, `entityId = DsrRequest.id`, `detail = { kind, slaDeadline }`.

## SLA

30 days from `received`. The queue UI shows a countdown badge. If a DSR is
within 5 days of breach, the badge turns red and the editor channel posts a
ping every 24h.

## Source of truth

`app/apps/web/app/api/admin/dsr/route.ts` and `app/apps/web/app/admin/(authed)/dsr/`
implement the queue; `app/packages/db/src/schema.ts` (`dsrRequests`) holds
the rows. This document is the operational layer on top of those.
