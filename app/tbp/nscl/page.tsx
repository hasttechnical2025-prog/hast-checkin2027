import { getStaffSession } from '@/lib/auth';
import { buildNsclData } from '@/lib/nscl';
import { vnNow } from '@/lib/attendance';
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
