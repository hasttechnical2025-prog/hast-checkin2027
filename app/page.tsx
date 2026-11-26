import NvLogin from './_components/NvLogin';

export default function HomePage() {
  return (
    <main className="wrap" style={{ maxWidth: 400 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="HSTC" className="home-logo" />
      <h1 style={{ margin: 0, textAlign: 'center' }}>CHẤM CÔNG CBNV</h1>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0, textAlign: 'center' }}>Đăng nhập CBNV</h3>
        <NvLogin />
      </div>

      <p className="muted" style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
        <a href="/login">Đăng nhập Trưởng Bộ phận</a>
      </p>
    </main>
  );
}
