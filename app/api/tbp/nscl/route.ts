import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStaffSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  scores?: { employeeId: number; date: string; value: string }[];
  adjusts?: { employeeId: number; date01: string; value: string }[];
}

function normScore(raw: string): string | null {
  const v = (raw || '').trim();
  if (v === '') return '';
  const up = v.toUpperCase();
  if (up === 'P') return 'P';
  if (up === 'Ô' || up === 'O') return 'Ô';
  if (up === 'N') return 'N';
  if (/^\d+$/.test(v)) {
    const n = Number(v);
    if (n >= 1 && n <= 15) return String(n);
  }
  return null; // không hợp lệ
}

/** Lưu ô điểm NSCL + Điểm +/- (fill-10 gửi nhiều scores). Enforce phòng / khóa / chặn B/D. */
export async function POST(req: NextRequest) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
  const isAdmin = session.role === 'admin';

  const body = (await req.json().catch(() => null)) as Body | null;
  const scores = body?.scores ?? [];
  const adjusts = body?.adjusts ?? [];
  if (scores.length === 0 && adjusts.length === 0) {
    return NextResponse.json({ error: 'Không có dữ liệu.' }, { status: 400 });
  }

  const admin = createAdminClient();

  const empIds = [...new Set([...scores, ...adjusts].map((x) => x.employeeId))];
  const { data: emps } = await admin
    .from('chamcong_employees')
    .select('id, name, department, ngay_vao_lam')
    .in('id', empIds);
  const empById = new Map<number, { id: number; name: string; department: string; ngay_vao_lam: string | null }>(
    (emps ?? []).map((e) => [e.id as number, e as { id: number; name: string; department: string; ngay_vao_lam: string | null }]),
  );

  // Khóa Ký & Khóa theo phòng (tháng của cell đầu tiên).
  const anyDate = scores[0]?.date || adjusts[0]?.date01 || '';
  const thang = Number(anyDate.slice(5, 7));
  const nam = Number(anyDate.slice(0, 4));
  const { data: lockRows } = await admin
    .from('chamcong_nscl_lock')
    .select('department')
    .eq('thang', thang)
    .eq('nam', nam);
  const lockedDepts = new Set<string>((lockRows ?? []).map((l) => l.department as string));

  // Dữ liệu để chặn ô B/D: records + holidays + leave liên quan.
  const dates = [...new Set(scores.map((s) => s.date))];
  const { data: recs } = dates.length
    ? await admin
        .from('chamcong_attendance_records')
        .select('employee_id, date, grades, approve_status')
        .in('employee_id', empIds)
        .in('date', dates)
    : { data: [] as { employee_id: number; date: string; grades: string | null; approve_status: string | null }[] };
  const recMap = new Map<string, { grades: string | null; approve_status: string | null }>(
    (recs ?? []).map((r) => [`${r.employee_id}_${r.date}`, { grades: r.grades, approve_status: r.approve_status }]),
  );
  const { data: hols } = dates.length
    ? await admin.from('chamcong_holidays').select('date').in('date', dates)
    : { data: [] as { date: string }[] };
  const holidays = new Set<string>((hols ?? []).map((h) => h.date as string));
  const { data: leaves } = dates.length
    ? await admin.from('chamcong_nghi_phep_dong_bo').select('employee_id, ngay').in('employee_id', empIds).in('ngay', dates)
    : { data: [] as { employee_id: number; ngay: string }[] };
  const leaveSet = new Set<string>((leaves ?? []).map((l) => `${l.employee_id}_${l.ngay}`));

  const nowIso = new Date().toISOString();
  const upserts: Record<string, unknown>[] = [];
  let skipped = 0;

  // Gộp score + adjust theo (employee_id, date) để 1 upsert/ô.
  const byKey = new Map<string, Record<string, unknown>>();
  const touchedDepts = new Set<string>();

  function ensure(empId: number, date: string): Record<string, unknown> | null {
    const emp = empById.get(empId);
    if (!emp) return null;
    if (!isAdmin && emp.department !== session!.department) return null; // sai phòng
    if (!isAdmin && lockedDepts.has(emp.department)) return null; // đã khóa
    touchedDepts.add(emp.department);
    const k = `${empId}_${date}`;
    let o = byKey.get(k);
    if (!o) {
      o = { employee_id: empId, employee_name: emp.name, date, updated_at: nowIso };
      byKey.set(k, o);
    }
    return o;
  }

  for (const s of scores) {
    const emp = empById.get(s.employeeId);
    if (!emp) {
      skipped++;
      continue;
    }
    const val = normScore(s.value);
    if (val === null) {
      skipped++;
      continue;
    }
    // Weekend / holiday / before-join / block -> bỏ qua.
    const dow = new Date(Date.UTC(Number(s.date.slice(0, 4)), Number(s.date.slice(5, 7)) - 1, Number(s.date.slice(8, 10)))).getUTCDay();
    const beforeJoin = !!emp.ngay_vao_lam && s.date < emp.ngay_vao_lam;
    if (dow === 0 || dow === 6 || holidays.has(s.date) || beforeJoin) {
      skipped++;
      continue;
    }
    if (!isAdmin) {
      const rec = recMap.get(`${s.employeeId}_${s.date}`);
      const grades = (rec?.grades || 'D,D,D,D').split(',').map((g) => g.trim());
      const hasBD = grades.some((g) => g === 'B' || g === 'D');
      const approve = leaveSet.has(`${s.employeeId}_${s.date}`) ? 'Đồng ý' : rec?.approve_status || '';
      if (hasBD && approve !== 'Đồng ý') {
        skipped++;
        continue;
      }
    }
    const o = ensure(s.employeeId, s.date);
    if (!o) {
      skipped++;
      continue;
    }
    o.nscl_score = val;
  }

  for (const a of adjusts) {
    const v = (a.value || '').trim();
    const dbVal = v === '' ? null : /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 15 ? Number(v) : undefined;
    if (dbVal === undefined) {
      skipped++;
      continue;
    }
    const o = ensure(a.employeeId, a.date01);
    if (!o) {
      skipped++;
      continue;
    }
    o.nscl_adjust = dbVal;
  }

  upserts.push(...byKey.values());
  if (upserts.length === 0) {
    return NextResponse.json({ ok: true, saved: 0, skipped });
  }

  const { error } = await admin
    .from('chamcong_attendance_records')
    .upsert(upserts, { onConflict: 'employee_id,date' });
  if (error) {
    return NextResponse.json({ error: 'Lỗi lưu: ' + error.message }, { status: 500 });
  }

  // Admin sửa phòng đã khóa -> ký đè.
  if (isAdmin) {
    for (const dept of touchedDepts) {
      if (lockedDepts.has(dept)) {
        await admin
          .from('chamcong_nscl_lock')
          .update({ nguoi_ky: 'Admin', thoi_gian_ky: nowIso })
          .eq('department', dept)
          .eq('thang', thang)
          .eq('nam', nam);
      }
    }
  }

  return NextResponse.json({ ok: true, saved: upserts.length, skipped });
}
