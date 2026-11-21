'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Icon } from '@/app/_components/icons';

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(
    params.get('e') === 'norole'
      ? 'Tài khoản chưa được gán vai. Liên hệ Admin.'
      : null,
  );

  // Khôi phục lựa chọn ghi nhớ + email đã lưu (tiện cho TBP ít khi đăng nhập).
  useEffect(() => {
    try {
      setRemember(localStorage.getItem('cc_remember') !== '0');
      const savedEmail = localStorage.getItem('cc_email');
      if (savedEmail) setEmail(savedEmail);
    } catch {
      /* storage bị chặn -> giữ mặc định (ghi nhớ bật) */
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErr('Sai email hoặc mật khẩu.');
      setBusy(false);
      return;
    }

    // Lưu lựa chọn ghi nhớ cho RememberGuard + prefill lần sau.
    try {
      if (remember) {
        localStorage.setItem('cc_remember', '1');
        localStorage.setItem('cc_email', email);
      } else {
        localStorage.setItem('cc_remember', '0');
        localStorage.removeItem('cc_email');
        // Đánh dấu phiên hiện tại còn sống để không bị guard đăng xuất ngay.
        sessionStorage.setItem('cc_alive', '1');
      }
    } catch {
      /* storage bị chặn -> bỏ qua */
    }

    // Lấy vai để điều hướng đúng khu vực.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: role } = await supabase
      .from('chamcong_app_roles')
      .select('role')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (!role) {
      setErr('Tài khoản chưa được gán vai. Liên hệ Admin.');
      setBusy(false);
      return;
    }

    router.replace(role.role === 'admin' ? '/admin' : '/tbp');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="auth-form">
      <label className="auth-label" htmlFor="auth-email">
        Email
      </label>
      <div className="auth-ib">
        <Icon name="mail" size={18} className="auth-ib-ic" />
        <input
          id="auth-email"
          className="auth-in"
          type="email"
          inputMode="email"
          placeholder="ten@hstc.vn"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
        />
      </div>

      <label className="auth-label" htmlFor="auth-pw">
        Mật khẩu
      </label>
      <div className="auth-ib">
        <Icon name="lock" size={18} className="auth-ib-ic" />
        <input
          id="auth-pw"
          className="auth-in"
          type={showPw ? 'text' : 'password'}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <button
          type="button"
          className="auth-eye"
          onClick={() => setShowPw((v) => !v)}
          aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-pressed={showPw}
        >
          <Icon name={showPw ? 'eyeOff' : 'eye'} size={18} />
        </button>
      </div>

      <label className="auth-remember">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        />
        Ghi nhớ đăng nhập trên máy này
      </label>

      {err && (
        <p className="auth-err">
          <Icon name="alert" size={15} /> {err}
        </p>
      )}

      <button className="btn auth-btn" type="submit" disabled={busy}>
        {busy ? (
          'Đang đăng nhập…'
        ) : (
          <>
            <Icon name="login" size={18} /> Đăng nhập
          </>
        )}
      </button>
    </form>
  );
}
