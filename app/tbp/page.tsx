import { getStaffSession } from '@/lib/auth';
import { buildGiaiTrinhItems } from '@/lib/giaitrinh';
import { vnNow } from '@/lib/attendance';
import TbpGiaiTrinh from './tbp-giaitrinh';

export const dynamic = 'force-dynamic';

export default async function TbpPage({ searchParams }: { searchParams: Promise<{ m?: string; dept?: string }> }) {
  const staff = await getStaffSession();
  if (!staff) {
    return (
      <p className="muted">
        Không có quyền. <a href="/login">Đăng nhập</a>.
      </p>
    );
  }

  const { m, dept } = await searchParams;
  const now = vnNow();
  const curY = Number(now.dateStr.slice(0, 4));
  const curM = Number(now.dateStr.slice(5, 7));
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

  const isAdmin = staff.role === 'admin';
  const seeAll = isAdmin || staff.viewAll;
  const visibleDepts = seeAll ? null : [staff.department as string];
  const approverDept = isAdmin ? null : staff.department;

  const data = await buildGiaiTrinhItems(visibleDepts, approverDept, isAdmin, year, month);
  // Lọc phòng (?dept) chỉ áp dụng cho vai xem nhiều phòng (seeAll); TBP thường bỏ qua.
  const dep = seeAll && dept ? dept : '';

  return <TbpGiaiTrinh items={data.items} dept={dep} />;
}
