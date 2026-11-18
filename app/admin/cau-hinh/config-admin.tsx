'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const DEFAULT_PRINT = {
  fontName: 11,
  fontData: 11,
  rowHeight: 30,
  colorSat: '#BFBFBF',
  colorSun: '#A6A6A6',
  colorHoliday: '#D9D9D9',
};

export default function ConfigAdmin({
  config,
  printConfig,
}: {
  config: Record<string, string>;
  printConfig: Record<string, string | number>;
}) {
  const router = useRouter();
  const [c, setC] = useState<Record<string, string>>({ ...config });
  const [p, setP] = useState<Record<string, string | number>>({ ...DEFAULT_PRINT, ...printConfig });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const set = (k: string, v: string) => setC((prev) => ({ ...prev, [k]: v }));
  const setP2 = (k: string, v: string | number) => setP((prev) => ({ ...prev, [k]: v }));
  const bool = (k: string) => c[k] === 'true';

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: c, printConfig: p }),
      });
      const j = await res.json();
      setMsg(!res.ok || j.error ? '❌ ' + (j.error || 'Lỗi') : '✅ Đã lưu cấu hình.');
      if (res.ok && !j.error) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Công ty</h3>
        <label>Tên công ty (banner CBNV)
          <input className="field" value={c.company_name || ''} onChange={(e) => set('company_name', e.target.value)} />
        </label>
        <label style={{ display: 'block', marginTop: 8 }}>Tên văn phòng
          <input className="field" value={c.office_name || ''} onChange={(e) => set('office_name', e.target.value)} />
        </label>
        <label style={{ display: 'block', marginTop: 8 }}>Địa chỉ
          <input className="field" value={c.company_address || ''} onChange={(e) => set('company_address', e.target.value)} />
        </label>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>GPS &amp; phạm vi</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label>Vĩ độ (lat)
            <input className="field" value={c.office_lat || ''} onChange={(e) => set('office_lat', e.target.value)} />
          </label>
          <label>Kinh độ (lng)
            <input className="field" value={c.office_lng || ''} onChange={(e) => set('office_lng', e.target.value)} />
          </label>
          <label>Bán kính hợp lệ (m)
            <input className="field" type="number" value={c.office_radius || ''} onChange={(e) => set('office_radius', e.target.value)} />
          </label>
          <label>Khoảng cách tối đa (m)
            <input className="field" type="number" value={c.max_distance || ''} onChange={(e) => set('max_distance', e.target.value)} />
          </label>
          <label>GPS hết hạn (ms)
            <input className="field" type="number" value={c.gps_expire_ms || ''} onChange={(e) => set('gps_expire_ms', e.target.value)} />
          </label>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Công tắc</h3>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={bool('allow_holiday')} onChange={(e) => set('allow_holiday', e.target.checked ? 'true' : 'false')} />
          Cho phép chấm công ngày nghỉ (T7/CN/lễ)
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <input type="checkbox" checked={bool('allow_multiple')} onChange={(e) => set('allow_multiple', e.target.checked ? 'true' : 'false')} />
          Cho phép chấm trùng ca (bỏ cảnh báo)
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <input type="checkbox" checked={(c.leave_symbol_mode || 'merged') !== 'split'} onChange={(e) => set('leave_symbol_mode', e.target.checked ? 'merged' : 'split')} />
          Gộp nghỉ ốm vào phép (ký hiệu P; bỏ tick = tách Ô)
        </label>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Bản in NSCL</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <label>Cỡ chữ tên
            <input className="field" type="number" value={p.fontName} onChange={(e) => setP2('fontName', Number(e.target.value))} />
          </label>
          <label>Cỡ chữ điểm
            <input className="field" type="number" value={p.fontData} onChange={(e) => setP2('fontData', Number(e.target.value))} />
          </label>
          <label>Cao dòng (px)
            <input className="field" type="number" value={p.rowHeight} onChange={(e) => setP2('rowHeight', Number(e.target.value))} />
          </label>
          <label>Màu Thứ 7
            <input className="field" type="color" value={String(p.colorSat)} onChange={(e) => setP2('colorSat', e.target.value)} />
          </label>
          <label>Màu Chủ nhật
            <input className="field" type="color" value={String(p.colorSun)} onChange={(e) => setP2('colorSun', e.target.value)} />
          </label>
          <label>Màu ngày lễ
            <input className="field" type="color" value={String(p.colorHoliday)} onChange={(e) => setP2('colorHoliday', e.target.value)} />
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn" disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : '💾 Lưu cấu hình'}</button>
        {msg && <span className="muted" style={{ fontSize: 13 }}>{msg}</span>}
      </div>
    </>
  );
}
