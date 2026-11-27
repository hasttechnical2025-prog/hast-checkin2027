import { vnNow } from '@/lib/attendance';
import { resolveViewMonth } from '@/lib/view-month';
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
  const { year, month, idx, curIdx } = resolveViewMonth(
    m,
    Number(now.dateStr.slice(0, 4)),
    Number(now.dateStr.slice(5, 7)),
    Number(now.dateStr.slice(8, 10)),
  );

  // Admin xem toàn công ty; lọc theo phòng làm ở client (dropdown có đủ phòng).
  const matrix = await buildMonthMatrix(null, year, month);

  const toM = (i: number) => `${Math.floor((i - 1) / 12)}-${pad(((i - 1) % 12) + 1)}`;
  const prevHref = `/admin/bang-cong?m=${toM(idx - 1)}`;
  const nextHref = idx + 1 <= curIdx ? `/admin/bang-cong?m=${toM(idx + 1)}` : null;

  return <BangCongAdmin matrix={matrix} prevHref={prevHref} nextHref={nextHref} />;
}
