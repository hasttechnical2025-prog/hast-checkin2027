import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSystemConfig } from '@/lib/config';
import { sendTelegram } from '@/lib/telegram';
import {
  haversine,
  vnNow,
  sessionFromHHMM,
  sessionLabel,
  STATUS_OK,
  STATUS_OUT,
  type Session,
} from '@/lib/attendance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CheckinBody {
  token: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  note?: string;
  confirm?: boolean; // xác nhận chấm trùng ca
  deviceId?: string;
}

/**
 * Đường GHI chấm công DUY NHẤT. Server (service role) tự:
 *  - giải token -> nhân viên (client không gửi tên)
 *  - chặn ngày nghỉ (trừ allow_holiday)
 *  - tính khoảng cách; vượt max_distance -> chặn
 *  - cảnh báo chấm trùng ca (trừ allow_multiple) -> cần confirm
 *  - reverse geocode (best-effort) rồi INSERT log; trigger tổng hợp record + chấm A/B/D.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as CheckinBody | null;
  if (
    !body ||
    typeof body.token !== 'string' ||
    typeof body.latitude !== 'number' ||
    typeof body.longitude !== 'number'
  ) {
    return NextResponse.json({ error: 'Thiếu dữ liệu chấm công.' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: emp } = await admin
    .from('chamcong_employees')
    .select('id, name, status, telegram_chat_id')
    .eq('token', body.token)
    .maybeSingle();

  if (!emp || emp.status !== 'Đang làm việc') {
    return NextResponse.json({ error: 'Token không hợp lệ hoặc đã bị thu hồi.' }, { status: 401 });
  }

  // Chống chấm hộ: nếu nhân viên đã có thiết bị ACTIVE, chỉ thiết bị đó được chấm.
  // Chưa có bind nào -> cho qua (tương thích ngược / chưa đăng nhập bind).
  const deviceId = req.cookies.get('hstc_device')?.value || null;
  const { data: binds } = await admin
    .from('chamcong_device_bind')
    .select('device_id, is_active')
    .eq('employee_id', emp.id);
  if (binds && binds.length > 0) {
    const active = binds.find((b) => b.is_active);
    if (active && active.device_id !== deviceId) {
      return NextResponse.json(
        {
          error: 'Thiết bị này chưa được duyệt để chấm công. Vui lòng chờ!',
          blocked: 'device',
        },
        { status: 403 },
      );
    }
  }

  const cfg = await getSystemConfig();

  // Công tắc: chỉ cho chấm công trên điện thoại (khóa PC) — nhận diện qua User-Agent.
  if (cfg.requireMobile) {
    const ua = req.headers.get('user-agent') || '';
    const isMobile = /Mobi|Android|iPhone|iPod|iPad|Windows Phone/i.test(ua);
    if (!isMobile) {
      return NextResponse.json(
        { error: 'Chấm công chỉ thực hiện trên điện thoại. Hãy dùng điện thoại đã cài app.', blocked: 'desktop' },
        { status: 403 },
      );
    }
  }

  const { dateStr, hhmm, dow } = vnNow();

  // 1) Ngày nghỉ
  if (!cfg.allowHoliday) {
    if (dow === 0 || dow === 6) {
      return NextResponse.json(
        { error: `Hôm nay là ${dow === 0 ? 'Chủ Nhật' : 'Thứ Bảy'} — ngày nghỉ.`, blocked: 'holiday' },
        { status: 409 },
      );
    }
    const { data: hol } = await admin
      .from('chamcong_holidays')
      .select('description')
      .eq('date', dateStr)
      .maybeSingle();
    if (hol) {
      return NextResponse.json(
        { error: `Hôm nay là ${hol.description} — ngày nghỉ lễ.`, blocked: 'holiday' },
        { status: 409 },
      );
    }
  }

  // 2) Khoảng cách
  const dist = Math.round(haversine(body.latitude, body.longitude, cfg.office.lat, cfg.office.lng));
  const inside = dist <= cfg.office.radius;
  if (cfg.maxDistance > 0 && dist > cfg.maxDistance) {
    return NextResponse.json(
      {
        error: `Bạn đang cách công ty ${(dist / 1000).toFixed(1)} km, vượt giới hạn ${(cfg.maxDistance / 1000).toFixed(1)} km.`,
        blocked: 'distance',
        distance: dist,
      },
      { status: 409 },
    );
  }

  // 3) Cảnh báo chấm trùng ca
  const session: Session = sessionFromHHMM(hhmm);
  if (!cfg.allowMultiple && !body.confirm) {
    const { data: rec } = await admin
      .from('chamcong_attendance_records')
      .select('morning_in, morning_out, afternoon_in, afternoon_out')
      .eq('employee_id', emp.id)
      .eq('date', dateStr)
      .maybeSingle();
    const existing = rec ? (rec[session] as string | null) : null;
    if (existing) {
      return NextResponse.json({
        needsConfirm: true,
        session,
        sessionLabel: sessionLabel(session),
        existingTime: String(existing).slice(0, 5),
      });
    }
  }

  // 4) Reverse geocode (best-effort — KHÔNG chặn luồng)
  let address = 'Không xác định';
  try {
    const geo = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${body.latitude}&lon=${body.longitude}&format=json&accept-language=vi`,
      { headers: { 'User-Agent': 'HSTC-ChamCong/2027' } },
    );
    if (geo.ok) {
      const j = (await geo.json()) as { display_name?: string };
      address = j.display_name || address;
    }
  } catch {
    /* bỏ qua */
  }

  // 5) Ghi log -> trigger tổng hợp record + chấm A/B/D
  const status = inside ? STATUS_OK : STATUS_OUT;
  const { error } = await admin.from('chamcong_attendance_logs').insert({
    employee_id: emp.id,
    employee_name: emp.name,
    latitude: body.latitude,
    longitude: body.longitude,
    accuracy: body.accuracy != null ? Math.round(body.accuracy) : null,
    nearest_office: cfg.office.name,
    distance: dist,
    status,
    address,
    note: (body.note || '').trim() || null,
    device_id: deviceId,
  });

  if (error) {
    return NextResponse.json({ error: 'Lỗi ghi chấm công: ' + error.message }, { status: 500 });
  }

  // Đọc lại grade do trigger vừa tính (để client hiện ngay, khỏi reload).
  let grade: string | null = null;
  const { data: rec2 } = await admin
    .from('chamcong_attendance_records')
    .select('grades')
    .eq('employee_id', emp.id)
    .eq('date', dateStr)
    .maybeSingle();
  if (rec2?.grades) {
    const order = ['morning_in', 'morning_out', 'afternoon_in', 'afternoon_out'];
    const idx = order.indexOf(session);
    const parts = String(rec2.grades).split(',').map((g) => g.trim());
    grade = idx >= 0 ? parts[idx] ?? null : null;
  }

  // Sự kiện 1: xác nhận chấm công cho CBNV (best-effort).
  const timeStr = `${String(Math.floor(hhmm / 100)).padStart(2, '0')}:${String(hhmm % 100).padStart(2, '0')}`;
  await sendTelegram(
    emp.telegram_chat_id,
    `✅ <b>${emp.name}</b> đã chấm công <b>${sessionLabel(session)}</b> lúc ${timeStr}\n` +
      `${inside ? '📍 Trong phạm vi' : '⚠️ Ngoài phạm vi'} · ${dist} m · ${cfg.office.name}`,
  );

  return NextResponse.json({
    ok: true,
    inside,
    distance: dist,
    status,
    office: cfg.office.name,
    address,
    session,
    sessionLabel: sessionLabel(session),
    grade,
  });
}
