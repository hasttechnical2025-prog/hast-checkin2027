import { Suspense } from 'react';
import { getStaffSession } from '@/lib/auth';
import SignOutButton from '@/app/_components/SignOutButton';
import RememberGuard from '@/app/_components/RememberGuard';
import TbpHeader from './tbp-header';

/**
 * Khung chung cho khu TBP (cả 2 tab): header định danh + tab + thanh tháng.
 * Giữ nguyên khi chuyển tab -> không reset, cảm giác mượt; tháng dùng chung.
 */
export default async function TbpLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaffSession();

  return (
    <main className="tbp-page">
      <RememberGuard />

      {staff && (
        <div className="ls-top">
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>Trưởng bộ phận</h1>
            <div className="muted" style={{ fontSize: 13 }}>
              {staff.email} · {staff.role === 'admin' ? 'Admin (toàn công ty)' : staff.department}
              {staff.viewAll && staff.role !== 'admin' ? ' · xem toàn công ty' : ''}
            </div>
          </div>
          <SignOutButton />
        </div>
      )}

      <Suspense fallback={<div className="tbp-tabs" />}>
        <TbpHeader />
      </Suspense>

      {children}
    </main>
  );
}
