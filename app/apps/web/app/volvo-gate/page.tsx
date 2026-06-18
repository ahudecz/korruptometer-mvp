import Link from 'next/link';
import { desc, ilike, or, eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';

export const dynamic = 'force-dynamic';

const HU_MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];

function fmtDate(d: Date): string {
  return `${d.getFullYear()}. ${HU_MONTHS[d.getMonth()]} ${d.getDate()}.`;
}

export default async function VolvoGatePage() {
  const db = getDb();

  const articles = await db
    .select({
      id: schema.newsArticles.id,
      headline: schema.newsArticles.headline,
      excerpt: schema.newsArticles.excerpt,
      sourceUrl: schema.newsArticles.sourceUrl,
      publishedAt: schema.newsArticles.publishedAt,
      sourceName: schema.sources.name,
    })
    .from(schema.newsArticles)
    .leftJoin(schema.sources, eq(schema.sources.id, schema.newsArticles.sourceId))
    .where(or(
      ilike(schema.newsArticles.headline, '%volvo gate%'),
      ilike(schema.newsArticles.headline, '%volvo-gate%'),
      ilike(schema.newsArticles.headline, '%bánki erik%'),
      ilike(schema.newsArticles.headline, '%tüke busz%'),
      eq(schema.newsArticles.tag, 'volvo-gate'),
    ))
    .orderBy(desc(schema.newsArticles.publishedAt))
    .limit(30);

  return (
    <div className="person-page">
      <div className="person-hero">
        <div className="person-hero-inner" style={{ gridTemplateColumns: '1fr' }}>
          <div className="person-hero-text">
            <div className="person-hero-eyebrow">Legdurvább ügyek · Aktív</div>
            <h1 className="person-hero-name">Pécsi Volvo-gate</h1>
            <div className="person-hero-sub">Bánki Erik · Fideszes képviselő · Pécs</div>
            <div className="person-hero-amount">
              <span className="person-hero-amount-lbl">Becsült közkár</span>
              <span className="person-hero-amount-val">~700 millió Ft</span>
            </div>
            <p className="person-hero-desc">
              A pécsi Tüke Zrt. 2010-ben 115 használt Volvo buszt vásárolt Hollandiából 3,5 milliárd
              forintért — miközben azonos buszokat pár hónappal korábban 2,8 milliárdért kínáltak.
              A ~700 millió forintos közkárból 170 millió forint (550 000 EUR) Thaiföldre vándorolt,
              ebből 52 millió forint egy Bánki Erik fideszes képviselőhöz köthető cégnek folyt.
              Éveken át eltussolták; Hadházy Ákos 2026-os feljelentése nyomán újabb nyomozás indult.
            </p>
            <div className="person-hero-tags">
              <span className="tag">Közbeszerzési visszaélés</span>
              <span className="tag">Eltussolt korrupció</span>
              <span className="tag">Közpénzek hűtlen kezelése</span>
            </div>
          </div>
        </div>
      </div>

      <div className="person-body">
        <div className="person-video-wrap">
          <iframe
            src="https://www.youtube.com/embed/feWPUeFNDmU"
            title="Pécsi Volvo-gate összefoglaló"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        <div className="person-cases">
          <h2 className="person-section-title">Az ügy idővonala</h2>
          <p className="person-section-note">
            Sajtócikkeken és nyilvánosan hozzáférhető dokumentumokon alapul. Jogerős ítélet hiányában
            bűnösséget nem állít.
          </p>

          <div className="person-case-card">
            <div className="person-case-num">/ 01</div>
            <div className="person-case-body">
              <h3 className="person-case-title">A buszbeszerzés — 700 millió forintos közkár</h3>
              <p className="person-case-desc">
                A pécsi Tüke Zrt. 2010-ben 115 db használt Volvo buszt vásárolt Hollandiából 3,5 milliárd
                forintért. Azonos típusú, azonos korú buszokat pár hónappal korábban 2,8 milliárdért
                kínáltak a piacon — a különbözet ~700 millió forint, amit a Tüke Zrt.-nek, azaz Pécs
                városának kellett fizetnie. Az ügylet lebonyolítója Paiger István volt (azóta elhunyt).
              </p>
              <div className="person-case-footer">
                <div className="person-case-dmg">
                  <span className="person-case-dmg-lbl">Becsült közkár</span>
                  <span className="person-case-dmg-val">~700 millió Ft</span>
                </div>
                <div className="person-case-crimes">
                  <span className="tag">Közbeszerzési visszaélés</span>
                  <span className="tag">Túlárazás</span>
                </div>
              </div>
            </div>
          </div>

          <div className="person-case-card">
            <div className="person-case-num">/ 02</div>
            <div className="person-case-body">
              <h3 className="person-case-title">Bánki Erik kapcsolata — 52 M Ft + 550 000 EUR</h3>
              <p className="person-case-desc">
                Az ügyben harmadrendű vádlottként szereplő személy bűnösnek vallotta magát pénzmosásban.
                A nyomozás során kiderült: 170 millió forintnak megfelelő eurót (550 000 EUR) egy thaiföldön
                lévő offshore cégen keresztül utaltak el ellenszolgáltatás nélkül. Ebből 52 millió forint
                egy Bánki Erik fideszes képviselőhöz köthető cégnek folyt ki. Bánki maga tagadja
                az érintettséget, és politikai lejáratókampánynak tartja az ellene irányuló gyanúsításokat.
              </p>
              <div className="person-case-footer">
                <div className="person-case-dmg">
                  <span className="person-case-dmg-lbl">Bánki-közeli cégnek folyt</span>
                  <span className="person-case-dmg-val">52 M Ft · + 550 000 EUR offshore</span>
                </div>
                <div className="person-case-crimes">
                  <span className="tag">Pénzmosás</span>
                  <span className="tag">Összeférhetetlenség</span>
                </div>
              </div>
            </div>
          </div>

          <div className="person-case-card">
            <div className="person-case-num">/ 03</div>
            <div className="person-case-body">
              <h3 className="person-case-title">Eltussolás és újraindítás</h3>
              <p className="person-case-desc">
                Az ügyészség az első eljárásban felmentette Bánki Eriket és a strómant is — annak ellenére,
                hogy az elsőrendű vádlott Bánkira vallott. A Pécsi Ítélőtábla megsemmisítette az ítéletet,
                a Szekszárdi Törvényszék újratárgyalja az ügyet. 2025 májusában harmadszor hallgatták meg
                tanúként Bánki Eriket. Hadházy Ákos 2026-os feljelentése nyomán a Fejér Megyei Rendőrség
                újabb nyomozást indított a vádemeléssel nem érintett személyek tevékenységével kapcsolatban.
              </p>
              <div className="person-case-footer">
                <div className="person-case-crimes">
                  <span className="tag">Eljárás elhúzása</span>
                  <span className="tag">Eltussolt korrupció</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {articles.length > 0 && (
          <div className="person-news">
            <h2 className="person-section-title">Kapcsolódó hírek</h2>
            <p className="person-section-note">
              Automatikusan szűrve a napi hírfolyamból.
            </p>
            <div className="person-news-list">
              {articles.map(a => (
                <a
                  key={a.id}
                  href={a.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="person-news-item"
                >
                  <span className="person-news-source">{a.sourceName}</span>
                  <span className="person-news-date">{fmtDate(a.publishedAt)}</span>
                  <span className="person-news-headline">{a.headline}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {articles.length === 0 && (
          <div className="person-news-empty">
            Még nincs beindexelt hír — futtasd az import-volvo-gate scriptet, vagy várj a következő scrape-re.
          </div>
        )}

        <div style={{ paddingTop: 8 }}>
          <Link href="/#legdurvabb-ugyek" className="big-case-more-btn">
            ← Vissza a legdurvább ügyekhez
          </Link>
        </div>
      </div>
    </div>
  );
}
