import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { UGYEK } from './ugyek-config';
import { GALERIA, type GaleriaDetention, type GaleriaHair } from './galeria-config';
import { WATCH_LIST } from './watchlist-config';
import { getFeaturedPeople, getTotalDamage } from './featured-persons';
import { FtValue } from './ft-value';
import { Mugshot } from '@korr/ui/mugshot';

const HU_MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
function fmtDate(d: Date) {
  return `${HU_MONTHS[d.getMonth()]} ${d.getDate()}.`;
}

// ── CrossMegszunt ────────────────────────────────────────────────────────────

function closureTypeLabel(t: string) {
  if (t === 'megszűnés') return 'Megszűnt';
  if (t === 'leépítés') return 'Leépítés';
  if (t === 'elmaradt esemény') return 'Elmaradt';
  return t;
}
function closureTypeColor(t: string) {
  if (t === 'megszűnés') return '#e31937';
  if (t === 'leépítés') return '#e8a000';
  return '#4B7AFF';
}

// Kézzel kiemelt, legjelentősebb megszűnések — mindig ebben a sorrendben a
// lista tetején, a többi utánuk dátum szerint. Case-insensitive substring
// match a `name` mezőn.
const FEATURED_CLOSURES = ['szuverenitásvédelmi', 'mtva propaganda', 'mandiner', 'origo', 'megafon'];

function featuredRank(name: string): number {
  const n = name.toLowerCase();
  const i = FEATURED_CLOSURES.findIndex((f) => n.includes(f));
  return i === -1 ? FEATURED_CLOSURES.length : i;
}

export async function CrossMegszunt() {
  const db = getDb();
  const rows = (
    await db
      .select()
      .from(schema.mediaClosures)
      .orderBy(desc(schema.mediaClosures.eventDate))
      .limit(30)
  )
    .sort((a, b) => featuredRank(a.name) - featuredRank(b.name) || +b.eventDate - +a.eventDate)
    .slice(0, 10);

  if (rows.length === 0) return null;

  return (
    <div className="cross-promo">
      <h2 className="cross-promo-title">Érdekelnek a megszűnések is?</h2>
      <p className="cross-promo-deck">
        NER-közeli médiumok, műsorok és rendezvények, amelyek 2026. április 12. óta megszűntek vagy leépültek.
      </p>
      <div className="cross-promo-rows">
        {rows.map(r => (
          <div key={r.id} className="cross-promo-row">
            <span className="cross-promo-row-date">{fmtDate(r.eventDate)}</span>
            <span
              className="cross-promo-row-type"
              style={{ background: `${closureTypeColor(r.eventType)}30`, color: closureTypeColor(r.eventType) }}
            >
              {closureTypeLabel(r.eventType)}
            </span>
            <span className="cross-promo-row-name">{r.name}</span>
          </div>
        ))}
      </div>
      <Link href="/megszunt" className="cross-promo-cta">
        Teljes megszűnési lista →
      </Link>
    </div>
  );
}

// ── CrossLemondosok ──────────────────────────────────────────────────────────

function resignTypeLabel(t: string) {
  if (t === 'lemondás') return 'Lemondás';
  if (t === 'kirúgás') return 'Kirúgás';
  if (t === 'felmentés') return 'Felmentés';
  return t;
}
function resignTypeColor(t: string) {
  if (t === 'lemondás') return '#4B7AFF';
  if (t === 'kirúgás') return '#e31937';
  if (t === 'felmentés') return '#e8a000';
  return '#888';
}

export async function CrossLemondosok() {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.politicalResignations)
    .orderBy(desc(schema.politicalResignations.resignationDate))
    .limit(10);

  if (rows.length === 0) return null;

  return (
    <div className="cross-promo">
      <h2 className="cross-promo-title">Érdekelnek a kirúgások és felmentések is?</h2>
      <p className="cross-promo-deck">
        Politikusok, intézményvezetők és közszereplők, akik 2026. április 12. óta lemondtak, kirúgták vagy felmentették őket.
      </p>
      <div className="cross-promo-rows">
        {rows.map(r => (
          <div key={r.id} className="cross-promo-row cross-promo-row--resignation">
            <span className="cross-promo-row-date">{fmtDate(r.resignationDate)}</span>
            <span
              className="cross-promo-row-dot"
              title={resignTypeLabel(r.resignationType)}
              style={{ background: resignTypeColor(r.resignationType) }}
            />
            <span className="cross-promo-row-name">{r.name}</span>
            {r.position && <span className="cross-promo-row-sub">— {r.position}</span>}
          </div>
        ))}
      </div>
      <Link href="/lemondasok" className="cross-promo-cta">
        Teljes lemondási lista →
      </Link>
    </div>
  );
}

