import { ImageResponse } from 'next/og';
import { LOGO_BADGE_DATA_URI } from '../../_og/logo-badge';
import { getDb } from '@/lib/db';
import { getQuizWithQuestions } from '@/lib/quiz-queries';

// Node.js futtatókörnyezet (nem 'edge') — a Postgres-kapcsolat (postgres-js,
// nyers TCP-socket) a dinamikus kvíz-cím lekérdezéséhez edge-en nem
// működne megbízhatóan (l. a szavazás opengraph-image.tsx-ének azonos
// jegyzetét).
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const quiz = await getQuizWithQuestions(getDb(), slug);
  const title = quiz?.title ?? 'Kvíz a Kegyencjáraton';
  const questionCount = quiz?.questions.length ?? 0;

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
            Kegyencjárat · Kvíz
          </div>

          <div
            style={{
              color: '#ffffff',
              fontSize: 52,
              fontWeight: 900,
              lineHeight: 1.08,
              fontFamily: 'system-ui',
              letterSpacing: '-0.02em',
              marginBottom: 28,
              maxWidth: 980,
            }}
          >
            {title}
          </div>

          <div
            style={{
              color: '#8b9099',
              fontSize: 26,
              fontFamily: 'system-ui',
            }}
          >
            {questionCount} kérdés · Mennyire ismered az ügyet?
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
