'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '@/app/_components/icons';

const ITEMS: { href: string; label: string; icon: string }[] = [
  { href: '/admin/nhan-vien', label: 'Nhân viên', icon: '👤' },
  { href: '/admin/log', label: 'Log chấm công', icon: '🗒️' },
  { href: '/admin/sua-cong', label: 'Sửa công ngày', icon: '✏️' },
  { href: '/admin/thiet-bi', label: 'Duyệt thiết bị', icon: '📱' },
  { href: '/admin/ngay-le', label: 'Ngày lễ', icon: '📅' },
  { href: '/admin/ca', label: 'Cấu hình ca', icon: '⏱️' },
  { href: '/admin/cau-hinh', label: 'Cấu hình', icon: '⚙️' },
  { href: '/admin/tai-khoan', label: 'Tài khoản', icon: '🔑' },
  { href: '/admin/huong-dan', label: 'Hướng dẫn', icon: '📖' },
];

export default function AdminSidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="admin-topbar">
        <button className="admin-ham" onClick={() => setOpen(true)} aria-label="Mở menu">
          ☰
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
              <span className="ic">{it.icon}</span>
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
    </>
  );
}
