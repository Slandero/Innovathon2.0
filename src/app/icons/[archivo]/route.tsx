import { ImageResponse } from 'next/og';

// PNG del ícono de la PWA generado al vuelo: /icons/icon-192.png y /icons/icon-512.png
export const runtime = 'edge';

export function GET(_req: Request, { params }: { params: { archivo: string } }) {
  const m = params.archivo.match(/^icon-(\d+)\.png$/);
  const size = m ? Math.min(1024, Number(m[1])) : 192;
  const pin = Math.round(size * 0.52);
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, background: '#7C5CFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={pin} height={pin} viewBox="0 0 24 24">
          <path fill="#fff" d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
