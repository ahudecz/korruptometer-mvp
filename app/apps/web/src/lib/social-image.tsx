import 'server-only';
import { ImageResponse } from 'next/og';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatMilliardLabelShort } from './social-milestone';

/**
 * Márkázott, 1080×1080-as (FB + TikTok fotó-karusszel kompatibilis) PNG
 * generálása mérföldkő-/breaking-posztokhoz (l. check-social-triggers.ts).
 * user kérés, 2026-08-30.
 *
 * MEGJEGYZÉS a betűtípusról: a next/og (Satori) beépített alapértelmezett
 * fontja nincs explicit Hungarian-glyph-tesztelve — HA a ékezetes karakterek
 * (á/é/í/ó/ö/ő/ú/ü/ű) törötten jelennének meg, ide kell egy tényleges
 * font-fájlt (ArrayBuffer) betölteni a `fonts` opcióba. Mivel a Telegram-
 * jóváhagyási lépés MINDIG megmutatja a kész képet, mielőtt bármi kimegy
 * élesben (l. sendTelegramPhoto), ez emberi védőhálóval van fedve —
 * eddig nem volt rá bizonyíték, hogy szükség lenne rá.
 */

let logoDataUri: string | null = null;
function getLogoDataUri(): string {
  if (logoDataUri) return logoDataUri;
  const bytes = readFileSync(join(process.cwd(), 'public/images/brand/logo-wordmark.png'));
  logoDataUri = `data:image/png;base64,${bytes.toString('base64')}`;
  return logoDataUri;
}

// Fehér wordmark, piros nagyítós elem — sötét hátterű sablonokhoz (user
// report, 2026-08-31: a korábbi "fehér chip a fekete logó mögött" megoldás
// csúnya volt). Egyszeri, előre legenerált fájl (nem runtime-invertálás) —
// l. a generáló scriptet a memóriában, ha újra kellene készíteni.
let logoInverseDataUri: string | null = null;
function getLogoInverseDataUri(): string {
  if (logoInverseDataUri) return logoInverseDataUri;
  const bytes = readFileSync(join(process.cwd(), 'public/images/brand/logo-wordmark-inverse.png'));
  logoInverseDataUri = `data:image/png;base64,${bytes.toString('base64')}`;
  return logoInverseDataUri;
}

const INK = '#171a20';
const ACCENT = '#e31937';
const SURFACE = '#f4f4f4';

const SIZE = { width: 1080, height: 1080 } as const;

// Sötét hátterű sablonon a fehér-wordmark inverz logót használjuk (l.
// getLogoInverseDataUri), világos hátterűn az eredetit — user report,
// 2026-08-31.
function LogoChip({ width, dark }: { width: number; dark: boolean }) {
  const height = Math.round((width / 420) * 78);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={dark ? getLogoInverseDataUri() : getLogoDataUri()} alt="Kegyencjárat" width={width} height={height} style={{ objectFit: 'contain' }} />
  );
}

// Két váltogatható vizuál minden posztt-típushoz — a Telegram "🎨 Új
// design" gombja (l. check-social-triggers.ts / telegram/webhook route.ts)
// ezek között lép tovább. Nem élő Claude-generálás (a webhook egy előre
// megírt program, nem interaktív session) — l. project-social-auto-poster
// memória.
export type ImageVariant = 'dark' | 'light';

