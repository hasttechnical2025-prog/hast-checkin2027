'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import QrCode from '@/app/_components/QrCode';

export interface Emp {
  id: number;
  maNv: string;
  name: string;
  department: string;
  role: string;
  loaiCa: string;
  status: string;
  email: string;
  telegram: string;
  ngayVaoLam: string;
  mienChamCong: boolean;
  token: string;
}

const LOAI_CA: Record<string, string> = {
  tieu_chuan: 'Tiêu chuẩn',
  ngoai_le_1: 'Ngoại lệ 1',
  ngoai_le_2: 'Ngoại lệ 2',
};

type FormState = Omit<Emp, 'token' | 'id'> & { id: number | null };

const EMPTY: FormState = {
  id: null,
  maNv: '',
  name: '',
  department: '',
  role: 'CBNV',
  loaiCa: 'tieu_chuan',
  status: 'Đang làm việc',
  email: '',
  telegram: '',
  ngayVaoLam: '',
  mienChamCong: false,
};

export default function EmployeesAdmin({ initial, departments }: { initial: Emp[]; departments: string[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [qrEmp, setQrEmp] = useState<Emp | null>(null);
  const [result, setResult] = useState<{ title: string; lines: string[] } | null>(null);

  const shown = initial.filter(
    (e) => !q || e.name.toLowerCase().includes(q.toLowerCase()) || e.maNv.toLowerCase().includes(q.toLowerCase()),
  );

  function origin() {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }

  async function post(body: Record<string, unknown>) {
    const res = await fetch('/api/admin/employee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (!res.ok || j.error) throw new Error(j.error || 'Lỗi');
    return j;
  }

  async function submit() {
    if (!form) return;
    setErr(null);
    setBusy(true);
    try {
      if (form.id == null) {
        const j = await post({
          op: 'create',
          ma_nv: form.maNv.trim().toUpperCase(),
          name: form.name.trim(),
          department: form.department.trim(),
          role: form.role,
          loai_ca: form.loaiCa,
          email: form.email,
          telegram: form.telegram,
          ngay_vao_lam: form.ngayVaoLam || null,
          mien_cham_cong: form.mienChamCong,
        });
        setForm(null);
        setResult({
          title: `✅ Đã tạo ${j.ma_nv}`,
          lines: [`PIN: ${j.pin}  (báo cho nhân viên, chỉ hiện 1 lần)`, `Link: ${origin()}/c/${j.token}`],
        });
      } else {
        await post({
          op: 'update',
          id: form.id,
          ma_nv: form.maNv.trim().toUpperCase(),
          name: form.name.trim(),
          department: form.department.trim(),
          role: form.role,
          loai_ca: form.loaiCa,
          status: form.status,
          email: form.email,
          telegram: form.telegram,
          ngay_vao_lam: form.ngayVaoLam || null,
          mien_cham_cong: form.mienChamCong,
        });
        setForm(null);
      }
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resetPin(e: Emp) {
    if (!confirm(`Cấp lại PIN cho ${e.name}?`)) return;
    try {
      const j = await post({ op: 'reset_pin', id: e.id });
      setResult({ title: `🔑 PIN mới của ${e.maNv}`, lines: [`PIN: ${j.pin}  (báo cho nhân viên)`] });
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function revokeToken(e: Emp) {
    if (!confirm(`Thu hồi & cấp QR mới cho ${e.name}? (QR cũ sẽ không dùng được)`)) return;
    try {
      await post({ op: 'revoke_token', id: e.id });
      router.refresh();
      setResult({ title: `🔄 Đã cấp QR mới cho ${e.maNv}`, lines: ['QR cũ đã vô hiệu. Mở lại QR để in bản mới.'] });
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function toggleStatus(e: Emp) {
    const next = e.status === 'Đang làm việc' ? 'Đã nghỉ việc' : 'Đang làm việc';
    if (!confirm(`Đổi trạng thái ${e.name} → ${next}?`)) return;
    try {
      await post({ op: 'set_status', id: e.id, status: next });
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function printOne(e: Emp) {
    await printCards([e]);
  }
  async function printAll() {
    await printCards(shown.filter((e) => e.status === 'Đang làm việc'));
  }

  async function printCards(list: Emp[]) {
    if (list.length === 0) return;
    const QR = await import('qrcode');
    const cards = await Promise.all(
      list.map(async (e) => {
        const url = `${origin()}/c/${e.token}`;
        const data = await QR.toDataURL(url, { margin: 1, width: 240 });
        return `<div class="qr-card"><div class="qr-name">${e.name}</div><div class="qr-manv">${e.maNv} · ${e.department}</div><img src="${data}"><div class="qr-hint">Quét để chấm công</div></div>`;
      }),
    );
    const html = `<html><head><meta charset="utf-8"><title>QR nhân viên</title><style>
      body{font-family:Arial,sans-serif;margin:0;padding:8mm;display:flex;flex-wrap:wrap;gap:8mm;}
      .qr-card{border:1px solid #999;border-radius:10px;padding:10px 14px;width:62mm;text-align:center;page-break-inside:avoid;}
      .qr-name{font-weight:700;font-size:15px;}
      .qr-manv{color:#555;font-size:12px;margin:2px 0 6px;}
      .qr-card img{width:150px;height:150px;}
      .qr-hint{font-size:11px;color:#777;margin-top:4px;}
      @page{size:A4;margin:8mm;}
    </style></head><body>${cards.join('')}</body></html>`;
    let iframe = document.getElementById('qr-print') as HTMLIFrameElement | null;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'qr-print';
      iframe.style.cssText = 'position:absolute;width:0;height:0;border:none;';
      document.body.appendChild(iframe);
    }
    const doc = iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe!.contentWindow?.focus();
      iframe!.contentWindow?.print();
    }, 200);
  }

  function openEdit(e: Emp) {
    setErr(null);
    setForm({
      id: e.id,
      maNv: e.maNv,
      name: e.name,
      department: e.department,
      role: e.role,
      loaiCa: e.loaiCa,
      status: e.status,
      email: e.email,
      telegram: e.telegram,
      ngayVaoLam: e.ngayVaoLam,
      mienChamCong: e.mienChamCong,
    });
  }

  return (
    <>
      <div className="tbp-bar">
        <input className="tbp-select" placeholder="🔎 Tìm tên / mã…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 180 }} />
        <span className="muted" style={{ fontSize: 13 }}>{shown.length} nhân viên</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className="btn-undo" onClick={printAll}>🖨 In tất cả QR</button>
          <button className="btn-approve" onClick={() => { setErr(null); setForm({ ...EMPTY }); }}>+ Thêm nhân viên</button>
        </div>
      </div>

      <div className="ls-table-wrap">
        <table className="ls-table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Họ tên</th>
              <th>Phòng</th>
              <th>Vai</th>
              <th>Ca</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((e) => (
              <tr key={e.id} className={e.status !== 'Đang làm việc' ? 'r-weekend' : ''}>
                <td>{e.maNv}</td>
                <td style={{ textAlign: 'left' }}>
                  {e.name}
                  {e.mienChamCong && <span className="muted" style={{ fontSize: 11 }}> · miễn chấm</span>}
                </td>
                <td style={{ textAlign: 'left' }}>{e.department}</td>
                <td>{e.role}</td>
                <td>{LOAI_CA[e.loaiCa] || e.loaiCa}</td>
                <td>
                  {e.status === 'Đang làm việc' ? (
                    <span className="badge badge-ok">Đang làm</span>
                  ) : (
                    <span className="badge badge-no">Nghỉ</span>
                  )}
                </td>
                <td className="tbp-act" style={{ flexWrap: 'wrap' }}>
                  <button className="btn-undo" onClick={() => openEdit(e)}>Sửa</button>
                  <button className="btn-undo" onClick={() => setQrEmp(e)}>QR</button>
                  <button className="btn-undo" onClick={() => resetPin(e)}>PIN</button>
                  <button className="btn-undo" onClick={() => revokeToken(e)}>Token</button>
                  <button className="btn-undo" onClick={() => toggleStatus(e)}>
                    {e.status === 'Đang làm việc' ? 'Nghỉ việc' : 'Kích hoạt'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form thêm/sửa */}
      {form && (
        <div className="cc-dlg-overlay" onClick={() => !busy && setForm(null)}>
          <div className="cc-dlg" style={{ textAlign: 'left', maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{form.id == null ? 'Thêm nhân viên' : 'Sửa nhân viên'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label>Mã NV
                <input className="field" value={form.maNv} onChange={(e) => setForm({ ...form, maNv: e.target.value })} placeholder="ST001" />
              </label>
              <label>Họ tên
                <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label>Phòng ban
                <input className="field" list="dept-list" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
                <datalist id="dept-list">{departments.map((d) => <option key={d} value={d} />)}</datalist>
              </label>
              <label>Vai trò
                <select className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="CBNV">CBNV</option>
                  <option value="TBP">TBP</option>
                </select>
              </label>
              <label>Loại ca
                <select className="field" value={form.loaiCa} onChange={(e) => setForm({ ...form, loaiCa: e.target.value })}>
                  <option value="tieu_chuan">Tiêu chuẩn</option>
                  <option value="ngoai_le_1">Ngoại lệ 1</option>
                  <option value="ngoai_le_2">Ngoại lệ 2</option>
                </select>
              </label>
              <label>Ngày vào làm
                <input className="field" type="date" value={form.ngayVaoLam} onChange={(e) => setForm({ ...form, ngayVaoLam: e.target.value })} />
              </label>
              <label>Telegram chat id
                <input className="field" value={form.telegram} onChange={(e) => setForm({ ...form, telegram: e.target.value.replace(/[^0-9-]/g, '') })} />
              </label>
              <label>Email
                <input className="field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </label>
              {form.id != null && (
                <label>Trạng thái
                  <select className="field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="Đang làm việc">Đang làm việc</option>
                    <option value="Đã nghỉ việc">Đã nghỉ việc</option>
                  </select>
                </label>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20 }}>
                <input type="checkbox" checked={form.mienChamCong} onChange={(e) => setForm({ ...form, mienChamCong: e.target.checked })} />
                Miễn chấm công
              </label>
            </div>
            {err && <p className="err">{err}</p>}
            <div className="cc-dlg-btns">
              <button className="btn" disabled={busy} onClick={submit}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
              <button className="btn cc-btn-ghost" disabled={busy} onClick={() => setForm(null)}>Hủy</button>
            </div>
          </div>
        </div>
      )}

      {/* QR modal */}
      {qrEmp && (
        <div className="cc-dlg-overlay" onClick={() => setQrEmp(null)}>
          <div className="cc-dlg" style={{ maxWidth: 320 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{qrEmp.name}</h3>
            <p className="muted" style={{ marginTop: -4 }}>{qrEmp.maNv} · {qrEmp.department}</p>
            <div style={{ display: 'grid', placeItems: 'center', padding: 8 }}>
              <QrCode text={`${origin()}/c/${qrEmp.token}`} size={200} />
            </div>
            <div className="cc-dlg-btns">
              <button className="btn" onClick={() => printOne(qrEmp)}>🖨 In QR</button>
              <button className="btn cc-btn-ghost" onClick={() => setQrEmp(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* Kết quả (PIN/token) */}
      {result && (
        <div className="cc-dlg-overlay" onClick={() => setResult(null)}>
          <div className="cc-dlg" style={{ textAlign: 'left', maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{result.title}</h3>
            {result.lines.map((l, i) => (
              <p key={i} style={{ fontSize: 14, wordBreak: 'break-all' }}>{l}</p>
            ))}
            <div className="cc-dlg-btns">
              <button className="btn" onClick={() => setResult(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
