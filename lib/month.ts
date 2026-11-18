import { createAdminClient } from '@/lib/supabase/admin';
import { vnNow } from '@/lib/attendance';

// Port logic dữ liệu tháng của app cũ (history.js) sang server. GIỮ hành vi:
//  - record ảo 'D,D,D,D' cho ngày làm việc đã qua chưa chấm
//  - overlay nghỉ phép đã duyệt (chamcong_nghi_phep_dong_bo): cả ngày -> P, không gate giải trình
//  - bỏ qua ngày trước ngay_vao_lam
//  - 4 thẻ: Công chuẩn / thực / B,D / Không chấm

const LEAVE_LABEL: Record<string, string> = { phep: 'Nghỉ phép', om: 'Nghỉ ốm', viec_rieng: 'Việc riêng' };
function leaveText(loai: string, buoi: string): string {
  const b = LEAVE_LABEL[loai] || 'Nghỉ phép';
  if (buoi === 'sang') return b + ' (sáng)';
  if (buoi === 'chieu') return b + ' (chiều)';
  return b;
}

export interface DayRow {
  ymd: string;
  date: string; // DD/MM/YYYY
  dowLabel: string;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayLabel: string;
  mi: string;
  mo: string;
  ai: string;
  ao: string;
  grades: [string, string, string, string];
  allOk: boolean;
  hasAbsent: boolean;
  reason: string;
  approve: string;
  approveNote: string;
  jtype: string;
  jbuoi: string;
  isLeave: boolean;
  isFullLeave: boolean;
  leaveLabel: string;
  canJustify: boolean;
  locked: boolean;
}

export interface MonthData {
  year: number;
  month: number;
  summary: { congChuan: number; congThucTe: number; congBD: number; khongCham: number };
  days: DayRow[];
}

const pad = (n: number) => String(n).padStart(2, '0');
const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

interface RecRow {
  date: string;
  morning_in: string | null;
  morning_out: string | null;
  afternoon_in: string | null;
  afternoon_out: string | null;
  grades: string | null;
  justification: string | null;
  justification_type: string | null;
  justification_buoi: string | null;
  approve_status: string | null;
  approve_note: string | null;
}

export async function buildMonthData(
  employeeId: number,
  ngayVaoLam: string | null,
  year: number,
  month: number,
): Promise<MonthData> {
  const admin = createAdminClient();
  const start = `${year}-${pad(month)}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${pad(month)}-${pad(daysInMonth)}`;

  const [hldRes, rowsRes, leaveRes] = await Promise.all([
    admin.from('chamcong_holidays').select('date, description').gte('date', start).lte('date', end),
    admin
      .from('chamcong_attendance_records')
      .select(
        'date, morning_in, morning_out, afternoon_in, afternoon_out, grades, justification, justification_type, justification_buoi, approve_status, approve_note',
      )
      .eq('employee_id', employeeId)
      .gte('date', start)
      .lte('date', end),
    admin
      .from('chamcong_nghi_phep_dong_bo')
      .select('ngay, buoi, loai')
      .eq('employee_id', employeeId)
      .gte('ngay', start)
      .lte('ngay', end),
  ]);

  const holidaysMap = new Map<string, string>(
    (hldRes.data ?? []).map((h) => [h.date as string, h.description as string]),
  );
  const recordMap = new Map<string, RecRow>(
    (rowsRes.data ?? []).map((r) => [r.date as string, r as RecRow]),
  );
  const leaveMap = new Map<string, { loai: string; buoi: string }>(
    (leaveRes.data ?? []).map((l) => [l.ngay as string, { loai: l.loai as string, buoi: l.buoi as string }]),
  );

  const todayStr = vnNow().dateStr;

  let congChuan = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${year}-${pad(month)}-${pad(d)}`;
    const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
    if (dow !== 0 && dow !== 6 && !(ngayVaoLam && ymd < ngayVaoLam)) congChuan++;
  }

  let congThucTe = 0;
  let congBD = 0;
  let khongCham = 0;
  const days: DayRow[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${year}-${pad(month)}-${pad(d)}`;
    if (ngayVaoLam && ymd < ngayVaoLam) continue;

    const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = holidaysMap.has(ymd);
    const isTodayOrBefore = ymd <= todayStr;

    let r = recordMap.get(ymd);
    let isVirtual = false;
    if (!r && isTodayOrBefore && !isHoliday && !isWeekend) {
      r = {
        date: ymd,
        morning_in: '',
        morning_out: '',
        afternoon_in: '',
        afternoon_out: '',
        grades: 'D,D,D,D',
        justification: '',
        justification_type: '',
        justification_buoi: '',
        approve_status: '',
        approve_note: '',
      };
      isVirtual = true;
    }
    if (!r) continue;

    const leave = leaveMap.get(ymd);
    const isFullLeave = !!leave && leave.buoi === 'ca_ngay';
    const ga = (r.grades || 'D,D,D,D').split(',').map((g) => g.trim());
    const allOk = ga.every((g) => g === 'A');
    const hasAbsent = ga.every((g) => g === 'D');

    if (isTodayOrBefore && !isHoliday && !isWeekend) {
      if (isFullLeave) {
        /* nghỉ phép cả ngày: không tính vào thực/B,D/không chấm */
      } else {
        if (!isVirtual) congThucTe++;
        if (!isVirtual && !allOk) congBD++;
        if (isVirtual) khongCham++;
      }
    }

    const reason = (r.justification || '').replace(/\|+$/, '').trim();
    const approve = r.approve_status || '';

    days.push({
      ymd,
      date: `${pad(d)}/${pad(month)}/${year}`,
      dowLabel: DOW[dow],
      isWeekend,
      isHoliday,
      holidayLabel: holidaysMap.get(ymd) || '',
      mi: r.morning_in || '',
      mo: r.morning_out || '',
      ai: r.afternoon_in || '',
      ao: r.afternoon_out || '',
      grades: [ga[0] || 'D', ga[1] || 'D', ga[2] || 'D', ga[3] || 'D'],
      allOk,
      hasAbsent,
      reason,
      approve,
      approveNote: r.approve_note || '',
      jtype: r.justification_type || '',
      jbuoi: r.justification_buoi || '',
      isLeave: !!leave,
      isFullLeave,
      leaveLabel: leave ? leaveText(leave.loai, leave.buoi) : '',
      canJustify: !isWeekend && !isHoliday && !leave && !(allOk && !reason),
      locked: approve === 'Đồng ý',
    });
  }

  return { year, month, summary: { congChuan, congThucTe, congBD, khongCham }, days };
}
