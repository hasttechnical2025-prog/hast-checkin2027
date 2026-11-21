import { getStaffSession } from '@/lib/auth';
import { buildGiaiTrinhItems } from '@/lib/giaitrinh';
import { vnNow } from '@/lib/attendance';
import SignOutButton from '@/app/_components/SignOutButton';
import RememberGuard from '@/app/_components/RememberGuard';
import TbpGiaiTrinh from './tbp-giaitrinh';

export const dynamic = 'force-dynamic';

const pad = (n: number) => String(n).padStart(2, '0');

export default async function TbpPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const staff = await getStaffSession();
  if (!staff) {
    return (
      <main className="wrap">
        <p>Không có quyền. <a href="/login">Đăng nhập</a>.</p>
      </main>
    );
  }

  const { m } = await searchParams;
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

  const idx = year * 12 + month;
  const toM = (i: number) => `${Math.floor((i - 1) / 12)}-${pad(((i - 1) % 12) + 1)}`;
  const canNext = idx + 1 <= curY * 12 + curM;

  return (
    <main className="tbp-page">
      <RememberGuard />
      <div className="ls-top">
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Trưởng bộ phận</h1>
          <div className="muted" style={{ fontSize: 13 }}>
            {staff.email} · {isAdmin ? 'Admin (toàn công ty)' : staff.department}
            {staff.viewAll && !isAdmin ? ' · xem toàn công ty' : ''}
          </div>
        </div>
        <SignOutButton />
      </div>

      <TbpGiaiTrinh
        items={data.items}
        departments={data.departments}
        year={year}
        month={month}
        prevHref={`/tbp?m=${toM(idx - 1)}`}
        nextHref={canNext ? `/tbp?m=${toM(idx + 1)}` : null}
        isAdmin={isAdmin}
      />
    </main>
  );
}
