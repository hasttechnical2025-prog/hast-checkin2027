'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { APP_VERSION } from '@/lib/version';
import { Icon } from '@/app/_components/icons';

export interface OfficeProp {
  name: string;
  lat: number;
  lng: number;
  radius: number;
}
export interface TodayRecord {
  morning_in: string | null;
  morning_out: string | null;
  afternoon_in: string | null;
  afternoon_out: string | null;
  grades: string | null; // "A,B,A,D" theo thứ tự SESSIONS
}
export interface ShiftRow {
  a_start: string | null;
  a_end: string | null;
  a_end2: string | null;
  b_end: string | null;
}
export interface ChamCongProps {
  token: string;
  employee: { name: string; maNv: string; department: string };
  office: OfficeProp;
  maxDistance: number;
  gpsExpireMs: number;
  companyName: string;
  today: TodayRecord | null;
  holiday: { isHoliday: boolean; reason: string };
  guide: { id: string; title: string; content: string }[];
  shiftConfig: Partial<Record<SessionKey, ShiftRow>>;
}

type LocType = 'idle' | 'ok' | 'warn' | 'err';
type SessionKey = 'morning_in' | 'morning_out' | 'afternoon_in' | 'afternoon_out';
interface Gps {
  lat: number;
  lng: number;
  acc: number;
  ts: number;
}

const SESSIONS: { key: SessionKey; label: string; io: 'in' | 'out' }[] = [
  { key: 'morning_in', label: 'Vào sáng', io: 'in' },
  { key: 'morning_out', label: 'Ra sáng', io: 'out' },
  { key: 'afternoon_in', label: 'Vào chiều', io: 'in' },
  { key: 'afternoon_out', label: 'Ra chiều', io: 'out' },
];

const GRADE_CLASS: Record<string, string> = { A: 'grade-a', B: 'grade-b', D: 'grade-d' };
const GRADE_MEAN: Record<string, string> = { A: 'đúng giờ', B: 'trễ nhẹ', D: 'không đạt' };
const DOW_VI = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

const pad2 = (n: number) => String(n).padStart(2, '0');
const hm = (t: string | null) => (t ? String(t).slice(0, 5) : '—');

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** "HH:MM:SS" -> giây trong ngày. */
function toSec(t: string | null): number | null {
  if (!t) return null;
  const [h, m, s] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 3600 + m * 60 + (s || 0);
}

/**
 * Đoán công A/B/D NẾU chấm vào "nowSec" cho 1 ca — khớp logic server
 * chamcong_calculate_session_grade (0004). Thiếu config -> null (không đoán).
 */
function predictGrade(session: SessionKey, nowSec: number, cfg?: ShiftRow): 'A' | 'B' | 'D' | null {
  if (!cfg) return null;
  const aEnd = toSec(cfg.a_end);
  const bEnd = toSec(cfg.b_end);
  const aStart = toSec(cfg.a_start);
  const aEnd2 = toSec(cfg.a_end2);
  if (session === 'morning_in' || session === 'afternoon_in') {
    if (aEnd == null) return null;
    if (nowSec <= aEnd) return 'A';
    if (bEnd != null && nowSec <= bEnd) return 'B';
    return 'D';
  }
  if (session === 'morning_out') {
    if (aStart == null || aEnd2 == null) return null;
    if (nowSec >= aStart && nowSec <= aEnd2) return 'A';
    if (nowSec < aStart) return 'B';
    return 'D';
  }
  // afternoon_out: có chấm -> A/B (không bao giờ D)
  if (aEnd == null) return null;
  return nowSec >= aEnd ? 'A' : 'B';
}

interface Popover {
  title: string;
  body?: string;
  giaiTrinh?: boolean;
}

