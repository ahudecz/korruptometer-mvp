import type { Metadata } from 'next';
import { and, desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { getActiveBreaking, findBreakingForName, type BreakingArticle } from '@/lib/breaking';

export const metadata: Metadata = {
  title: 'Lemondott-e már?',
  description: 'Nyomon követjük, hogy a NER kegyenceinek lemondását ki és mikor teljesítette — és ki húzza még mindig.',
  openGraph: { title: 'Lemondott-e már? — Kegyencjárat', description: 'Ki mondott le, és ki húzza még mindig.' },
};
import { WatchlistGrid } from '../_home/watchlist-grid';
import { CrossMegszunt, CrossUgyek, CrossGaleria } from '../_home/cross-promo';

export const revalidate = 120;

function typeLabel(t: string): string {
  if (t === 'lemondás') return '↓ Lemondás';
  if (t === 'kirúgás') return '✕ Kirúgás';
  if (t === 'felmentés') return '⟲ Felmentés';
  return t;
}

function typeColor(t: string): string {
  if (t === 'lemondás') return '#4B7AFF';
  if (t === 'kirúgás') return '#E31937';
  if (t === 'felmentés') return '#FF9D00';
  return '#666';
}

const cellStyle = { padding: '12px', color: '#666' } as const;

function Row({ r, breakingArticle }: { r: Awaited<ReturnType<typeof fetchRows>>[number]; breakingArticle?: BreakingArticle | null }) {
  const color = typeColor(r.resignationType);
  return (
    <tr className={breakingArticle ? 'res-row-breaking' : undefined} style={{ borderBottom: '1px solid #f0f0f0' }}>
      <td className="res-col-date" style={{ ...cellStyle, whiteSpace: 'nowrap' as const }}>
        {new Date(r.resignationDate).toLocaleDateString('hu-HU')}
      </td>
      <td style={{ ...cellStyle, whiteSpace: 'nowrap' as const }}>
        <span style={{
          display: 'inline-block',
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: `${color}20`,
          color,
          fontSize: '12px',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>
          {typeLabel(r.resignationType)}
        </span>
      </td>
      <td style={{ ...cellStyle, fontWeight: 500, color: 'var(--ink)' }}>
        {r.name}
        {breakingArticle && (
          <a
            href={breakingArticle.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="res-breaking-inline"
          >
            <span className="res-breaking-dot" />
            BREAKING
          </a>
        )}
      </td>
      <td style={cellStyle}>{r.position}</td>
      <td className="res-col-institution" style={cellStyle}>{r.institution}</td>
      <td className="res-col-desc" style={{ ...cellStyle, maxWidth: 320, fontSize: 13 }}>{r.description ?? '—'}</td>
      <td style={cellStyle}>
        {r.sourceUrls?.[0] ? (
          <a href={r.sourceUrls[0]} target="_blank" rel="noopener noreferrer" className="res-source-link">
            {r.sourceNames?.[0] ?? 'Forrás'} →
          </a>
        ) : '—'}
      </td>
    </tr>
  );
}

async function fetchRows() {
  const db = getDb();
  return db
    .select()
    .from(schema.politicalResignations)
    .where(eq(schema.politicalResignations.reviewStatus, 'approved'))
    .orderBy(desc(schema.politicalResignations.resignationDate))
    .limit(100);
}

const tableHead = (
  <thead>
    <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
      <th className="res-col-date" style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Dátum</th>
      <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Státusz</th>
      <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Név</th>
      <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Pozíció</th>
      <th className="res-col-institution" style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Intézmény</th>
      <th className="res-col-desc" style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Leírás</th>
      <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Forrás</th>
    </tr>
  </thead>
);

export default async function LemondasokPage() {
  const db = getDb();
  const [rows, mediaLeepites, breakingArticles] = await Promise.all([
    fetchRows(),
    db.select().from(schema.mediaClosures).where(and(eq(schema.mediaClosures.eventType, 'leépítés'), eq(schema.mediaClosures.reviewStatus, 'approved'))),
    getActiveBreaking(),
  ]);
  const rest = rows.filter(r => !r.pinned);

  const kirugasFelmentesCount = rows.filter(r => (r.resignationType === 'kirúgás' || r.resignationType === 'felmentés') && !r.name.includes('szerkesztőség')).length;
  const lemondasCount = rows.filter(r => r.resignationType === 'lemondás').length;
  const osszes = kirugasFelmentesCount + lemondasCount;
  const szerkLeepitesCount = mediaLeepites.length;

  return (
    <div className="news-section-wrap">
      <section className="section" id="lemondasok">
        <div className="section-head">
          <div className="section-num">/ Személyi változások</div>
          <h2 className="section-title">Lemondott-e már?</h2>
        </div>

        <p className="rogues-deck" style={{ marginTop: 24, marginBottom: 0, color: 'var(--ink)' }}>
          Magyar Péter lemondásra szólította fel a NER kulcsintézményeinek vezetőit — ha valamelyikük
          távozik, a kártyáján megjelenik. Lemondásra szólította fel Sulyok Tamás köztársasági elnököt,
          valamint azokat, akiket ő a rendszer tartóoszlopainak nevez: a Kúria elnökét, az
          Alkotmánybíróság elnökét, a legfőbb ügyészt, az Állami Számvevőszék elnökét, a Gazdasági
          Versenyhivatal elnökét, a Médiahatóság elnökét és az Országos Bírói Hivatal elnökét.
        </p>

        <WatchlistGrid breaking={breakingArticles} />

        {/* Tisztítótűz összefoglaló blokk */}
        <div style={{
          margin: '40px 0 8px',
          border: '2px solid #E31937',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          <div style={{
            background: '#E31937',
            padding: '14px 24px',
          }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '15px', letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>
              „Tisztítótűz" — Magyar Péter elindítja a NER intézményi felszámolását
            </span>
          </div>
          <div style={{
            padding: '20px 24px',
            background: '#fff9f9',
            fontSize: '14px',
            lineHeight: '1.75',
            color: 'var(--ink)',
          }}>
            <p style={{ marginTop: 0, marginBottom: '14px' }}>
              Magyar Péter miniszterelnök <strong>2026. június 22-én</strong> a parlamentben elindította
              a <strong>Tisztítótűz-műveletet</strong>: Alaptörvény-módosítással veszi célba a fenti
              nyolc NER-vezető mindegyikét, akik a május 31-i határidőig nem mondtak le önként.
              Négy kulcspozíció eltávolítása már konkrét menetrend szerint zajlik:
            </p>
            <ul style={{ margin: '0 0 16px 18px', padding: 0 }}>
              <li style={{ marginBottom: '8px' }}>
                <strong>Sulyok Tamás</strong> (köztársasági elnök) — az Alaptörvény-módosítással
                mindenekelőtt az ő megbízatását szüntetik meg:
                <blockquote style={{
                  margin: '10px 0 10px 0',
                  padding: '10px 16px',
                  borderLeft: '3px solid #E31937',
                  background: '#fff0f0',
                  borderRadius: '0 6px 6px 0',
                  fontSize: '15px',
                  fontStyle: 'italic',
                  lineHeight: '1.6',
                  color: 'var(--ink)',
                }}>
                  „az Alaptörvény tizenhetedik módosításának hatálybalépését követő napon a hivatalban lévő köztársasági elnök megbízatása megszűnik"
                </blockquote>
                Ha nem írja alá a módosítást, megfosztási eljárás indul, és az Országgyűlés elnöke
                veszi át a jogköreit ideiglenesen. Magyar Péter szerint <strong>kb. július 20-ra</strong> már
                bizonyosan nem lesz elnök — augusztus 20. előtt új, az ellenzék számára is elfogadható
                köztársasági elnököt választanak.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Polt Péter</strong> (alkotmánybíró, elnök) — szeptemberben betölti a 71.
                életévét, így a visszaállított <strong>70 éves korhatár</strong> azonnal kiszorítja
                a pozíciójából. Ugyanez vonatkozik három másik alkotmánybíróra:
                Haszonicsné Ádám Máriára, Juhász Miklósra és Lomnici Zoltánra.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>OBH elnöke</strong> (Országos Bírósági Hivatal) — az új Alaptörvény megerősíti
                a bírói önigazgatást, az OBH és a Kúria vezetőjét ezután a bírák választják.
              </li>
              <li>
                <strong>Kúria elnöke</strong> — az alkotmányozási csomag részeként kerül ki,
                a bírói önigazgatás megerősítésével a Kúria vezetőjét is a bírák választják majd.
              </li>
            </ul>
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, marginBottom: '16px', borderRadius: '8px', overflow: 'hidden' }}>
              <iframe
                src="https://www.youtube.com/embed/mwkGNSfwF-g"
                title="Tisztítótűz-művelet összefoglaló"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
              />
            </div>

            <p style={{ marginBottom: '10px' }}>
              A <strong>12 éves mandátumkorlát</strong> bevezetése a jelenleg parlamentben ülő képviselők közül
              50 fideszes, KDNP-s és Mi Hazánk-os képviselőt érintene, akik 2014 előtt vagy 2014-ben
              kerültek be a parlamentbe.{' '}
              <strong style={{ color: '#E31937' }}>Fontos: a korlát nem azonnal, hanem 2030-tól lép érvénybe</strong>{' '}
              — addig az érintett képviselők mandátuma nem szűnik meg automatikusan.
              A szabály visszamenőlegesen is számít: <strong>Orbán Viktor például soha nem ülhetne be
              a parlamentbe</strong>, hiszen 1990 óta folyamatosan képviselő.
            </p>
            <div style={{ marginBottom: '16px', fontSize: '13px', lineHeight: '1.8', display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' as const }}>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: '#E31937', marginBottom: '4px' }}>Fidesz</div>
                <div style={{ columnCount: 4, columnGap: '16px' }}>
                  <div>Ágh Péter (2006)</div>
                  <div>Balla György (1998)</div>
                  <div>Balla Mihály (1998)</div>
                  <div>Bánki Erik (1998)</div>
                  <div>Bányai Gábor (2006)</div>
                  <div>Becsó Zsolt (1998)</div>
                  <div>Bencsik János (1998)</div>
                  <div>Bodó Sándor (2010)</div>
                  <div>Bóna Zoltán (2014)</div>
                  <div>Csöbör Katalin (2010)</div>
                  <div>Czerván György (1998)</div>
                  <div>Czunyi-Bertalan Judit (2010)</div>
                  <div>Dankó Béla (2010)</div>
                  <div>Demeter Zoltán (2010)</div>
                  <div>Dunai Mónika (2014)</div>
                  <div>Erdős Norbert (2002)</div>
                  <div>Farkas Sándor (1998)</div>
                  <div>Font Sándor (1998)</div>
                  <div>Gelencsér Attila (2010)</div>
                  <div>Gyopáros Alpár (2009)</div>
                  <div>Hende Csaba (2002)</div>
                  <div>Horváth István (2006)</div>
                  <div>Horváth László (1990)</div>
                  <div>Hörcsik Richárd (1990)</div>
                  <div>Kara Ákos (2010)</div>
                  <div>Kósa Lajos (1990)</div>
                  <div>Kovács József (2010)</div>
                  <div>Kovács Sándor (2014)</div>
                  <div>Lázár János (2002)</div>
                  <div>Lezsák Sándor (1994)</div>
                  <div>Nagy Csaba (2010)</div>
                  <div>Nagy István (2010)</div>
                  <div>Pánczél Károly (1998)</div>
                  <div>Pócs János (2010)</div>
                  <div>Pogácsás Tibor (1998)</div>
                  <div>Pósán László (1998)</div>
                  <div>Riz Gábor (2010)</div>
                  <div>Salacz László (2014)</div>
                  <div>Simon Róbert Balázs (2014)</div>
                  <div>Szabó Tünde (2014)</div>
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontWeight: 600, color: '#E31937', marginBottom: '4px' }}>KDNP</div>
                <div>Aradszki András (2010)</div>
                <div>Földi László (2010)</div>
                <div>Hargitai János (1998)</div>
                <div>Móring József Attila (2002)</div>
                <div>Rétvári Bence (2008)</div>
                <div>Seszták Miklós (2010)</div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontWeight: 600, color: '#E31937', marginBottom: '4px' }}>Mi Hazánk</div>
                <div>Apáti István (2010)</div>
                <div>Dúró Dóra (2010)</div>
                <div>Novák Előd (2010)</div>
              </div>
            </div>

            <p style={{ marginBottom: '14px' }}>
              A művelet részeként felállítják a <strong>Nemzeti Vagyonvisszaszerzési és Védelmi
              Hivatalt</strong> is, amely évi ~10 milliárd forintból (a volt Szuverenitásvédelmi
              Hivatal keretéből) üldözi majd a NER-korszakban eltüntetett vagyont. A hivatal célkeresztjében:
              lombkoronasétányok, bobpálya, hídberuházások, trieszti kikötőprojekt, stadionügyek,
              világkiállítási projektek — és politikusok vagyonosodása, köztük Lázár János és Pócs János.
              Az elnök és négy helyettese <strong>24 órás rendőri védelmet</strong> kap.
            </p>
            <div style={{ paddingTop: '12px', borderTop: '1px solid #fccdd3', fontSize: '12px', color: '#999' }}>
              Forrás:{' '}
              <a href="https://telex.hu/belfold/2026/06/22/sulyok-tamas-koztarsasagi-elnok-lemondas-tisztitotuz-magyar-peter" target="_blank" rel="noopener noreferrer" style={{ color: '#E31937' }}>
                Telex — Alaptörvény-módosítás
              </a>
              {' · '}
              <a href="https://telex.hu/belfold/2026/06/22/magyar-peter-tisztitotuz-sajtotajekoztato" target="_blank" rel="noopener noreferrer" style={{ color: '#E31937' }}>
                Telex — sajtótájékoztató
              </a>
              {' · '}
              <a href="https://www.portfolio.hu/gazdasag/20260622/magyar-peter-elindul-a-tisztitotuz-muvelet-844840" target="_blank" rel="noopener noreferrer" style={{ color: '#E31937' }}>
                Portfolio
              </a>
              {' · '}
              <a href="https://nepszava.hu/3326772_magyar-kormany-alkotmanybirok-nyugdijazas-tisztitotuz" target="_blank" rel="noopener noreferrer" style={{ color: '#E31937' }}>
                Népszava — alkotmánybírók
              </a>
            </div>
          </div>
        </div>

        {rest.length > 0 && (
          <>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              marginTop: '48px',
              marginBottom: '8px',
              paddingTop: '24px',
              borderTop: '1px solid #e5e5e5',
              color: 'var(--ink)',
            }}>
              Legfrissebb lemondások, kirúgások és felmentések
            </h2>
            <p className="elszamoltatas-deck" style={{ marginBottom: 24 }}>
              Itt dokumentáljuk a NER összeomlásával távozó, kirúgott és felmentett embereket —
              köztisztviselőket, propagandistákat és mindenkit, aki a rendszer szekerét tolta,
              és most mennie kellett.
            </p>
            <div className="megszunt-stats megszunt-stats--4" style={{ marginBottom: 32 }}>
              <div className="megszunt-stat">
                <div className="megszunt-stat-value">{osszes}</div>
                <div className="megszunt-stat-label">NER-káder távozott összesen</div>
              </div>
              <div className="megszunt-stat">
                <div className="megszunt-stat-value megszunt-stat-value--red">{kirugasFelmentesCount}</div>
                <div className="megszunt-stat-label">Kirúgás / felmentés</div>
              </div>
              <div className="megszunt-stat">
                <div className="megszunt-stat-value" style={{ color: '#4B7AFF' }}>{lemondasCount}</div>
                <div className="megszunt-stat-label">Lemondás</div>
              </div>
              <div className="megszunt-stat">
                <div className="megszunt-stat-value megszunt-stat-value--orange">{szerkLeepitesCount}</div>
                <div className="megszunt-stat-label">Szerkesztőségi leépítés</div>
              </div>
            </div>
            <div className="res-table-wrap">
              <table style={{ width: '100%', minWidth: 700, fontSize: '14px', lineHeight: '1.6' }}>
                {tableHead}
                <tbody>
                  {rest.map(r => <Row key={r.id} r={r} breakingArticle={findBreakingForName(r.name, breakingArticles)} />)}
                </tbody>
              </table>
            </div>
          </>
        )}

        {rows.length === 0 && (
          <div className="empty-state" style={{ marginTop: 32 }}>Nincs adat.</div>
        )}
      </section>

      <div className="cross-promo-section">
        <div className="cross-promo-section-inner">
          <CrossMegszunt />
          <CrossUgyek />
          <CrossGaleria />
        </div>
      </div>
    </div>
  );
}
