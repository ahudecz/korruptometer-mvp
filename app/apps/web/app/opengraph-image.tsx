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

      {/* Tartalom */}
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
            marginBottom: 28,
            fontFamily: 'system-ui',
          }}
        >
          Független adatbázis · 2026
        </div>

        {/* Főcím */}
        <div
          style={{
            color: '#ffffff',
            fontSize: 100,
            fontWeight: 900,
            lineHeight: 0.95,
            fontFamily: 'system-ui',
            letterSpacing: '-0.03em',
          }}
        >
          KEGYENC
        </div>
        <div
          style={{
            color: '#ffffff',
            fontSize: 100,
            fontWeight: 900,
            lineHeight: 0.95,
            fontFamily: 'system-ui',
            letterSpacing: '-0.03em',
            marginBottom: 36,
          }}
        >
          JÁRAT
        </div>

        {/* Alcím */}
        <div
          style={{
            color: '#8b9099',
            fontSize: 26,
            fontFamily: 'system-ui',
            lineHeight: 1.45,
            maxWidth: 700,
          }}
        >
          Magyar korrupciós ügyek nyilvános adatbázisa — adatokra, nem szólamokra alapozva.
        </div>

        {/* URL */}
        <div
          style={{
            color: '#4b5563',
            fontSize: 18,
            marginTop: 44,
            fontFamily: 'system-ui',
            letterSpacing: '0.04em',
          }}
        >
          korruptometer.vercel.app
        </div>
      </div>

      {/* Jobb oldali dekor — piros négyzet sarokba */}
      <div
        style={{
          position: 'absolute',
          right: 60,
          bottom: 60,
          width: 64,
          height: 64,
          background: '#e31937',
          opacity: 0.15,
        }}
      />
    </div>,
    size,
  );
}
