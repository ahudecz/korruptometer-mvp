import { ImageResponse } from 'next/og';
import { LOGO_BADGE_DATA_URI } from '../../_og/logo-badge';
import { getDb } from '@/lib/db';
import { getQuizWithQuestions } from '@/lib/quiz-queries';

// Node.js futtatókörnyezet (nem 'edge') — a Postgres-kapcsolat (postgres-js,
// nyers TCP-socket) a dinamikus kvíz-cím lekérdezéséhez edge-en nem
// működne megbízhatóan (l. a szavazás opengraph-image.tsx-ének azonos
// jegyzetét).
export const runtime = 'nodejs';
// A postgres-js (nyers TCP) DB-hívást a Next.js nem tudja automatikusan
// dinamikusként felismerni (csak a fetch()-eket figyeli) — enélkül a
// route STATIKUSAN gettelődött volna be a build/első-kérés
// pillanatában, és Cache-Control: immutable, max-age=1 év fejléccel
// örökre azt a snapshotot szolgálta volna ki, akárhányszor frissül is
// utána a DB (user report, 2026-09-04: a kvíz-cím frissítése az oldalon
// azonnal látszott, az OG-képen nem — l. [slug]/page.tsx azonos
// dynamic='force-dynamic' jegyzetét).
export const dynamic = 'force-dynamic';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Ugyanaz az elv, mint a layout.tsx metadataBase-ében: a coverImageUrl
// relatív útvonalát (pl. '/images/persons/matolcsy-gyorgy.png') abszolút
// URL-lé kell alakítani, hogy a next/og (satori) valóban le tudja tölteni
// renderléskor — SOSE a belső *.vercel.app aliasra essen a fallback (l.
// layout.tsx jegyzete: 2026-07-17-i Messenger-előnézet bugfix ugyanerre).
const appUrl = process.env.NEXT_PUBLIC_APP_URL?.startsWith('http')
  ? process.env.NEXT_PUBLIC_APP_URL
  : 'https://www.kegyencjarat.hu';

export default async function OGImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const quiz = await getQuizWithQuestions(getDb(), slug);
  const title = quiz?.title ?? 'Kvíz a Kegyencjáraton';
  const questionCount = quiz?.questions.length ?? 0;
  const coverImageUrl = quiz?.coverImageUrl ? `${appUrl}${quiz.coverImageUrl}` : null;

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
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '64px 56px',
            flex: 1,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              color: '#e31937',
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              marginBottom: 32,
              fontFamily: 'system-ui',
            }}
          >
            Kegyencjárat · Kvíz
          </div>

          <div
            style={{
              display: 'flex',
              color: '#ffffff',
              fontSize: coverImageUrl ? 46 : 52,
              fontWeight: 900,
              lineHeight: 1.1,
              fontFamily: 'system-ui',
              letterSpacing: '-0.02em',
              marginBottom: 28,
              maxWidth: coverImageUrl ? 620 : 980,
            }}
          >
            {title}
          </div>

          <div
            style={{
              display: 'flex',
              color: '#8b9099',
              fontSize: 26,
              fontFamily: 'system-ui',
            }}
          >
            {questionCount} kérdés · Mennyire ismered az ügyet?
          </div>
        </div>

        {coverImageUrl !== null ? (
          <div
            style={{
              position: 'relative',
              width: 440,
              flexShrink: 0,
              display: 'flex',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImageUrl}
              width={440}
              height={630}
              style={{ objectFit: 'cover', width: 440, height: 630 }}
              alt=""
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(90deg, #171a20 0%, rgba(23,26,32,0) 22%)',
                display: 'flex',
              }}
            />
          </div>
        ) : null}

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
            position: 'absolute',
            left: 64,
            bottom: 60,
            color: coverImageUrl ? '#5a5e66' : '#2a2d34',
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
