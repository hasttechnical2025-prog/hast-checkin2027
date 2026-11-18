import { Suspense } from 'react';
import LoginForm from './login-form';

export default function LoginPage() {
  return (
    <main className="wrap" style={{ maxWidth: 420 }}>
      <h1>Đăng nhập</h1>
      <p className="muted">Dành cho TBP &amp; Admin.</p>
      <div className="card" style={{ marginTop: 12 }}>
        <Suspense fallback={<p className="muted">Đang tải…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
