import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
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
          borderRadius: 8,
          border: '2px solid #ffd700',
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            border: '3.5px solid #ffd700',
            marginBottom: 2,
          }}
        />
        <div
          style={{
            width: 18,
            height: 3.5,
            borderRadius: 2,
            background: '#ffe600',
          }}
        />
      </div>
    ),
    { ...size },
  );
}
