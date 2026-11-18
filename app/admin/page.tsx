import { getStaffSession } from '@/lib/auth';
import SignOutButton from '@/app/_components/SignOutButton';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const staff = await getStaffSession();

  return (
    <main className="wrap">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Trang Admin</h1>
        <SignOutButton />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <p>
          Xin chào <b>{staff?.email}</b> — vai <b>{staff?.role}</b> (toàn công ty).
        </p>
        <p className="muted" style={{ fontSize: 13 }}>
          Khung Bước 2. Quản lý nhân viên / QR / log / ngày lễ / ca / cấu hình sẽ dựng ở Bước 6.
        </p>
      </div>
    </main>
  );
}
