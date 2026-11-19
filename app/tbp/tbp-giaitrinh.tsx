'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { GtItem } from '@/lib/giaitrinh';

function Grade({ g }: { g: string }) {
  const cls = g === 'A' ? 'grade-a' : g === 'B' ? 'grade-b' : 'grade-d';
  return <span className={`grade ${cls}`}>{g}</span>;
}

export default function TbpGiaiTrinh({
  items,
  departments,
  year,
  month,
  prevHref,
  nextHref,
  isAdmin,
}: {
  items: GtItem[];
  departments: string[];
  year: number;
  month: number;
  prevHref: string;
  nextHref: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [dept, setDept] = useState('');
  const [busy, setBusy] = useState(false);
  const [reject, setReject] = useState<{ employeeId: number; date: string; name: string; d: string } | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [batch, setBatch] = useState<{ action: 'Đồng ý' | 'Từ chối'; list: GtItem[] } | null>(null);

  const shown = dept ? items.filter((i) => i.dept === dept) : items;
  const pending = shown.filter((i) => i.approve === '').length;
  const approved = shown.filter((i) => i.approve === 'Đồng ý').length;
  const rejected = shown.filter((i) => i.approve === 'Từ chối').length;

  async function apply(approvals: { employeeId: number; date: string }[], status: string, note?: string) {
    if (approvals.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch('/api/tbp/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvals, status, note: note || '' }),
      });
      await res.json();
      setReject(null);
      setBatch(null);
      router.refresh();
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  }

  function openBatch(action: 'Đồng ý' | 'Từ chối') {
    const list =
      action === 'Đồng ý'
        ? shown.filter((i) => i.canApprove && i.approve === '' && i.hasReason)
        : shown.filter((i) => i.canApprove && i.approve === '');
    if (list.length === 0) return;
    setBatch({ action, list });
  }

  return (
    <>
      <div className="tbp-tabs">
        <button className="active">Duyệt giải trình</button>
        <Link href="/tbp/nscl" className="tbp-tablink">
          Bảng điểm NSCL
        </Link>
      </div>

      <div className="ls-nav">
        <Link href={prevHref} className="ls-navbtn">
          ‹
        </Link>
        <div className="ls-month">
          Tháng {month}/{year}
        </div>
        {nextHref ? (
          <Link href={nextHref} className="ls-navbtn">
            ›
          </Link>
        ) : (
          <span className="ls-navbtn disabled">›</span>
        )}
      </div>

      <div className="tbp-bar">
        {departments.length > 1 && (
          <select className="tbp-select" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">Tất cả phòng</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
        <div className="tbp-stats">
          <span className="badge badge-wait">⏳ {pending}</span>
          <span className="badge badge-ok">✅ {approved}</span>
          <span className="badge badge-no">❌ {rejected}</span>
        </div>
        <div className="tbp-batch">
          <button className="btn-approve" disabled={busy} onClick={() => openBatch('Đồng ý')}>
            ✅ Đồng ý tất cả
          </button>
          <button className="btn-reject" disabled={busy} onClick={() => openBatch('Từ chối')}>
            ❌ Từ chối tất cả
          </button>
        </div>
      </div>

      <div className="ls-table-wrap">
        {shown.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: 20 }}>
            Không có giải trình nào.
          </p>
        ) : (
          <table className="ls-table">
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Ngày</th>
                <th>Đánh giá</th>
                <th>Lý do</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => (
                <tr key={`${i.employeeId}_${i.ymd}`} className={i.isLeave ? 'r-leave' : i.approve === '' ? 'r-partial' : ''}>
                  <td style={{ textAlign: 'left' }}>
                    {i.name}
                    <div className="muted" style={{ fontSize: 11 }}>
                      {i.dept}
                    </div>
                  </td>
                  <td>
                    {i.date.slice(0, 5)} <span className="muted">{i.dowLabel}</span>
                  </td>
                  <td className="ls-grades">
                    {i.isFullLeave ? (
                      <span className="ls-p">P</span>
                    ) : (
                      <>
                        <Grade g={i.grades[0]} /> <Grade g={i.grades[1]} /> <Grade g={i.grades[2]} />{' '}
                        <Grade g={i.grades[3]} />
                      </>
                    )}
                  </td>
                  <td className="ls-reason">
                    {i.isLeave ? <span className="ls-leave-tag">🌴 {i.reason}</span> : i.reason || <span className="muted">(chưa có)</span>}
                    {i.approve === 'Từ chối' && i.approveNote && (
                      <div className="gt-reject-note">TBP: {i.approveNote}</div>
                    )}
                  </td>
                  <td>
                    {i.approve === 'Đồng ý' ? (
                      <span className="badge badge-ok">✅ Đồng ý</span>
                    ) : i.approve === 'Từ chối' ? (
                      <span className="badge badge-no">❌ Từ chối</span>
                    ) : (
                      <span className="badge badge-wait">⏳ Chờ</span>
                    )}
                  </td>
                  <td className="tbp-act">
                    {i.isLeave ? (
                      <span className="muted" style={{ fontSize: 12 }}>
                        (đồng bộ)
                      </span>
                    ) : !i.canApprove ? (
                      <span className="muted" style={{ fontSize: 12 }}>
                        —
                      </span>
                    ) : i.approve === '' ? (
                      <>
                        <button
                          className="btn-approve"
                          disabled={busy || !i.hasReason}
                          title={i.hasReason ? '' : 'Chưa có lý do'}
                          onClick={() => apply([{ employeeId: i.employeeId, date: i.ymd }], 'Đồng ý')}
                        >
                          ✅
                        </button>
                        <button
                          className="btn-reject"
                          disabled={busy}
                          onClick={() => {
                            setRejectNote('');
                            setReject({ employeeId: i.employeeId, date: i.ymd, name: i.name, d: i.date });
                          }}
                        >
                          ❌
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn-undo"
                        disabled={busy}
                        onClick={() => apply([{ employeeId: i.employeeId, date: i.ymd }], 'Chờ')}
                      >
                        ↩ Hủy
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {reject && (
        <div className="cc-dlg-overlay" onClick={() => !busy && setReject(null)}>
          <div className="cc-dlg" style={{ textAlign: 'left', maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ textAlign: 'center', marginTop: 0 }}>Từ chối giải trình</h3>
            <p className="muted" style={{ textAlign: 'center', marginTop: -4 }}>
              {reject.name} — {reject.d}
            </p>
            <textarea
              className="field"
              rows={3}
              placeholder="Lý do từ chối (gửi cho CBNV)…"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
            <div className="cc-dlg-btns">
              <button
                className="btn"
                disabled={busy}
                onClick={() => apply([{ employeeId: reject.employeeId, date: reject.date }], 'Từ chối', rejectNote)}
              >
                {busy ? 'Đang gửi…' : 'Từ chối'}
              </button>
              <button className="btn cc-btn-ghost" disabled={busy} onClick={() => setReject(null)}>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {batch && (
        <div className="cc-dlg-overlay" onClick={() => !busy && setBatch(null)}>
          <div className="cc-dlg" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>
              {batch.action === 'Đồng ý' ? '✅ Đồng ý' : '❌ Từ chối'} hàng loạt
            </h3>
            <p className="muted">
              {batch.action === 'Đồng ý' ? 'Đồng ý' : 'Từ chối'} <b>{batch.list.length}</b> giải trình
              {batch.action === 'Đồng ý' ? ' có lý do' : ' đang chờ'} (phòng bạn duyệt).
            </p>
            <div className="cc-dlg-btns">
              <button
                className="btn"
                disabled={busy}
                onClick={() => apply(batch.list.map((i) => ({ employeeId: i.employeeId, date: i.ymd })), batch.action)}
              >
                {busy ? 'Đang xử lý…' : 'Xác nhận'}
              </button>
              <button className="btn cc-btn-ghost" disabled={busy} onClick={() => setBatch(null)}>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
