import { ImageResponse } from 'next/og';

export const size = {
  width: 512,
  height: 512
};

export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(circle at 30% 20%, rgba(45, 212, 191, 0.45), transparent 34%), linear-gradient(180deg, #111827, #0f172a)',
          color: 'white',
          fontSize: 180,
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
