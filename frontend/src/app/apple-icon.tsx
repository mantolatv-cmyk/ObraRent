import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#070b12',
          borderRadius: 40,
          border: '8px solid #ffd700',
        }}
      >
        <div
          style={{
            width: 78,
            height: 78,
            borderRadius: 999,
            border: '18px solid #ffd700',
            marginBottom: 14,
          }}
        />
        <div
          style={{
            width: 100,
            height: 18,
            borderRadius: 9,
            background: '#ffe600',
          }}
        />
      </div>
    ),
    { ...size },
  );
}
