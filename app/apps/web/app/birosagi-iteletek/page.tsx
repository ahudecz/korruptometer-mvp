import { desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';

export const metadata = {
  title: 'Börtönben van-e?',
  description: 'Nyomon követjük a NER-hez köthető korrupciós ügyek bírósági szakaszát — vádemelés, előzetes letartóztatás és jogerős ítélet.',
};
import { UGYEK } from '../_home/ugyek-config';
import { GALERIA } from '../_home/galeria-config';
import { VerdictList, type SerializedVerdict } from './VerdictList';
import { CrossLemondosok, CrossUgyek, CrossGaleria, CrossMegszunt } from '../_home/cross-promo';

export const revalidate = 120;

const HU_MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];

function fmtDateLong(d: Date): string {
  return `${d.getFullYear()}. ${HU_MONTHS[d.getMonth()]} ${d.getDate()}.`;
}

const VERDICT_PERSON_PHOTOS: Record<string, string> = {
  'Bús Balázs': '/images/persons/bus-balazs.png',
  'Őrsi Gergely': '/images/persons/orsi-gergely.png',
  'Láng Zsolt': '/images/persons/lang-zsolt.png',
  'Puskás Péter': '/images/persons/puskas-peter.png',
  'Molnár Zsolt': '/images/persons/molnar-zsolt.png',
  'Ughy Attila': '/images/persons/ughy-attila.png',
};

const VERDICT_PERSON_QUOTES: Record<string, string> = {
  'Őrsi Gergely': `A jelenlegi helyzetben a legfontosabb, hogy elmondjam Önöknek, a II. kerületi Önkormányzat működik, minden feladatot zökkenőmentesen ellát.\nSzeretném nyilvánvalóvá tenni: minden körülmények között tartom magam eskümhöz és ahhoz a vállaláshoz, hogy számomra a II. kerület boldogulása, fejlődése a legfontosabb.\nBiztosan tudom, hogy esküm és lelkiismeretem szerint mindig a törvényeknek megfelelően jártam el — ahogy a Hivatal is.\nFelháborít és egyben elszomorít, hogy sarokba szorított ember/emberek szavára alapozva történhet letartóztatás, de ez nem változtat azon, hogy az igazság ki fog derülni. Sajnálatos módon ennek a magyar igazságszolgáltatás szervei egyelőre bedőltek. A velem szemben közölt gyanúsítás azonban teljes egészében megalapozatlan, az ténybeli és jogi alapokon sem állja meg a helyét. Ennek kívánunk érvényt szerezni a jövőben.\nKöszönöm szeretetüket és támogatásukat, hálás vagyok érte, mert erőt ad ahhoz, hogy kiálljak az igazamért.`,
};

function resolvePhoto(url: string | null | undefined, personName?: string): string | null {
  const fallback = personName ? (VERDICT_PERSON_PHOTOS[personName] ?? null) : null;
  const src = url ?? fallback;
  if (!src) return null;
  if (src.startsWith('/') || src.includes('wikimedia.org')) return src;
  return `/api/img-proxy?url=${encodeURIComponent(src)}`;
}

export default async function BirosagPage() {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.courtVerdicts)
    .where(eq(schema.courtVerdicts.reviewStatus, 'approved'))
    .orderBy(desc(schema.courtVerdicts.verdictDate));

  const serialized: SerializedVerdict[] = rows.map(r => {
    const galeriaEntry = r.personGaleriaId ? (GALERIA.find(g => g.id === r.personGaleriaId) ?? null) : null;
    const ugyEntry     = r.personUgyId     ? (UGYEK.find(u => u.id === r.personUgyId) ?? null)     : null;
    const photoUrl = resolvePhoto(galeriaEntry?.photoUrl ?? null, r.personName);

    return {
      id:                   r.id,
      personName:           r.personName,
      position:             r.position,
      crimes:               r.crimes,
      sentenceYears:        r.sentenceYears,
      sentenceMonths:       r.sentenceMonths ?? null,
      verdictType:          r.verdictType,
      verdictDateFormatted: fmtDateLong(new Date(r.verdictDate)),
      court:                r.court,
      summary:              r.summary,
      sourceUrls:           r.sourceUrls,
      sourceNames:          r.sourceNames,
      sourceHeadlines:      r.sourceHeadlines,
      sourceDates:          r.sourceDates,
      videoId:              r.videoId      ?? null,
      videoChannel:         r.videoChannel ?? null,
      videoTitle:           r.videoTitle   ?? null,
      videoSummary:         r.videoSummary ?? null,
      photoUrl,
      reactionQuote: VERDICT_PERSON_QUOTES[r.personName] ?? null,
      relatedUgy: ugyEntry ? {
        id:          ugyEntry.id,
        title:       ugyEntry.title,
        eyebrow:     ugyEntry.eyebrow,
        responsible: ugyEntry.responsible ?? undefined,
        summary:     ugyEntry.summary,
      } : null,
      relatedGaleria: galeriaEntry ? {
        id:       galeriaEntry.id,
        name:     galeriaEntry.name,
        subtitle: galeriaEntry.subtitle,
      } : null,
    };
  });

  return (
    <div className="news-section-wrap">
      <section className="section verdict-section" id="birosagi-iteletek">
        <div className="section-head">
          <div className="section-num">/ Bírósági ítéletek</div>
          <h2 className="section-title">Kiszabott börtönévek</h2>
        </div>

        <p className="rogues-deck" style={{ marginTop: 24, marginBottom: 32, color: 'var(--ink)' }}>
          NER-kapcsolatú ügyekben kiszabott jogerős és első fokú szabadságvesztés ítéletek —
          tényeket és forrásokat közlünk, nem kommentárt.
        </p>

        {rows.length === 0 ? (
          <div style={{ marginTop: 32, padding: '40px 24px', textAlign: 'center', color: '#888', border: '1px dashed #e0e0e0', borderRadius: 12 }}>
            Még nincs rögzített ítélet — az első jogerős ítélettel frissül az oldal.
          </div>
        ) : (
          <VerdictList rows={serialized} />
        )}
      </section>

      <div className="cross-promo-section">
        <div className="cross-promo-section-inner">
          <CrossLemondosok />
          <CrossMegszunt />
          <CrossUgyek />
          <CrossGaleria />
        </div>
      </div>
    </div>
  );
}
