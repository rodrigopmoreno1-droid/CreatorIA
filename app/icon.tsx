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
          background: '#ffffff',
          border: '18px solid rgba(15, 23, 42, 0.06)',
          borderRadius: '28%'
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 238,
            height: 238,
            borderRadius: 36,
            background: '#17171b'
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: 54,
              top: 60,
              width: 92,
              height: 8,
              borderRadius: 999,
              background: '#ffffff'
            }}
          />
          <span
            style={{
              position: 'absolute',
              left: 54,
              top: 96,
              width: 74,
              height: 8,
              borderRadius: 999,
              background: '#ffffff',
              opacity: 0.92
            }}
          />
          <span
            style={{
              position: 'absolute',
              left: 54,
              top: 132,
              width: 102,
              height: 8,
              borderRadius: 999,
              background: '#ffffff',
              opacity: 0.84
            }}
          />
          <span
            style={{
              position: 'absolute',
              right: 52,
              top: 58,
              width: 20,
              height: 20,
              borderRadius: 999,
              background: '#ffffff',
              opacity: 0.9
            }}
          />
        </div>
      </div>
    ),
    size
  );
}
