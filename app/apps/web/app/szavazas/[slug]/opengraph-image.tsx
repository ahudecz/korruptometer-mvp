import { ImageResponse } from 'next/og';
import { LOGO_BADGE_DATA_URI } from '../../_og/logo-badge';
import { getDb } from '@/lib/db';
import { getPollWithResults } from '@/lib/poll-queries';

// Node.js futtatókörnyezet (nem 'edge') — a Postgres-kapcsolat (postgres-js,
// nyers TCP-socket) a dinamikus kérdésszöveg lekérdezéséhez edge-en nem
// működne megbízhatóan.
export const runtime = 'nodejs';
// A postgres-js (nyers TCP) DB-hívást a Next.js nem tudja automatikusan
// dinamikusként felismerni (csak a fetch()-eket figyeli) — enélkül a
// route STATIKUSAN gettelődött volna be a build/első-kérés
// pillanatában, és Cache-Control: immutable, max-age=1 év fejléccel
// örökre azt a snapshotot szolgálta volna ki (l. a kvíz azonos
// opengraph-image.tsx-ének 2026-09-04-i bugfix-jegyzetét, ahol ez
// ténylegesen elő is fordult).
export const dynamic = 'force-dynamic';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const poll = await getPollWithResults(getDb(), slug);
  const questionText = poll?.question.questionText ?? 'Szavazás a Kegyencjáraton';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#171a20',
          display: 'flex',
          alignItems: 'stretch',
        }}
      >
        <div style={{ width: 12, background: '#e31937', flexShrink: 0 }} />

        <div
          style={{
            position: 'absolute',
            top: 56,
            right: 64,
            width: 76,
            height: 76,
            borderRadius: 16,
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_BADGE_DATA_URI} width={52} height={52} alt="" />
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '64px 72px',
            flex: 1,
          }}
        >
          <div
            style={{
              color: '#e31937',
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              marginBottom: 32,
              fontFamily: 'system-ui',
            }}
          >
            Kegyencjárat · Szólj bele
          </div>

          <div
            style={{
              color: '#ffffff',
              fontSize: 56,
              fontWeight: 900,
              lineHeight: 1.05,
              fontFamily: 'system-ui',
              letterSpacing: '-0.02em',
              marginBottom: 28,
              maxWidth: 980,
            }}
          >
            {questionText}
          </div>

          <div
            style={{
              color: '#8b9099',
              fontSize: 26,
              fontFamily: 'system-ui',
            }}
          >
            Szavazz te is, és jelezd, mi számít neked!
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            right: 60,
            bottom: 60,
            color: '#2a2d34',
            fontSize: 18,
            fontFamily: 'system-ui',
            letterSpacing: '0.04em',
          }}
        >
          kegyencjarat.hu
        </div>
      </div>
    ),
    size,
  );
}
