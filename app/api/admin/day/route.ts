import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStaffSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  op: 'get' | 'save';
  employeeId?: number;
  date?: string; // YYYY-MM-DD
  morningIn?: string | null; // HH:MM | null
  morningOut?: string | null;
  afternoonIn?: string | null;
  afternoonOut?: string | null;
}

const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const hm = (v: string | null) => (v ? String(v).slice(0, 5) : '');
// '' | undefined -> null ; 'HH:MM' -> 'HH:MM:00'
function toTime(v: string | null | undefined): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!/^\d{2}:\d{2}$/.test(s)) return null;
  return `${s}:00`;
}

/** Admin xem/sửa công NGÀY cho 1 nhân viên; lưu -> tính lại A/B/D (RPC). */
export async function POST(req: NextRequest) {
  const session = await getStaffSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Chỉ Admin.' }, { status: 403 });
  }

  const b = (await req.json().catch(() => null)) as Body | null;
  if (!b || !b.op || typeof b.employeeId !== 'number' || !isDate(b.date)) {
    return NextResponse.json({ error: 'Thiếu dữ liệu.' }, { status: 400 });
  }

  const admin = createAdminClient();

  if (b.op === 'get') {
    const { data: rec } = await admin
      .from('chamcong_attendance_records')
      .select('morning_in, morning_out, afternoon_in, afternoon_out, grades, approve_status, justification_type, justification_buoi')
      .eq('employee_id', b.employeeId)
      .eq('date', b.date)
      .maybeSingle();

    const start = `${b.date}T00:00:00+07:00`;
    const end = `${b.date}T23:59:59+07:00`;
    const { data: logs } = await admin
      .from('chamcong_attendance_logs')
      .select('checked_at, status, distance, note')
      .eq('employee_id', b.employeeId)
      .gte('checked_at', start)
      .lte('checked_at', end)
      .order('checked_at', { ascending: true });

    return NextResponse.json({
      record: rec
        ? {
            morningIn: hm(rec.morning_in as string | null),
            morningOut: hm(rec.morning_out as string | null),
            afternoonIn: hm(rec.afternoon_in as string | null),
            afternoonOut: hm(rec.afternoon_out as string | null),
            grades: (rec.grades as string) || 'D,D,D,D',
            approveStatus: (rec.approve_status as string) || null,
            justificationType: (rec.justification_type as string) || null,
            justificationBuoi: (rec.justification_buoi as string) || null,
          }
        : null,
      logs: (logs ?? []).map((l) => ({
        time: new Date(l.checked_at as string).toLocaleTimeString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        status: (l.status as string) || '',
        distance: l.distance as number | null,
        note: (l.note as string) || '',
      })),
    });
  }

  // op === 'save' -> gọi RPC tính lại A/B/D
  const { data, error } = await admin.rpc('chamcong_admin_set_day', {
    p_employee_id: b.employeeId,
    p_date: b.date,
    p_morning_in: toTime(b.morningIn),
    p_morning_out: toTime(b.morningOut),
    p_afternoon_in: toTime(b.afternoonIn),
    p_afternoon_out: toTime(b.afternoonOut),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rec = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    ok: true,
    grades: (rec?.grades as string) || 'D,D,D,D',
  });
}
