import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStaffSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  config?: Record<string, string>;
  printConfig?: Record<string, string | number>;
}

/** Admin lưu cấu hình hệ thống (system_config key/value) + cấu hình bản in NSCL. */
export async function POST(req: NextRequest) {
  const session = await getStaffSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Chỉ Admin.' }, { status: 403 });
  }
  const b = (await req.json().catch(() => null)) as Body | null;
  if (!b) return NextResponse.json({ error: 'Thiếu dữ liệu.' }, { status: 400 });

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  if (b.config && Object.keys(b.config).length > 0) {
    const rows = Object.entries(b.config).map(([key, value]) => ({ key, value: String(value), updated_at: nowIso }));
    const { error } = await admin.from('chamcong_system_config').upsert(rows, { onConflict: 'key' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (b.printConfig) {
    const { error } = await admin
      .from('chamcong_nscl_print_config')
      .upsert({ id: 1, config: b.printConfig, updated_at: nowIso }, { onConflict: 'id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
