'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Icon, type IconName } from '@/app/_components/icons';

const ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: '/admin/nhan-vien', label: 'Nhân viên', icon: 'user' },
  { href: '/admin/bang-cong', label: 'Bảng công tháng', icon: 'sheet' },
  { href: '/tbp', label: 'Duyệt & Bảng điểm', icon: 'checks' },
  { href: '/admin/log', label: 'Log chấm công', icon: 'doc' },
  { href: '/admin/thiet-bi', label: 'Duyệt thiết bị', icon: 'phone' },
  { href: '/admin/ngay-le', label: 'Ngày lễ', icon: 'calendar' },
  { href: '/admin/ca', label: 'Cấu hình ca', icon: 'clock' },
  { href: '/admin/cau-hinh', label: 'Cấu hình', icon: 'settings' },
  { href: '/admin/tai-khoan', label: 'Tài khoản', icon: 'lock' },
  { href: '/admin/huong-dan', label: 'Hướng dẫn', icon: 'info' },
];

// Thanh tab đáy (mobile) — admin trên điện thoại chỉ cần Thêm nhân viên + Duyệt thiết bị;
// còn lại vào qua "Thêm" (menu đầy đủ).
const BOTTOM: { href: string; label: string; icon: IconName }[] = [
  { href: '/admin/nhan-vien', label: 'Nhân viên', icon: 'user' },
  { href: '/admin/thiet-bi', label: 'Thiết bị', icon: 'phone' },
];

export default function AdminSidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="admin-topbar">
        <button className="admin-ham" onClick={() => setOpen(true)} aria-label="Mở menu">
          <Icon name="menu" size={20} />
        </button>
        <b>Quản trị</b>
      </div>

      {open && <div className="admin-backdrop" onClick={() => setOpen(false)} />}

      <aside className={`admin-sidebar${open ? ' open' : ''}`}>
        <div className="admin-brand">
          Chấm Công HSTC
          <span>Quản trị</span>
        </div>
        <nav className="admin-side-nav">
          {ITEMS.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={`admin-side-item${path.startsWith(it.href) ? ' active' : ''}`}
              onClick={() => setOpen(false)}
            >
              <span className="ic">
                <Icon name={it.icon} size={17} />
              </span>
              {it.label}
            </Link>
          ))}
        </nav>
        <form action="/auth/signout" method="post" className="admin-side-signout">
          <button
            className="btn-undo"
            type="submit"
            style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Icon name="logout" size={15} /> Đăng xuất
          </button>
        </form>
      </aside>

      {/* Thanh tab đáy — chỉ hiện trên mobile (CSS) */}
      <nav className="botnav admin-botnav" aria-label="Điều hướng nhanh">
        {BOTTOM.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={`botnav-item${path.startsWith(it.href) ? ' active' : ''}`}
          >
            <Icon name={it.icon} size={20} />
            <span>{it.label}</span>
          </Link>
        ))}
        <form action="/auth/signout" method="post">
          <button type="submit" className="botnav-item">
            <Icon name="logout" size={20} />
            <span>Đăng xuất</span>
          </button>
        </form>
      </nav>
    </>
  );
}
