/**
 * Egyetlen forrás arra, hogy mi számít LLM-placeholder névnek.
 *
 * 2026-07-14 — egy séma szerint kötelező név-mező nem attól valódi, hogy
 * nem üres: ha a forrás-részlet túl homályos, az LLM improvizál egy
 * helykitöltőt ("<UNKNOWN>", "ismeretlen" stb.), ami átmegy a puszta
 * truthiness-ellenőrzésen, és valódi adatként kerül be.
 *
 * Eredetileg a `packages/db/src/detection-check.ts`-ben élt (onnan
 * re-exportáljuk, hogy a meglévő importok ne törjenek), de az a modul
 * `drizzle-orm`-ot húz be — egy kliens komponens nem importálhatja. Mivel a
 * megjelenítés-oldali utolsó védőháló (ComplaintList.tsx) is ugyanezt a
 * definíciót kell hogy használja, függőség nélküli csomagba került. Ha
 * bővül a lista, ITT bővüljön — a detektor-guard és a render-guard nem
 * csúszhat szét (l. project-detector-drift-pattern az asszisztens
 * memóriájában).
 */
export function isPlaceholderName(value: string | null | undefined): boolean {
  if (value == null) return true;
  const v = value.trim().toLowerCase().replace(/^<|>$/g, '');
  return v === '' || v === 'unknown' || v === 'ismeretlen' || v === 'n/a' || v === 'null' || v === 'undefined';
}
