import Link from 'next/link';

const PRISON_PERSONS = [
  { name: 'Orbán Viktor',    sub: 'Volt miniszterelnök',            photo: '/images/persons/orban.jpg',           objectPos: '50% 15%' },
  { name: 'Rogán Antal',     sub: 'Volt kabinetirodát vezető min.', photo: '/images/persons/rogan-antal.png',     objectPos: '50% 10%' },
  { name: 'Mészáros Lőrinc', sub: 'Felcsúti üzletember',           photo: '/images/persons/meszaros-lorinc.png', objectPos: '50% 5%'  },
  { name: 'Tiborcz István',  sub: 'Orbán Viktor veje',              photo: '/images/persons/tiborcz-istvan.png',  objectPos: '50% 10%' },
  { name: 'Szijjártó Péter', sub: 'Volt külügyminiszter',          photo: '/images/persons/szijjarto-peter.png', objectPos: '50% 10%' },
  { name: 'Lázár János',     sub: 'Volt építési miniszter',         photo: '/images/persons/lazar-janos.png',     objectPos: '50% 10%' },
  { name: 'Balásy Gyula',    sub: 'New Land Media',                 photo: '/images/persons/balasy-gyula.png',    objectPos: '50% 10%' },
];

export default function NotFound() {
  return (
    <div className="nf-page">

      {/* ── Prison strip ─────────────────────────────────── */}
      <div className="nf-prison-wrap">
        <div className="nf-prison-track">
          {PRISON_PERSONS.map(p => (
            <div key={p.name} className="nf-cell">
              <div className="nf-cell-photo-wrap">
                <img
                  src={p.photo}
                  alt={p.name}
                  className="nf-cell-photo"
                  style={{ objectPosition: p.objectPos }}
                />
                {/* Rácsok */}
                <div className="nf-bars" aria-hidden="true">
                  {[0,1,2,3,4].map(i => <div key={i} className="nf-bar" />)}
                </div>
                {/* Sötét overlay */}
                <div className="nf-cell-overlay" aria-hidden="true" />
              </div>
              <div className="nf-cell-plate">
                <span className="nf-cell-name">{p.name}</span>
                <span className="nf-cell-sub">{p.sub}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Rácsvonal alján */}
        <div className="nf-prison-floor" aria-hidden="true" />
      </div>

      {/* ── Szöveg & CTA ─────────────────────────────────── */}
      <div className="nf-body">
        <div className="nf-eyebrow">404</div>
        <h1 className="nf-headline">Rács mögött keresed őket?<br />Mi is.</h1>
        <p className="nf-sub">
          Ez az oldal nem létezik — de az ellopott milliárdok igen.<br />
          Az elkövetők egyelőre a rács innenső oldalán vannak — addig nézz körül a dokumentált ügyek között.
        </p>

        <div className="nf-links">
          <Link href="/" className="nf-link nf-link--primary">
            ← Vissza a főoldalra
          </Link>
          <Link href="/galeria" className="nf-link">
            Kiemelt személyek →
          </Link>
          <Link href="/ugyek" className="nf-link">
            Ügyek →
          </Link>
          <Link href="/birosagi-iteletek" className="nf-link">
            Börtönben van-e már? →
          </Link>
          <Link href="/lemondasok" className="nf-link">
            Lemondások →
          </Link>
        </div>
      </div>

    </div>
  );
}
