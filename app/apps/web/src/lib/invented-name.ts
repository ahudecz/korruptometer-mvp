import 'server-only';
import { looksLikePersonName, nameTokensMissingFromText } from '@korr/db';
import { fetchArticleBodyTransient } from '@korr/scrapers';

/**
 * 2026-11-06 — TILTÓLISTÁS szabály (Ókovács-eset, user döntése): a modell
 * által kitalált névtag SOSE kerül ki, és jóváhagyásra sem ajánljuk fel.
 *
 * Egy névtag akkor „kitalált", ha sem a modellnek adott szövegben (cím +
 * kivonat / törzs), sem a cikk teljes, élőben lekért törzsében nem szerepel.
 * A teljes törzs azért kell, mert a rövid kivonat gyakran nem írja ki a
 * nevet, a modell pedig helyesen tudja (Börcsök András, KNBSZ) — ezt a cikk
 * maga igazolja. Ókovács István viszont sehol nincs a 444 cikkében.
 *
 * A törzs csak memóriában él, sosem kerül DB-be (constitution IV). Ha a
 * lekérés nem sikerül, a hiány marad → eldobás (fail-closed, a user
 * szabálya szerint: amit nem tudunk igazolni, az nem megy ki).
 *
 * Csak személynévre fut (looksLikePersonName); több személyes mezőnél
 * („X és Y", „X, Y") tagonként. Ügy-címkét és intézménynevet nem néz.
 *
 * Visszaadja az első hibás nevet és a hiányzó tagjait, vagy null-t.
 */
export async function findInventedName(
  names: Array<string | null | undefined>,
  seenText: string,
  sourceUrl: string | null | undefined,
): Promise<{ name: string; missing: string[] } | null> {
  const persons = names
    .flatMap((n) => (n ?? '').split(/\s*(?:,|;|\bés\b)\s*/))
    .map((n) => n.trim())
    .filter((n) => looksLikePersonName(n));
  const suspicious = persons
    .map((name) => ({ name, missing: nameTokensMissingFromText(name, seenText) }))
    .filter((x) => x.missing.length > 0);
  if (suspicious.length === 0) return null;

  const body = sourceUrl ? await fetchArticleBodyTransient(sourceUrl).catch(() => null) : null;
  const full = body ? `${seenText}\n${body}` : seenText;
  for (const s of suspicious) {
    const missing = nameTokensMissingFromText(s.name, full);
    if (missing.length > 0) return { name: s.name, missing };
  }
  return null;
}
