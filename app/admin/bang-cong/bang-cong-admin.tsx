'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/app/_components/icons';
import type { DayCell, EmpMonthRow, MonthMatrix } from '@/lib/bangcong';

const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const SESS = ['Vào sáng', 'Ra sáng', 'Vào chiều', 'Ra chiều'];

/** Lớp CSS + ký hiệu + tooltip cho 1 ô ngày. */
function cellInfo(c: DayCell, month: number): { cls: string; text: string; title: string } {
  const dmy = `${String(c.d).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
  const gradesTip =
    c.grades &&
    c.grades
      .split(',')
      .map((g, i) => `${SESS[i]}: ${g.trim()}`)
      .join(' · ');
  switch (c.kind) {
    case 'future':
    case 'before-join':
      return { cls: 'bc-c bc-void', text: '', title: dmy };
    case 'weekend':
      return { cls: 'bc-c bc-wknd', text: '', title: `${dmy} · cuối tuần` };
    case 'holiday':
      return { cls: 'bc-c bc-holi', text: 'L', title: `${dmy} · ngày lễ` };
    case 'leave-full':
      return { cls: 'bc-c bc-leave', text: c.leaveSymbol || 'P', title: `${dmy} · ${c.leaveText || 'Nghỉ phép'}` };
    case 'ok':
      return { cls: 'bc-c bc-ok', text: '', title: `${dmy} · ${gradesTip}` };
    case 'warn':
      return { cls: 'bc-c bc-warn', text: 'B', title: `${dmy} · ${gradesTip}` };
    case 'bad':
      return { cls: 'bc-c bc-bad', text: 'D', title: `${dmy} · ${gradesTip}` };
    case 'absent':
      return { cls: 'bc-c bc-absent', text: 'V', title: `${dmy} · chưa chấm (vắng)` };
    default:
      return { cls: 'bc-c', text: '', title: dmy };
  }
}

interface EditTarget {
  empId: number;
  name: string;
  ymd: string;
  dateLabel: string;
  dept: string;
}

export default function BangCongAdmin({
  matrix,
  prevHref,
  nextHref,
}: {
  matrix: MonthMatrix;
  prevHref: string;
  nextHref: string | null;
}) {
  const [dept, setDept] = useState('');
  const [edit, setEdit] = useState<EditTarget | null>(null);

  const rows = dept ? matrix.rows.filter((r) => r.dept === dept) : matrix.rows;

  // Nhóm theo phòng để chèn hàng tiêu đề phòng.
  const groups: { dept: string; rows: EmpMonthRow[] }[] = [];
  for (const r of rows) {
    const last = groups[groups.length - 1];
    if (last && last.dept === r.dept) last.rows.push(r);
    else groups.push({ dept: r.dept, rows: [r] });
  }

  const dayNums = Array.from({ length: matrix.daysInMonth }, (_, i) => i + 1);
  const totalCols = matrix.daysInMonth + 5; // tên + N ngày + 4 cột tổng kết

  return (
    <>
      <div className="ls-top" style={{ marginBottom: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="sheet" size={20} /> Bảng công tháng
          </h1>
          <div className="muted" style={{ fontSize: 13 }}>
            Toàn công ty · bấm 1 ô ngày để sửa công (tính lại A/B/D).
          </div>
        </div>
      </div>

      <div className="tbp-bar">
        <div className="bc-monthnav">
          <Link href={prevHref} className="ls-navbtn" aria-label="Tháng trước">
            <Icon name="chevLeft" size={16} />
          </Link>
          <span className="bc-month">
            Tháng {matrix.month}/{matrix.year}
          </span>
          {nextHref ? (
            <Link href={nextHref} className="ls-navbtn" aria-label="Tháng sau">
              <Icon name="chevRight" size={16} />
            </Link>
          ) : (
            <span className="ls-navbtn disabled">
              <Icon name="chevRight" size={16} />
            </span>
          )}
        </div>

        {matrix.departments.length > 1 && (
          <select className="tbp-select" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">Tất cả phòng</option>
            {matrix.departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}

        <div className="bc-legend">
          <span className="bc-lg"><i className="bc-sw bc-ok" /> Đủ</span>
          <span className="bc-lg"><i className="bc-sw bc-warn" /> B</span>
          <span className="bc-lg"><i className="bc-sw bc-bad" /> Thiếu</span>
          <span className="bc-lg"><i className="bc-sw bc-absent" /> Vắng</span>
          <span className="bc-lg"><i className="bc-sw bc-leave" /> Phép</span>
          <span className="bc-lg"><i className="bc-sw bc-wknd" /> Nghỉ</span>
        </div>
      </div>

      <div className="bc-wrap">
        {rows.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: 20 }}>Không có nhân viên.</p>
        ) : (
          <table className="bc-grid">
            <thead>
              <tr>
                <th className="bc-name-h">Nhân viên</th>
                {dayNums.map((d) => {
                  const dow = matrix.dows[d - 1];
                  const wk = dow === 0 || dow === 6;
                  return (
                    <th key={d} className={`bc-dayh${wk ? ' bc-wknd-h' : ''}`}>
                      <span className="bc-dnum">{d}</span>
                      <span className="bc-ddow">{DOW[dow]}</span>
                    </th>
                  );
                })}
                <th className="bc-sum-h">Công</th>
                <th className="bc-sum-h">B</th>
                <th className="bc-sum-h">Thiếu</th>
                <th className="bc-sum-h">P</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.dept}>
                  <tr className="bc-deptrow">
                    <td colSpan={totalCols}>
                      {g.dept || '(Chưa đặt phòng)'}
                      {matrix.locks[g.dept] && (
                        <span className="bc-locktag" title={`Ký & Khóa bởi ${matrix.locks[g.dept].nguoiKy}`}>
                          <Icon name="lock" size={12} /> Đã Ký &amp; Khóa
                          {matrix.locks[g.dept].nguoiKy ? ` · ${matrix.locks[g.dept].nguoiKy}` : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                  {g.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="bc-name" title={r.name}>
                        {r.name}
                      </td>
                      {r.days.map((c) => {
                        const info = cellInfo(c, matrix.month);
                        if (c.editable) {
                          return (
                            <td key={c.d} className={info.cls}>
                              <button
                                type="button"
                                className="bc-cellbtn"
                                title={`${info.title} — bấm để sửa`}
                                onClick={() =>
                                  setEdit({
                                    empId: r.id,
                                    name: r.name,
                                    ymd: c.ymd,
                                    dateLabel: `${String(c.d).padStart(2, '0')}/${String(matrix.month).padStart(2, '0')}/${matrix.year}`,
                                    dept: r.dept,
                                  })
                                }
                              >
                                {c.leaveText && c.kind !== 'leave-full' ? <i className="bc-halfdot" /> : null}
                                {info.text}
                              </button>
                            </td>
                          );
                        }
                        return (
                          <td key={c.d} className={info.cls} title={info.title}>
                            {info.text}
                          </td>
                        );
                      })}
                      <td className="bc-sum">{r.summary.cong}</td>
                      <td className="bc-sum bc-sum-b">{r.summary.b || ''}</td>
                      <td className="bc-sum bc-sum-d">{r.summary.d || ''}</td>
                      <td className="bc-sum bc-sum-p">{r.summary.p || ''}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {edit && (
        <DayEditDialog
          target={edit}
          locked={!!matrix.locks[edit.dept]}
          nsclHref={`/tbp/nscl?m=${matrix.year}-${String(matrix.month).padStart(2, '0')}`}
          onClose={() => setEdit(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Hộp sửa công 1 ngày — dùng lại /api/admin/day (get/save). Lưu -> tính lại A/B/D.
// ---------------------------------------------------------------------------
type Times = { morningIn: string; morningOut: string; afternoonIn: string; afternoonOut: string };
const EMPTY: Times = { morningIn: '', morningOut: '', afternoonIn: '', afternoonOut: '' };
const TIME_FIELDS: { key: keyof Times; label: string }[] = [
  { key: 'morningIn', label: 'Vào sáng' },
  { key: 'morningOut', label: 'Ra sáng' },
  { key: 'afternoonIn', label: 'Vào chiều' },
  { key: 'afternoonOut', label: 'Ra chiều' },
];

interface DayLog {
  time: string;
  status: string;
  distance: number | null;
  note: string;
}

function DayEditDialog({
  target,
  locked,
  nsclHref,
  onClose,
}: {
  target: EditTarget;
  locked: boolean;
  nsclHref: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [times, setTimes] = useState<Times>({ ...EMPTY });
  const [grades, setGrades] = useState<string | null>(null);
  const [logs, setLogs] = useState<DayLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch('/api/admin/day', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: 'get', employeeId: target.empId, date: target.ymd }),
        });
        const j = await res.json();
        if (!alive) return;
        if (!res.ok || j.error) {
          setErr(j.error || 'Lỗi tải.');
          return;
        }
        const rec = j.record as null | (Times & { grades: string });
        setTimes(rec ? { morningIn: rec.morningIn, morningOut: rec.morningOut, afternoonIn: rec.afternoonIn, afternoonOut: rec.afternoonOut } : { ...EMPTY });
        setGrades(rec ? rec.grades : null);
        setLogs((j.logs as DayLog[]) || []);
      } catch {
        if (alive) setErr('Lỗi mạng.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [target.empId, target.ymd]);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'save', employeeId: target.empId, date: target.ymd, ...times }),
      });
      const j = await res.json();
      if (!res.ok || j.error) {
        setErr(j.error || 'Lỗi lưu.');
        return;
      }
      setGrades(j.grades as string);
      setSaved(true);
      router.refresh(); // cập nhật lại ma trận phía sau
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cc-dlg-overlay" onClick={() => !busy && onClose()}>
      <div className="cc-dlg bc-editdlg" style={{ textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Sửa công ngày</h3>
        <p className="muted" style={{ marginTop: -4 }}>
          {target.name} · {target.dateLabel}
        </p>

        {locked && (
          <div className="bc-lockwarn">
            <Icon name="alert" size={15} />
            <span>
              Phòng này đã <b>Ký &amp; Khóa</b> bảng điểm NSCL tháng này. Sửa ở đây sẽ <b>lệch</b> bảng đã ký — nên{' '}
              <a href={nsclHref}>Mở khóa ở Bảng điểm NSCL</a> rồi chấm lại.
            </span>
          </div>
        )}

        {loading ? (
          <p className="muted" style={{ padding: '10px 0' }}>Đang tải…</p>
        ) : (
          <>
            <div className="bc-edit-grid">
              {TIME_FIELDS.map((f) => (
                <label key={f.key} className="bc-edit-field">
                  {f.label}
                  <input
                    className="field"
                    type="time"
                    value={times[f.key]}
                    onChange={(e) => {
                      setTimes((p) => ({ ...p, [f.key]: e.target.value }));
                      setSaved(false);
                    }}
                  />
                </label>
              ))}
            </div>

            {grades && (
              <p style={{ margin: '12px 0 0', fontSize: 13 }}>
                <span className="muted" style={{ marginRight: 8 }}>Điểm{saved ? ' (đã lưu)' : ''}:</span>
                {grades.split(',').map((g, i) => {
                  const t = g.trim();
                  const cls = t === 'A' ? 'grade-a' : t === 'B' ? 'grade-b' : 'grade-d';
                  return (
                    <span key={i} style={{ marginRight: 8 }}>
                      <span className="muted" style={{ fontSize: 11 }}>{SESS[i]}: </span>
                      <span className={`grade ${cls}`}>{t}</span>
                    </span>
                  );
                })}
              </p>
            )}

            <div className="bc-edit-logs">
              <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Log chấm thô (tham khảo)
              </div>
              {logs.length === 0 ? (
                <p className="muted" style={{ fontSize: 13, margin: 0 }}>Không có log thô.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {logs.map((l, i) => (
                    <span
                      key={i}
                      className="bc-logchip"
                      title={[l.status, l.distance != null ? `${l.distance} m` : '', l.note].filter(Boolean).join(' · ')}
                    >
                      <Icon name="clock" size={12} /> {l.time}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {err && <p style={{ color: 'var(--err)', fontSize: 13, margin: '10px 0 0' }}>{err}</p>}

            <div className="cc-dlg-btns" style={{ marginTop: 14 }}>
              <button className="btn" disabled={busy} onClick={save}>
                {busy ? 'Đang lưu…' : 'Lưu & tính lại'}
              </button>
              <button
                className="btn-undo"
                disabled={busy}
                onClick={() => {
                  setTimes({ ...EMPTY });
                  setSaved(false);
                }}
              >
                Xóa hết
              </button>
              <button className="btn cc-btn-ghost" disabled={busy} onClick={onClose}>
                Đóng
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
