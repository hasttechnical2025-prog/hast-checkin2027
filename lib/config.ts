import { unstable_cache } from 'next/cache';
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

export interface GuideItem {
  id: string;
  title: string;
  content: string;
}

/**
 * Nội dung hướng dẫn (sheet Cài đặt CBNV) — gần như tĩnh nên CACHE (data cache) để
 * không query Supabase mỗi lần mở app. Admin sửa -> trễ tối đa ~5 phút là chấp nhận được.
 */
export const getGuideContent = unstable_cache(
  async (): Promise<GuideItem[]> => {
    const admin = createAdminClient();
    const { data } = await admin.from('chamcong_guide_content').select('id, title, content').order('id');
    return (data ?? []).map((g) => ({
      id: g.id as string,
      title: (g.title as string) || '',
      content: (g.content as string) || '',
    }));
  },
  ['cc-guide-content'],
  { revalidate: 300, tags: ['cc-config'] },
);

export interface ShiftRow {
  a_start: string | null;
  a_end: string | null;
  a_end2: string | null;
  b_end: string | null;
}

/**
 * Ngưỡng ca theo loai_ca (để client ĐOÁN công A/B cho giờ hiện tại) — cấu hình tĩnh,
 * Admin sửa trong /admin/ca. CACHE theo loai_ca để khỏi query mỗi lần mở app.
 */
export const getShiftConfig = unstable_cache(
  async (loaiCa: string): Promise<Record<string, ShiftRow>> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from('chamcong_shift_config')
      .select('session, a_start, a_end, a_end2, b_end')
      .eq('shift_type', loaiCa);
    const out: Record<string, ShiftRow> = {};
    (data ?? []).forEach((r) => {
      out[r.session as string] = {
        a_start: (r.a_start as string) ?? null,
        a_end: (r.a_end as string) ?? null,
        a_end2: (r.a_end2 as string) ?? null,
        b_end: (r.b_end as string) ?? null,
      };
    });
    return out;
  },
  ['cc-shift-config'],
  { revalidate: 300, tags: ['cc-config'] },
);
