import { createAdminClient } from '@/lib/supabase/admin';
import { vnNow } from '@/lib/attendance';

// Tải danh sách giải trình cho TBP theo phòng + tháng (port main.giaitrinh.js loadData).
// Hiện ngày B/D hoặc có giải trình (record ảo cho ngày không chấm). Overlay nghỉ phép -> P.

const LEAVE_LABEL: Record<string, string> = { phep: 'Nghỉ phép', om: 'Nghỉ ốm', viec_rieng: 'Việc riêng' };
function leaveText(loai: string, buoi: string): string {
  const b = LEAVE_LABEL[loai] || 'Nghỉ phép';
  if (buoi === 'sang') return b + ' (sáng)';
  if (buoi === 'chieu') return b + ' (chiều)';
  return b;
}

export interface GtItem {
  employeeId: number;
  name: string;
  dept: string;
  ymd: string;
  date: string; // DD/MM/YYYY
  dowLabel: string;
  grades: [string, string, string, string];
  reason: string;
  approve: string; // '' | 'Đồng ý' | 'Từ chối'
  approveNote: string;
  isLeave: boolean;
  isFullLeave: boolean;
  canApprove: boolean;
  hasReason: boolean;
}

export interface GiaiTrinhData {
  year: number;
  month: number;
  items: GtItem[];
  departments: string[];
}

const pad = (n: number) => String(n).padStart(2, '0');
const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

interface EmpRow {
  id: number;
  name: string;
  department: string;
  ngay_vao_lam: string | null;
  mien_cham_cong: boolean | null;
}
interface RecRow {
  employee_id: number;
  date: string;
  grades: string | null;
  justification: string | null;
  approve_status: string | null;
  approve_note: string | null;
}

/**
 * @param visibleDepts  phòng được XEM (null = tất cả — admin/view_all)
 * @param approverDept  phòng được DUYỆT của người đăng nhập (null nếu admin)
 * @param isAdmin       admin duyệt mọi phòng
 */
export async function buildGiaiTrinhItems(
  visibleDepts: string[] | null,
  approverDept: string | null,
  isAdmin: boolean,
  year: number,
  month: number,
): Promise<GiaiTrinhData> {
  const admin = createAdminClient();
  const start = `${year}-${pad(month)}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${pad(month)}-${pad(daysInMonth)}`;

  let empQuery = admin
    .from('chamcong_employees')
    .select('id, name, department, ngay_vao_lam, mien_cham_cong')
    .eq('status', 'Đang làm việc');
  if (visibleDepts) empQuery = empQuery.in('department', visibleDepts);
  const { data: empData } = await empQuery;
  const employees = (empData ?? []) as EmpRow[];
  if (employees.length === 0) {
    return { year, month, items: [], departments: [] };
  }
  const empIds = employees.map((e) => e.id);
  const empById = new Map<number, EmpRow>(employees.map((e) => [e.id, e]));

  const [holRes, recRes, leaveRes] = await Promise.all([
    admin.from('chamcong_holidays').select('date').gte('date', start).lte('date', end),
    admin
      .from('chamcong_attendance_records')
      .select('employee_id, date, grades, justification, approve_status, approve_note')
      .in('employee_id', empIds)
      .gte('date', start)
      .lte('date', end),
    admin
      .from('chamcong_nghi_phep_dong_bo')
      .select('employee_id, ngay, buoi, loai')
      .in('employee_id', empIds)
      .gte('ngay', start)
      .lte('ngay', end),
  ]);

  const holidays = new Set<string>((holRes.data ?? []).map((h) => h.date as string));
  const recMap = new Map<string, RecRow>(
    (recRes.data ?? []).map((r) => [`${r.employee_id}_${r.date}`, r as RecRow]),
  );
  const leaveMap = new Map<string, { loai: string; buoi: string }>(
    (leaveRes.data ?? []).map((l) => [
      `${l.employee_id}_${l.ngay}`,
      { loai: l.loai as string, buoi: l.buoi as string },
    ]),
  );

  const todayStr = vnNow().dateStr;
  const items: GtItem[] = [];

  for (const emp of employees) {
    for (let d = 1; d <= daysInMonth; d++) {
      const ymd = `${year}-${pad(month)}-${pad(d)}`;
      if (ymd > todayStr) break;
      if (emp.ngay_vao_lam && ymd < emp.ngay_vao_lam) continue;
      const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
      if (dow === 0 || dow === 6) continue;
      if (holidays.has(ymd)) continue;

      const rec = recMap.get(`${emp.id}_${ymd}`);
      const leave = leaveMap.get(`${emp.id}_${ymd}`);
      const grades = (rec?.grades || 'D,D,D,D').split(',').map((g) => g.trim());
      const hasBD = grades.some((g) => g === 'B' || g === 'D');
      const reason = (rec?.justification || '').replace(/\|+$/, '').trim();
      const hasReason = reason.length > 0;

      // Nhân viên miễn chấm công: KHÔNG phát sinh nghĩa vụ giải trình -> không đưa vào
      // danh sách duyệt chỉ vì ngày chưa chấm (D/D). Chỉ hiện nếu họ thực sự có giải trình.
      if (emp.mien_cham_cong) {
        if (!hasReason) continue;
      } else if (!hasBD && !hasReason && !leave) {
        // Người thường: chỉ hiện ngày B/D hoặc có giải trình hoặc có nghỉ phép.
        continue;
      }

      const isFullLeave = !!leave && leave.buoi === 'ca_ngay';
      const approve = leave ? 'Đồng ý' : rec?.approve_status || '';

      items.push({
        employeeId: emp.id,
        name: emp.name,
        dept: emp.department,
        ymd,
        date: `${pad(d)}/${pad(month)}/${year}`,
        dowLabel: DOW[dow],
        grades: [grades[0] || 'D', grades[1] || 'D', grades[2] || 'D', grades[3] || 'D'],
        reason: leave ? leaveText(leave.loai, leave.buoi) : reason,
        approve,
        approveNote: rec?.approve_note || '',
        isLeave: !!leave,
        isFullLeave,
        canApprove: !leave && (isAdmin || emp.department === approverDept),
        hasReason: leave ? true : hasReason,
      });
    }
  }

  // Sắp xếp: phòng -> tên -> ngày
  items.sort(
    (a, b) => a.dept.localeCompare(b.dept) || a.name.localeCompare(b.name) || a.ymd.localeCompare(b.ymd),
  );

  const departments = [...new Set(employees.map((e) => e.department))].sort();
  return { year, month, items, departments };
}
