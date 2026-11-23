'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/app/_components/icons';
import type { MonthData, DayRow } from '@/lib/month';

type JType = 'phep' | 'om' | 'khac';
type JBuoi = 'ca_ngay' | 'sang' | 'chieu';

const TYPES: { v: JType; label: string }[] = [
  { v: 'phep', label: 'Nghỉ phép' },
  { v: 'om', label: 'Nghỉ ốm' },
  { v: 'khac', label: 'Khác' },
];
const BUOIS: { v: JBuoi; label: string }[] = [
  { v: 'ca_ngay', label: 'Cả ngày' },
  { v: 'sang', label: 'Sáng' },
  { v: 'chieu', label: 'Chiều' },
];

const pad = (n: number) => String(n).padStart(2, '0');
// idx = year*12 + month  <->  "YYYY-MM"
const toM = (i: number) => `${Math.floor((i - 1) / 12)}-${pad(((i - 1) % 12) + 1)}`;

const hm = (t: string) => {
  if (!t) return '';
  const s = String(t).trim();
  return s.length >= 5 ? s.slice(0, 5) : s;
};

function Grade({ g }: { g: string }) {
  const cls = g === 'A' ? 'grade-a' : g === 'B' ? 'grade-b' : 'grade-d';
  return <span className={`grade ${cls}`}>{g}</span>;
}

