import { Suspense } from 'react';
import LoginForm from './login-form';

export default function LoginPage() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-head">
          <div className="auth-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="HSTC" />
          </div>
          <h1 className="auth-title">Hệ thống chấm công</h1>
          <p className="auth-sub">Đăng nhập · TBP &amp; Admin</p>
        </div>
        <Suspense fallback={<p className="muted" style={{ textAlign: 'center' }}>Đang tải…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
