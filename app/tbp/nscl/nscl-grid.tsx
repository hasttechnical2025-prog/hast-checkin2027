'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { NsclData, NsclRow, NsclCell } from '@/lib/nscl';
import ExportExcel from './export-excel';
import { Icon } from '@/app/_components/icons';

const pad = (n: number) => String(n).padStart(2, '0');

function escHtml(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function normScore(raw: string): string {
  const v = (raw || '').trim();
  if (v === '') return '';
  const up = v.toUpperCase();
  if (/[pP]/.test(v)) return 'P';
  if (/[oôOÔ]/.test(v)) return 'Ô';
  if (/[nN]/.test(v)) return 'N';
  const digits = v.replace(/[^0-9]/g, '');
  if (!digits) return '';
  let n = parseInt(digits, 10);
  if (isNaN(n) || n < 1) return '';
  if (n > 15) n = 15;
  return String(n);
}

function valClassOf(val: string, cls: string): string {
  if (cls === '' && val !== '' && val !== '10') {
    return val === 'P' ? 'nv-p' : val === 'Ô' ? 'nv-om' : val === 'N' ? 'nv-n' : 'nv-low';
  }
  return '';
}

function computeTotals(cells: NsclCell[], adjust: string) {
  let diem = 0;
  let phep = 0;
  let om = 0;
  for (const c of cells) {
    const v = c.val;
    if (v === 'P') phep += 1;
    else if (v === 'Ô') om += 1;
    else if (v === 'N') {
      /* lễ */
    } else {
      const n = parseFloat(v);
      if (!isNaN(n)) {
        diem += n;
        if (n === 5) phep += 0.5;
      }
    }
  }
  const adjNum = parseFloat(adjust);
  return { rowDiem: diem + (isNaN(adjNum) ? 0 : adjNum), sumPhep: phep, sumOm: om };
}

export default function NsclGrid({
  data,
  isAdmin,
  seeAll,
  ownDept,
  dept,
}: {
  data: NsclData;
  isAdmin: boolean;
  seeAll: boolean;
  ownDept: string | null;
  dept: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<NsclRow[]>(() => data.rows.map((r) => ({ ...r, cells: r.cells.map((c) => ({ ...c })) })));
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmLock, setConfirmLock] = useState<null | 'lock' | 'unlock'>(null);

  const monthStr = `${data.year}-${pad(data.month)}`;
  const date01 = `${monthStr}-01`;
  const todayVN = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

  const shown = dept ? rows.filter((r) => r.dept === dept) : rows;
  const totals = useMemo(() => {
    let d = 0;
    let p = 0;
    let o = 0;
    shown.forEach((r) => {
      d += r.rowDiem;
      p += r.sumPhep;
      o += r.sumOm;
    });
    return { d, p, o };
  }, [shown]);

  // Phòng cần khóa: TBP = phòng mình; admin/view_all = phòng đang lọc.
  // Phòng mục tiêu Ký & Khóa: admin = phòng đang lọc; TBP (gồm view_all) = phòng mình.
  const lockDept = isAdmin ? dept : ownDept;
  // view_all chỉ được Ký & Khóa khi đang xem đúng phòng mình (không lọc sang phòng khác).
  const canLock = isAdmin || !seeAll || dept === ownDept;
  const shownDepts = [...new Set(shown.map((r) => r.dept))];
  const allLocked = shownDepts.length > 0 && shownDepts.every((d) => data.locks[d]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  function updateCell(empId: number, idx: number, raw: string) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.employeeId !== empId) return row;
        const cells = row.cells.map((c, i) => (i === idx ? { ...c, val: raw, valClass: valClassOf(raw, c.cls) } : c));
        const t = computeTotals(cells, row.adjust);
        return { ...row, cells, ...t };
      }),
    );
  }

  function updateAdjust(empId: number, raw: string) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.employeeId !== empId) return row;
        const t = computeTotals(row.cells, raw);
        return { ...row, adjust: raw, ...t };
      }),
    );
  }

  async function saveScore(empId: number, idx: number, ymd: string, raw: string) {
    const val = normScore(raw);
    updateCell(empId, idx, val);
    try {
      await fetch('/api/tbp/nscl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores: [{ employeeId: empId, date: ymd, value: val }] }),
      });
    } catch {
      flash('Lỗi lưu, thử lại.');
    }
  }

  async function saveAdjust(empId: number, raw: string) {
    const v = raw.replace(/[^0-9]/g, '');
    const val = v && Number(v) >= 1 && Number(v) <= 15 ? String(Number(v)) : '';
    updateAdjust(empId, val);
    try {
      await fetch('/api/tbp/nscl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjusts: [{ employeeId: empId, date01, value: val }] }),
      });
    } catch {
      flash('Lỗi lưu, thử lại.');
    }
  }

  async function fill10() {
    const updates: { employeeId: number; date: string; value: string }[] = [];
    setRows((prev) =>
      prev.map((row) => {
        if (dept && row.dept !== dept) return row;
        const cells = row.cells.map((c) => {
          if (c.editable && c.val === '' && c.ymd <= todayVN) {
            updates.push({ employeeId: row.employeeId, date: c.ymd, value: '10' });
            return { ...c, val: '10', valClass: '' };
          }
          return c;
        });
        const t = computeTotals(cells, row.adjust);
        return { ...row, cells, ...t };
      }),
    );
    if (updates.length === 0) {
      flash('Không có ô trống để điền.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/tbp/nscl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores: updates }),
      });
      const j = await res.json();
      flash(`Đã điền ${j.saved ?? updates.length} điểm 10${j.skipped ? ` (bỏ qua ${j.skipped})` : ''}.`);
    } catch {
      flash('Lỗi điền điểm.');
    } finally {
      setBusy(false);
    }
  }

  async function doLock(action: 'lock' | 'unlock') {
    if (!lockDept) {
      flash('Chọn một phòng để Ký & Khóa.');
      return;
    }
    setBusy(true);
    // Timeout để KHÔNG kẹt "Đang xử lý…" mãi nếu mạng/hàm chậm (cold-start).
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch('/api/tbp/nscl-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, department: lockDept, thang: data.month, nam: data.year }),
        signal: ctrl.signal,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.error) {
        flash(j?.error || (action === 'unlock' ? 'Mở khóa thất bại — thử lại.' : 'Ký & Khóa thất bại — thử lại.'));
      } else {
        flash(action === 'unlock' ? 'Đã mở khóa.' : 'Đã ký & khóa.');
        router.refresh();
      }
    } catch (e) {
      flash((e as Error)?.name === 'AbortError' ? 'Quá thời gian chờ — thử lại.' : 'Lỗi mạng — thử lại.');
    } finally {
      clearTimeout(timer);
      setBusy(false); // LUÔN tắt busy (trước đây chỉ tắt trong catch -> thành công bị kẹt spinner)
      setConfirmLock(null); // đóng hộp xác nhận dù xong hay lỗi
    }
  }

  function printReport() {
    if (!allLocked) {
      flash('Chưa thể in: hãy "Ký & Khóa" bảng điểm trước.');
      return;
    }
    const cfg = data.printCfg;
    const daysInMonth = data.days.length;
    const deptName = (dept || (!seeAll && ownDept ? ownDept : 'Toàn Công Ty')).toUpperCase();
    const origin = window.location.origin + '/';
    const lhUrl = origin + 'letterhead.png';

    const tbp = shown.find((r) => (r.role || '').toUpperCase() === 'TBP');
    const lock = lockDept ? data.locks[lockDept] : undefined;
    const signerName = lock?.nguoiKy || (tbp ? tbp.name : '');
    const eSignLabel = lock ? '(Đã ký & khóa)' : '(Đã ký điện tử)';
    const slug = signerName
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/\s+/g, '_');
    const signImgUrl = slug ? `${origin}chuky/${slug}.png` : '';
    const today = new Date();
    const dateLine = `Hà Nội, ngày ${pad(today.getDate())} tháng ${pad(today.getMonth() + 1)} năm ${today.getFullYear()}`;
    const signTime = lock?.thoiGianKy
      ? new Date(lock.thoiGianKy).toLocaleString('vi-VN')
      : `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()} ${pad(today.getHours())}:${pad(today.getMinutes())}`;

    let colgroup = '<col class="c-tt"><col class="c-name">';
    for (let i = 0; i < daysInMonth; i++) colgroup += '<col class="c-day">';
    colgroup += '<col class="c-pm"><col class="c-diem"><col class="c-sum"><col class="c-sum"><col class="c-sum"><col class="c-sum"><col class="c-sm"><col class="c-sm"><col class="c-sm"><col class="c-sm"><col class="c-sm">';

    let dayHeads = '';
    data.days.forEach((dy) => (dayHeads += `<th class="${dy.cls}">${pad(dy.d)}</th>`));

    let body = '';
    let totD = 0;
    let totP = 0;
    let totO = 0;
    shown.forEach((row, i) => {
      let dayCells = '';
      row.cells.forEach((c) => (dayCells += `<td class="${c.cls}">${escHtml(c.val)}</td>`));
      totD += row.rowDiem;
      totP += row.sumPhep;
      totO += row.sumOm;
      body +=
        '<tr>' +
        `<td class="c-tt">${i + 1}</td>` +
        `<td class="c-name">${escHtml(row.name)}</td>` +
        dayCells +
        `<td>${row.adjust || '-'}</td>` +
        `<td class="c-diem">${row.rowDiem || '-'}</td>` +
        '<td>-</td>' +
        `<td>${row.sumPhep || '-'}</td>` +
        '<td>-</td>' +
        `<td>${row.sumOm || '-'}</td>` +
        '<td>-</td><td>-</td><td>-</td><td>-</td><td>-</td>' +
        '</tr>';
    });
    const congRow =
      '<tr class="cong">' +
      '<td colspan="2" style="text-align:right;padding-right:4px;">CỘNG</td>' +
      `<td colspan="${daysInMonth + 1}"></td>` +
      `<td class="c-diem">${totD || '-'}</td>` +
      '<td>-</td>' +
      `<td>${totP || '-'}</td>` +
      '<td>-</td>' +
      `<td>${totO || '-'}</td>` +
      '<td>-</td><td>-</td><td>-</td><td>-</td><td>-</td>' +
      '</tr>';

    const html = `<html><head><meta charset="UTF-8"><title>Bảng điểm NSCL ${pad(data.month)}/${data.year}</title><style>
      * { box-sizing:border-box; }
      body { font-family:'Times New Roman',Times,serif; color:#000; margin:0; padding:6mm 8mm; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .lh { width:100%; margin-bottom:4px; } .lh-img { display:block; width:100%; height:auto; object-fit:contain; }
      .lh-fallback { display:none; font-weight:bold; font-size:15px; color:#c0392b; border-bottom:2px solid #c0392b; padding-bottom:6px; }
      .sub { display:flex; justify-content:space-between; align-items:center; margin-top:7px; }
      .phong { font-weight:bold; font-size:12px; text-transform:uppercase; }
      .bm { border:1px solid #000; padding:2px 10px; font-size:11px; font-weight:bold; white-space:nowrap; }
      .title { text-align:center; margin:8px 0 6px; } .title h2 { font-size:14px; font-weight:bold; text-transform:uppercase; margin:0; }
      table.nscl { width:100%; border-collapse:collapse; table-layout:fixed; border:1.4px solid #000; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      table.nscl th, table.nscl td { border-right:1px solid #000; border-bottom:1px dashed #9a9a9a; text-align:center; vertical-align:middle; font-size:${cfg.fontData}px; padding:3px 2px; overflow:hidden; white-space:nowrap; height:${cfg.rowHeight}px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      table.nscl thead th { background:#e9e9e9; font-weight:bold; border-bottom:1.4px solid #000; }
      table.nscl td { background:#fff; } table.nscl td.c-name { text-align:left; padding-left:6px; font-size:${cfg.fontName}px; }
      table.nscl th.c-tt, table.nscl th.c-name { font-size:${cfg.fontName}px; } td.c-diem { font-weight:bold; font-size:${cfg.fontName}px; }
      .vtxt { writing-mode:vertical-rl; transform:rotate(180deg); white-space:nowrap; display:inline-block; line-height:1; font-size:9px; }
      col.c-tt { width:26px; } col.c-name { width:132px; } col.c-pm { width:24px; } col.c-diem { width:42px; } col.c-sum { width:24px; } col.c-sm { width:20px; }
      table.nscl thead th.t7, table.nscl td.t7 { background:${cfg.colorSat}; color:#000; }
      table.nscl thead th.cn, table.nscl td.cn { background:${cfg.colorSun}; color:#000; }
      table.nscl thead th.le, table.nscl td.le { background:${cfg.colorHoliday}; color:#000; }
      tr.cong td { font-weight:bold; background:#e9e9e9; border-top:1.4px solid #000; border-bottom:1px solid #000; }
      .note-box { border:1px solid #000; min-height:64px; margin-top:10px; padding:6px 8px; } .note-box .note-label { font-weight:bold; font-size:11px; }
      .footer { display:flex; justify-content:space-between; margin-top:14px; padding:0 6%; } .fbox { text-align:center; width:40%; }
      .fbox .role { font-weight:bold; font-size:13px; } .fbox .date { font-style:italic; font-size:12px; margin-bottom:2px; } .fbox .gap { height:56px; }
      .fbox .signer { font-weight:bold; font-style:italic; font-size:13px; } .fbox .esign { font-size:11px; color:#137333; font-weight:bold; margin-top:2px; }
      .fbox .sign-img { max-height:46px; max-width:80%; object-fit:contain; display:block; margin:2px auto 0; } .fbox .esign-time { font-size:10px; font-style:italic; color:#555; margin-top:1px; }
      @page { size: A4 landscape; margin: 7mm; } @media print { body { padding:0; } }
      </style></head><body>
      <div class="lh"><img src="${lhUrl}" class="lh-img" onerror="this.style.display='none';this.nextElementSibling.style.display='block';"><div class="lh-fallback">CÔNG TY CP SIÊU THANH HÀ NỘI</div></div>
      <div class="sub"><div class="phong">PHÒNG: ${escHtml(deptName)}</div><div class="bm">BM11-HCNS.01</div></div>
      <div class="title"><h2>BẢNG CHẤM CÔNG &amp; CHẤM ĐIỂM NSCL THÁNG ${pad(data.month)} NĂM ${data.year}</h2></div>
      <table class="nscl"><colgroup>${colgroup}</colgroup>
      <thead><tr><th class="c-tt" rowspan="2">TT</th><th class="c-name" rowspan="2">Họ tên</th><th colspan="${daysInMonth}">Ngày/tháng</th><th rowspan="2"><span class="vtxt">Điểm +/-</span></th><th colspan="10">TỔNG HỢP CÔNG ĐIỂM/THÁNG</th></tr>
      <tr>${dayHeads}<th>Điểm</th><th><span class="vtxt">Trực</span></th><th><span class="vtxt">Phép</span></th><th><span class="vtxt">CĐ</span></th><th><span class="vtxt">Ốm</span></th><th>B</th><th>C</th><th>D</th><th>E</th><th>Y</th></tr></thead>
      <tbody>${body}${congRow}</tbody></table>
      <div class="note-box"><div class="note-label">Ghi chú:</div></div>
      <div class="footer"><div class="fbox"><div class="role">PHÒNG KT-HC</div><div class="gap"></div></div>
      <div class="fbox"><div class="date">${dateLine}</div><div class="role">NGƯỜI LẬP</div><div class="esign">${eSignLabel}</div>${signImgUrl ? `<img src="${signImgUrl}" class="sign-img" onerror="this.style.display='none'">` : ''}<div class="signer">${escHtml(signerName)}</div><div class="esign-time">Ký lúc: ${signTime}</div></div></div>
      </body></html>`;

    let iframe = document.getElementById('nscl-print-iframe') as HTMLIFrameElement | null;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'nscl-print-iframe';
      iframe.style.position = 'absolute';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
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
    }, 150);
  }

  const lockInfo = lockDept ? data.locks[lockDept] : undefined;

  return (
    <>
      <div className="tbp-bar">
        <button className="btn-undo" disabled={busy} onClick={fill10}>
          <Icon name="bolt" size={15} /> Điền nhanh 10
        </button>
        {canLock &&
          (lockDept && lockInfo ? (
            isAdmin ? (
              <button className="btn-reject" disabled={busy} onClick={() => setConfirmLock('unlock')}>
                <Icon name="lockOpen" size={15} /> Mở khóa
              </button>
            ) : (
              <span className="badge badge-ok"><Icon name="lock" size={13} /> Đã khóa</span>
            )
          ) : (
            <button
              className="btn-approve"
              disabled={busy}
              onClick={() => {
                if (!lockDept) {
                  flash('Chọn một phòng để Ký & Khóa.');
                  return;
                }
                setConfirmLock('lock');
              }}
            >
              <Icon name="lock" size={15} /> Ký &amp; Khóa
            </button>
          ))}
        <button className="btn-undo nscl-pc-only" onClick={printReport}>
          <Icon name="printer" size={15} /> In
        </button>
        {seeAll && (
          <span className="nscl-pc-only" style={{ display: 'contents' }}>
            <ExportExcel year={data.year} month={data.month} />
          </span>
        )}
        {toast && <span className="muted">{toast}</span>}
      </div>

      {lockInfo && (
        <div className="muted" style={{ color: 'var(--ok)', marginBottom: 8 }}>
          <Icon name="lock" size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
          {lockDept} đã ký &amp; khóa bởi {lockInfo.nguoiKy}
          {lockInfo.thoiGianKy ? ' lúc ' + new Date(lockInfo.thoiGianKy).toLocaleString('vi-VN') : ''}
          {isAdmin ? ' — Admin có thể Mở khóa để chấm lại.' : ''}
        </div>
      )}

      <div className="nscl-hint">
        <Icon name="info" size={15} />
        Bảng điểm rộng — vuốt ngang để xem/sửa. Nên dùng máy tính để thao tác nhanh (In &amp; Xuất Excel chỉ có trên PC).
      </div>

      <div className="nscl-scroll">
        {shown.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: 20 }}>
            Không có CBNV.
          </p>
        ) : (
          <table className="nscl-grid">
            <thead>
              <tr>
                <th className="s-tt" rowSpan={2}>
                  TT
                </th>
                <th className="s-name" rowSpan={2}>
                  Họ tên
                </th>
                <th colSpan={data.days.length}>Ngày/tháng</th>
                <th rowSpan={2} className="vth">
                  Điểm +/-
                </th>
                <th colSpan={10}>Tổng hợp</th>
              </tr>
              <tr>
                {data.days.map((dy) => (
                  <th key={dy.d} className={dy.cls}>
                    {pad(dy.d)}
                  </th>
                ))}
                <th>Điểm</th>
                <th>Trực</th>
                <th>Phép</th>
                <th>CĐ</th>
                <th>Ốm</th>
                <th>B</th>
                <th>C</th>
                <th>D</th>
                <th>E</th>
                <th>Y</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row, ri) => (
                <tr key={row.employeeId}>
                  <td className="s-tt">{ri + 1}</td>
                  <td className="s-name">
                    {row.name}
                    {(row.role || '').toUpperCase() === 'TBP' && <span className="nscl-tbp"> TBP</span>}
                  </td>
                  {row.cells.map((c, ci) => (
                    <td key={c.d} className={`${c.cls} ${c.valClass} ${c.block ? 'nv-block' : ''}`} title={c.block ? `Chưa chấm được: có công B/D và ${c.blockReason}` : ''}>
                      {c.editable ? (
                        <input
                          className="nscl-cell"
                          size={1}
                          value={c.val}
                          onChange={(e) => updateCell(row.employeeId, ci, e.target.value)}
                          onBlur={(e) => saveScore(row.employeeId, ci, c.ymd, e.target.value)}
                          onFocus={(e) => e.target.select()}
                        />
                      ) : (
                        <span className="nscl-ro">{c.val}</span>
                      )}
                    </td>
                  ))}
                  <td>
                    {row.canEdit ? (
                      <input
                        className="nscl-cell"
                        size={1}
                        value={row.adjust}
                        onChange={(e) => updateAdjust(row.employeeId, e.target.value)}
                        onBlur={(e) => saveAdjust(row.employeeId, e.target.value)}
                        onFocus={(e) => e.target.select()}
                      />
                    ) : (
                      <span className="nscl-ro">{row.adjust}</span>
                    )}
                  </td>
                  {/* Tổng hợp: Điểm | Trực | Phép | Ô | Ốm | B | C | D | E | Y.
                      TODO: confirm with DK — Trực/Ô/B/C/D/E/Y chưa có công thức (hiển thị "-"). */}
                  <td className="nscl-sum">{row.rowDiem || '-'}</td>
                  <td>-</td>
                  <td>{row.sumPhep || '-'}</td>
                  <td>-</td>
                  <td>{row.sumOm || '-'}</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                </tr>
              ))}
              <tr className="nscl-cong">
                <td colSpan={2} style={{ textAlign: 'right' }}>
                  CỘNG
                </td>
                <td colSpan={data.days.length + 1}></td>
                <td className="nscl-sum">{totals.d || '-'}</td>
                <td>-</td>
                <td>{totals.p || '-'}</td>
                <td>-</td>
                <td>{totals.o || '-'}</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <p className="muted" style={{ marginTop: 8 }}>
        Ô sọc đỏ = có công B/D nhưng giải trình chưa Đồng ý (khóa chấm). P=phép, Ô=ốm, N=nghỉ lễ, 5=nửa ngày phép.
      </p>

      {confirmLock && (
        <div className="cc-dlg-overlay" onClick={() => !busy && setConfirmLock(null)}>
          <div className="cc-dlg" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              <Icon name={confirmLock === 'lock' ? 'lock' : 'lockOpen'} size={18} />
              {confirmLock === 'lock' ? 'Ký & Khóa bảng điểm' : 'Mở khóa bảng điểm'}
            </h3>
            <p className="muted">
              {confirmLock === 'lock' ? (
                <>
                  Ký &amp; khóa bảng điểm phòng <b>{lockDept}</b> tháng{' '}
                  <b>
                    {data.month}/{data.year}
                  </b>
                  ? Sau khi khóa sẽ không sửa được điểm (chỉ Admin mới mở lại được).
                </>
              ) : (
                <>
                  Mở khóa bảng điểm phòng <b>{lockDept}</b> tháng{' '}
                  <b>
                    {data.month}/{data.year}
                  </b>{' '}
                  để chấm lại?
                </>
              )}
            </p>
            <div className="cc-dlg-btns">
              <button className="btn" disabled={busy} onClick={() => doLock(confirmLock)}>
                {busy ? 'Đang xử lý…' : confirmLock === 'lock' ? 'Ký & Khóa' : 'Mở khóa'}
              </button>
              <button className="btn cc-btn-ghost" disabled={busy} onClick={() => setConfirmLock(null)}>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
