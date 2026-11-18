import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStaffSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  op: 'delete' | 'update';
  id: string;
  note?: string;
  status?: string;
}

/** Admin sửa (note/status) hoặc xóa 1 log chấm thô. */
export async function POST(req: NextRequest) {
  const session = await getStaffSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Chỉ Admin.' }, { status: 403 });
  }
  const b = (await req.json().catch(() => null)) as Body | null;
  if (!b || !b.op || !b.id) return NextResponse.json({ error: 'Thiếu dữ liệu.' }, { status: 400 });

  const admin = createAdminClient();

  if (b.op === 'delete') {
    const { error } = await admin.from('chamcong_attendance_logs').delete().eq('id', b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const patch: Record<string, unknown> = {};
  if (b.note !== undefined) patch.note = b.note;
  if (b.status !== undefined) patch.status = b.status;
  const { error } = await admin.from('chamcong_attendance_logs').update(patch).eq('id', b.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
