import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildMonthData } from '@/lib/month';
import { vnNow } from '@/lib/attendance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Dữ liệu 1 tháng cho màn Lịch sử CBNV (JSON) — để client chuyển tháng + prefetch
 * tháng liền kề mà KHÔNG phải điều hướng server mỗi lần (bấm ‹/› hiện gần như tức thì).
 * Định danh = token ở path (giống trang /c/[token]). Chặn xem tháng tương lai.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const m = req.nextUrl.searchParams.get('m') || '';

  const admin = createAdminClient();
  const { data: emp } = await admin
    .from('chamcong_employees')
    .select('id, status, ngay_vao_lam')
    .eq('token', token)
    .maybeSingle();
  if (!emp || emp.status !== 'Đang làm việc') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const now = vnNow();
  const curY = Number(now.dateStr.slice(0, 4));
  const curM = Number(now.dateStr.slice(5, 7));
  let year = curY;
  let month = curM;
  if (/^\d{4}-\d{2}$/.test(m)) {
    const y = Number(m.slice(0, 4));
    const mo = Number(m.slice(5, 7));
    if (mo >= 1 && mo <= 12 && y * 12 + mo <= curY * 12 + curM) {
      year = y;
      month = mo;
    }
  }

  const data = await buildMonthData(emp.id as number, emp.ngay_vao_lam ?? null, year, month);
  return NextResponse.json(data);
}
