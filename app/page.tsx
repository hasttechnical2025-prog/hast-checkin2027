export default function HomePage() {
  return (
    <main className="wrap">
      <h1>Chấm Công HSTC — 2027</h1>
      <p className="muted">Công ty CP Siêu Thanh Hà Nội</p>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Khu vực</h3>
        <ul>
          <li>
            <b>CBNV</b> — mở link/QR cá nhân <code>/c/&lt;token&gt;</code> để chấm công.
          </li>
          <li>
            <b>TBP / Admin</b> — <a href="/login">Đăng nhập</a> để vào trang quản trị.
          </li>
        </ul>
        <p className="muted" style={{ fontSize: 13 }}>
          Khung Bước 2 — các màn nghiệp vụ sẽ bổ sung ở các bước sau.
        </p>
      </div>
    </main>
  );
}
