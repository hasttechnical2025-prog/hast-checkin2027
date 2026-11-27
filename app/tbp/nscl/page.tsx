import { getStaffSession } from '@/lib/auth';
import { buildNsclData } from '@/lib/nscl';
import { vnNow } from '@/lib/attendance';
import { resolveViewMonth } from '@/lib/view-month';
import NsclGrid from './nscl-grid';

export const dynamic = 'force-dynamic';

export default async function NsclPage({ searchParams }: { searchParams: Promise<{ m?: string; dept?: string }> }) {
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
  const { year, month } = resolveViewMonth(
    m,
    Number(now.dateStr.slice(0, 4)),
    Number(now.dateStr.slice(5, 7)),
    Number(now.dateStr.slice(8, 10)),
  );

  const isAdmin = staff.role === 'admin';
  const seeAll = isAdmin || staff.viewAll;
  const visibleDepts = seeAll ? null : [staff.department as string];
  const editorDept = isAdmin ? null : (staff.department as string | null);

  const data = await buildNsclData(visibleDepts, editorDept, isAdmin, year, month);
  // Phòng áp dụng: chưa chọn -> mặc định theo vai (Admin=tất cả, view_all=phòng mình);
  // 'all' -> tất cả; còn lại -> tên phòng.
  const dep = !seeAll
    ? ''
    : dept === undefined
      ? isAdmin
        ? ''
        : staff.department || ''
      : dept === 'all'
        ? ''
        : dept;

  return <NsclGrid data={data} isAdmin={isAdmin} seeAll={seeAll} ownDept={staff.department} dept={dep} />;
}
