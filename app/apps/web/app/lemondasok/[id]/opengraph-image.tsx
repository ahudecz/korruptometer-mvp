import { ImageResponse } from 'next/og';
import { WATCH_LIST } from '../../_home/watchlist-config';
import { LOGO_BADGE_DATA_URI } from '../../_og/logo-badge';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function statusLabel(status: string): string {
  if (status === 'resigned') return 'Lemondott';
  if (status === 'removed') return 'Eltávolítva';
  return 'Hivatalban van';
}

function statusColor(status: string): string {
  if (status === 'active') return '#2a8a4a';
  return '#e31937';
}

export default function OGImage({ params }: { params: { id: string } }) {
  const person = WATCH_LIST.find((p) => p.id === params.id);

  const name = person?.name ?? 'Ismeretlen';
  const institution = person?.institution ?? '';
  const status = person?.status ?? 'active';

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#171a20',
        display: 'flex',
        alignItems: 'stretch',
      }}
    >
      {/* Piros oldalsáv */}
      <div style={{ width: 12, background: '#e31937', flexShrink: 0 }} />

      {/* Logó jelvény */}
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
        {/* Label */}
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
          Kegyencjárat · Lemondott-e már?
        </div>

        {/* Név */}
        <div
          style={{
            color: '#ffffff',
            fontSize: 88,
            fontWeight: 900,
            lineHeight: 0.95,
            fontFamily: 'system-ui',
            letterSpacing: '-0.02em',
            marginBottom: 28,
          }}
        >
          {name}
        </div>

        {/* Intézmény */}
        <div
          style={{
            color: '#8b9099',
            fontSize: 28,
            fontFamily: 'system-ui',
            marginBottom: 40,
          }}
        >
          {institution}
        </div>

        {/* Státusz badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: statusColor(status),
              flexShrink: 0,
            }}
          />
          <div
            style={{
              color: statusColor(status),
              fontSize: 22,
              fontWeight: 700,
              fontFamily: 'system-ui',
              letterSpacing: '0.02em',
            }}
          >
            {statusLabel(status)}
          </div>
        </div>
      </div>

      {/* Jobb sarok dekor */}
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
        korruptometer.vercel.app
      </div>
    </div>,
    size,
  );
}
