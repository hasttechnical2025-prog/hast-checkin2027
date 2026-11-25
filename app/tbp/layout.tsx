import { Suspense } from 'react';
import Link from 'next/link';
import { getStaffSession } from '@/lib/auth';
import SignOutButton from '@/app/_components/SignOutButton';
import RememberGuard from '@/app/_components/RememberGuard';
import { Icon } from '@/app/_components/icons';
import StickyTop from './StickyTop';
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

      <StickyTop>
        {staff && (
          <div className="ls-top">
            <div>
              <h1 style={{ margin: 0, fontSize: 22 }}>Trưởng bộ phận</h1>
              <div className="muted">
                {staff.email} · {staff.role === 'admin' ? 'Admin (toàn công ty)' : staff.department}
                {staff.viewAll && staff.role !== 'admin' ? ' · xem toàn công ty' : ''}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {staff.role === 'admin' && (
                <Link
                  href="/admin"
                  className="btn-undo"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Icon name="settings" size={15} /> Quản trị
                </Link>
              )}
              <SignOutButton />
            </div>
          </div>
        )}

        <Suspense fallback={<div className="tbp-headrow" />}>
          <TbpHeader />
        </Suspense>
      </StickyTop>

      {children}
    </main>
  );
}
