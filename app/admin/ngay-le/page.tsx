import { createAdminClient } from '@/lib/supabase/admin';
import AdminNav from '@/app/admin/admin-nav';
import HolidaysAdmin, { type Holiday } from './holidays-admin';

export const dynamic = 'force-dynamic';

export default async function NgayLePage() {
  const admin = createAdminClient();
  const { data } = await admin.from('chamcong_holidays').select('date, description').order('date');
  const holidays: Holiday[] = (data ?? []).map((h) => ({
    date: h.date as string,
    description: (h.description as string) || '',
  }));

  return (
    <main className="wrap" style={{ maxWidth: 720 }}>
      <AdminNav active="ngay-le" />
      <HolidaysAdmin initial={holidays} />
    </main>
  );
}
