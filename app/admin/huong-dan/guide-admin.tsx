'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface GuideItem {
  id: string;
  title: string;
  content: string;
}

export default function GuideAdmin({ initial }: { initial: GuideItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState<GuideItem[]>(initial.map((i) => ({ ...i })));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function set(id: string, field: 'title' | 'content', val: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: val } : i)));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const j = await res.json();
      setMsg(!res.ok || j.error ? '❌ ' + (j.error || 'Lỗi') : '✅ Đã lưu hướng dẫn.');
      if (res.ok && !j.error) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="muted" style={{ fontSize: 13 }}>Nội dung 4 trang hướng dẫn hiển thị trong sheet Cài đặt của CBNV.</p>
      {items.map((it, idx) => (
        <div className="card" key={it.id} style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Trang {idx + 1} ({it.id}) — Tiêu đề</label>
          <input className="field" value={it.title} onChange={(e) => set(it.id, 'title', e.target.value)} style={{ marginBottom: 8 }} />
          <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Nội dung</label>
          <textarea className="field" rows={4} value={it.content} onChange={(e) => set(it.id, 'content', e.target.value)} />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn" disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : '💾 Lưu hướng dẫn'}</button>
        {msg && <span className="muted" style={{ fontSize: 13 }}>{msg}</span>}
      </div>
    </>
  );
}
