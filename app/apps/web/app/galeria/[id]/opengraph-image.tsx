import { ImageResponse } from 'next/og';
import { GALERIA } from '../../_home/galeria-config';
import { LOGO_BADGE_DATA_URI } from '../../_og/logo-badge';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function detentionColor(detention: string): string {
  if (detention === 'busted') return '#e31937';
  if (detention === 'pretrial') return '#d97706';
  if (detention === 'investig') return '#0891b2';
  return '#6b7280';
}

export default function OGImage({ params }: { params: { id: string } }) {
  const entry = GALERIA.find((e) => e.id === params.id);

  const name = entry?.name ?? 'Ismeretlen';
  const subtitle = entry?.subtitle ?? '';
  const amount = entry?.amountLabel ?? '';
  const detentionLabel = entry?.detentionLabel ?? '';
  const detention = entry?.detention ?? 'loose';
  const crimes = entry?.crimes?.slice(0, 3) ?? [];

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
          padding: '56px 72px',
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
            marginBottom: 24,
            fontFamily: 'system-ui',
          }}
        >
          Kegyencjárat · Galéria
        </div>

        {/* Név */}
        <div
          style={{
            color: '#ffffff',
            fontSize: name.length > 16 ? 72 : 88,
            fontWeight: 900,
            lineHeight: 0.95,
            fontFamily: 'system-ui',
            letterSpacing: '-0.02em',
            marginBottom: 20,
          }}
        >
          {name}
        </div>

        {/* Szerepkör */}
        <div
          style={{
            color: '#8b9099',
            fontSize: 26,
            fontFamily: 'system-ui',
            marginBottom: 32,
          }}
        >
          {subtitle}
        </div>

        {/* Státusz + összeg */}
        <div style={{ display: 'flex', gap: 32, alignItems: 'center', marginBottom: 28 }}>
          {detentionLabel && (
            <div
              style={{
                color: detentionColor(detention),
                fontSize: 18,
                fontWeight: 700,
                fontFamily: 'system-ui',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                borderLeft: `3px solid ${detentionColor(detention)}`,
                paddingLeft: 12,
              }}
            >
              {detentionLabel}
            </div>
          )}
          {amount && (
            <div
              style={{
                color: '#ffffff',
                fontSize: 18,
                fontWeight: 700,
                fontFamily: 'system-ui',
              }}
            >
              {amount}
            </div>
          )}
        </div>

        {/* Bűncselekmények */}
        {crimes.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            {crimes.map((crime, i) => (
              <div
                key={i}
                style={{
                  background: '#1f2329',
                  color: '#8b9099',
                  fontSize: 14,
                  fontFamily: 'system-ui',
                  padding: '6px 14px',
                  borderRadius: 4,
                  border: '1px solid #2a2d34',
                }}
              >
                {crime}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* URL */}
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
    </div>,
    size,
  );
}
