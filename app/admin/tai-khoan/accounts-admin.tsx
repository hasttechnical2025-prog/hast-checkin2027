'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface Account {
  userId: string;
  email: string;
  role: string;
  department: string;
  viewAll: boolean;
}

export default function AccountsAdmin({ accounts, departments }: { accounts: Account[]; departments: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('TBP');
  const [dept, setDept] = useState('');
  const [viewAll, setViewAll] = useState(false);

  const [roleEdit, setRoleEdit] = useState<Account | null>(null);
  const [pwdEdit, setPwdEdit] = useState<Account | null>(null);
  const [pwd, setPwd] = useState('');

  async function post(body: Record<string, unknown>) {
    const res = await fetch('/api/admin/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (!res.ok || j.error) throw new Error(j.error || 'Lỗi');
    return j;
  }

  async function create() {
    setErr(null);
    setBusy(true);
    try {
      await post({ op: 'create', email: email.trim(), password, role, department: dept, viewAll });
      setCreateOpen(false);
      setEmail(''); setPassword(''); setRole('TBP'); setDept(''); setViewAll(false);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveRole() {
    if (!roleEdit) return;
    setErr(null);
    setBusy(true);
    try {
      await post({ op: 'set_role', userId: roleEdit.userId, role: roleEdit.role || 'TBP', department: roleEdit.department, viewAll: roleEdit.viewAll });
      setRoleEdit(null);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function savePwd() {
    if (!pwdEdit) return;
    setErr(null);
    setBusy(true);
    try {
      await post({ op: 'reset_password', userId: pwdEdit.userId, password: pwd });
      setPwdEdit(null);
      setPwd('');
      alert('Đã đổi mật khẩu.');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function del(a: Account) {
    if (!confirm(`Xóa tài khoản ${a.email}? (không hoàn tác)`)) return;
    try {
      await post({ op: 'delete', userId: a.userId });
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <>
      <div className="tbp-bar">
        <span className="muted" style={{ fontSize: 13 }}>{accounts.length} tài khoản</span>
        <button className="btn-approve" style={{ marginLeft: 'auto' }} onClick={() => { setErr(null); setCreateOpen(true); }}>
          + Thêm tài khoản
        </button>
      </div>

      <div className="ls-table-wrap">
        <table className="ls-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Vai</th>
              <th>Phòng</th>
              <th>Xem toàn CT</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.userId}>
                <td style={{ textAlign: 'left' }}>{a.email}</td>
                <td>{a.role || <span className="muted">(chưa gán)</span>}</td>
                <td>{a.department || '—'}</td>
                <td>{a.viewAll ? '✅' : '—'}</td>
                <td className="tbp-act" style={{ flexWrap: 'wrap' }}>
                  <button className="btn-undo" onClick={() => setRoleEdit({ ...a, role: a.role || 'TBP' })}>Vai</button>
                  <button className="btn-undo" onClick={() => { setPwd(''); setPwdEdit(a); }}>Mật khẩu</button>
                  <button className="btn-reject" onClick={() => del(a)}>Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <div className="cc-dlg-overlay" onClick={() => !busy && setCreateOpen(false)}>
          <div className="cc-dlg" style={{ textAlign: 'left', maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Thêm tài khoản TBP/Admin</h3>
            <label>Email<input className="field" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label style={{ display: 'block', marginTop: 8 }}>Mật khẩu (≥6 ký tự)
              <input className="field" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
              <label>Vai
                <select className="field" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="TBP">TBP</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              {role === 'TBP' && (
                <label>Phòng
                  <input className="field" list="dept-list" value={dept} onChange={(e) => setDept(e.target.value)} />
                  <datalist id="dept-list">{departments.map((d) => <option key={d} value={d} />)}</datalist>
                </label>
              )}
            </div>
            {role === 'TBP' && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                <input type="checkbox" checked={viewAll} onChange={(e) => setViewAll(e.target.checked)} />
                Xem toàn công ty (KTHC)
              </label>
            )}
            {err && <p className="err">{err}</p>}
            <div className="cc-dlg-btns">
              <button className="btn" disabled={busy} onClick={create}>{busy ? 'Đang tạo…' : 'Tạo'}</button>
              <button className="btn cc-btn-ghost" disabled={busy} onClick={() => setCreateOpen(false)}>Hủy</button>
            </div>
          </div>
        </div>
      )}

      {roleEdit && (
        <div className="cc-dlg-overlay" onClick={() => !busy && setRoleEdit(null)}>
          <div className="cc-dlg" style={{ textAlign: 'left', maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Vai: {roleEdit.email}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label>Vai
                <select className="field" value={roleEdit.role} onChange={(e) => setRoleEdit({ ...roleEdit, role: e.target.value })}>
                  <option value="TBP">TBP</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              {roleEdit.role === 'TBP' && (
                <label>Phòng
                  <input className="field" list="dept-list" value={roleEdit.department} onChange={(e) => setRoleEdit({ ...roleEdit, department: e.target.value })} />
                </label>
              )}
            </div>
            {roleEdit.role === 'TBP' && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                <input type="checkbox" checked={roleEdit.viewAll} onChange={(e) => setRoleEdit({ ...roleEdit, viewAll: e.target.checked })} />
                Xem toàn công ty
              </label>
            )}
            {err && <p className="err">{err}</p>}
            <div className="cc-dlg-btns">
              <button className="btn" disabled={busy} onClick={saveRole}>Lưu</button>
              <button className="btn cc-btn-ghost" disabled={busy} onClick={() => setRoleEdit(null)}>Hủy</button>
            </div>
          </div>
        </div>
      )}

      {pwdEdit && (
        <div className="cc-dlg-overlay" onClick={() => !busy && setPwdEdit(null)}>
          <div className="cc-dlg" style={{ textAlign: 'left', maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Đổi mật khẩu</h3>
            <p className="muted" style={{ marginTop: -4 }}>{pwdEdit.email}</p>
            <input className="field" type="text" placeholder="Mật khẩu mới (≥6)" value={pwd} onChange={(e) => setPwd(e.target.value)} />
            {err && <p className="err">{err}</p>}
            <div className="cc-dlg-btns">
              <button className="btn" disabled={busy} onClick={savePwd}>Đổi</button>
              <button className="btn cc-btn-ghost" disabled={busy} onClick={() => setPwdEdit(null)}>Hủy</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
