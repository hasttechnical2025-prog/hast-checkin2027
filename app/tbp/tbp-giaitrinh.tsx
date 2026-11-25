'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GtItem } from '@/lib/giaitrinh';
import { Icon } from '@/app/_components/icons';

function Grade({ g }: { g: string }) {
  const cls = g === 'A' ? 'grade-a' : g === 'B' ? 'grade-b' : 'grade-d';
  return <span className={`grade ${cls}`}>{g}</span>;
}

export default function TbpGiaiTrinh({
  items,
  departments,
}: {
  items: GtItem[];
  departments: string[];
}) {
  const router = useRouter();
  const [dept, setDept] = useState('');
  const [busy, setBusy] = useState(false);
  const [reject, setReject] = useState<{ employeeId: number; date: string; name: string; d: string } | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [batch, setBatch] = useState<{ action: 'Đồng ý' | 'Từ chối'; list: GtItem[] } | null>(null);
  const [batchNote, setBatchNote] = useState('');

  const shown = dept ? items.filter((i) => i.dept === dept) : items;
  const pending = shown.filter((i) => i.approve === '').length;
  const approved = shown.filter((i) => i.approve === 'Đồng ý').length;
  const rejected = shown.filter((i) => i.approve === 'Từ chối').length;
  // Chỉ mục ĐÃ CÓ LÝ DO mới duyệt/từ chối được -> mới hiện thanh hành động (ẩn trên mobile khi rỗng)
  const canBatch = shown.some((i) => i.canApprove && i.approve === '' && i.hasReason);

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
    // Cả Đồng ý lẫn Từ chối chỉ áp dụng cho mục ĐÃ CÓ LÝ DO (chưa có lý do thì không có gì để xét).
    const list = shown.filter((i) => i.canApprove && i.approve === '' && i.hasReason);
    if (list.length === 0) return;
    setBatchNote('');
    setBatch({ action, list });
  }

  return (
    <>
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
          <span className="badge badge-wait"><Icon name="clock" size={13} /> Chờ {pending}</span>
          <span className="badge badge-ok"><Icon name="check" size={13} /> Đồng ý {approved}</span>
          <span className="badge badge-no"><Icon name="x" size={13} /> Từ chối {rejected}</span>
        </div>
        <div className={`tbp-batch${canBatch ? '' : ' tbp-batch-off'}`}>
          <button className="btn-approve" disabled={busy} onClick={() => openBatch('Đồng ý')}>
            <Icon name="checks" size={15} /> Đồng ý tất cả
          </button>
          <button className="btn-reject" disabled={busy} onClick={() => openBatch('Từ chối')}>
            <Icon name="x" size={15} /> Từ chối tất cả
          </button>
        </div>
      </div>

      <div className="ls-table-wrap">
        {shown.length === 0 ? (
          <div className="tbp-empty">
            <Icon name="checks" size={30} />
            <p>Không có giải trình nào.</p>
          </div>
        ) : (
          <table className="ls-table gt-table">
            <colgroup>
              <col style={{ width: '18%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '27%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '16%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Họ tên</th>
                <th>Ngày</th>
                <th>Thứ</th>
                <th>Đánh giá</th>
                <th style={{ textAlign: 'left' }}>Lý do</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => (
                <tr key={`${i.employeeId}_${i.ymd}`} className={i.isLeave ? 'r-leave' : i.approve === '' ? 'r-partial' : ''}>
                  <td className="gt-name">{i.name}</td>
                  <td data-label="Ngày">{i.date.slice(0, 5)}</td>
                  <td data-label="Thứ">
                    <span className="muted">{i.dowLabel}</span>
                  </td>
                  <td className="ls-grades" data-label="Đánh giá">
                    {i.isFullLeave ? (
                      <span className="ls-p">P</span>
                    ) : (
                      <>
                        <Grade g={i.grades[0]} /> <Grade g={i.grades[1]} /> <Grade g={i.grades[2]} />{' '}
                        <Grade g={i.grades[3]} />
                      </>
                    )}
                  </td>
                  <td className="ls-reason" data-label="Lý do">
                    {i.isLeave ? (
                      <span className="ls-leave-tag">
                        <Icon name="plane" size={14} /> {i.reason}
                      </span>
                    ) : (
                      i.reason || <span className="muted">(chưa có)</span>
                    )}
                    {i.approve === 'Từ chối' && i.approveNote && (
                      <div className="gt-reject-note">TBP: {i.approveNote}</div>
                    )}
                  </td>
                  <td data-label="Trạng thái">
                    {i.approve === 'Đồng ý' ? (
                      <span className="badge badge-ok"><Icon name="check" size={13} /> Đồng ý</span>
                    ) : i.approve === 'Từ chối' ? (
                      <span className="badge badge-no"><Icon name="x" size={13} /> Từ chối</span>
                    ) : (
                      <span className="badge badge-wait"><Icon name="clock" size={13} /> Chờ</span>
                    )}
                  </td>
                  <td className="tbp-act">
                    {i.isLeave ? (
                      <span className="muted">
                        (đồng bộ)
                      </span>
                    ) : !i.canApprove ? (
                      <span className="muted">
                        —
                      </span>
                    ) : i.approve === '' ? (
                      !i.hasReason ? (
                        <span className="muted tbp-wait">Chờ CBNV giải trình</span>
                      ) : (
                        <>
                          <button
                            className="btn-approve"
                            disabled={busy}
                            aria-label="Đồng ý"
                            onClick={() => apply([{ employeeId: i.employeeId, date: i.ymd }], 'Đồng ý')}
                          >
                            <Icon name="check" size={16} /> <span className="tbp-act-label">Đồng ý</span>
                          </button>
                          <button
                            className="btn-reject"
                            disabled={busy}
                            aria-label="Từ chối"
                            onClick={() => {
                              setRejectNote('');
                              setReject({ employeeId: i.employeeId, date: i.ymd, name: i.name, d: i.date });
                            }}
                          >
                            <Icon name="x" size={16} /> <span className="tbp-act-label">Từ chối</span>
                          </button>
                        </>
                      )
                    ) : (
                      <button
                        className="btn-undo"
                        disabled={busy}
                        onClick={() => apply([{ employeeId: i.employeeId, date: i.ymd }], 'Chờ')}
                      >
                        <Icon name="undoBack" size={14} /> Hủy
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
                disabled={busy || !rejectNote.trim()}
                onClick={() => apply([{ employeeId: reject.employeeId, date: reject.date }], 'Từ chối', rejectNote.trim())}
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
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              <Icon name={batch.action === 'Đồng ý' ? 'checks' : 'x'} size={18} />
              {batch.action === 'Đồng ý' ? 'Đồng ý' : 'Từ chối'} hàng loạt
            </h3>
            <p className="muted">
              {batch.action === 'Đồng ý' ? 'Đồng ý' : 'Từ chối'} <b>{batch.list.length}</b> giải trình có lý do
              (phòng bạn duyệt).
            </p>
            {batch.action === 'Từ chối' && (
              <textarea
                className="field"
                rows={3}
                placeholder="Lý do từ chối (gửi cho tất cả CBNV trong danh sách)…"
                value={batchNote}
                onChange={(e) => setBatchNote(e.target.value)}
              />
            )}
            <div className="cc-dlg-btns">
              <button
                className="btn"
                disabled={busy || (batch.action === 'Từ chối' && !batchNote.trim())}
                onClick={() =>
                  apply(
                    batch.list.map((i) => ({ employeeId: i.employeeId, date: i.ymd })),
                    batch.action,
                    batch.action === 'Từ chối' ? batchNote.trim() : undefined,
                  )
                }
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
