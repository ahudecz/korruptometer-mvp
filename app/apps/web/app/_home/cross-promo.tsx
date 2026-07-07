import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { UGYEK } from './ugyek-config';
import { GALERIA, type GaleriaDetention, type GaleriaHair } from './galeria-config';
import { WATCH_LIST } from './watchlist-config';
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

export async function CrossBirosag() {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.courtVerdicts)
    .orderBy(desc(schema.courtVerdicts.verdictDate))
    .limit(5);

  if (rows.length === 0) return null;

  const totalYears = rows.reduce((sum, r) => sum + r.sentenceYears, 0);

  return (
    <div className="cross-promo">
      <h2 className="cross-promo-title">Kiszabott börtönévek</h2>
      <p className="cross-promo-deck">
        NER-kapcsolatú ügyekben kiszabott szabadságvesztés ítéletek — {totalYears} év összesen.
      </p>
      <div className="cross-promo-rows">
        {rows.map(r => (
          <div key={r.id} className="cross-promo-row">
            <span style={{ fontWeight: 800, color: '#E31937', minWidth: 52, flexShrink: 0 }}>{r.sentenceYears} ÉV</span>
            <span className="cross-promo-row-name">{r.personName}</span>
            {r.crimes[0] && <span className="cross-promo-row-sub">— {r.crimes[0]}</span>}
          </div>
        ))}
      </div>
      <Link href="/birosagi-iteletek" className="cross-promo-cta">
        Összes ítélet →
      </Link>
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
