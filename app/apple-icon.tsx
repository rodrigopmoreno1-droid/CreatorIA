import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180
};

export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #0f172a, #111827)',
          color: 'white',
          fontSize: 72,
          fontWeight: 700,
          borderRadius: '28%'
        }}
      >
        C
      </div>
    ),
    size
  );
}
