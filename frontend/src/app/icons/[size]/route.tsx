import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export async function GET(_req: NextRequest, context: { params: Promise<{ size: string }> }) {
  const { size: rawSize } = await context.params;
  const parsed = Number.parseInt(rawSize, 10);
  const dim = parsed === 512 ? 512 : 192;
  const circle = Math.round(dim * 0.42);
  const stroke = Math.max(8, Math.round(dim * 0.095));
  const barW = Math.round(dim * 0.54);
  const barH = stroke;
  const gap = Math.round(dim * 0.07);
  const radius = Math.round(dim * 0.22);

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
          borderRadius: radius,
          border: `${Math.max(4, Math.round(dim * 0.04))}px solid #ffd700`,
        }}
      >
        <div
          style={{
            width: circle,
            height: circle,
            borderRadius: 9999,
            border: `${stroke}px solid #ffd700`,
            marginBottom: gap,
          }}
        />
        <div
          style={{
            width: barW,
            height: barH,
            borderRadius: Math.round(barH / 2),
            background: '#ffe600',
          }}
        />
      </div>
    ),
    { width: dim, height: dim },
  );
}
