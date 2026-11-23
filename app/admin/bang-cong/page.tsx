import { vnNow } from '@/lib/attendance';
import { buildMonthMatrix } from '@/lib/bangcong';
import BangCongAdmin from './bang-cong-admin';

export const dynamic = 'force-dynamic';

const pad = (n: number) => String(n).padStart(2, '0');

export default async function BangCongPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const now = vnNow();
  const curY = Number(now.dateStr.slice(0, 4));
  const curM = Number(now.dateStr.slice(5, 7));
  let year = curY;
  let month = curM;
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const y = Number(m.slice(0, 4));
    const mo = Number(m.slice(5, 7));
    // Không cho vượt quá tháng hiện tại.
    if (mo >= 1 && mo <= 12 && y * 12 + mo <= curY * 12 + curM) {
      year = y;
      month = mo;
    }
  }

  // Admin xem toàn công ty; lọc theo phòng làm ở client (dropdown có đủ phòng).
  const matrix = await buildMonthMatrix(null, year, month);

  const idx = year * 12 + month;
  const curIdx = curY * 12 + curM;
  const toM = (i: number) => `${Math.floor((i - 1) / 12)}-${pad(((i - 1) % 12) + 1)}`;
  const prevHref = `/admin/bang-cong?m=${toM(idx - 1)}`;
  const nextHref = idx + 1 <= curIdx ? `/admin/bang-cong?m=${toM(idx + 1)}` : null;

  return <BangCongAdmin matrix={matrix} prevHref={prevHref} nextHref={nextHref} />;
}
