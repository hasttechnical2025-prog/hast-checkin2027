import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStaffSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Status = 'Đồng ý' | 'Từ chối' | 'Chờ';

interface Body {
  approvals: { employeeId: number; date: string }[];
  status: Status;
  note?: string;
}

const LEAVE_NSCL: Record<string, string> = { phep: 'P', om: 'Ô' };

/**
 * Duyệt / Từ chối / Hủy giải trình (lẻ hoặc hàng loạt — 1 request).
 *  - Chỉ staff (Supabase Auth). TBP chỉ duyệt phòng mình; admin duyệt mọi phòng.
 *  - Đồng ý: bắt buộc có lý do. Tự chấm NSCL nếu ô trống (Nghỉ phép/Ốm: cả ngày -> P/Ô
 *    theo leave_symbol_mode; nửa buổi -> 5; Khác -> không tự chấm).
 */
export async function POST(req: NextRequest) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || !Array.isArray(body.approvals) || !body.status) {
    return NextResponse.json({ error: 'Thiếu dữ liệu.' }, { status: 400 });
  }
  const { status } = body;
  const note = (body.note || '').trim();
  const isAdmin = session.role === 'admin';

  const admin = createAdminClient();

  // Công tắc ký hiệu nghỉ.
  let leaveMode = 'merged';
  const { data: cfg } = await admin
    .from('chamcong_system_config')
    .select('value')
    .eq('key', 'leave_symbol_mode')
    .maybeSingle();
  if (cfg?.value === 'split') leaveMode = 'split';

  // Nhân viên liên quan (để kiểm phòng + lấy tên).
  const empIds = [...new Set(body.approvals.map((a) => a.employeeId))];
  const { data: emps } = await admin
    .from('chamcong_employees')
    .select('id, name, department')
    .in('id', empIds);
  const empById = new Map<number, { id: number; name: string; department: string }>(
    (emps ?? []).map((e) => [e.id as number, e as { id: number; name: string; department: string }]),
  );

  const nowIso = new Date().toISOString();
  const results: { employeeId: number; date: string; ok: boolean; error?: string }[] = [];

  for (const ap of body.approvals) {
    const emp = empById.get(ap.employeeId);
    if (!emp) {
      results.push({ ...ap, ok: false, error: 'Không tìm thấy nhân viên' });
      continue;
    }
    if (!isAdmin && emp.department !== session.department) {
      results.push({ ...ap, ok: false, error: 'Ngoài phạm vi phòng' });
      continue;
    }

    const { data: rec } = await admin
      .from('chamcong_attendance_records')
      .select('justification, justification_type, justification_buoi, nscl_score')
      .eq('employee_id', ap.employeeId)
      .eq('date', ap.date)
      .maybeSingle();

    const reason = (rec?.justification || '').replace(/\|+/g, '').trim();
    if (status === 'Đồng ý' && !reason) {
      results.push({ ...ap, ok: false, error: 'Chưa có lý do giải trình' });
      continue;
    }

    const update: Record<string, unknown> = {
      employee_id: ap.employeeId,
      employee_name: emp.name,
      date: ap.date,
      approve_status: status,
      approve_note: status === 'Từ chối' ? note : null,
      approve_time: status === 'Chờ' ? null : nowIso,
      updated_at: nowIso,
    };

    // Tự chấm NSCL khi Đồng ý (chỉ khi ô trống + loại phép/ốm).
    if (status === 'Đồng ý' && !((rec?.nscl_score || '').trim())) {
      const jt = rec?.justification_type || '';
      const jb = rec?.justification_buoi || '';
      if (jt === 'phep' || jt === 'om') {
        update.nscl_score = jb === 'ca_ngay' ? (leaveMode === 'split' ? LEAVE_NSCL[jt] || 'P' : 'P') : '5';
      }
    }

    const { error } = await admin
      .from('chamcong_attendance_records')
      .upsert(update, { onConflict: 'employee_id,date' });
    results.push({ ...ap, ok: !error, error: error?.message });
  }

  // TODO (Bước 7): gửi Telegram báo CBNV kết quả duyệt.
  const okCount = results.filter((r) => r.ok).length;
  return NextResponse.json({ ok: true, okCount, total: results.length, results });
}
