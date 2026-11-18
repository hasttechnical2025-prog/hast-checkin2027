'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(
    params.get('e') === 'norole'
      ? 'Tài khoản chưa được gán vai. Liên hệ Admin.'
      : null,
  );

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
    <form onSubmit={onSubmit}>
      <label>
        Email
        <input
          className="field"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
        />
      </label>
      <label style={{ display: 'block', marginTop: 12 }}>
        Mật khẩu
        <input
          className="field"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </label>

      {err && (
        <p className="err" style={{ fontSize: 14 }}>
          {err}
        </p>
      )}

      <button className="btn" type="submit" disabled={busy} style={{ marginTop: 14, width: '100%' }}>
        {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </button>
    </form>
  );
}
