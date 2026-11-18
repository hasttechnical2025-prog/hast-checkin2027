'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  prevHref,
  nextHref,
}: {
  token: string;
  employee: { name: string; maNv: string };
  data: MonthData;
  prevHref: string;
  nextHref: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<DayRow | null>(null);
  const [type, setType] = useState<JType>('phep');
  const [buoi, setBuoi] = useState<JBuoi>('ca_ngay');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const s = data.summary;

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
      router.refresh();
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
        <Link href={prevHref} className="ls-navbtn">
          ‹
        </Link>
        <div className="ls-month">
          Tháng {data.month}/{data.year}
        </div>
        {nextHref ? (
          <Link href={nextHref} className="ls-navbtn">
            ›
          </Link>
        ) : (
          <span className="ls-navbtn disabled">›</span>
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
        {data.days.length === 0 ? (
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
              {data.days.map((d) => {
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
