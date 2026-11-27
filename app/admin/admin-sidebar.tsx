'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Icon, type IconName } from '@/app/_components/icons';

type NavItem = { href: string; label: string; icon: IconName; match?: string[] };

// Gom 10 trang phẳng thành NHÓM có nhãn -> dễ quét, gọn mắt. Một số trang gộp dưới 1 mục:
// "Bảng công & Log" (/admin/bang-cong + /admin/log) và "Cấu hình" (chung + ca + ngày lễ).
const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Vận hành',
    items: [
      { href: '/admin/nhan-vien', label: 'Nhân viên', icon: 'user' },
      { href: '/admin/thiet-bi', label: 'Duyệt thiết bị', icon: 'phone' },
    ],
  },
  {
    label: 'Dữ liệu chấm công',
    items: [
      { href: '/admin/bang-cong', label: 'Bảng công & Log', icon: 'sheet', match: ['/admin/bang-cong', '/admin/log'] },
    ],
  },
  {
    label: 'Thiết lập',
    items: [
      { href: '/admin/cau-hinh', label: 'Cấu hình', icon: 'settings', match: ['/admin/cau-hinh', '/admin/ca', '/admin/ngay-le'] },
      { href: '/admin/huong-dan', label: 'Hướng dẫn CBNV', icon: 'info' },
      { href: '/admin/tai-khoan', label: 'Tài khoản & quyền', icon: 'lock' },
    ],
  },
];

// Thanh tab đáy (mobile): chỉ 2 mục hay dùng; còn lại vào qua menu (hamburger).
const BOTTOM: { href: string; label: string; icon: IconName }[] = [
  { href: '/admin/nhan-vien', label: 'Nhân viên', icon: 'user' },
  { href: '/admin/thiet-bi', label: 'Thiết bị', icon: 'phone' },
];

function isActive(path: string, it: NavItem): boolean {
  const ms = it.match ?? [it.href];
  return ms.some((m) => path === m || path.startsWith(m + '/'));
}

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
          {GROUPS.map((g) => (
            <div key={g.label} className="admin-side-group">
              <div className="admin-side-grouplabel">{g.label}</div>
              {g.items.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`admin-side-item${isActive(path, it) ? ' active' : ''}`}
                  onClick={() => setOpen(false)}
                >
                  <span className="ic">
                    <Icon name={it.icon} size={17} />
                  </span>
                  {it.label}
                </Link>
              ))}
            </div>
          ))}

          {/* Khu khác: Duyệt/NSCL là KHU giao diện riêng (không phải trang admin) -> tách hẳn,
              mở tab mới để admin giữ nguyên ngữ cảnh đang làm. */}
          <div className="admin-side-group admin-side-other">
            <div className="admin-side-grouplabel">Khu khác</div>
            <Link
              href="/tbp"
              className="admin-side-item"
              onClick={() => setOpen(false)}
            >
              <span className="ic">
                <Icon name="checks" size={17} />
              </span>
              Duyệt giải trình & NSCL
            </Link>
          </div>
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
