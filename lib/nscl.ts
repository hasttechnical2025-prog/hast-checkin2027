import { createAdminClient } from '@/lib/supabase/admin';

// Dữ liệu bảng điểm NSCL (port main.giaitrinh.js renderNsclTable + block + totals).
// Ô ngày: số 1..15 | P (phép) | Ô (ốm) | N (nghỉ lễ). T7/CN/Lễ/chưa vào làm -> khóa.
// Chặn ô: ngày có công B/D mà giải trình chưa Đồng ý -> không chấm được (sọc đỏ).

const LEAVE_NSCL: Record<string, string> = { phep: 'P', om: 'Ô', viec_rieng: 'P' };

export interface NsclDay {
  d: number;
  ymd: string;
  cls: '' | 't7' | 'cn' | 'le';
}
export interface NsclCell {
  d: number;
  ymd: string;
  val: string;
  cls: string;
  editable: boolean;
  block: boolean;
  blockReason: string;
  valClass: string;
}
export interface NsclRow {
  employeeId: number;
  name: string;
  dept: string;
  role: string;
  canEdit: boolean;
  cells: NsclCell[];
  adjust: string;
  rowDiem: number;
  sumPhep: number;
  sumOm: number;
}
export interface NsclLock {
  nguoiKy: string;
  thoiGianKy: string;
}
export interface NsclPrintCfg {
  fontName: number;
  fontData: number;
  rowHeight: number;
  colorSat: string;
  colorSun: string;
  colorHoliday: string;
}
export interface NsclData {
  year: number;
  month: number;
  days: NsclDay[];
  rows: NsclRow[];
  totals: { diem: number; phep: number; om: number };
  departments: string[];
  locks: Record<string, NsclLock>;
  printCfg: NsclPrintCfg;
  leaveMode: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

const DEFAULT_PRINT: NsclPrintCfg = {
  fontName: 11,
  fontData: 11,
  rowHeight: 30,
  colorSat: '#BFBFBF',
  colorSun: '#A6A6A6',
  colorHoliday: '#D9D9D9',
};

interface EmpRow {
  id: number;
  name: string;
  department: string;
  role: string | null;
  ngay_vao_lam: string | null;
  mien_cham_cong: boolean | null;
}
interface RecRow {
  employee_id: number;
  date: string;
  grades: string | null;
  approve_status: string | null;
  nscl_score: string | null;
  nscl_adjust: number | null;
}

export async function buildNsclData(
  visibleDepts: string[] | null,
  editorDept: string | null,
  isAdmin: boolean,
  year: number,
  month: number,
): Promise<NsclData> {
  const admin = createAdminClient();
  const start = `${year}-${pad(month)}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${pad(month)}-${pad(daysInMonth)}`;

  let empQ = admin
    .from('chamcong_employees')
    .select('id, name, department, role, ngay_vao_lam, mien_cham_cong')
    .eq('status', 'Đang làm việc');
  if (visibleDepts) empQ = empQ.in('department', visibleDepts);
  const { data: empData } = await empQ;
  const employees = (empData ?? []) as EmpRow[];

  const [holRes, recRes, leaveRes, lockRes, cfgRes, modeRes] = await Promise.all([
    admin.from('chamcong_holidays').select('date').gte('date', start).lte('date', end),
    employees.length
      ? admin
          .from('chamcong_attendance_records')
          .select('employee_id, date, grades, approve_status, nscl_score, nscl_adjust')
          .in('employee_id', employees.map((e) => e.id))
          .gte('date', start)
          .lte('date', end)
      : Promise.resolve({ data: [] as RecRow[] }),
    employees.length
      ? admin
          .from('chamcong_nghi_phep_dong_bo')
          .select('employee_id, ngay, buoi, loai')
          .in('employee_id', employees.map((e) => e.id))
          .gte('ngay', start)
          .lte('ngay', end)
      : Promise.resolve({ data: [] as { employee_id: number; ngay: string; buoi: string; loai: string }[] }),
    admin.from('chamcong_nscl_lock').select('department, nguoi_ky, thoi_gian_ky').eq('thang', month).eq('nam', year),
    admin.from('chamcong_nscl_print_config').select('config').eq('id', 1).maybeSingle(),
    admin.from('chamcong_system_config').select('value').eq('key', 'leave_symbol_mode').maybeSingle(),
  ]);

  const holidays = new Set<string>((holRes.data ?? []).map((h) => h.date as string));
  const recMap = new Map<string, RecRow>(
    ((recRes.data ?? []) as RecRow[]).map((r) => [`${r.employee_id}_${r.date}`, r]),
  );
  const leaveMap = new Map<string, { buoi: string; loai: string }>(
    ((leaveRes.data ?? []) as { employee_id: number; ngay: string; buoi: string; loai: string }[]).map((l) => [
      `${l.employee_id}_${l.ngay}`,
      { buoi: l.buoi, loai: l.loai },
    ]),
  );
  const locks: Record<string, NsclLock> = {};
  (lockRes.data ?? []).forEach((l) => {
    locks[l.department as string] = {
      nguoiKy: (l.nguoi_ky as string) || '',
      thoiGianKy: (l.thoi_gian_ky as string) || '',
    };
  });
  const printCfg: NsclPrintCfg = { ...DEFAULT_PRINT, ...((cfgRes.data?.config as Partial<NsclPrintCfg>) || {}) };
  const leaveMode = modeRes.data?.value === 'split' ? 'split' : 'merged';

  // Ngày (header)
  const days: NsclDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${year}-${pad(month)}-${pad(d)}`;
    const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
    const cls: NsclDay['cls'] = holidays.has(ymd) ? 'le' : dow === 6 ? 't7' : dow === 0 ? 'cn' : '';
    days.push({ d, ymd, cls });
  }

  // Sắp xếp: TBP trước, rồi theo tên
  employees.sort((a, b) => {
    const ar = (a.role || '').toUpperCase();
    const br = (b.role || '').toUpperCase();
    if (ar === 'TBP' && br !== 'TBP') return -1;
    if (ar !== 'TBP' && br === 'TBP') return 1;
    return a.name.localeCompare(b.name, 'vi');
  });

  let totDiem = 0;
  let totPhep = 0;
  let totOm = 0;
  const rows: NsclRow[] = [];

  for (const emp of employees) {
    const deptLocked = !!locks[emp.department];
    const canEdit = isAdmin || (emp.department === editorDept && !deptLocked);
    let sumDiem = 0;
    let sumPhep = 0;
    let sumOm = 0;
    const cells: NsclCell[] = [];

    for (const day of days) {
      const { ymd, cls } = day;
      const beforeJoin = !!emp.ngay_vao_lam && ymd < emp.ngay_vao_lam;
      const rec = recMap.get(`${emp.id}_${ymd}`);
      const leave = leaveMap.get(`${emp.id}_${ymd}`);

      let val = (rec?.nscl_score || '').trim();
      const up = val.toUpperCase();
      if (up === 'P') val = 'P';
      else if (up === 'Ô' || up === 'O') val = 'Ô';
      else if (up === 'N') val = 'N';
      // Overlay nghỉ phép (nếu ô trống): cả ngày -> P/Ô theo mode; nửa buổi -> 5.
      if (!val && leave) {
        val = leave.buoi === 'ca_ngay' ? (leaveMode === 'split' ? LEAVE_NSCL[leave.loai] || 'P' : 'P') : '5';
      }
      if (cls === 'le') val = 'N';
      if (beforeJoin) val = '';

      // Tổng hợp
      if (val === 'P') sumPhep += 1;
      else if (val === 'Ô') sumOm += 1;
      else if (val === 'N') {
        /* nghỉ lễ */
      } else {
        const nv = parseFloat(val);
        if (!isNaN(nv)) {
          sumDiem += nv;
          if (nv === 5) sumPhep += 0.5;
        }
      }

      // Chặn ô: B/D mà giải trình chưa Đồng ý (leave coi như Đồng ý).
      // NGOẠI LỆ: nhân viên miễn chấm công -> không cần giải trình, TBP chấm NSCL trực tiếp.
      const grades = (rec?.grades || 'D,D,D,D').split(',').map((g) => g.trim());
      const hasBD = grades.some((g) => g === 'B' || g === 'D');
      const approve = leave ? 'Đồng ý' : rec?.approve_status || '';
      let block = false;
      let blockReason = '';
      if (canEdit && cls === '' && !beforeJoin && !emp.mien_cham_cong && hasBD && approve !== 'Đồng ý') {
        block = true;
        blockReason = approve === 'Chờ' ? 'giải trình chờ duyệt' : approve === 'Từ chối' ? 'giải trình bị từ chối' : 'chưa giải trình';
      }

      let valClass = '';
      if (cls === '' && val !== '' && val !== '10') {
        valClass = val === 'P' ? 'nv-p' : val === 'Ô' ? 'nv-om' : val === 'N' ? 'nv-n' : 'nv-low';
      }

      const editable = canEdit && cls === '' && !beforeJoin && !block;
      cells.push({ d: day.d, ymd, val, cls, editable, block, blockReason, valClass });
    }

    const adjRec = recMap.get(`${emp.id}_${year}-${pad(month)}-01`);
    const adjust = adjRec?.nscl_adjust != null ? String(adjRec.nscl_adjust) : '';
    const adjNum = parseFloat(adjust);
    const rowDiem = sumDiem + (isNaN(adjNum) ? 0 : adjNum);

    totDiem += rowDiem;
    totPhep += sumPhep;
    totOm += sumOm;

    rows.push({
      employeeId: emp.id,
      name: emp.name,
      dept: emp.department,
      role: emp.role || '',
      canEdit,
      cells,
      adjust,
      rowDiem,
      sumPhep,
      sumOm,
    });
  }

  const departments = [...new Set(employees.map((e) => e.department))].sort();

  return {
    year,
    month,
    days,
    rows,
    totals: { diem: totDiem, phep: totPhep, om: totOm },
    departments,
    locks,
    printCfg,
    leaveMode,
  };
}
