'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
  const [busy, setBusy] = useState<string | null>(null);

  const pendingCount = items.filter((i) => i.status === 'Chờ').length;

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

  return (
    <>
      <div className="tbp-tabs">
        <Link href="/tbp" className="tbp-tablink">
          Duyệt giải trình
        </Link>
        <Link href="/tbp/nscl" className="tbp-tablink">
          Bảng điểm NSCL
        </Link>
        <button className="active">
          Thiết bị{pendingCount > 0 ? ` (${pendingCount})` : ''}
        </button>
      </div>

      <p className="muted" style={{ fontSize: 13, margin: '10px 0 14px' }}>
        Duyệt thiết bị mới giúp chống chấm hộ: mỗi nhân viên chỉ 1 thiết bị hoạt động. Duyệt máy mới sẽ tự
        vô hiệu máy cũ.
      </p>

      <div className="ls-table-wrap">
        {items.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: 20 }}>
            Chưa có thiết bị nào.
          </p>
        ) : (
          <table className="ls-table">
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
                  <td style={{ textAlign: 'left' }}>
                    {i.name}
                    <div className="muted" style={{ fontSize: 11 }}>
                      {i.dept}
                    </div>
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    {shortUA(i.label)}
                    {i.active && <span className="badge badge-ok" style={{ marginLeft: 6 }}>đang dùng</span>}
                  </td>
                  <td>{new Date(i.boundAt).toLocaleDateString('vi-VN')}</td>
                  <td>
                    {i.status === 'Đồng ý' ? (
                      <span className="badge badge-ok">✅ Đồng ý</span>
                    ) : i.status === 'Từ chối' ? (
                      <span className="badge badge-no">❌ Từ chối</span>
                    ) : (
                      <span className="badge badge-wait">⏳ Chờ</span>
                    )}
                  </td>
                  <td className="tbp-act">
                    {i.status === 'Chờ' && i.canApprove ? (
                      <>
                        <button className="btn-approve" disabled={busy === i.id} onClick={() => act(i.id, 'approve')}>
                          ✅ Duyệt
                        </button>
                        <button className="btn-reject" disabled={busy === i.id} onClick={() => act(i.id, 'reject')}>
                          ❌
                        </button>
                      </>
                    ) : (
                      <span className="muted" style={{ fontSize: 12 }}>
                        —
                      </span>
                    )}
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
