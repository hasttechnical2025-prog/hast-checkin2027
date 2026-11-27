'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DateField from '@/app/_components/DateField';
import { useConfirm } from '@/lib/confirm';
import AdminTabs, { CONFIG_TABS } from '@/app/admin/_components/AdminTabs';

export interface Holiday {
  date: string;
  description: string;
}

function dmy(ymd: string): string {
  const p = ymd.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : ymd;
}

export default function HolidaysAdmin({ initial }: { initial: Holiday[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [date, setDate] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    if (!date || !desc.trim()) {
      setErr('Nhập ngày và tên ngày lễ.');
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch('/api/admin/holiday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'add', date, description: desc.trim() }),
      });
      const j = await res.json();
      if (!res.ok || j.error) {
        setErr(j.error);
        return;
      }
      setDate('');
      setDesc('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function del(d: string) {
    if (!(await confirm({ message: `Xóa ngày lễ ${dmy(d)}?`, danger: true, okText: 'Xóa' }))) return;
    await fetch('/api/admin/holiday', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'delete', date: d }),
    });
    router.refresh();
  }

  return (
    <>
      <AdminTabs tabs={CONFIG_TABS} />
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Thêm ngày nghỉ lễ</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label>
            Ngày
            <DateField value={date} onChange={setDate} />
          </label>
          <label style={{ flex: 1, minWidth: 160 }}>
            Tên ngày lễ
            <input className="field" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="VD: Tết Dương lịch" />
          </label>
          <button className="btn" disabled={busy} onClick={add} style={{ height: 42 }}>
            {busy ? '…' : 'Thêm'}
          </button>
        </div>
        {err && <p className="err">{err}</p>}
      </div>

      <div className="ls-table-wrap">
        {initial.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: 20 }}>Chưa có ngày lễ.</p>
        ) : (
          <table className="ls-table">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Tên ngày lễ</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {initial.map((h) => (
                <tr key={h.date}>
                  <td>{dmy(h.date)}</td>
                  <td style={{ textAlign: 'left' }}>{h.description}</td>
                  <td>
                    <button className="btn-reject-ol" onClick={() => del(h.date)}>Xóa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
