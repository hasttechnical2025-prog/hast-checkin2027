import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSystemConfig } from '@/lib/config';
import { isPhone } from '@/lib/device';
import { vnNow } from '@/lib/attendance';
import ChamCong from './cham-cong';
import DeviceBlock from './device-block';
import PwaClient from './pwa-client';

// Định danh CBNV ở PATH (token). Server giải định danh mỗi request -> không phụ thuộc
// localStorage/cookie (fix iOS). Luôn render động.
export const dynamic = 'force-dynamic';

// Manifest ĐỘNG theo token + meta iOS A2HS (chỉ trang CBNV là PWA cài được).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  return {
    title: 'Chấm Công HSTC',
    manifest: `/c/${token}/manifest.webmanifest`,
    appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Chấm Công' },
    icons: { apple: '/icon.svg', icon: '/icon.svg' },
    // iOS đời cũ vẫn cần meta apple-prefixed để A2HS vào chế độ standalone.
    other: { 'apple-mobile-web-app-capable': 'yes' },
  };
}

export default async function CbnvPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: emp } = await admin
    .from('chamcong_employees')
    .select('id, ma_nv, name, department, status')
    .eq('token', token)
    .maybeSingle();

  if (!emp || emp.status !== 'Đang làm việc') {
    notFound();
  }

  const cfg = await getSystemConfig();

  // Công tắc "chỉ điện thoại": chặn NGAY khi mở trang trên PC / máy tính bảng / iPad,
  // thay vì cho thao tác rồi mới báo khi bấm chấm công.
  if (cfg.requireMobile) {
    const h = await headers();
    if (!isPhone(h.get('user-agent'))) {
      const host = h.get('host') ?? '';
      const proto = h.get('x-forwarded-proto') ?? 'https';
      return <DeviceBlock url={`${proto}://${host}/c/${token}`} employeeName={emp!.name} />;
    }
  }

  const { dateStr, dow } = vnNow();

  // Bản ghi ngày hôm nay (để hiện tiến trình 4 ca)
  const { data: today } = await admin
    .from('chamcong_attendance_records')
    .select('morning_in, morning_out, afternoon_in, afternoon_out, grades')
    .eq('employee_id', emp!.id)
    .eq('date', dateStr)
    .maybeSingle();

  // Trạng thái ngày nghỉ (để khóa chấm công)
  let holiday = { isHoliday: false, reason: '' };
  if (!cfg.allowHoliday) {
    if (dow === 0 || dow === 6) {
      holiday = { isHoliday: true, reason: `Hôm nay là ${dow === 0 ? 'Chủ Nhật' : 'Thứ Bảy'} — ngày nghỉ.` };
    } else {
      const { data: hol } = await admin
        .from('chamcong_holidays')
        .select('description')
        .eq('date', dateStr)
        .maybeSingle();
      if (hol) holiday = { isHoliday: true, reason: `Hôm nay là ${hol.description} — ngày nghỉ lễ.` };
    }
  }

  // Nội dung hướng dẫn (p1..p4) cho sheet Cài đặt.
  const { data: guideRows } = await admin
    .from('chamcong_guide_content')
    .select('id, title, content')
    .order('id');
  const guide = (guideRows ?? []).map((g) => ({
    id: g.id as string,
    title: (g.title as string) || '',
    content: (g.content as string) || '',
  }));

  return (
    <>
      <ChamCong
        token={token}
        employee={{ name: emp!.name, maNv: emp!.ma_nv, department: emp!.department }}
        office={cfg.office}
        maxDistance={cfg.maxDistance}
        gpsExpireMs={cfg.gpsExpireMs}
        companyName={cfg.companyName}
        today={today ?? null}
        holiday={holiday}
        guide={guide}
      />
      <PwaClient />
    </>
  );
}
