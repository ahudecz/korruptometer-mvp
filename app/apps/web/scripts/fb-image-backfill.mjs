// Egyszeri: a SocialPost sorokban lévő fbcdn-képeket átmásolja a saját
// Supabase Storage-unkba, és a sorokat a tartós URL-re írja át.
//
// MIÉRT: az fbcdn-linkek alá vannak írva és lejárnak — a régi (Apify-os és
// az első saját) futások képei előbb-utóbb 404-re váltanának a nyitóoldali
// feeden, a /legfontosabb-hangok oldalon és a Dicsőségfal-profilokon.
//
// Idempotens: a már átmásolt (supabase.co/storage/...) sorokat kihagyja,
// tehát bármikor újrafuttatható.

const FBBOT = 'facebookexternalhit/1.1';
const BUCKET = 'social-images';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN === '1';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Hiányzik a Supabase URL vagy a service role kulcs.');
  process.exit(1);
}

const auth = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

async function main() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/SocialPost?select=id,imageUrl,postUrl&imageUrl=not.is.null&limit=2000`,
    { headers: auth },
  );
  const rows = await res.json();
  const todo = rows.filter(
    (r) => r.imageUrl && !r.imageUrl.includes('/storage/v1/object/public/'),
  );
  console.log(`${rows.length} képes sor, ebből ${todo.length} külső (lejáró) linken.`);

  let ok = 0;
  let fail = 0;

  for (const row of todo) {
    // Fájlnév a poszt azonosítójából — így újrafuttatásnál felülírja magát.
    const m = String(row.postUrl ?? '').match(/(pfbid[0-9A-Za-z]+|\d{10,})/);
    const shortId = (m ? m[1] : row.id).slice(-24);
    const name = `fb-${shortId}.jpg`;

    if (DRY_RUN) {
      console.log(`  [DRY] ${name} ← ${row.imageUrl.slice(0, 70)}…`);
      ok += 1;
      continue;
    }

    try {
      const img = await fetch(row.imageUrl, {
        headers: { 'User-Agent': FBBOT },
        signal: AbortSignal.timeout(45_000),
      });
      if (!img.ok) throw new Error(`letöltés ${img.status}`);
      const buf = Buffer.from(await img.arrayBuffer());
      if (buf.byteLength < 8000) throw new Error('túl kicsi (placeholder)');

      const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${name}`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
        body: buf,
        signal: AbortSignal.timeout(60_000),
      });
      if (!up.ok) throw new Error(`feltöltés ${up.status}: ${(await up.text()).slice(0, 90)}`);

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${name}`;
      const patch = await fetch(`${SUPABASE_URL}/rest/v1/SocialPost?id=eq.${row.id}`, {
        method: 'PATCH',
        headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ imageUrl: publicUrl }),
      });
      if (!patch.ok) throw new Error(`DB-frissítés ${patch.status}`);
      ok += 1;
      if (ok % 20 === 0) console.log(`  … ${ok} kész`);
    } catch (e) {
      fail += 1;
      console.log(`  kihagyva (${e.message}): ${row.imageUrl.slice(0, 60)}…`);
    }
  }

  console.log(`\nKÉSZ — ${ok} átmásolva, ${fail} sikertelen.${DRY_RUN ? ' (DRY RUN)' : ''}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
