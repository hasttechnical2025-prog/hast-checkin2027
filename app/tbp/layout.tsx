import { Suspense } from 'react';
import Link from 'next/link';
import { getStaffSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import SignOutButton from '@/app/_components/SignOutButton';
import RememberGuard from '@/app/_components/RememberGuard';
import { Icon } from '@/app/_components/icons';
import { getDepartments } from '@/lib/config';
import StickyTop from './StickyTop';
import TbpHeader from './tbp-header';

/**
 * Khung chung cho khu TBP (cả 2 tab): header định danh + tab + thanh tháng.
 * Giữ nguyên khi chuyển tab -> không reset, cảm giác mượt; tháng dùng chung.
 */
export default async function TbpLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaffSession();
  const seeAll = !!staff && (staff.role === 'admin' || staff.viewAll);
  const departments = seeAll ? await getDepartments() : [];
  // Mặc định khi chưa chọn phòng: Admin = tất cả (''); view_all = phòng của chính mình.
  const defaultDept = staff && staff.role !== 'admin' ? staff.department || '' : '';

  // Họ tên TBP của phòng (role=TBP) để hiển thị thay cho email; Admin/không có -> dùng email.
  // RLS cho phép TBP đọc nhân viên phòng mình nên dùng client phía server (không service role).
  let displayName: string | null = null;
  if (staff?.department) {
    try {
      const supabase = await createClient();
      const { data: tbpEmp } = await supabase
        .from('chamcong_employees')
        .select('name')
        .eq('department', staff.department)
        .eq('role', 'TBP')
        .limit(1)
        .maybeSingle();
      displayName = tbpEmp?.name ?? null;
    } catch {
      /* lỗi đọc -> giữ null, fallback email */
    }
  }

  return (
    <main className="tbp-page">
      <RememberGuard />

      <StickyTop>
        {staff && (
          <div className="ls-top">
            <div>
              <h1 style={{ margin: 0, fontSize: 18 }}>Duyệt giải trình công &amp; Chấm điểm NSCL</h1>
              <div className="muted">
                {displayName || staff.email} · {staff.role === 'admin' ? 'Admin (toàn công ty)' : staff.department}
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
          <TbpHeader departments={departments} seeAll={seeAll} defaultDept={defaultDept} />
        </Suspense>
      </StickyTop>

      {children}
    </main>
  );
}
