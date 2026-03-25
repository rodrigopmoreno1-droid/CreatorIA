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
          background: '#ffffff',
          border: '10px solid rgba(15, 23, 42, 0.06)',
          borderRadius: '28%'
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 92,
            height: 92,
            borderRadius: 22,
            background: '#17171b'
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: 20,
              top: 24,
              width: 34,
              height: 4,
              borderRadius: 999,
              background: '#ffffff'
            }}
          />
          <span
            style={{
              position: 'absolute',
              left: 20,
              top: 39,
              width: 28,
              height: 4,
              borderRadius: 999,
              background: '#ffffff',
              opacity: 0.92
            }}
          />
          <span
            style={{
              position: 'absolute',
              left: 20,
              top: 54,
              width: 38,
              height: 4,
              borderRadius: 999,
              background: '#ffffff',
              opacity: 0.84
            }}
          />
          <span
            style={{
              position: 'absolute',
              right: 18,
              top: 22,
              width: 8,
              height: 8,
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
