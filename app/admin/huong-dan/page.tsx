import { createAdminClient } from '@/lib/supabase/admin';
import GuideAdmin, { type GuideItem } from './guide-admin';

export const dynamic = 'force-dynamic';

const IDS = ['p1', 'p2', 'p3', 'p4'];

export default async function HuongDanPage() {
  const admin = createAdminClient();
  const { data } = await admin.from('chamcong_guide_content').select('id, title, content');
  const map = new Map<string, { title: string; content: string }>(
    (data ?? []).map((g) => [g.id as string, { title: (g.title as string) || '', content: (g.content as string) || '' }]),
  );
  const items: GuideItem[] = IDS.map((id) => ({
    id,
    title: map.get(id)?.title || '',
    content: map.get(id)?.content || '',
  }));

  return <GuideAdmin initial={items} />;
}
