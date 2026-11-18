'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NvLogin() {
  const router = useRouter();
  const [maNv, setMaNv] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null); // token nếu thiết bị chờ duyệt

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch('/api/nv-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maNv: maNv.trim().toUpperCase(), pin: pin.trim() }),
      });
      const j = await res.json();
      if (!res.ok || j.error) {
        setErr(j.error || 'Có lỗi xảy ra.');
        setBusy(false);
        return;
      }
      if (j.status === 'rejected') {
        setErr('Thiết bị này đã bị từ chối. Liên hệ TBP.');
        setBusy(false);
        return;
      }
      if (j.status === 'pending') {
        setPending(j.token);
        setBusy(false);
        return;
      }
      router.replace('/c/' + j.token);
    } catch {
      setErr('Lỗi kết nối. Thử lại.');
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 34 }}>📱</div>
        <h3 style={{ margin: '6px 0' }}>Thiết bị mới</h3>
        <p className="muted">
          Thiết bị này cần <b>TBP duyệt</b> trước khi chấm công (chống chấm hộ). Bạn vẫn có thể mở trang để xem.
        </p>
        <button className="btn" style={{ width: '100%', marginTop: 10 }} onClick={() => router.replace('/c/' + pending)}>
          Mở trang chấm công
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <label>
        Mã nhân viên
        <input
          className="field"
          value={maNv}
          onChange={(e) => setMaNv(e.target.value)}
          placeholder="VD: ST001"
          autoCapitalize="characters"
          autoCorrect="off"
          required
        />
      </label>
      <label style={{ display: 'block', marginTop: 12 }}>
        Mã PIN (4 số)
        <input
          className="field"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          type="password"
          autoComplete="off"
          placeholder="••••"
          required
        />
      </label>

      {err && <p className="err">{err}</p>}

      <button className="btn" type="submit" disabled={busy} style={{ width: '100%', marginTop: 14 }}>
        {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </button>
    </form>
  );
}
