'use client';

import PcHint from '@/app/admin/_components/pc-hint';
import AdminTabs, { DATA_TABS } from '@/app/admin/_components/AdminTabs';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useConfirm } from '@/lib/confirm';

export interface LogRow {
  id: string;
  name: string;
  checkedAt: string;
  lat: number | null;
  lng: number | null;
  distance: number | null;
  office: string;
  status: string;
  address: string;
  note: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

function vnTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
  } catch {
    return iso;
  }
}

export default function LogAdmin({
  rows,
  names,
  selEmp,
  year,
  month,
  prevHref,
  nextHref,
}: {
  rows: LogRow[];
  names: string[];
  selEmp: string;
  year: number;
  month: number;
  prevHref: string;
  nextHref: string | null;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const [edit, setEdit] = useState<LogRow | null>(null);
  const [note, setNote] = useState('');

  const monthStr = `${year}-${pad(month)}`;

  function onEmp(v: string) {
    router.push(`/admin/log?m=${monthStr}${v ? `&emp=${encodeURIComponent(v)}` : ''}`);
  }

  async function del(id: string) {
    if (!(await confirm({ message: 'Xóa log này? (không hoàn tác)', danger: true, okText: 'Xóa' }))) return;
    setBusy(id);
    try {
      await fetch('/api/admin/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'delete', id }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function saveNote() {
    if (!edit) return;
    setBusy(edit.id);
    try {
      await fetch('/api/admin/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'update', id: edit.id, note }),
      });
      setEdit(null);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PcHint />
      <AdminTabs tabs={DATA_TABS} />
      <div className="ls-nav">
        <Link href={prevHref} className="ls-navbtn">
          ‹
        </Link>
        <div className="ls-month">Tháng {month}/{year}</div>
        {nextHref ? (
          <Link href={nextHref} className="ls-navbtn">
            ›
          </Link>
        ) : (
          <span className="ls-navbtn disabled">›</span>
        )}
      </div>

      <div className="tbp-bar">
        <select className="tbp-select" value={selEmp} onChange={(e) => onEmp(e.target.value)}>
          <option value="">Tất cả nhân viên</option>
          {names.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="muted">{rows.length} lượt chấm</span>
      </div>

      <div className="ls-table-wrap">
        {rows.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: 20 }}>Không có log.</p>
        ) : (
          <table className="ls-table">
            <thead>
              <tr>
                <th>Thời gian (VN)</th>
                <th>Nhân viên</th>
                <th>VP gần nhất</th>
                <th>K.cách</th>
                <th>Trạng thái</th>
                <th>Ghi chú</th>
                <th>Vị trí</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{vnTime(r.checkedAt)}</td>
                  <td style={{ textAlign: 'left' }}>{r.name}</td>
                  <td>{r.office}</td>
                  <td>{r.distance != null ? `${r.distance} m` : '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.status}</td>
                  <td style={{ textAlign: 'left', maxWidth: 160, whiteSpace: 'normal' }}>{r.note}</td>
                  <td>
                    {r.lat != null && r.lng != null ? (
                      <a href={`https://www.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noreferrer">
                        🗺 Map
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="tbp-act">
                    <button className="btn-undo" disabled={busy === r.id} onClick={() => { setEdit(r); setNote(r.note); }}>
                      Sửa
                    </button>
                    <button className="btn-reject" disabled={busy === r.id} onClick={() => del(r.id)}>
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        Lưu ý: xóa/sửa log thô KHÔNG tự tính lại bảng ngày (trigger chỉ chạy khi chấm mới). Dùng để dọn log lỗi.
      </p>

      {edit && (
        <div className="cc-dlg-overlay" onClick={() => setEdit(null)}>
          <div className="cc-dlg" style={{ textAlign: 'left', maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Sửa ghi chú</h3>
            <p className="muted" style={{ marginTop: -4 }}>{edit.name} · {vnTime(edit.checkedAt)}</p>
            <textarea className="field" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="cc-dlg-btns">
              <button className="btn" onClick={saveNote}>Lưu</button>
              <button className="btn cc-btn-ghost" onClick={() => setEdit(null)}>Hủy</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
