import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStaffSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  action: 'lock' | 'unlock';
  department: string;
  thang: number;
  nam: number;
}

/** Ký & Khóa (lock) / Mở khóa (unlock, chỉ admin) bảng điểm NSCL theo phòng + tháng. */
export async function POST(req: NextRequest) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
  const isAdmin = session.role === 'admin';

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || !body.department || !body.thang || !body.nam) {
    return NextResponse.json({ error: 'Thiếu dữ liệu.' }, { status: 400 });
  }

  // Chỉ admin hoặc TBP của chính phòng đó được thao tác.
  if (!isAdmin && session.department !== body.department) {
    return NextResponse.json({ error: 'Ngoài phạm vi phòng.' }, { status: 403 });
  }

  const admin = createAdminClient();

  if (body.action === 'unlock') {
    if (!isAdmin) {
      return NextResponse.json({ error: 'Chỉ Admin được mở khóa.' }, { status: 403 });
    }
    const { error } = await admin
      .from('chamcong_nscl_lock')
      .delete()
      .eq('department', body.department)
      .eq('thang', body.thang)
      .eq('nam', body.nam);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // lock
  const { error } = await admin.from('chamcong_nscl_lock').upsert(
    {
      department: body.department,
      thang: body.thang,
      nam: body.nam,
      nguoi_ky: session.email || session.department || 'TBP',
      thoi_gian_ky: new Date().toISOString(),
    },
    { onConflict: 'department,thang,nam' },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
