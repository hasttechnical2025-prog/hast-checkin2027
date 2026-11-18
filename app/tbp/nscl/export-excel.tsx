'use client';

import { useEffect, useState } from 'react';
import { fsSupported, getLinkedInfo, pickTarget, writeToTarget, downloadXlsx, expSheetName } from '@/lib/fs-export';

const pad = (n: number) => String(n).padStart(2, '0');

export default function ExportExcel({ year, month }: { year: number; month: number }) {
  const [linked, setLinked] = useState<{ name: string; sheet: string } | null>(null);
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [sheet, setSheet] = useState('BangCong');

  useEffect(() => {
    setSupported(fsSupported());
    getLinkedInfo().then((i) => {
      if (i) {
        setLinked(i);
        setSheet(i.sheet);
      } else {
        setSheet(expSheetName());
      }
    });
  }, []);

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 4000);
  }

  // Gọi NGAY trong click "Tiếp tục" để giữ user-gesture mở cửa sổ chọn file.
  async function confirmPick() {
    setPickOpen(false);
    try {
      const r = await pickTarget(sheet);
      if (!r) return; // hủy
      if ('unsafe' in r) {
        flash(`🛑 File "${r.fileName}" có ${r.sheets.length} sheet (file làm việc). Hãy chọn file RIÊNG chỉ chứa bảng công.`);
        return;
      }
      setLinked(r);
      flash(`📁 Đã liên kết: ${r.name} ▸ ${r.sheet}`);
    } catch (e) {
      flash('❌ Lỗi chọn file: ' + (e as Error).message);
    }
  }

  async function doExport() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/tbp/export-nscl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        flash('❌ ' + (data.error || 'Lỗi xuất.'));
        return;
      }
      if (data.unsigned && data.unsigned.length > 0) {
        flash(`🔒 Chưa thể xuất: còn ${data.unsigned.length} phòng chưa Ký & Khóa (${data.unsigned.join(', ')}).`);
        return;
      }
      const aoa = data.aoa as (string | number)[][];
      const cols = data.cols as { wch: number }[];

      if (fsSupported()) {
        const w = await writeToTarget(aoa, cols);
        if (w === false) {
          flash('⚠️ Thiếu quyền ghi file. Hãy chọn lại file đích.');
          return;
        }
        if (w && 'unsafe' in w) {
          flash(`🛑 File đích "${w.fileName}" đang có ${w.sheets.length} sheet — dừng để bảo vệ dữ liệu.`);
          return;
        }
        if (w) {
          flash(`📊 Đã ghi ${data.count} CBNV vào "${w.name}" — sheet "${w.sheet}".`);
          return;
        }
      }
      // Chưa liên kết / không hỗ trợ -> tải về
      await downloadXlsx(aoa, cols, `T${pad(month)}-${year}`, `Bang_cong_NSCL_T${pad(month)}_${year}.xlsx`);
      flash(`📊 Đã tải file bảng công tháng ${pad(month)}/${year} (${data.count} CBNV).`);
    } catch (e) {
      flash('❌ Lỗi xuất Excel: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {supported && (
        <button className="btn-undo" onClick={() => setPickOpen(true)} title="Chọn file Excel đích trên ổ cứng (Chrome/Edge)">
          {linked ? `📁 ${linked.name} ▸ ${linked.sheet}` : '📁 Chọn file đích'}
        </button>
      )}
      <button className="btn-undo" disabled={busy} onClick={doExport}>
        📊 Xuất Excel
      </button>
      {msg && <span className="muted" style={{ fontSize: 13 }}>{msg}</span>}

      {pickOpen && (
        <div className="cc-dlg-overlay" onClick={() => setPickOpen(false)}>
          <div className="cc-dlg" style={{ textAlign: 'left', maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>📁 Chọn file Excel đích</h3>
            <p style={{ fontSize: 13, color: 'var(--err)' }}>
              🛑 Chọn một file <b>RIÊNG chỉ chứa bảng công</b> (vd <b>bang_cong.xlsx</b>). <b>Không chọn file lương / file nhiều sheet</b> — mỗi lần xuất app ghi đè toàn bộ file đích.
            </p>
            <label className="ls-flabel">Tên sheet trong file đó</label>
            <input className="field" value={sheet} onChange={(e) => setSheet(e.target.value.slice(0, 31))} />
            <p className="muted" style={{ fontSize: 12.5 }}>
              Dùng tên này khi liên kết từ file lương (Power Query: Data → Get Data → From File → From Excel Workbook → chọn file này → mỗi tháng chỉ bấm Refresh).
            </p>
            <div className="cc-dlg-btns">
              <button className="btn" onClick={confirmPick}>
                Tiếp tục
              </button>
              <button className="btn cc-btn-ghost" onClick={() => setPickOpen(false)}>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