// ── CrossUgyek ───────────────────────────────────────────────────────────────

export function CrossUgyek() {
  return (
    <div className="cross-promo">
      <h2 className="cross-promo-title">Érdekelnek a legdurvább ügyek?</h2>
      <p className="cross-promo-deck">
        7 kiemelt korrupciós ügy — bizonyítékokkal, becsült összegekkel, felelős személyekkel.
      </p>
      <div className="ugyek-more-grid">
        {UGYEK.map(e => (
          <Link key={e.id} href={`/ugyek/${e.id}`} className="ugyek-more-card">
            <div className="ugyek-more-eyebrow">{(e.eyebrow.split('·')[0] ?? '').trim()}</div>
            <div className="ugyek-more-title">{e.title}</div>
            {e.responsible && <div className="ugyek-more-sub">{e.responsible}</div>}
          </Link>
        ))}
      </div>
      <Link href="/ugyek" className="cross-promo-cta">Összes kiemelt ügy →</Link>
    </div>
  );
}

// ── CrossFelszolitottak ──────────────────────────────────────────────────────

function watchImgSrc(url: string) {
  if (url.startsWith('/') || url.includes('wikimedia.org')) return url;
  return `/api/img-proxy?url=${encodeURIComponent(url)}`;
}

const GONE_LABEL: Record<string, string> = {
  removed: 'ELTÁVOLÍTVA',
  resigned: 'LEMONDOTT',
};

