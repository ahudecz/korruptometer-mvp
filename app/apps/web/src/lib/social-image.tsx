import 'server-only';
import { ImageResponse } from 'next/og';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

const INK = '#171a20';
const ACCENT = '#e31937';
const SURFACE = '#f4f4f4';

const SIZE = { width: 1080, height: 1080 } as const;

/** Mérföldkő-poszt: "Elérte a X milliárd Ft-ot a feljelentések összértéke". */
export async function renderMilestoneImage(params: {
  amountLabel: string; // pl. "3000 milliárd Ft"
  subline: string; // pl. "NER-hez köthető feljelentések összértéke"
}): Promise<Buffer> {
  const img = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: INK,
          padding: '80px 90px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={getLogoDataUri()} alt="Kegyencjárat" width={420} height={78} style={{ objectFit: 'contain' }} />

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', marginTop: 40 }}>
          <div style={{ display: 'flex', color: '#9a9ca3', fontSize: 34, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
            Mérföldkő
          </div>
          <div style={{ display: 'flex', color: ACCENT, fontSize: 128, fontWeight: 900, lineHeight: 1.05, marginTop: 16 }}>
            {params.amountLabel}
          </div>
          <div style={{ display: 'flex', color: SURFACE, fontSize: 44, fontWeight: 600, lineHeight: 1.3, marginTop: 24, maxWidth: 880 }}>
            {params.subline}
          </div>
        </div>

        <div style={{ display: 'flex', color: '#9a9ca3', fontSize: 32, fontWeight: 600 }}>kegyencjarat.hu</div>
      </div>
    ),
    SIZE,
  );
  return Buffer.from(await img.arrayBuffer());
}

/** Breaking-poszt: konkrét esemény (lemondás/megszűnés/ítélet/vagyonvisszaszerzés). */
export async function renderBreakingImage(params: {
  kicker: string; // pl. "LEMONDÁS" / "ÍTÉLET" / "MEGSZŰNÉS" / "VAGYONVISSZASZERZÉS"
  headline: string;
  detail?: string;
}): Promise<Buffer> {
  const img = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          padding: '80px 90px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={getLogoDataUri()} alt="Kegyencjárat" width={380} height={70} style={{ objectFit: 'contain' }} />

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
          <div style={{ display: 'flex', color: INK, fontSize: 72, fontWeight: 900, lineHeight: 1.15, marginTop: 24 }}>
            {params.headline}
          </div>
          {params.detail && (
            <div style={{ display: 'flex', color: '#5c5e62', fontSize: 38, fontWeight: 500, lineHeight: 1.35, marginTop: 28, maxWidth: 880 }}>
              {params.detail}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', color: '#9a9ca3', fontSize: 32, fontWeight: 600 }}>kegyencjarat.hu</div>
      </div>
    ),
    SIZE,
  );
  return Buffer.from(await img.arrayBuffer());
}
