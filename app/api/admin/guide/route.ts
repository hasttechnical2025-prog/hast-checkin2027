import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStaffSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  items: { id: string; title: string; content: string }[];
}

/** Admin lưu nội dung hướng dẫn p1..p4 (chamcong_guide_content). */
export async function POST(req: NextRequest) {
  const session = await getStaffSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Chỉ Admin.' }, { status: 403 });
  }
  const b = (await req.json().catch(() => null)) as Body | null;
  if (!b || !Array.isArray(b.items)) return NextResponse.json({ error: 'Thiếu dữ liệu.' }, { status: 400 });

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const rows = b.items
    .filter((i) => /^p[1-4]$/.test(i.id))
    .map((i) => ({ id: i.id, title: i.title || '', content: i.content || '', updated_at: nowIso }));
  if (rows.length === 0) return NextResponse.json({ error: 'Không có mục hợp lệ.' }, { status: 400 });

  const { error } = await admin.from('chamcong_guide_content').upsert(rows, { onConflict: 'id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
