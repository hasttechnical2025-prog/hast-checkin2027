import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = { phep: 'Nghỉ phép', om: 'Nghỉ ốm', khac: 'Khác' };
const BUOI_LABEL: Record<string, string> = { ca_ngay: 'cả ngày', sang: 'buổi sáng', chieu: 'buổi chiều' };

interface Body {
  token: string;
  date: string; // YYYY-MM-DD
  type: 'phep' | 'om' | 'khac';
  buoi?: 'ca_ngay' | 'sang' | 'chieu';
  content?: string;
}

/**
 * Gửi giải trình (CBNV). Server ghi qua service role vào attendance_records.
 *  - Nghỉ phép/Ốm -> lý do tự sinh "<Loại> (<buổi>)"; Khác -> nội dung tự nhập (bắt buộc).
 *  - Upsert (employee_id, date): record ảo chưa có -> tạo mới (grades mặc định 'D,D,D,D').
 *  - approve_status='Chờ'. Ngày đã 'Đồng ý' -> chặn sửa.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || !body.token || !body.date || !body.type) {
    return NextResponse.json({ error: 'Thiếu dữ liệu giải trình.' }, { status: 400 });
  }

  const type = body.type;
  const buoi = body.buoi || 'ca_ngay';
  const content = (body.content || '').trim();
  if (type === 'khac' && !content) {
    return NextResponse.json({ error: 'Vui lòng nhập nội dung giải trình.' }, { status: 400 });
  }
  const reason = type === 'khac' ? content : `${TYPE_LABEL[type]} (${BUOI_LABEL[buoi]})`;

  const admin = createAdminClient();

  const { data: emp } = await admin
    .from('chamcong_employees')
    .select('id, name, status')
    .eq('token', body.token)
    .maybeSingle();
  if (!emp || emp.status !== 'Đang làm việc') {
    return NextResponse.json({ error: 'Token không hợp lệ.' }, { status: 401 });
  }

  // Chặn sửa ngày đã duyệt Đồng ý.
  const { data: rec } = await admin
    .from('chamcong_attendance_records')
    .select('approve_status')
    .eq('employee_id', emp.id)
    .eq('date', body.date)
    .maybeSingle();
  if (rec && rec.approve_status === 'Đồng ý') {
    return NextResponse.json({ error: 'Ngày này đã được duyệt, không sửa được.' }, { status: 409 });
  }

  // Upsert — bỏ qua 'grades' để không ghi đè điểm đã có (record mới dùng default 'D,D,D,D').
  const { error } = await admin.from('chamcong_attendance_records').upsert(
    {
      employee_id: emp.id,
      employee_name: emp.name,
      date: body.date,
      justification: reason,
      justification_type: type,
      justification_buoi: buoi,
      approve_status: 'Chờ',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'employee_id,date' },
  );
  if (error) {
    return NextResponse.json({ error: 'Lỗi lưu giải trình: ' + error.message }, { status: 500 });
  }

  // TODO (Bước 7): gửi Telegram báo TBP có giải trình mới.
  return NextResponse.json({ ok: true, reason, approve: 'Chờ' });
}
