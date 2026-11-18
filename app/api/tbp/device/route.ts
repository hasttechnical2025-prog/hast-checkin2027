import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStaffSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  bindId: string;
  action: 'approve' | 'reject';
}

/**
 * TBP duyệt / từ chối thiết bị mới (bind 'Chờ').
 *  - approve: kích hoạt thiết bị này + ĐÁ máy cũ (deactivate các bind active khác của NV).
 *  - reject : đánh dấu Từ chối, không kích hoạt.
 * Giới hạn: TBP chỉ thao tác NV phòng mình; admin mọi phòng.
 */
export async function POST(req: NextRequest) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
  const isAdmin = session.role === 'admin';

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || !body.bindId || !body.action) {
    return NextResponse.json({ error: 'Thiếu dữ liệu.' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: bind } = await admin
    .from('chamcong_device_bind')
    .select('id, employee_id, chamcong_employees!inner(department)')
    .eq('id', body.bindId)
    .maybeSingle();
  if (!bind) return NextResponse.json({ error: 'Không tìm thấy thiết bị.' }, { status: 404 });

  const emp = bind.chamcong_employees as unknown as { department: string };
  if (!isAdmin && emp.department !== session.department) {
    return NextResponse.json({ error: 'Ngoài phạm vi phòng.' }, { status: 403 });
  }

  const nowIso = new Date().toISOString();

  if (body.action === 'reject') {
    const { error } = await admin
      .from('chamcong_device_bind')
      .update({ approve_status: 'Từ chối', is_active: false, approved_by: session.email, approved_at: nowIso })
      .eq('id', body.bindId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // approve: đá máy cũ trước, rồi kích hoạt máy này.
  await admin
    .from('chamcong_device_bind')
    .update({ is_active: false })
    .eq('employee_id', bind.employee_id)
    .eq('is_active', true)
    .neq('id', body.bindId);

  const { error } = await admin
    .from('chamcong_device_bind')
    .update({ approve_status: 'Đồng ý', is_active: true, approved_by: session.email, approved_at: nowIso })
    .eq('id', body.bindId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
