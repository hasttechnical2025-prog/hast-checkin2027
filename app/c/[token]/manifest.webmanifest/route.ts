import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Manifest ĐỘNG theo token: start_url/scope = /c/[token]/ nên khi A2HS, icon trên màn
 * hình chính "đóng băng" đúng URL có token -> mở thẳng vào trang chấm công của người đó
 * (định danh ở PATH, không phụ thuộc localStorage — fix iOS).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // KHÔNG dấu "/" cuối: trang thật phục vụ ở /c/<token> (Next bỏ trailing slash).
  // Nếu scope có "/" cuối thì URL app luôn nằm NGOÀI scope -> Chrome hiện thanh địa chỉ,
  // không vào standalone. Để khớp URL thật, scope/start_url phải là /c/<token>.
  const base = `/c/${token}`;
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
      // PNG 192/512 là BẮT BUỘC để Android tạo app standalone thật (không thì ra shortcut mở trong trình duyệt).
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
