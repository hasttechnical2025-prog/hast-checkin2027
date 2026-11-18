import Link from 'next/link';
import SignOutButton from '@/app/_components/SignOutButton';

const TABS: { key: string; href: string; label: string }[] = [
  { key: 'nhan-vien', href: '/admin/nhan-vien', label: 'Nhân viên' },
  { key: 'log', href: '/admin/log', label: 'Log chấm công' },
  { key: 'ngay-le', href: '/admin/ngay-le', label: 'Ngày lễ' },
  { key: 'ca', href: '/admin/ca', label: 'Cấu hình ca' },
  { key: 'cau-hinh', href: '/admin/cau-hinh', label: 'Cấu hình' },
];

export default function AdminNav({ active }: { active: string }) {
  return (
    <div className="ls-top" style={{ marginBottom: 12 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22 }}>Quản trị</h1>
        <div className="admin-nav">
          {TABS.map((t) => (
            <Link key={t.key} href={t.href} className={t.key === active ? 'admin-tab active' : 'admin-tab'}>
              {t.label}
            </Link>
          ))}
        </div>
      </div>
      <SignOutButton />
    </div>
  );
}
