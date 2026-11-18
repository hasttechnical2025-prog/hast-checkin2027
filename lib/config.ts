import { createAdminClient } from '@/lib/supabase/admin';

export interface OfficeConfig {
  name: string;
  lat: number;
  lng: number;
  radius: number; // mét
}

export interface SystemConfig {
  office: OfficeConfig;
  maxDistance: number; // mét; 0 = không giới hạn
  allowHoliday: boolean;
  allowMultiple: boolean;
  requireMobile: boolean;
  gpsExpireMs: number;
  companyName: string;
  companyAddress: string;
}

/** Đọc cấu hình hệ thống từ chamcong_system_config (server, service role). */
export async function getSystemConfig(): Promise<SystemConfig> {
  const admin = createAdminClient();
  const { data } = await admin.from('chamcong_system_config').select('key, value');
  const m = new Map<string, string>((data ?? []).map((r) => [r.key, r.value]));
  const num = (k: string, d: number) => {
    const v = Number(m.get(k));
    return Number.isFinite(v) ? v : d;
  };
  return {
    office: {
      name: m.get('office_name') || 'Văn phòng',
      lat: num('office_lat', 0),
      lng: num('office_lng', 0),
      radius: num('office_radius', 200),
    },
    maxDistance: num('max_distance', 15000),
    allowHoliday: m.get('allow_holiday') === 'true',
    allowMultiple: m.get('allow_multiple') === 'true',
    requireMobile: m.get('require_mobile') === 'true',
    gpsExpireMs: num('gps_expire_ms', 60000),
    companyName: m.get('company_name') || 'Chấm Công',
    companyAddress: m.get('company_address') || '',
  };
}