export default function ChamCong(props: ChamCongProps) {
  const { token, employee, office, maxDistance, gpsExpireMs, holiday, guide, shiftConfig } = props;

  const [today, setToday] = useState<TodayRecord>(
    props.today ?? { morning_in: null, morning_out: null, afternoon_in: null, afternoon_out: null, grades: null },
  );
  const [gps, setGps] = useState<Gps | null>(null);
  const [loc, setLocState] = useState<{ type: LocType; title: string; lines: string[] }>({
    type: 'idle',
    title: holiday.isHoliday ? 'Hôm nay là ngày nghỉ' : 'Chưa xác định vị trí',
    lines: holiday.isHoliday ? [holiday.reason] : ['Đang chuẩn bị định vị…'],
  });
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [justDone, setJustDone] = useState(false);
  const [note, setNote] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; title: string; lines: string[]; giaiTrinh?: boolean } | null>(null);
  const [confirmDlg, setConfirmDlg] = useState<{ label: string; time: string } | null>(null);
  const gettingRef = useRef(false);
  // Cách B: cờ "định vị xong thì chấm luôn" (khi chạm vòng lúc GPS hết hạn).
  const pendingSubmitRef = useRef(false);

  // Đồng hồ sống (giờ VN) + ca "đang tới giờ" — set sau mount để tránh lệch hydrate.
  const [clock, setClock] = useState<string | null>(null);
  const [clockDate, setClockDate] = useState('');
  const [nowSec, setNowSec] = useState(0);
  const [curSession, setCurSession] = useState<SessionKey | null>(null);

  // Lớp nổi: popover ô ca + banner điểm B/D (tự đóng khi chạm ra ngoài).
  const [popover, setPopover] = useState<Popover | null>(null);
  const [bannerOpen, setBannerOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const bannerRef = useRef<HTMLDivElement | null>(null);

  const filled = SESSIONS.filter((s) => today[s.key]).length;
  const gradeArr = (today.grades ?? '').split(',').map((g) => g.trim());

  useEffect(() => {
    const update = () => {
      const d = new Date(Date.now() + 7 * 3600 * 1000);
      const hh = d.getUTCHours();
      const mm = d.getUTCMinutes();
      const ss = d.getUTCSeconds();
      setClock(`${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`);
      setClockDate(`${DOW_VI[d.getUTCDay()]}, ${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`);
      setNowSec(hh * 3600 + mm * 60 + ss);
      const hhmm = hh * 100 + mm;
      setCurSession(hhmm <= 1000 ? 'morning_in' : hhmm <= 1245 ? 'morning_out' : hhmm <= 1500 ? 'afternoon_in' : 'afternoon_out');
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  // Banner điểm B/D: hiện khi vào trang nếu hôm nay có ca B/D; tự ẩn sau 7s.
  useEffect(() => {
    const bad = SESSIONS.some((s, i) => today[s.key] && (gradeArr[i] === 'B' || gradeArr[i] === 'D'));
    if (!bad) return;
    setBannerOpen(true);
    const t = setTimeout(() => setBannerOpen(false), 7000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chạm ra ngoài -> đóng popover / banner.
  useEffect(() => {
    if (!popover && !bannerOpen) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (popover && popRef.current && !popRef.current.contains(t) && stripRef.current && !stripRef.current.contains(t)) {
        setPopover(null);
      }
      if (bannerOpen && bannerRef.current && !bannerRef.current.contains(t)) {
        setBannerOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [popover, bannerOpen]);

  const requestGps = useCallback(() => {
    if (gettingRef.current || holiday.isHoliday) return;
    if (!navigator.geolocation) {
      setLocState({ type: 'err', title: 'Thiết bị không hỗ trợ định vị', lines: ['Không thể chấm công.'] });
      return;
    }
    gettingRef.current = true;
    setLocating(true); // bật cho icon "Định vị lại" xoay + vòng hiện trạng thái
    setLocState({ type: 'idle', title: 'Đang xác định vị trí…', lines: ['Nếu hỏi quyền → bấm Cho phép'] });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        gettingRef.current = false;
        setLocating(false);
        const { latitude: lat, longitude: lng, accuracy: acc } = pos.coords;
        setGps({ lat, lng, acc, ts: Date.now() });
        const dist = Math.round(haversine(lat, lng, office.lat, office.lng));
        if (maxDistance > 0 && dist > maxDistance) {
          setLocState({
            type: 'err',
            title: 'Không thể chấm công',
            lines: [
              `Bạn đang cách công ty ${(dist / 1000).toFixed(1)} km`,
              `Giới hạn: ${(maxDistance / 1000).toFixed(1)} km`,
            ],
          });
        } else if (dist <= office.radius) {
          setLocState({
            type: 'ok',
            title: `Trong phạm vi: ${office.name}`,
            lines: [`Khoảng cách ${dist} m · độ chính xác ±${Math.round(acc)} m`],
          });
        } else {
          setLocState({
            type: 'warn',
            title: 'Ngoài phạm vi công ty',
            lines: [`Cách ${dist} m · vẫn ghi nhận kèm cảnh báo`],
          });
        }
      },
      (err) => {
        gettingRef.current = false;
        setLocating(false);
        setGps(null);
        pendingSubmitRef.current = false; // định vị lỗi -> hủy ý định tự chấm
        const m: Record<number, string> = {
          1: 'Cần BẬT Định vị cho trình duyệt rồi thử lại.',
          2: 'Không bắt được tín hiệu định vị. Ra chỗ thoáng rồi thử lại.',
          3: 'Hết thời gian chờ định vị. Thử lại.',
        };
        setLocState({
          type: 'err',
          title: 'Chưa lấy được vị trí',
          lines: [m[err.code] || 'Lỗi định vị.', 'Bắt buộc có GPS để chấm công.'],
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [holiday.isHoliday, office, maxDistance]);

  useEffect(() => {
    if (!holiday.isHoliday) requestGps();
  }, [holiday.isHoliday, requestGps]);

  const submit = useCallback(
    async (confirm: boolean) => {
      if (!gps) return;
      setBusy(true);
      try {
        const res = await fetch('/api/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            latitude: gps.lat,
            longitude: gps.lng,
            accuracy: gps.acc,
            note,
            confirm,
          }),
        });
        const data = await res.json();

        if (data.needsConfirm) {
          setBusy(false);
          setConfirmDlg({ label: data.sessionLabel, time: data.existingTime });
          return;
        }
        if (!res.ok || data.error) {
          setResult({ ok: false, title: 'Không thể chấm công', lines: [data.error || 'Có lỗi xảy ra.'] });
          setBusy(false);
          return;
        }

        const now = new Date(Date.now() + 7 * 3600 * 1000);
        const nowHm = `${pad2(now.getUTCHours())}:${pad2(now.getUTCMinutes())}`;
        setToday((t) => {
          const order = SESSIONS.map((s) => s.key);
          const idx = order.indexOf(data.session);
          let grades = t.grades;
          if (idx >= 0 && data.grade) {
            const parts = (t.grades ?? ',,,').split(',');
            while (parts.length < 4) parts.push('');
            parts[idx] = data.grade;
            grades = parts.join(',');
          }
          return { ...t, [data.session]: nowHm, grades };
        });
        const isBad = data.grade === 'B' || data.grade === 'D';
        setResult({
          ok: true,
          title: 'Đã chấm công',
          lines: [
            data.sessionLabel.charAt(0).toUpperCase() + data.sessionLabel.slice(1) + (data.grade ? ` · loại ${data.grade}` : ''),
            data.inside ? `Trong phạm vi · ${data.distance} m` : `Ngoài phạm vi · ${data.distance} m`,
            data.address && data.address !== 'Không xác định' ? data.address : '',
          ].filter(Boolean),
          giaiTrinh: isBad,
        });
        if (isBad) setBannerOpen(true);
        setNote('');
        setBusy(false);
        setJustDone(true);
        setTimeout(() => setJustDone(false), 800);
      } catch {
        setResult({ ok: false, title: 'Lỗi kết nối', lines: ['Kiểm tra mạng rồi thử lại.'] });
        setBusy(false);
      }
    },
    [gps, token, note],
  );

  const onTapRing = useCallback(() => {
    if (holiday.isHoliday || busy || locating) return;
    const expired = !gps || Date.now() - gps.ts > gpsExpireMs;
    if (expired) {
      // Cách B: chạm vòng = chấm. GPS hết hạn -> định vị lại RỒI tự chấm luôn
      // (requestGps bật locating + xoay icon; hiệu ứng tự chấm xử lý ở effect dưới).
      pendingSubmitRef.current = true;
      setGps(null);
      requestGps();
      return;
    }
    if (loc.type === 'err') return;
    submit(false);
  }, [holiday.isHoliday, busy, locating, gps, gpsExpireMs, loc.type, requestGps, submit]);

  // Cách B: định vị lại xong (do chạm vòng lúc GPS hết hạn) -> tự chấm.
  // Lỗi định vị đã xóa cờ ở requestGps; ngoài giới hạn (loc.type='err') -> hủy, hiện lỗi.
  useEffect(() => {
    if (!pendingSubmitRef.current) return;
    if (!gps) return; // chưa có fix mới -> chờ
    if (loc.type === 'err') {
      pendingSubmitRef.current = false;
      return;
    }
    pendingSubmitRef.current = false;
    submit(false);
  }, [gps, loc.type, submit]);

  // Chạm 1 ô ca -> popover giải thích/định tuyến (không tự chấm ca cũ: server quyết theo giờ).
  const openChip = useCallback(
    (i: number) => {
      const s = SESSIONS[i];
      const label = s.label;
      if (holiday.isHoliday) {
        setPopover({ title: 'Hôm nay là ngày nghỉ', body: 'Không chấm công hôm nay.' });
        return;
      }
      if (today[s.key]) {
        const g = gradeArr[i] || '';
        setPopover({
          title: `${label}: ${hm(today[s.key])}`,
          body: g ? `Xếp loại ${g}${GRADE_MEAN[g] ? ` (${GRADE_MEAN[g]})` : ''}.` : undefined,
          giaiTrinh: g === 'B' || g === 'D',
        });
        return;
      }
      const curIdx = curSession ? SESSIONS.findIndex((x) => x.key === curSession) : -1;
      if (curIdx >= 0 && i < curIdx) {
        setPopover({ title: `Đã qua giờ ${label}`, giaiTrinh: true });
        return;
      }
      if (i === curIdx) {
        setPopover({ title: `Giờ ${label}`, body: 'Chạm nút tròn bên dưới để chấm.' });
        return;
      }
      setPopover({ title: `Chưa tới giờ ${label}`, body: 'Ca này chưa tới giờ chấm.' });
    },
    [holiday.isHoliday, today, gradeArr, curSession],
  );

  const processing = busy || locating;
  const canCheck = !holiday.isHoliday && !!gps && loc.type !== 'err' && !busy;
  const ready = canCheck && !locating;
  const curLabel = curSession ? SESSIONS.find((s) => s.key === curSession)?.label ?? '' : '';

  // Dải ngữ cảnh dưới đồng hồ.
  let ctx: { cls: string; text: string } | null = null;
  if (clock) {
    if (holiday.isHoliday) {
      ctx = { cls: 'muted', text: 'Hôm nay là ngày nghỉ' };
    } else if (curSession) {
      if (today[curSession]) {
        ctx = { cls: 'muted', text: `Đã chấm ${curLabel}` };
      } else {
        const g = predictGrade(curSession, nowSec, shiftConfig[curSession]);
        ctx = {
          cls: g === 'A' ? 'ok' : g === 'B' ? 'warn' : g === 'D' ? 'err' : 'muted',
          text: g ? `Giờ ${curLabel} (công ${g})` : `Giờ ${curLabel}`,
        };
      }
    }
  }

  // Nội dung tâm vòng.
  let ringCenter: React.ReactNode;
  if (busy) ringCenter = <span className="cc-ring-cta small">Đang gửi…</span>;
  else if (locating) ringCenter = <span className="cc-ring-cta small">Đang lấy vị trí…</span>;
  else if (holiday.isHoliday) ringCenter = <span className="cc-ring-cta">Ngày nghỉ</span>;
  else if (!gps)
    ringCenter = (
      <>
        <span className="cc-ring-cta">ĐỊNH VỊ</span>
        <span className="cc-ring-sub">bấm để xác định vị trí</span>
      </>
    );
  else if (loc.type === 'err') ringCenter = <span className="cc-ring-cta small">Không thể chấm</span>;
  else
    ringCenter = (
      <>
        <span className="cc-ring-cta">CHẠM ĐỂ CHẤM</span>
        <span className="cc-ring-sub">{filled}/4 ca{curLabel ? ` · ${curLabel}` : ''}</span>
      </>
    );

  const R = 92;
  const C = 2 * Math.PI * R;
  const GAP_DEG = 7;
  const ARC_LEN = C * ((90 - GAP_DEG) / 360);

  return (
    <main className="cc-wrap">
      {bannerOpen && (
        <div className="cc-banner" ref={bannerRef} role="status">
          <Icon name="alert" size={16} className="cc-banner-ic" />
          <span>Hôm nay có ca xếp loại B/D — bạn có thể giải trình.</span>
          <Link className="cc-banner-btn" href={`/c/${token}/lich-su`} prefetch>
            Giải trình
          </Link>
        </div>
      )}

      {/* 1) Logo công ty + nút cài đặt */}
      <header className="cc-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt={props.companyName} className="cc-top-logo" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        <button type="button" className="cc-gear" onClick={() => setSheetOpen(true)} aria-label="Cài đặt">
          <Icon name="settings" size={19} />
        </button>
      </header>

      <div className="cc-apptitle">CHẤM CÔNG CBNV</div>

      {/* 2) Đồng hồ sống + ngữ cảnh ca */}
      <div className="cc-clock">
        <div className="cc-clock-time">{clock ?? '--:--:--'}</div>
        <div className="cc-clock-date">{clockDate || ' '}</div>
        {ctx && (
          <div className={`cc-clock-ctx ${ctx.cls}`}>
            <Icon name="clock" size={13} />
            {ctx.text}
          </div>
        )}
      </div>

      {/* 3) Họ tên + phòng ban */}
      <div className="cc-ident">
        <div className="cc-ident-name">
          <Icon name="user" size={18} style={{ color: 'var(--muted)' }} />
          {employee.name}
        </div>
        <div className="cc-ident-sub">
          {employee.maNv} · {employee.department}
        </div>
      </div>

      {/* 4) 4 ca — chạm để xem chú thích/giải trình */}
      <div className="cc-strip-wrap" ref={stripRef}>
        <div className="cc-strip">
          {SESSIONS.map((s, i) => {
            const done = !!today[s.key];
            const g = done ? gradeArr[i] : '';
            const curIdx = curSession ? SESSIONS.findIndex((x) => x.key === curSession) : -1;
            const missed = !done && !holiday.isHoliday && curIdx >= 0 && i < curIdx;
            const isCurrent = !done && s.key === curSession;
            return (
              <button
                type="button"
                key={s.key}
                className={`cc-chip ${done ? 'done' : ''}${isCurrent ? ' current' : ''}${missed ? ' missed' : ''}`}
                onClick={() => openChip(i)}
              >
                <span className="cc-chip-label">
                  <Icon name={s.io === 'in' ? 'arrowIn' : 'arrowOut'} size={11} className="cc-chip-io" />
                  {s.label}
                </span>
                <span className="cc-chip-time">{hm(today[s.key])}</span>
                {g && GRADE_CLASS[g] ? (
                  <span className={`cc-chip-grade ${GRADE_CLASS[g]}`}>{g}</span>
                ) : missed ? (
                  <span className="cc-chip-grade cc-chip-miss" aria-hidden="true">
                    <Icon name="info" size={12} />
                  </span>
                ) : (
                  <span className="cc-chip-grade cc-chip-grade-empty" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>

        {popover && (
          <div className="cc-pop" ref={popRef}>
            <div className="cc-pop-arrow" />
            <div className="cc-pop-body">
              <div className="cc-pop-title">{popover.title}</div>
              {popover.body && <div className="cc-pop-text">{popover.body}</div>}
            </div>
            {popover.giaiTrinh && (
              <Link className="cc-pop-btn" href={`/c/${token}/lich-su`} prefetch onClick={() => setPopover(null)}>
                <Icon name="doc" size={15} />
                Giải trình
              </Link>
            )}
          </div>
        )}
      </div>

      {/* 5) Ghi chú */}
      {!holiday.isHoliday && (
        <textarea
          className="field cc-note"
          placeholder="Ghi chú (tuỳ chọn): đi muộn, công tác, lý do…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={1}
        />
      )}

      {/* 6) Vị trí */}
      <div className={`cc-loc cc-loc-${loc.type}`}>
        <div className="cc-loc-main">
          <div className="cc-loc-title">
            <Icon name={loc.type === 'err' ? 'alert' : 'pin'} size={16} className="cc-loc-ic" />
            {loc.title}
          </div>
          {loc.lines.map((l, i) => (
            <div key={i} className="cc-loc-line">
              {l}
            </div>
          ))}
        </div>
        {!holiday.isHoliday && (
          <button type="button" className="cc-reloc" onClick={requestGps} disabled={busy || locating}>
            <Icon name="refresh" size={14} className={locating ? 'cc-spin-ic' : undefined} />
            {locating ? 'Đang định vị…' : 'Định vị lại'}
          </button>
        )}
      </div>

      {/* 7) Nút chấm công */}
      <div className="cc-ring-area">
        <button
          type="button"
          className={`cc-ring cc-ring-${canCheck ? loc.type : holiday.isHoliday ? 'idle' : loc.type}${processing ? ' processing' : ''}${justDone ? ' just-done' : ''}${ready ? ' ready' : ''}`}
          onClick={onTapRing}
          disabled={processing}
          aria-label="Chấm công"
          aria-busy={processing}
        >
          <svg viewBox="0 0 220 220" className="cc-ring-svg">
            {SESSIONS.map((s, i) => {
              const done = !!today[s.key];
              const current = !done && s.key === curSession;
              const rot = -90 + i * 90 + GAP_DEG / 2;
              return (
                <circle
                  key={s.key}
                  cx="110"
                  cy="110"
                  r={R}
                  className={`cc-ring-seg${done ? ' done' : current ? ' current' : ''}`}
                  strokeDasharray={`${ARC_LEN} ${C - ARC_LEN}`}
                  transform={`rotate(${rot} 110 110)`}
                />
              );
            })}
            {processing && (
              <circle
                cx="110"
                cy="110"
                r={R}
                className="cc-ring-spinner"
                strokeDasharray={`${C * 0.26} ${C}`}
              />
            )}
          </svg>
          <span className="cc-ring-center">{ringCenter}</span>
        </button>
      </div>

      {/* 8) Dữ liệu tháng */}
      <Link className="cc-monthlink" href={`/c/${token}/lich-su`} prefetch>
        <Icon name="chart" size={16} />
        Dữ liệu tháng &amp; giải trình
      </Link>

      {confirmDlg && (
        <div className="cc-dlg-overlay" onClick={() => setConfirmDlg(null)}>
          <div className="cc-dlg" onClick={(e) => e.stopPropagation()}>
            <h3>Chấm trùng ca?</h3>
            <p>
              Bạn đã <b>{confirmDlg.label}</b> lúc <b>{confirmDlg.time}</b>. Tiếp tục chấm công?
            </p>
            <div className="cc-dlg-btns">
              <button className="btn" onClick={() => { setConfirmDlg(null); submit(true); }}>
                Tiếp tục
              </button>
              <button className="btn cc-btn-ghost" onClick={() => setConfirmDlg(null)}>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="cc-dlg-overlay" onClick={() => setResult(null)}>
          <div className="cc-dlg" onClick={(e) => e.stopPropagation()}>
            <div className="cc-result-emoji">{result.ok ? '✅' : '⚠️'}</div>
            <h3>{result.title}</h3>
            {result.lines.map((l, i) => (
              <p key={i} className="muted">
                {l}
              </p>
            ))}
            <div className="cc-dlg-btns">
              {result.giaiTrinh && (
                <Link className="btn" href={`/c/${token}/lich-su`} prefetch onClick={() => setResult(null)}>
                  Giải trình
                </Link>
              )}
              <button className="btn cc-btn-ghost" onClick={() => setResult(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {sheetOpen && (
        <div className="cc-sheet-overlay" onClick={() => setSheetOpen(false)}>
          <div className="cc-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="cc-sheet-handle" />
            <h3 style={{ marginTop: 0 }}>About</h3>

            <div className="cc-sheet-sec">
              <div className="cc-sheet-k">Nhân viên</div>
              <div>
                {employee.name} · {employee.maNv}
              </div>
              <div className="muted">{employee.department}</div>
            </div>

            <div className="cc-sheet-sec">
              <div className="cc-sheet-k">Hướng dẫn sử dụng</div>
              {guide.length === 0 ? (
                <p className="muted">(Chưa có nội dung)</p>
              ) : (
                guide.map((g) => (
                  <details key={g.id} className="cc-guide">
                    <summary>{g.title || g.id}</summary>
                    <div className="muted" style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>
                      {g.content || '(Chưa có nội dung)'}
                    </div>
                  </details>
                ))
              )}
            </div>

            <div className="cc-sheet-sec">
              <div className="cc-sheet-k">Cài vào Màn hình chính</div>
              <p className="muted">
                iPhone: bấm <b>Chia sẻ</b> ⬆️ → <b>Thêm vào MH chính</b>. Android: menu <b>⋮</b> → <b>Cài ứng dụng</b>.
              </p>
            </div>

            <div className="cc-sheet-sec">
              <div className="cc-sheet-k">Phiên bản</div>
              <div className="muted">{APP_VERSION}</div>
              <button
                type="button"
                className="btn cc-btn-ghost"
                style={{ marginTop: 8 }}
                onClick={() => window.location.reload()}
              >
                🔄 Tải lại ứng dụng
              </button>
            </div>

            <button type="button" className="btn" style={{ width: '100%', marginTop: 4 }} onClick={() => setSheetOpen(false)}>
              Đóng
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
