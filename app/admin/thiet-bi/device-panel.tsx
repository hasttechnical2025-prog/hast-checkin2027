'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConfirm } from '@/lib/confirm';
import { Icon } from '@/app/_components/icons';

export interface DeviceItem {
  id: string;
  name: string;
  dept: string;
  label: string;
  status: string; // Chờ | Đồng ý | Từ chối
  active: boolean;
  boundAt: string;
  canApprove: boolean;
}

function shortUA(ua: string): string {
  if (!ua) return 'Thiết bị không rõ';
  if (/iphone/i.test(ua)) return 'iPhone (Safari/Chrome)';
  if (/ipad/i.test(ua)) return 'iPad';
  if (/android/i.test(ua)) return 'Android';
  if (/windows/i.test(ua)) return 'Windows PC';
  if (/mac os/i.test(ua)) return 'Mac';
  return ua.slice(0, 40);
}

export default function DevicePanel({ items }: { items: DeviceItem[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action: 'approve' | 'reject') {
    setBusy(id);
    try {
      await fetch('/api/tbp/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bindId: id, action }),
      });
      router.refresh();
    } catch {
      /* noop */
    } finally {
      setBusy(null);
    }
  }

  async function reject(it: DeviceItem) {
    const warnActive = it.active
      ? ' Thiết bị này đang hoạt động — thu hồi xong nhân viên sẽ KHÔNG chấm công được cho tới khi có thiết bị khác được duyệt.'
      : '';
    const ok = await confirm({
      message: `${it.active ? 'Thu hồi' : 'Từ chối'} thiết bị của ${it.name}?${warnActive}`,
      danger: true,
      okText: it.active ? 'Thu hồi' : 'Từ chối',
    });
    if (ok) await act(it.id, 'reject');
  }

  return (
    <div className="ls-table-wrap">
      {items.length === 0 ? (
        <p className="muted" style={{ textAlign: 'center', padding: 20 }}>
          Chưa có thiết bị nào.
        </p>
      ) : (
        <table className="ls-table dev-table">
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Thiết bị</th>
              <th>Đăng ký</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className={i.status === 'Chờ' ? 'r-partial' : ''}>
                <td className="dev-name" data-label="Nhân viên" style={{ textAlign: 'left' }}>
                  {i.name}
                  <div className="muted">{i.dept}</div>
                </td>
                <td data-label="Thiết bị" style={{ textAlign: 'left' }}>
                  {shortUA(i.label)}
                  {i.active && (
                    <span className="badge badge-ok" style={{ marginLeft: 6 }}>
                      đang dùng
                    </span>
                  )}
                </td>
                <td data-label="Đăng ký">{new Date(i.boundAt).toLocaleDateString('vi-VN')}</td>
                <td data-label="Trạng thái">
                  {i.status === 'Đồng ý' ? (
                    <span className="badge badge-ok">
                      <Icon name="check" size={13} /> Đồng ý
                    </span>
                  ) : i.status === 'Từ chối' ? (
                    <span className="badge badge-no">
                      <Icon name="x" size={13} /> Từ chối
                    </span>
                  ) : (
                    <span className="badge badge-wait">
                      <Icon name="clock" size={13} /> Chờ
                    </span>
                  )}
                </td>
                <td className="tbp-act">
                  {!i.canApprove ? (
                    <span className="muted">—</span>
                  ) : i.status === 'Chờ' ? (
                    <>
                      <button className="btn-approve" disabled={busy === i.id} onClick={() => act(i.id, 'approve')}>
                        <Icon name="check" size={15} /> Duyệt
                      </button>
                      <button className="btn-reject" disabled={busy === i.id} onClick={() => reject(i)}>
                        <Icon name="x" size={15} /> Từ chối
                      </button>
                    </>
                  ) : i.status === 'Từ chối' ? (
                    <button className="btn-approve" disabled={busy === i.id} onClick={() => act(i.id, 'approve')}>
                      <Icon name="undoBack" size={14} /> Duyệt lại
                    </button>
                  ) : (
                    <button className="btn-undo" disabled={busy === i.id} onClick={() => reject(i)}>
                      Thu hồi
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
