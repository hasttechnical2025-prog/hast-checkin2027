import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Ping siêu nhẹ để client xác minh CÓ THỰC SỰ ra được máy chủ hay không
 * (navigator.onLine không đáng tin — nhiều máy vẫn true dù đã tắt Wi-Fi/4G).
 * Trả 204, no-store. Service worker (public/sw.js) BỎ QUA path này để luôn đi mạng thật.
 */
export function GET() {
  return new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}
