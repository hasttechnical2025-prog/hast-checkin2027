import { createAdminClient } from '@/lib/supabase/admin';
import { vnNow } from '@/lib/attendance';

// Dựng MA TRẬN công tháng (nhân viên × ngày) cho Admin.
// Khác buildGiaiTrinhItems (lib/giaitrinh.ts): KHÔNG lọc chỉ ngày B/D — lấy MỌI ngày
// làm việc để nhìn toàn cảnh. Mỗi ô là 1 ngày với 'kind' để tô màu + sửa công.

export type DayKind =
  | 'future' // ngày chưa tới
  | 'before-join' // trước ngày vào làm
  | 'weekend' // T7/CN
  | 'holiday' // ngày lễ
  | 'leave-full' // nghỉ phép cả ngày
  | 'ok' // đủ A
  | 'warn' // có B (muộn/sớm), không D
  | 'bad' // có chấm nhưng thiếu mốc (có D)
  | 'absent'; // ngày làm việc đã qua mà không chấm

export interface DayCell {
  d: number; // ngày trong tháng (1..31)
  ymd: string; // YYYY-MM-DD
  dow: number; // 0=CN .. 6=T7
  kind: DayKind;
  grades: string; // "A,B,A,D" (cho tooltip); '' nếu không áp dụng
  editable: boolean; // ngày làm việc đã qua -> bấm sửa công được
  leaveSymbol?: string; // 'P' | 'Ô' nếu nghỉ phép
  leaveText?: string; // nhãn nghỉ phép (tooltip); có cả khi nghỉ NỬA buổi
}

export interface EmpMonthRow {
  id: number;
  name: string;
  dept: string;
  loaiCa: string;
  days: DayCell[]; // length = daysInMonth
  summary: { cong: number; b: number; d: number; p: number };
}

export interface MonthMatrix {
  year: number;
  month: number;
  daysInMonth: number;
  dows: number[]; // dow của từng ngày (index 0 = ngày 1)
  rows: EmpMonthRow[];
  departments: string[];
  // Trạng thái Ký & Khóa NSCL theo PHÒNG (tháng này). Có mặt = đã khóa.
  locks: Record<string, { nguoiKy: string; thoiGianKy: string }>;
}

const pad = (n: number) => String(n).padStart(2, '0');

const LEAVE_LABEL: Record<string, string> = {
  phep: 'Nghỉ phép',
  om: 'Nghỉ ốm',
  viec_rieng: 'Việc riêng',
};
function leaveText(loai: string, buoi: string): string {
  const b = LEAVE_LABEL[loai] || 'Nghỉ phép';
  if (buoi === 'sang') return `${b} (sáng)`;
  if (buoi === 'chieu') return `${b} (chiều)`;
  return b;
}
const leaveSymbol = (loai: string) => (loai === 'om' ? 'Ô' : 'P');

interface EmpRow {
  id: number;
  name: string;
  department: string;
  loai_ca: string | null;
  ngay_vao_lam: string | null;
}

/**
 * @param visibleDepts phòng được XEM (null = tất cả — admin). Danh sách phòng trả về
 *   luôn là của tập nhân viên lấy được; để lọc theo phòng nên gọi null rồi lọc ở client.
 */
