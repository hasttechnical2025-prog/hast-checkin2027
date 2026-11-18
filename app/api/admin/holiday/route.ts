import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStaffSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  op: 'add' | 'delete';
  date: string; // YYYY-MM-DD
  description?: string;
}

/** Admin thêm/xóa ngày nghỉ lễ (chamcong_holidays, date PK). */
export async function POST(req: NextRequest) {
  const session = await getStaffSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Chỉ Admin.' }, { status: 403 });
  }
  const b = (await req.json().catch(() => null)) as Body | null;
  if (!b || !b.op || !b.date || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) {
    return NextResponse.json({ error: 'Thiếu/sai ngày.' }, { status: 400 });
  }
  const admin = createAdminClient();

  if (b.op === 'delete') {
    const { error } = await admin.from('chamcong_holidays').delete().eq('date', b.date);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (!b.description || !b.description.trim()) {
    return NextResponse.json({ error: 'Nhập tên ngày lễ.' }, { status: 400 });
  }
  const { error } = await admin
    .from('chamcong_holidays')
    .upsert({ date: b.date, description: b.description.trim() }, { onConflict: 'date' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
