import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { vnNow } from '@/lib/attendance';
import { sendTelegramMany } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Bot nhắc nhở chấm công (Vercel Cron gọi theo giờ). Nhắc NV đang làm, không miễn chấm,
 * có telegram, CHƯA chấm ca IN tương ứng hôm nay. Bỏ qua T7/CN/lễ.
 * Bảo vệ: Vercel Cron gửi Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { dateStr, hhmm, dow } = vnNow();
  if (dow === 0 || dow === 6) return NextResponse.json({ ok: true, skipped: 'weekend' });

  const admin = createAdminClient();
  const { data: hol } = await admin.from('chamcong_holidays').select('date').eq('date', dateStr).maybeSingle();
  if (hol) return NextResponse.json({ ok: true, skipped: 'holiday' });

  const url = new URL(req.url);
  let session = url.searchParams.get('session') || '';
  if (session !== 'morning_in' && session !== 'afternoon_in') {
    session = hhmm <= 1100 ? 'morning_in' : 'afternoon_in';
  }
  const col = session as 'morning_in' | 'afternoon_in';

  const { data: emps } = await admin
    .from('chamcong_employees')
    .select('id, name, telegram_chat_id')
    .eq('status', 'Đang làm việc')
    .eq('mien_cham_cong', false)
    .not('telegram_chat_id', 'is', null);
  const list = (emps ?? []) as { id: number; name: string; telegram_chat_id: number | null }[];
  const ids = list.map((e) => e.id);

  const { data: recs } = ids.length
    ? await admin.from('chamcong_attendance_records').select(`employee_id, ${col}`).eq('date', dateStr).in('employee_id', ids)
    : { data: [] as Record<string, unknown>[] };
  const done = new Set(
    ((recs ?? []) as Record<string, unknown>[]).filter((r) => r[col]).map((r) => r.employee_id as number),
  );

  const targets = list.filter((e) => !done.has(e.id));
  const label = session === 'morning_in' ? 'buổi sáng' : 'buổi chiều';
  await sendTelegramMany(
    targets.map((e) => e.telegram_chat_id),
    `⏰ Nhắc nhở: đừng quên <b>chấm công ${label}</b> hôm nay nhé!`,
  );

  return NextResponse.json({ ok: true, session, reminded: targets.length });
}
