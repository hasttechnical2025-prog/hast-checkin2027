import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSystemConfig, getGuideContent, getShiftConfig } from '@/lib/config';
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
    icons: { apple: '/apple-touch-icon.png', icon: '/icon-192.png' },
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

  // emp + cấu hình hệ thống độc lập nhau -> chạy SONG SONG (giảm 1 chặng mạng).
  const [{ data: emp }, cfg] = await Promise.all([
    admin
      .from('chamcong_employees')
      .select('id, ma_nv, name, department, status, loai_ca')
      .eq('token', token)
      .maybeSingle(),
    getSystemConfig(),
  ]);

  if (!emp || emp.status !== 'Đang làm việc') {
    notFound();
  }

  // Công tắc "chỉ điện thoại": chặn NGAY khi mở trang trên PC / máy tính bảng / iPad
  // (trước khi query các dữ liệu nặng), thay vì cho thao tác rồi mới báo khi bấm chấm công.
  if (cfg.requireMobile) {
    const h = await headers();
    if (!isPhone(h.get('user-agent'))) {
      const host = h.get('host') ?? '';
      const proto = h.get('x-forwarded-proto') ?? 'https';
      return <DeviceBlock url={`${proto}://${host}/c/${token}`} employeeName={emp.name} />;
    }
  }

  const { dateStr, dow } = vnNow();
  const needHolidayLookup = !cfg.allowHoliday && dow !== 0 && dow !== 6;

  // 4 nguồn còn lại chạy SONG SONG (thay vì tuần tự). guide/shift có data-cache nên
  // thường không chạm DB -> mở app chỉ còn ~2 chặng mạng: [emp+cfg] rồi [today+holiday].
  const [todayRes, holRes, guide, shiftConfig] = await Promise.all([
    admin
      .from('chamcong_attendance_records')
      .select('morning_in, morning_out, afternoon_in, afternoon_out, grades')
      .eq('employee_id', emp.id)
      .eq('date', dateStr)
      .maybeSingle(),
    needHolidayLookup
      ? admin.from('chamcong_holidays').select('description').eq('date', dateStr).maybeSingle()
      : Promise.resolve({ data: null as { description: string } | null }),
    getGuideContent(),
    getShiftConfig(emp.loai_ca || 'tieu_chuan'),
  ]);

  const today = todayRes.data;

  // Trạng thái ngày nghỉ (để khóa chấm công)
  let holiday = { isHoliday: false, reason: '' };
  if (!cfg.allowHoliday) {
    if (dow === 0 || dow === 6) {
      holiday = { isHoliday: true, reason: `Hôm nay là ${dow === 0 ? 'Chủ Nhật' : 'Thứ Bảy'} — ngày nghỉ.` };
    } else if (holRes.data) {
      holiday = { isHoliday: true, reason: `Hôm nay là ${holRes.data.description} — ngày nghỉ lễ.` };
    }
  }

  return (
    <>
      {/*
        Đăng ký service worker NGAY từ đầu (chạy khi trang vừa parse, không đợi React mount
        component nặng) + TỰ TẢI LẠI 1 lần khi SW vừa nắm quyền trang. Lý do: Chrome Android
        kiểm "cài được không" ngay lúc trang tải xong; nếu lúc đó chưa có SW kiểm soát (lần đầu
        mở từ QR, SW đăng ký muộn ~5s) -> Chrome chốt "This app cannot be installed" và không
        kiểm lại. Tải lại 1 lần để lần sau trang có SW kiểm soát ngay từ đầu -> Chrome mời Cài đặt.
      */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){if(!('serviceWorker' in navigator))return;try{navigator.serviceWorker.register('/sw.js');}catch(e){}if(!navigator.serviceWorker.controller){var done=false;navigator.serviceWorker.addEventListener('controllerchange',function(){if(done)return;done=true;location.reload();});}})();",
        }}
      />
      <ChamCong
        token={token}
        employee={{ name: emp.name, maNv: emp.ma_nv, department: emp.department }}
        office={cfg.office}
        maxDistance={cfg.maxDistance}
        gpsExpireMs={cfg.gpsExpireMs}
        companyName={cfg.companyName}
        today={today ?? null}
        holiday={holiday}
        guide={guide}
        shiftConfig={shiftConfig}
      />
      <PwaClient />
    </>
  );
}
