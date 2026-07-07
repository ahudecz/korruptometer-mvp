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
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_BADGE_DATA_URI} width={380} height={380} alt="" />
    </div>,
    size,
  );
}
