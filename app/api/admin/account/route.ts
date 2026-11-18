import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStaffSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  op: 'create' | 'set_role' | 'reset_password' | 'delete';
  userId?: string;
  email?: string;
  password?: string;
  role?: string; // admin | TBP
  department?: string | null;
  viewAll?: boolean;
}

/** Admin quản lý tài khoản TBP/Admin (Supabase Auth + chamcong_app_roles). */
export async function POST(req: NextRequest) {
  const session = await getStaffSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Chỉ Admin.' }, { status: 403 });
  }
  const b = (await req.json().catch(() => null)) as Body | null;
  if (!b || !b.op) return NextResponse.json({ error: 'Thiếu dữ liệu.' }, { status: 400 });

  const admin = createAdminClient();
  const role = b.role === 'admin' ? 'admin' : 'TBP';
  const dept = role === 'admin' ? null : b.department || null;

  if (b.op === 'create') {
    if (!b.email || !b.password) return NextResponse.json({ error: 'Thiếu email/mật khẩu.' }, { status: 400 });
    if (b.password.length < 6) return NextResponse.json({ error: 'Mật khẩu tối thiểu 6 ký tự.' }, { status: 400 });
    const { data, error } = await admin.auth.admin.createUser({
      email: b.email.trim(),
      password: b.password,
      email_confirm: true,
    });
    if (error || !data.user) {
      return NextResponse.json({ error: error?.message || 'Không tạo được tài khoản.' }, { status: 400 });
    }
    const { error: rErr } = await admin.from('chamcong_app_roles').upsert(
      { user_id: data.user.id, role, department: dept, view_all: !!b.viewAll },
      { onConflict: 'user_id' },
    );
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, userId: data.user.id });
  }

  if (!b.userId) return NextResponse.json({ error: 'Thiếu userId.' }, { status: 400 });

  if (b.op === 'set_role') {
    const { error } = await admin.from('chamcong_app_roles').upsert(
      { user_id: b.userId, role, department: dept, view_all: !!b.viewAll },
      { onConflict: 'user_id' },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.op === 'reset_password') {
    if (!b.password || b.password.length < 6) return NextResponse.json({ error: 'Mật khẩu tối thiểu 6 ký tự.' }, { status: 400 });
    const { error } = await admin.auth.admin.updateUserById(b.userId, { password: b.password });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.op === 'delete') {
    if (b.userId === session.userId) return NextResponse.json({ error: 'Không thể tự xóa tài khoản đang đăng nhập.' }, { status: 400 });
    const { error } = await admin.auth.admin.deleteUser(b.userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Op không hợp lệ.' }, { status: 400 });
}
