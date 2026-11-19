'use client';

import { useState } from 'react';
import DateField from '@/app/_components/DateField';

export interface EmpOpt {
  id: number;
  name: string;
  maNv: string;
  loaiCa: string;
}

interface DayLog {
  time: string;
  status: string;
  distance: number | null;
  note: string;
}

const SHIFT_LABEL: Record<string, string> = {
  tieu_chuan: 'Tiêu chuẩn',
  ngoai_le_1: 'Ngoại lệ 1',
  ngoai_le_2: 'Ngoại lệ 2',
};
const SESSIONS: { key: 'morningIn' | 'morningOut' | 'afternoonIn' | 'afternoonOut'; label: string }[] = [
  { key: 'morningIn', label: 'Vào sáng' },
  { key: 'morningOut', label: 'Ra sáng' },
  { key: 'afternoonIn', label: 'Vào chiều' },
  { key: 'afternoonOut', label: 'Ra chiều' },
];

type Times = Record<'morningIn' | 'morningOut' | 'afternoonIn' | 'afternoonOut', string>;
const EMPTY: Times = { morningIn: '', morningOut: '', afternoonIn: '', afternoonOut: '' };

function todayVN(): string {
  const d = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
}

function GradeBadges({ grades }: { grades: string }) {
  const parts = grades.split(',');
  return (
    <span style={{ display: 'inline-flex', gap: 10 }}>
      {SESSIONS.map((s, i) => {
        const g = (parts[i] || 'D').trim();
        const cls = g === 'A' ? 'grade-a' : g === 'B' ? 'grade-b' : 'grade-d';
        return (
          <span key={s.key} style={{ fontSize: 12 }}>
            <span className="muted">{s.label}: </span>
            <span className={`grade ${cls}`}>{g}</span>
          </span>
        );
      })}
    </span>
  );
}

export default function SuaCongAdmin({ emps }: { emps: EmpOpt[] }) {
  const [empId, setEmpId] = useState<number | ''>('');
  const [date, setDate] = useState(todayVN());
  const [times, setTimes] = useState<Times>({ ...EMPTY });
  const [grades, setGrades] = useState<string | null>(null);
  const [logs, setLogs] = useState<DayLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const emp = emps.find((e) => e.id === empId) || null;
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date);

  function reset() {
    setLoaded(false);
    setGrades(null);
    setLogs([]);
    setMsg(null);
    setTimes({ ...EMPTY });
  }

  async function load() {
    if (empId === '' || !dateOk) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'get', employeeId: empId, date }),
      });
      const j = await res.json();
      if (!res.ok || j.error) {
        setMsg('❌ ' + (j.error || 'Lỗi tải'));
        return;
      }
      const rec = j.record as null | {
        morningIn: string;
        morningOut: string;
        afternoonIn: string;
        afternoonOut: string;
        grades: string;
        approveStatus: string | null;
        justificationType: string | null;
        justificationBuoi: string | null;
      };
      setTimes(
        rec
          ? {
              morningIn: rec.morningIn,
              morningOut: rec.morningOut,
              afternoonIn: rec.afternoonIn,
              afternoonOut: rec.afternoonOut,
            }
          : { ...EMPTY },
      );
      setGrades(rec ? rec.grades : null);
      setLogs((j.logs as DayLog[]) || []);
      setLoaded(true);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (empId === '' || !dateOk) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'save', employeeId: empId, date, ...times }),
      });
      const j = await res.json();
      if (!res.ok || j.error) {
        setMsg('❌ ' + (j.error || 'Lỗi lưu'));
        return;
      }
      setGrades(j.grades as string);
      setMsg('✅ Đã lưu & tính lại điểm.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Sửa công ngày</h2>
      <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>
        Sửa thẳng 4 mốc giờ của 1 nhân viên trong 1 ngày; lưu xong hệ thống <b>tính lại A/B/D</b> theo đúng luật
        chấm điểm. Chỉ đụng bản ghi ngày (không xóa log thô). Để trống mốc nào = không chấm mốc đó.
      </p>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px auto', gap: 10, alignItems: 'end' }}>
          <label>
            Nhân viên
            <select
              className="field"
              value={empId}
              onChange={(e) => {
                setEmpId(e.target.value ? Number(e.target.value) : '');
                reset();
              }}
            >
              <option value="">— Chọn nhân viên —</option>
              {emps.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} {e.maNv ? `(${e.maNv})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ngày
            <DateField
              value={date}
              onChange={(v) => {
                setDate(v);
                reset();
              }}
            />
          </label>
          <button className="btn" disabled={busy || empId === '' || !dateOk} onClick={load}>
            {busy && !loaded ? 'Đang tải…' : 'Tải công ngày'}
          </button>
        </div>
      </div>

      {loaded && emp && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <b>
              {emp.name} · {date.split('-').reverse().join('/')}
            </b>
            <span className="muted" style={{ fontSize: 12 }}>
              Ca: {SHIFT_LABEL[emp.loaiCa] || emp.loaiCa}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, maxWidth: 420 }}>
            {SESSIONS.map((s) => (
              <label key={s.key} style={{ fontSize: 12, color: 'var(--muted)' }}>
                {s.label}
                <input
                  className="field"
                  type="time"
                  value={times[s.key]}
                  onChange={(e) => setTimes((p) => ({ ...p, [s.key]: e.target.value }))}
                  style={{ marginTop: 2 }}
                />
              </label>
            ))}
          </div>

          {grades && (
            <p style={{ margin: '12px 0 0' }}>
              <span className="muted" style={{ fontSize: 12, marginRight: 8 }}>
                Điểm {msg?.startsWith('✅') ? 'sau khi lưu' : 'đang lưu'}:
              </span>
              <GradeBadges grades={grades} />
            </p>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14 }}>
            <button className="btn" disabled={busy} onClick={save}>
              {busy ? 'Đang lưu…' : '💾 Lưu & tính lại'}
            </button>
            <button
              className="btn-undo"
              disabled={busy}
              onClick={() => setTimes({ morningIn: '', morningOut: '', afternoonIn: '', afternoonOut: '' })}
            >
              Xóa hết (vắng cả ngày)
            </button>
            {msg && <span className="muted" style={{ fontSize: 13 }}>{msg}</span>}
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Log chấm thô ngày này (tham khảo, không sửa ở đây)
            </div>
            {logs.length === 0 ? (
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>Không có log thô.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {logs.map((l, i) => (
                  <span
                    key={i}
                    className="badge"
                    style={{
                      padding: '4px 9px',
                      borderRadius: 8,
                      background: 'var(--surface-2)',
                      fontSize: 12.5,
                    }}
                    title={[l.status, l.distance != null ? `${l.distance} m` : '', l.note].filter(Boolean).join(' · ')}
                  >
                    🕐 {l.time}
                    {l.status ? ` · ${l.status}` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
