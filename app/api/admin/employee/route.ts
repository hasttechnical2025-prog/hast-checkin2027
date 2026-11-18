import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStaffSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function genPin(): string {
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join('');
}

interface Body {
  op: 'create' | 'update' | 'reset_pin' | 'revoke_token' | 'set_status';
  id?: number;
  ma_nv?: string;
  name?: string;
  department?: string;
  role?: string;
  loai_ca?: string;
  status?: string;
  email?: string | null;
  telegram?: string | number | null;
  ngay_vao_lam?: string | null;
  mien_cham_cong?: boolean;
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Chỉ Admin.' }, { status: 403 });
  }

  const b = (await req.json().catch(() => null)) as Body | null;
  if (!b || !b.op) return NextResponse.json({ error: 'Thiếu dữ liệu.' }, { status: 400 });

  const admin = createAdminClient();
  const tele = b.telegram === '' || b.telegram == null ? null : Number(b.telegram);

  // ----- CREATE -----
  if (b.op === 'create') {
    if (!b.ma_nv || !/^ST[0-9]{3}$/.test(b.ma_nv)) {
      return NextResponse.json({ error: 'Mã NV phải dạng ST### (vd ST001).' }, { status: 400 });
    }
    if (!b.name || !b.department) {
      return NextResponse.json({ error: 'Thiếu tên hoặc phòng ban.' }, { status: 400 });
    }
    const pin = genPin();
    const { data, error } = await admin.rpc('chamcong_create_employee', {
      p_ma_nv: b.ma_nv,
      p_name: b.name,
      p_department: b.department,
      p_pin: pin,
      p_role: b.role || 'CBNV',
      p_loai_ca: b.loai_ca || 'tieu_chuan',
      p_telegram: tele,
      p_email: b.email || null,
      p_ngay_vao_lam: b.ngay_vao_lam || null,
      p_mien_cham: !!b.mien_cham_cong,
    });
    if (error) {
      const msg = /unique|duplicate/i.test(error.message) ? `Mã NV ${b.ma_nv} đã tồn tại.` : error.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const row = Array.isArray(data) && data[0] ? data[0] : null;
    return NextResponse.json({ ok: true, id: row?.id, ma_nv: row?.ma_nv, token: row?.token, pin });
  }

  if (!b.id) return NextResponse.json({ error: 'Thiếu id.' }, { status: 400 });

  // ----- UPDATE -----
  if (b.op === 'update') {
    const patch: Record<string, unknown> = {};
    if (b.ma_nv !== undefined) {
      if (!/^ST[0-9]{3}$/.test(b.ma_nv)) return NextResponse.json({ error: 'Mã NV phải dạng ST###.' }, { status: 400 });
      patch.ma_nv = b.ma_nv;
    }
    if (b.name !== undefined) patch.name = b.name;
    if (b.department !== undefined) patch.department = b.department;
    if (b.role !== undefined) patch.role = b.role;
    if (b.loai_ca !== undefined) patch.loai_ca = b.loai_ca;
    if (b.status !== undefined) patch.status = b.status;
    if (b.email !== undefined) patch.email = b.email || null;
    if (b.telegram !== undefined) patch.telegram_chat_id = tele;
    if (b.ngay_vao_lam !== undefined) patch.ngay_vao_lam = b.ngay_vao_lam || null;
    if (b.mien_cham_cong !== undefined) patch.mien_cham_cong = !!b.mien_cham_cong;

    const { error } = await admin.from('chamcong_employees').update(patch).eq('id', b.id);
    if (error) {
      const msg = /unique|duplicate/i.test(error.message) ? 'Mã NV đã tồn tại.' : error.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  // ----- RESET PIN -----
  if (b.op === 'reset_pin') {
    const pin = genPin();
    const { error } = await admin.rpc('chamcong_reset_pin', { p_employee_id: b.id, p_pin: pin });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, pin });
  }

  // ----- REVOKE TOKEN (cấp token mới) -----
  if (b.op === 'revoke_token') {
    const { data, error } = await admin.rpc('chamcong_revoke_token', { p_employee_id: b.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, token: data });
  }

  // ----- SET STATUS (nghỉ việc / đang làm) -----
  if (b.op === 'set_status') {
    const st = b.status === 'Đang làm việc' ? 'Đang làm việc' : 'Đã nghỉ việc';
    const { error } = await admin.from('chamcong_employees').update({ status: st }).eq('id', b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Op không hợp lệ.' }, { status: 400 });
}
