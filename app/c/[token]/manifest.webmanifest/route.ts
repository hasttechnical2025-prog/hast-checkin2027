import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Manifest ĐỘNG theo token: start_url/scope = /c/[token]/ nên khi A2HS, icon trên màn
 * hình chính "đóng băng" đúng URL có token -> mở thẳng vào trang chấm công của người đó
 * (định danh ở PATH, không phụ thuộc localStorage — fix iOS).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const base = `/c/${token}/`;
  const manifest = {
    name: 'Chấm Công HSTC',
    short_name: 'Chấm Công',
    id: base,
    start_url: base,
    scope: base,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#1a73e8',
    lang: 'vi',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
