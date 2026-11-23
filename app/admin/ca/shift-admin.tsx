'use client';

import PcHint from '@/app/admin/_components/pc-hint';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface ShiftRow {
  shift_type: string;
  session: string;
  a_start: string;
  a_end: string;
  a_end2: string;
  b_end: string;
}

const SHIFT_LABEL: Record<string, string> = {
  tieu_chuan: 'Tiêu chuẩn',
  ngoai_le_1: 'Ngoại lệ 1',
  ngoai_le_2: 'Ngoại lệ 2',
};
const SESSION_LABEL: Record<string, string> = {
  morning_in: 'Vào sáng',
  morning_out: 'Ra sáng',
  afternoon_in: 'Vào chiều',
  afternoon_out: 'Ra chiều',
};
const SESSION_ORDER = ['morning_in', 'morning_out', 'afternoon_in', 'afternoon_out'];

// Ô nào có ý nghĩa cho từng ca (theo luật chấm A/B/D).
const FIELDS: Record<string, (keyof Pick<ShiftRow, 'a_start' | 'a_end' | 'a_end2' | 'b_end'>)[]> = {
  morning_in: ['a_end', 'b_end'],
  afternoon_in: ['a_end', 'b_end'],
  morning_out: ['a_start', 'a_end2'],
  afternoon_out: ['a_end'],
};
const FIELD_HINT: Record<string, string> = {
  a_end: 'Cuối A',
  b_end: 'Cuối B',
  a_start: 'Đầu A',
  a_end2: 'Cuối A',
};

export default function ShiftAdmin({ initial }: { initial: ShiftRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<ShiftRow[]>(initial.map((r) => ({ ...r })));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const shiftTypes = [...new Set(rows.map((r) => r.shift_type))];

  function setField(st: string, se: string, field: keyof ShiftRow, val: string) {
    setRows((prev) => prev.map((r) => (r.shift_type === st && r.session === se ? { ...r, [field]: val } : r)));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const j = await res.json();
      if (!res.ok || j.error) {
        setMsg('❌ ' + (j.error || 'Lỗi'));
        return;
      }
      setMsg('✅ Đã lưu cấu hình ca.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PcHint />
      <p className="muted">
        Ngưỡng chấm A/B/D (data-driven, đổi không cần deploy). IN: ≤ Cuối A → A, ≤ Cuối B → B, còn lại D. Ra sáng:
        Đầu A ≤ giờ ≤ Cuối A → A. Ra chiều: ≥ Cuối A → A.
      </p>

      {shiftTypes.map((st) => (
        <div className="card" key={st} style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>{SHIFT_LABEL[st] || st}</h3>
          <div className="ls-table-wrap" style={{ border: 'none' }}>
            <table className="ls-table shift-table">
              <thead>
                <tr>
                  <th className="shift-c-ca">Ca</th>
                  <th>Mốc 1</th>
                  <th>Mốc 2</th>
                </tr>
              </thead>
              <tbody>
                {SESSION_ORDER.map((se) => {
                  const row = rows.find((r) => r.shift_type === st && r.session === se);
                  if (!row) return null;
                  const fields = FIELDS[se];
                  return (
                    <tr key={se}>
                      <td className="shift-c-ca">{SESSION_LABEL[se]}</td>
                      {[0, 1].map((i) => {
                        const f = fields[i];
                        return (
                          <td key={i}>
                            {f ? (
                              <label className="shift-field">
                                <span className="shift-hint">{FIELD_HINT[f]}</span>
                                <input
                                  className="field shift-time"
                                  type="time"
                                  value={row[f]}
                                  onChange={(e) => setField(st, se, f, e.target.value)}
                                />
                              </label>
                            ) : (
                              <span className="shift-none">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn" disabled={busy} onClick={save}>
          {busy ? 'Đang lưu…' : '💾 Lưu cấu hình'}
        </button>
        {msg && <span className="muted">{msg}</span>}
      </div>
    </>
  );
}
