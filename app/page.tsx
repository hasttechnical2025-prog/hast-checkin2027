import NvLogin from './_components/NvLogin';

export default function HomePage() {
  return (
    <main className="wrap" style={{ maxWidth: 400 }}>
      <h1 style={{ marginBottom: 2 }}>Chấm Công HSTC</h1>
      <p className="muted">Công ty CP Siêu Thanh Hà Nội</p>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0, textAlign: 'center' }}>Đăng nhập CBNV</h3>
        <NvLogin />
      </div>

      <p className="muted" style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
        <a href="/login">Đăng nhập Quản trị / TBP</a>
      </p>
    </main>
  );
}
