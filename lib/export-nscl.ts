import { createAdminClient } from '@/lib/supabase/admin';

// Tính dữ liệu Xuất Excel bảng công TOÀN CÔNG TY (port exportNsclExcel app cũ).
// GIỮ Y NGUYÊN công thức:
//   - Ngày công chuẩn  = số ngày thường (trừ T7/CN) từ ngày vào làm đến hết tháng (lễ vẫn tính chuẩn).
//   - Ngày lễ/tết -> cột "Nghỉ lễ tết".
//   - nscl_score: P -> Nghỉ phép +1 ; Ô/N -> gộp cột Tổng ; số >5 -> thực tế +1 ; số <=5 -> thực tế +0.5 & phép +0.5.
//   - Cột Tổng = phép + lễ tết + ốm/chế độ (N gõ tay).
// Bắt buộc mọi phòng đã Ký & Khóa mới cho xuất.

const pad = (n: number) => String(n).padStart(2, '0');

export interface ExportResult {
  unsigned?: string[]; // phòng chưa Ký & Khóa -> chặn xuất
  aoa?: (string | number)[][];
  cols?: { wch: number }[];
  count?: number;
}

interface EmpRow {
  id: number;
  name: string;
  department: string;
  ngay_vao_lam: string | null;
}

export async function buildExportAoa(year: number, month: number): Promise<ExportResult> {
  const admin = createAdminClient();
  const start = `${year}-${pad(month)}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${pad(month)}-${pad(daysInMonth)}`;

  const { data: empData } = await admin
    .from('chamcong_employees')
    .select('id, name, department, ngay_vao_lam')
    .eq('status', 'Đang làm việc');
  const emps = (empData ?? []) as EmpRow[];
  if (emps.length === 0) return { aoa: [], cols: [], count: 0 };

  const [recRes, holRes, lockRes] = await Promise.all([
    admin
      .from('chamcong_attendance_records')
      .select('employee_id, date, nscl_score')
      .in('employee_id', emps.map((e) => e.id))
      .gte('date', start)
      .lte('date', end),
    admin.from('chamcong_holidays').select('date').gte('date', start).lte('date', end),
    admin.from('chamcong_nscl_lock').select('department').eq('thang', month).eq('nam', year),
  ]);

  const scoreMap = new Map<string, string>(
    (recRes.data ?? []).map((r) => [`${r.employee_id}_${r.date}`, (r.nscl_score as string) || '']),
  );
  const holidays = new Set<string>((holRes.data ?? []).map((h) => h.date as string));
  const lockedDepts = new Set<string>((lockRes.data ?? []).map((l) => l.department as string));

  // Chặn nếu còn phòng chưa Ký & Khóa
  const depts = [...new Set(emps.map((e) => e.department).filter(Boolean))];
  const unsigned = depts.filter((d) => !lockedDepts.has(d)).sort((a, b) => a.localeCompare(b, 'vi'));
  if (unsigned.length > 0) return { unsigned };

  emps.sort(
    (a, b) => (a.department || '').localeCompare(b.department || '', 'vi') || (a.name || '').localeCompare(b.name || '', 'vi'),
  );

  const aoa: (string | number)[][] = [
    ['Họ tên', 'Phòng ban', 'Ngày công chuẩn', 'Ngày công thực tế', 'Nghỉ phép', 'Nghỉ lễ tết', 'Ngày nghỉ phép/Lễ tết/Chế độ'],
  ];
  const r1 = (v: number) => Math.round(v * 10) / 10;

  for (const emp of emps) {
    let chuan = 0;
    let thucTe = 0;
    let nghiPhep = 0;
    let nghiLe = 0;
    let nghiKhac = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const ymd = `${year}-${pad(month)}-${pad(d)}`;
      const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
      if (dow === 0 || dow === 6) continue;
      if (emp.ngay_vao_lam && ymd < emp.ngay_vao_lam) continue;

      chuan++;
      if (holidays.has(ymd)) {
        nghiLe++;
        continue;
      }

      let val = (scoreMap.get(`${emp.id}_${ymd}`) || '').trim();
      const up = val.toUpperCase();
      if (up === 'P') val = 'P';
      else if (up === 'Ô' || up === 'O') val = 'Ô';
      else if (up === 'N') val = 'N';

      if (val === 'P') {
        nghiPhep += 1;
        continue;
      }
      if (val === 'Ô' || val === 'N') {
        nghiKhac += 1;
        continue;
      }
      const num = parseFloat(val);
      if (!isNaN(num)) {
        if (num > 5) thucTe += 1;
        else {
          thucTe += 0.5;
          nghiPhep += 0.5;
        }
      }
    }

    aoa.push([
      emp.name,
      emp.department || '',
      chuan,
      r1(thucTe),
      r1(nghiPhep),
      r1(nghiLe),
      r1(nghiPhep + nghiLe + nghiKhac),
    ]);
  }

  const cols = [{ wch: 26 }, { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 30 }];
  return { aoa, cols, count: aoa.length - 1 };
}
