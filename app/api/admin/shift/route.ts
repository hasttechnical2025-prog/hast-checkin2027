import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStaffSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Row {
  shift_type: string;
  session: string;
  a_start: string | null;
  a_end: string | null;
  a_end2: string | null;
  b_end: string | null;
}

const t = (v: string | null) => (v && /^\d{2}:\d{2}/.test(v) ? v : null);

/** Admin lưu ngưỡng chấm A/B/D (chamcong_shift_config). */
export async function POST(req: NextRequest) {
  const session = await getStaffSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Chỉ Admin.' }, { status: 403 });
  }
  const b = (await req.json().catch(() => null)) as { rows?: Row[] } | null;
  if (!b || !Array.isArray(b.rows) || b.rows.length === 0) {
    return NextResponse.json({ error: 'Thiếu dữ liệu.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const payload = b.rows.map((r) => ({
    shift_type: r.shift_type,
    session: r.session,
    a_start: t(r.a_start),
    a_end: t(r.a_end),
    a_end2: t(r.a_end2),
    b_end: t(r.b_end),
    updated_at: nowIso,
    updated_by: session.email || 'admin',
  }));

  const { error } = await admin.from('chamcong_shift_config').upsert(payload, { onConflict: 'shift_type,session' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, saved: payload.length });
}