export function CrossFelszolitottak() {
  return (
    <div className="cross-promo">
      <h2 className="cross-promo-title">Lemondásra felszólított személyek</h2>
      <p className="cross-promo-deck">
        Magyar Péter nyolc NER-intézményvezető lemondását követeli — kövesd nyomon, ki ment és ki maradt.
      </p>
      <div className="person-more-grid cross-watch-grid">
        {WATCH_LIST.map(p => {
          const isGone = p.status !== 'active';
          return (
            <Link key={p.id} href={`/lemondasok/${p.id}`} className={`person-more-card${isGone ? ' person-more-card--gone' : ''}`}>
              <div className="person-more-mug r-loose">
                {p.photoUrl ? (
                  <img
                    src={watchImgSrc(p.photoUrl)}
                    alt={p.name}
                    className="person-more-img"
                    style={p.objectPosition ? { objectPosition: p.objectPosition } : undefined}
                  />
                ) : (
                  <div className="person-photo-placeholder">
                    <span>{p.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</span>
                  </div>
                )}
                {isGone && (
                  <div className="person-more-gone-badge">{GONE_LABEL[p.status] ?? 'ELTÁVOLÍTVA'}</div>
                )}
              </div>
              <div className="person-more-name">{p.name}</div>
              <div className="person-more-sub">{p.institution}</div>
            </Link>
          );
        })}
      </div>
      <Link href="/lemondasok" className="cross-promo-cta">Lemondásra felszólítottak →</Link>
    </div>
  );
}

// ── CrossBirosag ─────────────────────────────────────────────────────────────
// "Nincs már szabadlábon" státuszok — akit ezek egyike jelöl, az már nem
// számít az élő előzetes/elítélt-összesítésbe. Tükrözi VerdictList.tsx
// RELEASED_TYPES-ját (az a fájl kliens-komponens, innen nem importálható).
const RELEASED_VERDICT_TYPES = ['szabadlábra helyezve', 'eljárás megszűnt', 'felmentve'];

export async function CrossBirosag() {
  const db = getDb();
  const rows = await db
    .select({
      personUgyId: schema.courtVerdicts.personUgyId,
      verdictType: schema.courtVerdicts.verdictType,
      verdictDate: schema.courtVerdicts.verdictDate,
    })
    .from(schema.courtVerdicts)
    .where(eq(schema.courtVerdicts.reviewStatus, 'approved'));

  if (rows.length === 0) return null;

  const active = rows.filter(r => !RELEASED_VERDICT_TYPES.includes(r.verdictType));
  const pretrialCount = active.filter(r => r.verdictType === 'előzetesben').length;
  const convictedCount = active.filter(r => r.verdictType === 'elsőfokú' || r.verdictType === 'jogerős').length;

  if (pretrialCount === 0 && convictedCount === 0) return null;

  // Ügyenkénti gyorsgombok — csoportosítás personUgyId szerint, rendezés
  // (létszám desc, majd legfrissebb dátum desc). 2-3 ügynél ez a sorrend
  // nem sokat számít, de sok ügynél már ez lesz az irányadó rangsor.
  const byUgy = new Map<string, { count: number; latest: Date }>();
  for (const r of active) {
    if (!r.personUgyId) continue;
    const prev = byUgy.get(r.personUgyId);
    if (prev) {
      prev.count += 1;
      if (r.verdictDate > prev.latest) prev.latest = r.verdictDate;
    } else {
      byUgy.set(r.personUgyId, { count: 1, latest: r.verdictDate });
    }
  }
  const ugyPills = [...byUgy.entries()]
    .map(([id, stat]) => ({ id, title: UGYEK.find(u => u.id === id)?.title ?? id, ...stat }))
    .sort((a, b) => b.count - a.count || +b.latest - +a.latest);

  const sentenceParts = [`${pretrialCount} fő van jelenleg előzetes letartóztatásban`];
  if (convictedCount > 0) sentenceParts.push(`${convictedCount} fő jogerősen elítélve`);

  return (
    <div className="cross-promo">
      <h2 className="cross-promo-title">Kiket ért már utol az igazságszolgáltatás?</h2>
      <p className="cross-promo-deck">
        {sentenceParts.join(', ')} — a NER-hez köthető ügyekben.
      </p>
      {ugyPills.length > 0 && (
        <div className="cross-promo-pills">
          {ugyPills.map(p => (
            <Link key={p.id} href={`/birosagi-iteletek?ugy=${encodeURIComponent(p.id)}`} className="cross-promo-pill">
              {p.title} <span className="cross-promo-pill-count">{p.count}</span>
            </Link>
          ))}
        </div>
      )}
      <Link href="/birosagi-iteletek" className="cross-promo-cta">
        Összes ítélet →
      </Link>
    </div>
  );
}

// ── PersonGaleriaPromo ───────────────────────────────────────────────────────
// Csak a 10, GALERIA-profillal is rendelkező kiemelt személynek — a
// magánhangzó-illeszkedést kézzel térképezzük fel, mert a személynevekre
// nincs megbízható általános szabály.
const PERSON_TITLE: Record<string, string> = {
  'Orbán Viktor': 'Minden Orbánról',
  'Rogán Antal': 'Minden Rogánról',
  'Mészáros Lőrinc': 'Minden Mészárosról',
  'Tiborcz István': 'Minden Tiborczról',
  'Szijjártó Péter': 'Minden Szijjártóról',
  'Takács Péter': 'Minden Takácsról',
  'Matolcsy György': 'Minden Matolcsyról',
  'Lázár János': 'Minden Lázárról',
  'Balásy Gyula': 'Minden Balásyról',
  'Semjén Zsolt': 'Minden Semjénről',
};

export function PersonGaleriaPromo({
  personName,
  caseCount,
  total,
  photoUrl,
}: {
  personName: string;
  caseCount: number;
  total: bigint;
  photoUrl: string | null;
}) {
  const entry = GALERIA.find(g => g.name === personName);
  if (!entry) return null;
  const title = PERSON_TITLE[personName] ?? `Minden ${personName}ról`;
  const src = photoUrl ? (photoUrl.startsWith('/') || photoUrl.includes('wikimedia.org') ? photoUrl : `/api/img-proxy?url=${encodeURIComponent(photoUrl)}`) : null;
  const initials = personName.split(' ').slice(0, 2).map(w => w[0]).join('');

  return (
    <div className="cross-promo">
      <div className="cross-promo-person-layout">
        <div className="cross-promo-person-photo">
          {src ? (
            <img src={src} alt={personName} />
          ) : (
            <div className="person-photo-placeholder"><span>{initials}</span></div>
          )}
        </div>
        <div className="cross-promo-person-body">
          <h2 className="cross-promo-title">{title}</h2>
          <div className="cross-promo-person-stats">
            <span>{caseCount} dokumentált ügy</span>
            <span className="sep">·</span>
            <span><FtValue n={total} /> érintett közpénz</span>
          </div>
          <p className="cross-promo-deck">
            Videók a legdurvább ügyeiről, és minden vele kapcsolatos hír egy helyen — nézd meg a
            teljes profilt.
          </p>
          <Link href={`/galeria/${entry.id}`} className="cross-promo-cta">
            Teljes profil megnézése →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── CrossAdatbazisSzemelyek ──────────────────────────────────────────────────

export async function CrossAdatbazisSzemelyek() {
  const db = getDb();
  const people = await getFeaturedPeople(db);
  if (people.length === 0) return null;

  const featuredSum = people.reduce((s, p) => s + p.total, 0n);
  const totalDamageAll = await getTotalDamage(db);
  const featuredPct = totalDamageAll > 0n ? Math.round((Number(featuredSum) / Number(totalDamageAll)) * 1000) / 10 : 0;

  return (
    <div className="cross-promo">
      <h2 className="cross-promo-title">Érdekelnek az adatbázis kiemelt személyei?</h2>
      <p className="cross-promo-deck">
        12 kiemelt személy, akikhez a legtöbb, dokumentáltan érintett közpénz köthető —
        sajtójelentések és nyilvános dokumentumok alapján. Összesen{' '}
        <strong><FtValue n={featuredSum} /></strong> jut rájuk, ami a teljes adatbázisban érintett
        közpénz <strong>{String(featuredPct).replace('.', ',')}%-a</strong>.
      </p>
      <div className="person-more-grid cross-featured-grid">
        {people.map(p => (
          <Link key={p.slug} href={`/adatbazis/szemely/${p.slug}`} className="person-more-card">
            <div className="person-more-mug r-loose">
              {p.photoUrl ? (
                <img
                  src={p.photoUrl.startsWith('/') || p.photoUrl.includes('wikimedia.org') ? p.photoUrl : `/api/img-proxy?url=${encodeURIComponent(p.photoUrl)}`}
                  alt={p.name}
                  className="person-more-img"
                />
              ) : (
                <div className="person-photo-placeholder">
                  <span>{p.name.split(' ').slice(0, 2).map(w => w[0]).join('')}</span>
                </div>
              )}
            </div>
            <div className="person-more-name">{p.name}</div>
            <div className="person-more-sub"><FtValue n={p.total} /> érintett közpénz</div>
          </Link>
        ))}
      </div>
      <Link href="/adatbazis" className="cross-promo-cta">Teljes adatbázis →</Link>
    </div>
  );
}

// ── CrossGaleria ─────────────────────────────────────────────────────────────

export function CrossGaleria() {
  return (
    <div className="cross-promo">
      <h2 className="cross-promo-title">Érdekelnek a NER kiemelt személyei?</h2>
      <p className="cross-promo-deck">
        10 kiemelt személy, akik a rendszer kulcsfigurái voltak — sajtójelentések és nyilvános dokumentumok alapján.
      </p>
      <div className="person-more-grid">
        {GALERIA.map(e => (
          <Link key={e.id} href={`/galeria/${e.id}`} className="person-more-card">
            <div className={`person-more-mug r-${e.detention}`}>
              {e.photoUrl ? (
                <img
                  src={e.photoUrl.startsWith('/') || e.photoUrl.includes('wikimedia.org') ? e.photoUrl : `/api/img-proxy?url=${encodeURIComponent(e.photoUrl)}`}
                  alt={e.name}
                  className="person-more-img"
                />
              ) : (
                <Mugshot
                  caseId={e.id}
                  name={e.name}
                  variant={e.variant ?? 0}
                  glasses={e.glasses ?? false}
                  hair={(e.hair as GaleriaHair) ?? 'short'}
                  detention={e.detention as GaleriaDetention}
                />
              )}
            </div>
            <div className="person-more-name">{e.name}</div>
            <div className="person-more-sub">{(e.subtitle.split('·')[0] ?? '').trim()}</div>
          </Link>
        ))}
      </div>
      <Link href="/galeria" className="cross-promo-cta">Teljes galéria →</Link>
    </div>
  );
}
