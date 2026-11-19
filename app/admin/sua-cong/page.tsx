import { createAdminClient } from '@/lib/supabase/admin';
import SuaCongAdmin, { type EmpOpt } from './sua-cong-admin';

export const dynamic = 'force-dynamic';

export default async function SuaCongPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from('chamcong_employees')
    .select('id, name, ma_nv, loai_ca')
    .eq('status', 'Đang làm việc')
    .order('name');

  const emps: EmpOpt[] = (data ?? []).map((e) => ({
    id: e.id as number,
    name: (e.name as string) || '',
    maNv: (e.ma_nv as string) || '',
    loaiCa: (e.loai_ca as string) || 'tieu_chuan',
  }));

  return <SuaCongAdmin emps={emps} />;
}
