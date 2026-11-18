import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEVICE_COOKIE = 'hstc_device';

interface Body {
  maNv: string;
  pin: string;
}

/**
 * Đăng nhập CBNV bằng Mã NV + PIN (từ link/QR chung). Server:
 *  - xác thực qua RPC chamcong_verify_pin (bcrypt, bỏ qua RLS)
 *  - gắn thiết bị (chống chấm hộ): cookie httpOnly 'hstc_device' = device_id.
 *      • Nhân viên CHƯA có thiết bị active -> thiết bị này auto active.
 *      • Đã có thiết bị active, đây là máy mới -> tạo bind 'Chờ' (cần TBP duyệt).
 *  - trả token -> client chuyển tới /c/[token] (A2HS đóng token vào icon).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null;
  const maNv = (body?.maNv || '').trim();
  const pin = (body?.pin || '').trim();
  if (!maNv || !pin) {
    return NextResponse.json({ error: 'Nhập Mã NV và PIN.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin.rpc('chamcong_verify_pin', { p_ma_nv: maNv, p_pin: pin });
  if (error) {
    return NextResponse.json({ error: 'Lỗi hệ thống. Thử lại.' }, { status: 500 });
  }
  const emp = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!emp) {
    return NextResponse.json({ error: 'Sai Mã NV hoặc PIN.' }, { status: 401 });
  }

  // Gắn thiết bị
  let deviceId = req.cookies.get(DEVICE_COOKIE)?.value || '';
  if (!deviceId) deviceId = globalThis.crypto.randomUUID();
  const ua = (req.headers.get('user-agent') || '').slice(0, 180);

  let status: 'active' | 'pending' | 'rejected' = 'active';

  const { data: mine } = await admin
    .from('chamcong_device_bind')
    .select('id, is_active, approve_status')
    .eq('employee_id', emp.id)
    .eq('device_id', deviceId)
    .maybeSingle();

  if (mine) {
    status = mine.is_active ? 'active' : mine.approve_status === 'Từ chối' ? 'rejected' : 'pending';
  } else {
    const { data: activeBind } = await admin
      .from('chamcong_device_bind')
      .select('id')
      .eq('employee_id', emp.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!activeBind) {
      await admin.from('chamcong_device_bind').insert({
        employee_id: emp.id,
        device_id: deviceId,
        device_label: ua,
        is_active: true,
        approve_status: 'Đồng ý',
        approved_by: 'auto',
        approved_at: new Date().toISOString(),
      });
      status = 'active';
    } else {
      await admin.from('chamcong_device_bind').insert({
        employee_id: emp.id,
        device_id: deviceId,
        device_label: ua,
        is_active: false,
        approve_status: 'Chờ',
      });
      status = 'pending';
    }
  }

  const res = NextResponse.json({ ok: true, token: emp.token, name: emp.name, status });
  res.cookies.set(DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