export async function buildMonthMatrix(
  visibleDepts: string[] | null,
  year: number,
  month: number,
): Promise<MonthMatrix> {
  const admin = createAdminClient();
  const start = `${year}-${pad(month)}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${pad(month)}-${pad(daysInMonth)}`;

  let empQuery = admin
    .from('chamcong_employees')
    .select('id, name, department, loai_ca, ngay_vao_lam')
    .eq('status', 'Đang làm việc');
  if (visibleDepts) empQuery = empQuery.in('department', visibleDepts);
  const { data: empData } = await empQuery;
  const employees = (empData ?? []) as EmpRow[];

  const dows: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) dows.push(new Date(Date.UTC(year, month - 1, d)).getUTCDay());

  if (employees.length === 0) {
    return { year, month, daysInMonth, dows, rows: [], departments: [], locks: {} };
  }
  const empIds = employees.map((e) => e.id);

  const [holRes, recRes, leaveRes, lockRes] = await Promise.all([
    admin.from('chamcong_holidays').select('date').gte('date', start).lte('date', end),
    admin
      .from('chamcong_attendance_records')
      .select('employee_id, date, grades')
      .in('employee_id', empIds)
      .gte('date', start)
      .lte('date', end),
    admin
      .from('chamcong_nghi_phep_dong_bo')
      .select('employee_id, ngay, buoi, loai')
      .in('employee_id', empIds)
      .gte('ngay', start)
      .lte('ngay', end),
    admin
      .from('chamcong_nscl_lock')
      .select('department, nguoi_ky, thoi_gian_ky')
      .eq('thang', month)
      .eq('nam', year),
  ]);

  const locks: Record<string, { nguoiKy: string; thoiGianKy: string }> = {};
  for (const l of lockRes.data ?? []) {
    locks[l.department as string] = {
      nguoiKy: (l.nguoi_ky as string) || '',
      thoiGianKy: (l.thoi_gian_ky as string) || '',
    };
  }

  const holidays = new Set<string>((holRes.data ?? []).map((h) => h.date as string));
  const recMap = new Map<string, string>();
  for (const r of recRes.data ?? []) {
    recMap.set(`${r.employee_id}_${r.date}`, ((r.grades as string) || 'D,D,D,D'));
  }
  const leaveMap = new Map<string, { loai: string; buoi: string }>();
  for (const l of leaveRes.data ?? []) {
    leaveMap.set(`${l.employee_id}_${l.ngay}`, { loai: l.loai as string, buoi: l.buoi as string });
  }

  const todayStr = vnNow().dateStr;

  const rows: EmpMonthRow[] = employees.map((emp) => {
    const days: DayCell[] = [];
    let cong = 0;
    let bCount = 0;
    let dCount = 0;
    let pCount = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const ymd = `${year}-${pad(month)}-${pad(d)}`;
      const dow = dows[d - 1];
      const leave = leaveMap.get(`${emp.id}_${ymd}`);

      let kind: DayKind;
      let grades = '';
      let editable = false;

      if (ymd > todayStr) {
        kind = 'future';
      } else if (emp.ngay_vao_lam && ymd < emp.ngay_vao_lam) {
        kind = 'before-join';
      } else if (leave && leave.buoi === 'ca_ngay') {
        kind = 'leave-full';
        pCount++;
      } else if (dow === 0 || dow === 6) {
        kind = 'weekend';
      } else if (holidays.has(ymd)) {
        kind = 'holiday';
      } else {
        // Ngày làm việc đã qua -> sửa công được.
        editable = true;
        const rec = recMap.get(`${emp.id}_${ymd}`);
        grades = rec || 'D,D,D,D';
        const parts = grades.split(',').map((g) => g.trim());
        const hasAttend = parts.some((g) => g === 'A' || g === 'B');
        const hasB = parts.some((g) => g === 'B');
        const hasD = parts.some((g) => g === 'D');
        if (!hasAttend) kind = 'absent';
        else if (hasD) kind = 'bad';
        else if (hasB) kind = 'warn';
        else kind = 'ok';
        if (hasAttend) cong++;
        if (hasB) bCount++;
        if (hasD) dCount++;
      }

      days.push({
        d,
        ymd,
        dow,
        kind,
        grades,
        editable,
        leaveSymbol: leave ? leaveSymbol(leave.loai) : undefined,
        leaveText: leave ? leaveText(leave.loai, leave.buoi) : undefined,
      });
    }

    return {
      id: emp.id,
      name: emp.name,
      dept: emp.department,
      loaiCa: emp.loai_ca || 'tieu_chuan',
      days,
      summary: { cong, b: bCount, d: dCount, p: pCount },
    };
  });

  rows.sort((a, b) => a.dept.localeCompare(b.dept) || a.name.localeCompare(b.name));
  const departments = [...new Set(employees.map((e) => e.department))].sort();
  return { year, month, daysInMonth, dows, rows, departments, locks };
}
