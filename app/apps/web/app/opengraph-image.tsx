import { ImageResponse } from 'next/og';
import { LOGO_BADGE_DATA_URI } from './_og/logo-badge';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#171a20',
        display: 'flex',
        alignItems: 'stretch',
        padding: 0,
      }}
    >
      {/* Piros oldalsáv */}
      <div style={{ width: 12, background: '#e31937', flexShrink: 0 }} />

      {/* Tartalom — nagy logó + egyetlen jól olvasható sor */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 56,
          padding: '0 80px',
          flex: 1,
        }}
      >
        <div
          style={{
            width: 240,
            height: 240,
            borderRadius: 32,
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_BADGE_DATA_URI} width={176} height={176} alt="" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 740 }}>
          <div
            style={{
              color: '#e31937',
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '0.02em',
              marginBottom: 20,
              fontFamily: 'system-ui',
            }}
          >
            Kegyencjárat
          </div>
          <div
            style={{
              color: '#ffffff',
              fontSize: 58,
              fontWeight: 900,
              lineHeight: 1.08,
              fontFamily: 'system-ui',
              letterSpacing: '-0.02em',
            }}
          >
            Megszűnt már a propaganda?
          </div>
        </div>
      </div>

      {/* URL */}
      <div
        style={{
          position: 'absolute',
          right: 64,
          bottom: 48,
          color: '#4b5563',
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
