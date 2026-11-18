import { createAdminClient } from '@/lib/supabase/admin';
import AdminNav from '@/app/admin/admin-nav';
import ShiftAdmin, { type ShiftRow } from './shift-admin';

export const dynamic = 'force-dynamic';

const hm = (v: string | null) => (v ? String(v).slice(0, 5) : '');

export default async function CaPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from('chamcong_shift_config')
    .select('shift_type, session, a_start, a_end, a_end2, b_end')
    .order('shift_type')
    .order('session');

  const rows: ShiftRow[] = (data ?? []).map((r) => ({
    shift_type: r.shift_type as string,
    session: r.session as string,
    a_start: hm(r.a_start as string | null),
    a_end: hm(r.a_end as string | null),
    a_end2: hm(r.a_end2 as string | null),
    b_end: hm(r.b_end as string | null),
  }));

  return (
    <main className="wrap" style={{ maxWidth: 820 }}>
      <AdminNav active="ca" />
      <ShiftAdmin initial={rows} />
    </main>
  );
}
