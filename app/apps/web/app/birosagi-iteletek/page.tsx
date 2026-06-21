import { desc } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { UGYEK } from '../_home/ugyek-config';
import { GALERIA } from '../_home/galeria-config';
import { VerdictList, type SerializedVerdict } from './VerdictList';
import { CrossLemondosok, CrossUgyek, CrossGaleria, CrossMegszunt } from '../_home/cross-promo';

export const revalidate = 120;

const HU_MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];

function fmtDateLong(d: Date): string {
  return `${d.getFullYear()}. ${HU_MONTHS[d.getMonth()]} ${d.getDate()}.`;
}

function resolvePhoto(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('/') || url.includes('wikimedia.org')) return url;
  return `/api/img-proxy?url=${encodeURIComponent(url)}`;
}

export default async function BirosagPage() {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.courtVerdicts)
    .orderBy(desc(schema.courtVerdicts.verdictDate));

  const serialized: SerializedVerdict[] = rows.map(r => {
    const galeriaEntry = r.personGaleriaId ? (GALERIA.find(g => g.id === r.personGaleriaId) ?? null) : null;
    const ugyEntry     = r.personUgyId     ? (UGYEK.find(u => u.id === r.personUgyId) ?? null)     : null;
    const photoUrl = resolvePhoto(galeriaEntry?.photoUrl ?? ugyEntry?.photo);

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
