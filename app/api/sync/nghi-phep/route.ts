import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  ma_nv?: string;
  ngay?: string; // YYYY-MM-DD
  buoi?: string; // ca_ngay | sang | chieu
  loai?: string; // phep | om | viec_rieng
  nguon_id: string; // id đơn gốc bên Sổ Công tác
  employee_name?: string;
  action: 'upsert' | 'delete';
}

/**
 * Webhook MỘT CHIỀU từ app Sổ Công tác: đơn nghỉ đã duyệt -> chamcong_nghi_phep_dong_bo.
 * Bảo mật bằng secret dùng chung (header x-sync-secret = SYNC_SECRET). Idempotent (nguon_id, ngay).
 * Khóa nối = ma_nv; không map được -> lưu cờ nhan_vien_la. Chấm Công chỉ ĐỌC + overlay.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-sync-secret');
  if (!process.env.SYNC_SECRET || secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: 'Sai secret.' }, { status: 401 });
  }
  const b = (await req.json().catch(() => null)) as Body | null;
  if (!b || !b.nguon_id || !b.action) {
    return NextResponse.json({ error: 'Thiếu dữ liệu.' }, { status: 400 });
  }

  const admin = createAdminClient();

  if (b.action === 'delete') {
    const { error } = await admin.from('chamcong_nghi_phep_dong_bo').delete().eq('nguon_id', b.nguon_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, deleted: true });
  }

  if (!b.ma_nv || !b.ngay) {
    return NextResponse.json({ error: 'Thiếu ma_nv/ngay.' }, { status: 400 });
  }

  const { data: emp } = await admin
    .from('chamcong_employees')
    .select('id, name')
    .eq('ma_nv', b.ma_nv)
    .maybeSingle();

  const { error } = await admin.from('chamcong_nghi_phep_dong_bo').upsert(
    {
      ma_nv: b.ma_nv,
      employee_id: emp?.id ?? null,
      employee_name: emp?.name ?? b.employee_name ?? null,
      ngay: b.ngay,
      buoi: b.buoi || 'ca_ngay',
      loai: b.loai || 'phep',
      nguon_id: b.nguon_id,
      nhan_vien_la: !emp,
      synced_at: new Date().toISOString(),
    },
    { onConflict: 'nguon_id,ngay' },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, matched: !!emp });
}
