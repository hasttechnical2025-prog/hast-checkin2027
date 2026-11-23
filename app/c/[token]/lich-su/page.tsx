import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildMonthData } from '@/lib/month';
import { vnNow } from '@/lib/attendance';
import LichSu from './lich-su';

export const dynamic = 'force-dynamic';

export default async function LichSuPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const { token } = await params;
  const { m } = await searchParams;

  const admin = createAdminClient();
  const { data: emp } = await admin
    .from('chamcong_employees')
    .select('id, ma_nv, name, department, status, ngay_vao_lam')
    .eq('token', token)
    .maybeSingle();

  if (!emp || emp.status !== 'Đang làm việc') notFound();

  // Tháng đang xem: ?m=YYYY-MM, mặc định tháng hiện tại (giờ VN). Không cho xem tương lai.
  const now = vnNow();
  const [curY, curM] = [Number(now.dateStr.slice(0, 4)), Number(now.dateStr.slice(5, 7))];
  let year = curY;
  let month = curM;
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const y = Number(m.slice(0, 4));
    const mo = Number(m.slice(5, 7));
    if (mo >= 1 && mo <= 12 && y * 12 + mo <= curY * 12 + curM) {
      year = y;
      month = mo;
    }
  }

  const data = await buildMonthData(emp!.id, emp!.ngay_vao_lam ?? null, year, month);

  // maxIdx = tháng hiện tại (giờ VN) — client dùng để chặn sang tháng tương lai.
  const maxIdx = curY * 12 + curM;

  return (
    <LichSu
      token={token}
      employee={{ name: emp!.name, maNv: emp!.ma_nv }}
      data={data}
      maxIdx={maxIdx}
    />
  );
}
