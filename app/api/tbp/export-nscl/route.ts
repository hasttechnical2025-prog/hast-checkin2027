import { NextResponse, type NextRequest } from 'next/server';
import { getStaffSession } from '@/lib/auth';
import { buildExportAoa } from '@/lib/export-nscl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Trả dữ liệu aoa để Xuất Excel bảng công TOÀN CÔNG TY.
 * Chỉ KTHC (view_all) hoặc Admin. Chặn nếu còn phòng chưa Ký & Khóa (trả unsigned).
 * Client tự ghi file đích (File System Access) hoặc tải về.
 */
export async function POST(req: NextRequest) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
  if (session.role !== 'admin' && !session.viewAll) {
    return NextResponse.json({ error: 'Chỉ tài khoản Kế toán-Hành chính được xuất file này.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { year?: number; month?: number } | null;
  const year = Number(body?.year);
  const month = Number(body?.month);
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Thiếu tháng/năm.' }, { status: 400 });
  }

  const result = await buildExportAoa(year, month);
  return NextResponse.json(result);
}
