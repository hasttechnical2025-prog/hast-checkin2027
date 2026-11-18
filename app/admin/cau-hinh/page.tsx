import { createAdminClient } from '@/lib/supabase/admin';
import ConfigAdmin from './config-admin';

export const dynamic = 'force-dynamic';

export default async function CauHinhPage() {
  const admin = createAdminClient();
  const [{ data: cfgRows }, { data: printRow }] = await Promise.all([
    admin.from('chamcong_system_config').select('key, value'),
    admin.from('chamcong_nscl_print_config').select('config').eq('id', 1).maybeSingle(),
  ]);

  const config: Record<string, string> = {};
  (cfgRows ?? []).forEach((r) => {
    config[r.key as string] = (r.value as string) ?? '';
  });
  const printConfig = (printRow?.config as Record<string, string | number>) || {};

  return <ConfigAdmin config={config} printConfig={printConfig} />;
}
