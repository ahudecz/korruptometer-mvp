/**
 * A hírlevél EGYETLEN kapcsolója.
 *
 * 2026-09-22, user: „a hírlevelet állítsd le, zéró feliratkozó van, az most
 * nem kell még. majd szólok, ha menjen."
 *
 * Amíg ez `true`:
 *  - a feliratkozó űrlap egyik belépési pontján sem jelenik meg (nyitóoldal,
 *    /hirlevel, kvíz-oldalak) — senki nem iratkozhat fel egy álló rendszerbe;
 *  - a /hirlevel oldal MEGMARAD (a lábléc-link és a levelekben lévő
 *    leiratkozó/megerősítő linkek nem törhetnek el), csak a szünetelést írja ki.
 *
 * A KÜLDÉST nem ez állítja le, hanem két, egymástól független fék:
 *  1. a .github/workflows/subscriptions.yml ütemezései ki vannak kapcsolva;
 *  2. a RESEND_API_KEY hiánya (l. digest-send.ts, subscriber-confirm-send.ts) —
 *     ezt a Vercel env-ben kell kivenni, kódból nem érhető el.
 *
 * Visszakapcsoláskor: ezt `false`-ra, az ütemezéseket vissza a workflow-ban,
 * és a RESEND_API_KEY vissza a Vercelre.
 */
export const NEWSLETTER_PAUSED = true;
