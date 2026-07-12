# Tasks: Telegram jóváhagyó bot a detekciós review-hoz

**Input**: Design documents from `/specs/008-telegram-review-bot/`
**Prerequisites**: plan.md, spec.md

**Tests**: A `packages/db` meglévő vitest-keretével — a callback-parse és a
secret-header-ellenőrzés unit-tesztelhető; a tényleges force-insert ág
integrációs teszt (meglévő detektor-teszt minta).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: párhuzamosítható (külön fájl, nincs függőség)
- **[Story]**: melyik user story-hoz tartozik (US1–US2)

---

## Phase 1: Foundational (Blocking Prerequisites)

- [ ] T001 `apps/web/src/lib/telegram.ts` (új): `sendTelegramMessage(text,
      replyMarkup?)`, `answerCallbackQuery(callbackQueryId, text?)`,
      `editMessageReplyMarkup(chatId, messageId, markup?)` — Telegram Bot
      API wrapperek natív `fetch`-csel
- [ ] T002 `apps/web/src/lib/notify.ts`: `ReviewNeededEvent` bővítése
      `articleId: string` és `recordId?: string` mezőkkel; inline
      `reply_markup` építése (cikk-link gomb + Jóváhagyom/Elutasítom
      callback gombok, `{action}:{detectorKód}:{id}` formátum) és átadása
      `sendTelegramMessage`-nek

---

## Phase 2: User Story 1 - Gombos jóváhagyás/elutasítás (Priority: P1) 🎯 MVP

- [ ] T003 [US1] A 4 detektor-fájl (`detect-resignations.ts`,
      `detect-media-closures.ts`, `detect-verdicts.ts`,
      `detect-asset-recoveries.ts`) `notifyReviewNeeded()` hívásainak
      bővítése `articleId: article.id`-vel; a `pending` ágak `insert(...)`
      hívásának cseréje `.returning({ id: ... })`-ra, hogy `recordId`
      elérhető legyen
- [ ] T004 [US1] `apps/web/app/api/telegram/webhook/route.ts` (új): POST
      handler, `X-Telegram-Bot-Api-Secret-Token` header ellenőrzés
      (`TELEGRAM_WEBHOOK_SECRET` env var ellen, eltérés → 401, semmi más)
- [ ] T005 [US1] Callback-data parse (`{action}:{detectorKód}:{id}` →
      `{action, detectorType, id}`) + detektor-kód → `DetectorType` map
- [ ] T006 [US1] "Approve, pending" ág: `id`-t megkeresi a 3
      `reviewStatus`-os táblában (`politicalResignations`/
      `mediaClosures`/`courtVerdicts`) — ha talál `pending` sort, `UPDATE
      reviewStatus='approved'` + a meglévő `revalidatePath`-ek
      (`apps/web/app/api/admin/review/route.ts` mintája)
- [ ] T007 [US1] "Approve, near_miss" ág (mind a 4 detektorra): `id`
      (=articleId) alapján `NewsArticle` betöltés → a megfelelő
      `detect*FromArticle(headline, excerpt, todayIso)` újrahívása → a
      detektor-fájlból átemelt beszúrás-blokk (dedup / missing-fields /
      missing-source ellenőrzésekkel, konfidencia-kapu kihagyva) →
      explicit `UPDATE "DetectionCheck" SET outcome='inserted',
      reason=NULL` (NEM `markChecked()`, lásd plan.md Phase 0)
- [ ] T008 [US1] "Reject" ág: pending esetén `reviewStatus='rejected'`
      UPDATE + revalidate; near_miss esetén nincs DB-írás
- [ ] T009 [US1] Minden ág végén `answerCallbackQuery` +
      `editMessageReplyMarkup` (gombok eltávolítása, záró szöveg)
- [ ] T010 [P] [US1] Unit tesztek: callback-data parse edge case-ek
      (ismeretlen detektor-kód, hiányzó szegmens); secret-header
      hiány/hibás érték → 401 és 0 DB-hívás

**Checkpoint**: egy valódi Telegram-üzenet mindkét gombja ténylegesen
módosítja az adatbázist.

---

## Phase 3: User Story 2 - Kereszt-kategória auto-frissítés (Priority: P2)

- [ ] T011 [US2] Sikeres "approve" ág (T006 vagy T007) után: lekérdezi,
      a másik 3 detektor-típusnak van-e MÁR `DetectionCheck` sora erre az
      `articleId`-ra
- [ ] T012 [US2] Minden hiányzó detektor-típusra lefuttatja ANNAK a
      detektornak a saját kinyerő+beszúró logikáját (ugyanaz a mintázat,
      mint T007, de a NORMÁL küszöb-logikával — `decideStatus`/
      `CONFIDENCE_FLOOR` a helyén marad, nincs kihagyva)
- [ ] T013 [US2] Minden kereszt-kategória eredmény (auto-beszúrt /
      pending / eldobott) a normál `notifyReviewNeeded`/`markChecked`
      csatornán megy — auto-beszúrásnál is küld egy tájékoztató
      Telegram-üzenetet, pending esetén a normál gombos üzenetet
- [ ] T014 [US2] Integrációs teszt: egy két kategóriát érintő teszt-cikk
      jóváhagyása mindkét releváns táblában létrehoz sort

**Checkpoint**: egy két témát érintő cikk jóváhagyása után mindkét
kategóriában megjelenik a bejegyzés, kézi utómunka nélkül.

---

## Phase 4: Regisztráció és élesítés

- [ ] T015 `TELEGRAM_WEBHOOK_SECRET` generálása, hozzáadása
      `.env.local`-hoz és Vercel production env-hez (user jóváhagyásával)
- [ ] T016 Deploy után egyszeri `setWebhook` hívás (`curl`, nem kódrész) a
      `secret_token` paraméterrel
- [ ] T017 Élő teszt: valódi (vagy mesterségesen alacsony küszöbre
      állított) találat teljes körön át — Telegram-üzenet → gombnyomás →
      adatbázis-változás → publikus oldal frissül