/** Mérföldkő-poszt: "Elérte a X milliárd Ft-ot a feljelentések összértéke". */
export async function renderMilestoneImage(
  params: { amountLabel: string; subline: string },
  variant: ImageVariant = 'dark',
): Promise<Buffer> {
  const dark = variant === 'dark';
  const bg = dark ? INK : '#ffffff';
  const kickerColor = dark ? '#9a9ca3' : '#5c5e62';
  const sublineColor = dark ? SURFACE : INK;
  const footerColor = dark ? '#9a9ca3' : '#5c5e62';

  const img = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: bg,
          padding: '80px 90px',
          fontFamily: 'sans-serif',
        }}
      >
        <LogoChip width={420} dark={dark} />

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', marginTop: 40 }}>
          <div style={{ display: 'flex', color: kickerColor, fontSize: 34, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
            Mérföldkő
          </div>
          {/* fontSize 108 + whiteSpace:nowrap — user report, 2026-08-31: a
              128px-es, "milliárd Ft" hosszú alak a "Ft"-nél új sorba tört.
              A hívó (check-social-triggers.ts) a kompakt "Mrd Ft" formát
              (formatMilliardLabelShort) adja ide, a teljes "milliárd Ft"
              csak a caption/headline szövegében marad. */}
          <div style={{ display: 'flex', color: ACCENT, fontSize: 108, fontWeight: 900, lineHeight: 1.05, marginTop: 16, whiteSpace: 'nowrap' }}>
            {params.amountLabel}
          </div>
          <div style={{ display: 'flex', color: sublineColor, fontSize: 44, fontWeight: 600, lineHeight: 1.3, marginTop: 24, maxWidth: 880 }}>
            {params.subline}
          </div>
        </div>

        <div style={{ display: 'flex', color: footerColor, fontSize: 32, fontWeight: 600 }}>kegyencjarat.hu</div>
      </div>
    ),
    SIZE,
  );
  return Buffer.from(await img.arrayBuffer());
}

/** Breaking-poszt: konkrét esemény (lemondás/megszűnés/ítélet/vagyonvisszaszerzés). */
export async function renderBreakingImage(
  params: {
    kicker: string; // pl. "LEMONDÁS" / "ÍTÉLET" / "MEGSZŰNÉS" / "VAGYONVISSZASZERZÉS"
    headline: string;
    detail?: string;
  },
  variant: ImageVariant = 'light',
): Promise<Buffer> {
  const dark = variant === 'dark';
  const bg = dark ? INK : '#ffffff';
  const headlineColor = dark ? '#ffffff' : INK;
  const detailColor = dark ? SURFACE : '#5c5e62';
  const footerColor = dark ? '#9a9ca3' : '#5c5e62';

  const img = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: bg,
          padding: '80px 90px',
          fontFamily: 'sans-serif',
        }}
      >
        <LogoChip width={380} dark={dark} />

        <div style={{ display: 'flex', marginTop: 56 }}>
          <div
            style={{
              display: 'flex',
              background: ACCENT,
              color: '#ffffff',
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: 2,
              padding: '14px 32px',
              borderRadius: 8,
            }}
          >
            🚨 {params.kicker}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
          <div style={{ display: 'flex', color: headlineColor, fontSize: 72, fontWeight: 900, lineHeight: 1.15, marginTop: 24 }}>
            {params.headline}
          </div>
          {params.detail && (
            <div style={{ display: 'flex', color: detailColor, fontSize: 38, fontWeight: 500, lineHeight: 1.35, marginTop: 28, maxWidth: 880 }}>
              {params.detail}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', color: footerColor, fontSize: 32, fontWeight: 600 }}>kegyencjarat.hu</div>
      </div>
    ),
    SIZE,
  );
  return Buffer.from(await img.arrayBuffer());
}

/**
 * Egy SocialPostOutbox sor jelenlegi mezőiből újragenerálja a képet — a
 * Telegram "✏️ Módosítás" gomb (kép-szöveg csere, "🎨 Új design" váltás)
 * ezt hívja, hogy ne kelljen a hívóban duplikálni a mérföldkő/breaking
 * elágazást (l. telegram/webhook route.ts 's' ág).
 */
export async function regenerateOutboxImage(row: {
  triggerType: string;
  milestoneValueFt: bigint | null;
  headline: string;
  kicker: string | null;
  imageText: string | null;
  imageVariant: string;
}): Promise<Buffer> {
  const variant: ImageVariant = row.imageVariant === 'light' ? 'light' : 'dark';
  if (row.triggerType === 'complaint_milestone') {
    const amountLabel = row.milestoneValueFt !== null ? formatMilliardLabelShort(row.milestoneValueFt) : '';
    return renderMilestoneImage({ amountLabel, subline: row.imageText ?? '' }, variant);
  }
  return renderBreakingImage({ kicker: row.kicker ?? '', headline: row.headline, detail: row.imageText || undefined }, variant);
}
