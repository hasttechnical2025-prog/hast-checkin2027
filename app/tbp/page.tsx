import { getStaffSession } from '@/lib/auth';
import SignOutButton from '@/app/_components/SignOutButton';

// Khu vực có phiên — luôn render động.
export const dynamic = 'force-dynamic';

export default async function TbpPage() {
  // Middleware đã chặn nếu chưa đăng nhập / chưa có vai; đây chỉ để hiển thị.
  const staff = await getStaffSession();

  return (
    <main className="wrap">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Trang TBP</h1>
        <SignOutButton />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <p>
          Xin chào <b>{staff?.email}</b>
        </p>
        <ul>
          <li>Vai: <b>{staff?.role}</b></li>
          <li>Phòng ban: <b>{staff?.department ?? '—'}</b></li>
          <li>Xem toàn công ty (view_all): <b>{staff?.viewAll ? 'Có' : 'Không'}</b></li>
        </ul>
        <p className="muted" style={{ fontSize: 13 }}>
          Khung Bước 2. Tab Duyệt giải trình + Bảng điểm NSCL sẽ dựng ở Bước 5.
        </p>
      </div>
    </main>
  );
}