export default function LichSu({
  token,
  employee,
  data,
  maxIdx,
}: {
  token: string;
  employee: { name: string; maNv: string };
  data: MonthData;
  maxIdx: number; // tháng hiện tại (year*12+month) — không cho xem quá mốc này
}) {
  const initialIdx = data.year * 12 + data.month;

  // Cache dữ liệu các tháng đã tải (để chuyển qua lại tức thì + prefetch tháng liền kề).
  const cacheRef = useRef<Map<number, MonthData>>(null as unknown as Map<number, MonthData>);
  if (!cacheRef.current) cacheRef.current = new Map([[initialIdx, data]]);

  const [idx, setIdx] = useState(initialIdx);
  const [view, setView] = useState<MonthData>(data);
  const [pending, setPending] = useState<'prev' | 'next' | null>(null);

  const [open, setOpen] = useState<DayRow | null>(null);
  const [type, setType] = useState<JType>('phep');
  const [buoi, setBuoi] = useState<JBuoi>('ca_ngay');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Tải dữ liệu 1 tháng từ Route Handler JSON (có cache, force=bỏ qua cache để làm mới).
  const fetchMonth = useCallback(
    async (target: number, force = false): Promise<MonthData | null> => {
      const cache = cacheRef.current;
      if (!force && cache.has(target)) return cache.get(target)!;
      try {
        const res = await fetch(`/api/c/${token}/month?m=${toM(target)}`);
        if (!res.ok) return null;
        const d = (await res.json()) as MonthData;
        cache.set(target, d);
        return d;
      } catch {
        return null;
      }
    },
    [token],
  );

  // Nạp trước tháng liền trước/sau (nền) để bấm ‹/› hiện gần như tức thì.
  const prefetch = useCallback(
    (center: number) => {
      [center - 1, center + 1].forEach((n) => {
        if (n <= maxIdx && !cacheRef.current.has(n)) void fetchMonth(n);
      });
    },
    [fetchMonth, maxIdx],
  );

  useEffect(() => {
    prefetch(initialIdx);
  }, [prefetch, initialIdx]);

  const go = useCallback(
    async (target: number, dir: 'prev' | 'next') => {
      if (target > maxIdx) return;
      const cached = cacheRef.current.get(target);
      if (cached) {
        setView(cached);
        setIdx(target);
        try {
          window.history.replaceState(null, '', `/c/${token}/lich-su?m=${toM(target)}`);
        } catch {
          /* ignore */
        }
        prefetch(target);
        return;
      }
      setPending(dir);
      const d = await fetchMonth(target);
      setPending(null);
      if (!d) return;
      setView(d);
      setIdx(target);
      try {
        window.history.replaceState(null, '', `/c/${token}/lich-su?m=${toM(target)}`);
      } catch {
        /* ignore */
      }
      prefetch(target);
    },
    [fetchMonth, prefetch, maxIdx, token],
  );

  const s = view.summary;
  const canNext = idx < maxIdx;

  function openModal(day: DayRow) {
    const t = (day.jtype as JType) || 'phep';
    setOpen(day);
    setType(t === 'phep' || t === 'om' || t === 'khac' ? t : 'phep');
    setBuoi((day.jbuoi as JBuoi) || 'ca_ngay');
    setContent(t === 'khac' ? day.reason : '');
    setErr(null);
  }

  async function submit() {
    if (!open) return;
    if (type === 'khac' && !content.trim()) {
      setErr('Vui lòng nhập nội dung.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/justification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, date: open.ymd, type, buoi, content }),
      });
      const j = await res.json();
      if (!res.ok || j.error) {
        setErr(j.error || 'Có lỗi xảy ra.');
        setBusy(false);
        return;
      }
      setOpen(null);
      setBusy(false);
      // Làm mới tháng đang xem (bỏ cache) để thấy giải trình vừa gửi.
      const fresh = await fetchMonth(idx, true);
      if (fresh) setView(fresh);
    } catch {
      setErr('Lỗi kết nối. Thử lại.');
      setBusy(false);
    }
  }

  return (
    <main className="wrap" style={{ maxWidth: 680 }}>
      <div className="ls-top">
        <Link href={`/c/${token}`} className="ls-back">
          ← Chấm công
        </Link>
        <div className="ls-emp">
          {employee.name} · {employee.maNv}
        </div>
      </div>

      <div className="ls-nav">
        <button
          type="button"
          className="ls-navbtn"
          onClick={() => go(idx - 1, 'prev')}
          disabled={pending !== null}
          aria-label="Tháng trước"
        >
          {pending === 'prev' ? <span className="nav-spinner" aria-hidden /> : <Icon name="chevLeft" size={18} />}
        </button>
        <div className="ls-month">
          Tháng {view.month}/{view.year}
        </div>
        {canNext ? (
          <button
            type="button"
            className="ls-navbtn"
            onClick={() => go(idx + 1, 'next')}
            disabled={pending !== null}
            aria-label="Tháng sau"
          >
            {pending === 'next' ? <span className="nav-spinner" aria-hidden /> : <Icon name="chevRight" size={18} />}
          </button>
        ) : (
          <span className="ls-navbtn disabled">
            <Icon name="chevRight" size={18} />
          </span>
        )}
      </div>

      <div className="ls-cards">
        <div className="ls-card">
          <div className="v">{s.congChuan}</div>
          <div className="l">Công chuẩn</div>
        </div>
        <div className="ls-card">
          <div className="v" style={{ color: 'var(--ok)' }}>
            {s.congThucTe}
          </div>
          <div className="l">Công thực</div>
        </div>
        <div className="ls-card">
          <div className="v" style={{ color: 'var(--warn)' }}>
            {s.congBD}
          </div>
          <div className="l">Công B,D</div>
        </div>
        <div className="ls-card">
          <div className="v" style={{ color: 'var(--err)' }}>
            {s.khongCham}
          </div>
          <div className="l">Không chấm</div>
        </div>
      </div>

      <div className="ls-table-wrap">
        {view.days.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: 20 }}>
            Chưa có dữ liệu.
          </p>
        ) : (
          <table className="ls-table">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Thứ</th>
                <th>S.IN</th>
                <th>S.OUT</th>
                <th>C.IN</th>
                <th>C.OUT</th>
                <th>Đánh giá</th>
                <th>Lý do</th>
                <th>Duyệt</th>
              </tr>
            </thead>
            <tbody>
              {view.days.map((d) => {
                const rowCls = d.isHoliday
                  ? 'r-holiday'
                  : d.isWeekend
                    ? 'r-weekend'
                    : d.isLeave
                      ? 'r-leave'
                      : d.hasAbsent
                        ? 'r-absent'
                        : d.allOk
                          ? 'r-ok'
                          : 'r-partial';
                return (
                  <tr key={d.ymd} className={rowCls}>
                    <td>{d.date.slice(0, 5)}</td>
                    <td>{d.dowLabel}</td>
                    <td>{hm(d.mi)}</td>
                    <td>{hm(d.mo)}</td>
                    <td>{hm(d.ai)}</td>
                    <td>{hm(d.ao)}</td>
                    <td className="ls-grades">
                      {d.isWeekend || d.isHoliday ? (
                        ''
                      ) : d.isFullLeave ? (
                        <span className="ls-p">P</span>
                      ) : (
                        <>
                          <Grade g={d.grades[0]} /> <Grade g={d.grades[1]} /> <Grade g={d.grades[2]} />{' '}
                          <Grade g={d.grades[3]} />
                        </>
                      )}
                    </td>
                    <td className="ls-reason">
                      {d.isHoliday ? (
                        <span className="muted">{d.holidayLabel}</span>
                      ) : d.isLeave ? (
                        <span className="ls-leave-tag">🌴 {d.leaveLabel}</span>
                      ) : d.canJustify ? (
                        d.locked ? (
                          <span>
                            {d.reason} <span title="Đã duyệt">🔒</span>
                          </span>
                        ) : (
                          <button type="button" className="ls-gt" onClick={() => openModal(d)}>
                            {d.reason || '+ Giải trình'}
                          </button>
                        )
                      ) : (
                        ''
                      )}
                    </td>
                    <td>
                      {d.isLeave ? (
                        <span className="badge badge-ok">✅</span>
                      ) : d.reason && !d.isWeekend && !d.isHoliday ? (
                        d.approve === 'Đồng ý' ? (
                          <span className="badge badge-ok">✅</span>
                        ) : d.approve === 'Từ chối' ? (
                          <span className="badge badge-no" title={d.approveNote}>
                            ❌
                          </span>
                        ) : (
                          <span className="badge badge-wait">⏳</span>
                        )
                      ) : (
                        ''
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <div className="cc-dlg-overlay" onClick={() => !busy && setOpen(null)}>
          <div className="cc-dlg" style={{ maxWidth: 380, textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ textAlign: 'center' }}>Giải trình</h3>
            <p className="muted" style={{ textAlign: 'center', marginTop: -4 }}>
              Ngày {open.date}
            </p>

            <label className="ls-flabel">Loại</label>
            <div className="seg">
              {TYPES.map((t) => (
                <button
                  key={t.v}
                  type="button"
                  className={type === t.v ? 'active' : ''}
                  onClick={() => setType(t.v)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {type !== 'khac' ? (
              <>
                <label className="ls-flabel">Buổi</label>
                <div className="seg">
                  {BUOIS.map((b) => (
                    <button
                      key={b.v}
                      type="button"
                      className={buoi === b.v ? 'active' : ''}
                      onClick={() => setBuoi(b.v)}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <label className="ls-flabel">Nội dung</label>
                <textarea
                  className="field"
                  rows={3}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Nhập lý do…"
                />
              </>
            )}

            {err && <p className="err">{err}</p>}

            <div className="cc-dlg-btns">
              <button className="btn" onClick={submit} disabled={busy}>
                {busy ? 'Đang lưu…' : '💾 Lưu'}
              </button>
              <button className="btn cc-btn-ghost" onClick={() => setOpen(null)} disabled={busy}>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
