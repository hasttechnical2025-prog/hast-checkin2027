'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Thanh tab con theo ROUTE cho khu Admin (giống kiểu TBP 2-tab) — gom các trang cùng nhóm
 * dưới 1 mục sidebar. KHÔNG dùng Radix Tabs; mỗi tab là 1 trang riêng.
 */
export type AdminTab = { href: string; label: string };

export const DATA_TABS: AdminTab[] = [
  { href: '/admin/bang-cong', label: 'Bảng công tháng' },
  { href: '/admin/log', label: 'Log chấm công' },
];

export const CONFIG_TABS: AdminTab[] = [
  { href: '/admin/cau-hinh', label: 'Chung' },
  { href: '/admin/ca', label: 'Ca làm' },
  { href: '/admin/ngay-le', label: 'Ngày lễ' },
];

export default function AdminTabs({ tabs, suffix = '' }: { tabs: AdminTab[]; suffix?: string }) {
  const path = usePathname();
  return (
    <div className="admin-subtabs" role="tablist">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={`${t.href}${suffix}`}
          className={`admin-subtab${path === t.href ? ' active' : ''}`}
          aria-current={path === t.href ? 'page' : undefined}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
