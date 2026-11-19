'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_VERSION } from '@/lib/version';

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
}

type LocType = 'idle' | 'ok' | 'warn' | 'err';
interface Gps {
  lat: number;
  lng: number;
  acc: number;
  ts: number;
}

const SESSIONS: { key: keyof TodayRecord; label: string }[] = [
  { key: 'morning_in', label: 'Vào sáng' },
  { key: 'morning_out', label: 'Ra sáng' },
  { key: 'afternoon_in', label: 'Vào chiều' },
  { key: 'afternoon_out', label: 'Ra chiều' },
];

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

const hm = (t: string | null) => (t ? String(t).slice(0, 5) : '—');

// Màu + nhãn phụ cho grade. A=đạt, B=trễ nhẹ, D=không đạt.
const GRADE_CLASS: Record<string, string> = { A: 'grade-a', B: 'grade-b', D: 'grade-d' };

/** Ca "đang tới giờ" theo giờ VN — mốc phân ca khớp trigger (Vào sáng ≤10:00). */
function currentSessionKey(): keyof TodayRecord {
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  const hhmm = now.getUTCHours() * 100 + now.getUTCMinutes();
  if (hhmm <= 1000) return 'morning_in';
  if (hhmm <= 1245) return 'morning_out';
  if (hhmm <= 1500) return 'afternoon_in';
  return 'afternoon_out';
}

export default function ChamCong(props: ChamCongProps) {
  const { token, employee, office, maxDistance, gpsExpireMs, holiday, guide } = props;

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
  const [note, setNote] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; title: string; lines: string[] } | null>(null);
  const [confirmDlg, setConfirmDlg] = useState<{ label: string; time: string } | null>(null);
  const gettingRef = useRef(false);
  // Ca "đang tới giờ" — set sau khi mount để tránh lệch hydrate (server không biết giờ client).
  const [curSession, setCurSession] = useState<keyof TodayRecord | null>(null);
  useEffect(() => {
    setCurSession(currentSessionKey());
  }, []);

  const filled = SESSIONS.filter((s) => today[s.key]).length;
  const gradeArr = (today.grades ?? '').split(',').map((g) => g.trim());

  const requestGps = useCallback(() => {
    if (gettingRef.current || holiday.isHoliday) return;
    if (!navigator.geolocation) {
      setLocState({ type: 'err', title: 'Thiết bị không hỗ trợ định vị', lines: ['Không thể chấm công.'] });
      return;
    }
    gettingRef.current = true;
    setLocState({ type: 'idle', title: 'Đang xác định vị trí…', lines: ['Nếu hỏi quyền → bấm Cho phép'] });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        gettingRef.current = false;
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
        setGps(null);
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

        // Thành công: cập nhật ca vừa chấm (optimistic) để vòng + dải cập nhật.
        const now = new Date(Date.now() + 7 * 3600 * 1000);
        const nowHm = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
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
        setResult({
          ok: true,
          title: 'Đã chấm công',
          lines: [
            data.sessionLabel.charAt(0).toUpperCase() + data.sessionLabel.slice(1),
            data.inside ? `Trong phạm vi · ${data.distance} m` : `Ngoài phạm vi · ${data.distance} m`,
            data.address && data.address !== 'Không xác định' ? data.address : '',
          ].filter(Boolean),
        });
        setNote('');
        setBusy(false);
      } catch {
        setResult({ ok: false, title: 'Lỗi kết nối', lines: ['Kiểm tra mạng rồi thử lại.'] });
        setBusy(false);
      }
    },
    [gps, token, note],
  );

  const onTapRing = useCallback(() => {
    if (holiday.isHoliday || busy) return;
    const expired = !gps || Date.now() - gps.ts > gpsExpireMs;
    if (expired) {
      setGps(null);
      requestGps();
      return;
    }
    if (loc.type === 'err') return; // vượt max / lỗi GPS
    submit(false);
  }, [holiday.isHoliday, busy, gps, gpsExpireMs, loc.type, requestGps, submit]);

  const canCheck = !holiday.isHoliday && gps && loc.type !== 'err' && !busy;
  const ringCenter = busy
    ? 'Đang xử lý…'
    : holiday.isHoliday
      ? 'Ngày nghỉ'
      : !gps
        ? 'Chạm để định vị'
        : loc.type === 'err'
          ? 'Không thể chấm'
          : 'Chạm để chấm công';

  // Vòng tiến trình: 4 cung cố định, mỗi cung = 1 ca (Vào sáng ¼1 → Ra chiều ¼4).
  const R = 92;
  const C = 2 * Math.PI * R;
  const GAP_DEG = 7; // khoảng hở giữa 2 cung
  const ARC_LEN = C * ((90 - GAP_DEG) / 360);

  return (
    <main className="cc-wrap">
      <button type="button" className="cc-gear" onClick={() => setSheetOpen(true)} aria-label="Cài đặt">
        ⚙️
      </button>
      <div className="cc-banner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt={props.companyName} className="cc-logo" onError={(e) => { e.currentTarget.replaceWith(Object.assign(document.createElement('span'), { className: 'cc-banner-text', textContent: props.companyName })); }} />
      </div>

      <div className="cc-head">
        <div className="cc-name">{employee.name}</div>
        <div className="cc-sub">
          {employee.maNv} · {employee.department}
        </div>
      </div>

      <div className="cc-ring-area">
        <button
          type="button"
          className={`cc-ring cc-ring-${canCheck ? loc.type : holiday.isHoliday ? 'idle' : loc.type}`}
          onClick={onTapRing}
          disabled={busy}
          aria-label="Chấm công"
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
          </svg>
          <span className="cc-ring-center">
            <span className="cc-ring-count">{filled}/4</span>
            <span className="cc-ring-text">{ringCenter}</span>
          </span>
        </button>
      </div>

      <div className="cc-strip">
        {SESSIONS.map((s, i) => {
          const g = today[s.key] ? gradeArr[i] : '';
          return (
            <div key={s.key} className={`cc-chip ${today[s.key] ? 'done' : ''}`}>
              <span className="cc-chip-label">{s.label}</span>
              <span className="cc-chip-time">{hm(today[s.key])}</span>
              {g && GRADE_CLASS[g] ? (
                <span className={`cc-chip-grade ${GRADE_CLASS[g]}`}>{g}</span>
              ) : (
                <span className="cc-chip-grade cc-chip-grade-empty" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>

      <div className={`cc-loc cc-loc-${loc.type}`}>
        <div className="cc-loc-title">{loc.title}</div>
        {loc.lines.map((l, i) => (
          <div key={i} className="cc-loc-line">
            {l}
          </div>
        ))}
        {!holiday.isHoliday && (
          <button type="button" className="cc-reloc" onClick={requestGps} disabled={busy}>
            📡 Định vị lại
          </button>
        )}
      </div>

      {!holiday.isHoliday && (
        <textarea
          className="field"
          placeholder="Ghi chú (tuỳ chọn): công tác, đi muộn, lý do…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
        />
      )}

      <a className="cc-monthlink" href={`/c/${token}/lich-su`}>
        📅 Dữ liệu tháng &amp; giải trình
      </a>

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
              <button className="btn" onClick={() => setResult(null)}>
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
            <h3 style={{ marginTop: 0 }}>Cài đặt</h3>

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
