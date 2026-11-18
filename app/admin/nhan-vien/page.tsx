import { createAdminClient } from '@/lib/supabase/admin';
import EmployeesAdmin, { type Emp } from './employees-admin';

export const dynamic = 'force-dynamic';

export default async function NhanVienPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from('chamcong_employees')
    .select('id, ma_nv, name, department, role, loai_ca, status, email, telegram_chat_id, ngay_vao_lam, mien_cham_cong, token')
    .order('department')
    .order('ma_nv');

  const emps: Emp[] = (data ?? []).map((e) => ({
    id: e.id as number,
    maNv: (e.ma_nv as string) || '',
    name: (e.name as string) || '',
    department: (e.department as string) || '',
    role: (e.role as string) || 'CBNV',
    loaiCa: (e.loai_ca as string) || 'tieu_chuan',
    status: (e.status as string) || 'Đang làm việc',
    email: (e.email as string) || '',
    telegram: e.telegram_chat_id != null ? String(e.telegram_chat_id) : '',
    ngayVaoLam: (e.ngay_vao_lam as string) || '',
    mienChamCong: !!e.mien_cham_cong,
    token: (e.token as string) || '',
  }));

  const departments = [...new Set(emps.map((e) => e.department).filter(Boolean))].sort();

  return <EmployeesAdmin initial={emps} departments={departments} />;
}
