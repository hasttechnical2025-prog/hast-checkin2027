'use client';

import { useEffect, useState } from 'react';

/** Vẽ QR (dataURL) cho một chuỗi — qrcode nạp động. */
export default function QrCode({ text, size = 180 }: { text: string; size?: number }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let active = true;
    import('qrcode')
      .then((QR) => QR.toDataURL(text, { margin: 1, width: size }))
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [text, size]);

  if (!src) {
    return (
      <div style={{ width: size, height: size, display: 'grid', placeItems: 'center' }} className="muted">
        …
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="QR" width={size} height={size} style={{ display: 'block' }} />;
}
