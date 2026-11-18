// Ghi thẳng vào 1 file Excel cố định trên ổ cứng (File System Access API).
// GIỮ Y NGUYÊN cơ chế app cũ: handle lưu trong IndexedDB của CHÍNH máy đó; mỗi máy
// liên kết file 1 lần; máy không hỗ trợ -> tải về. Chỉ Chrome/Edge PC hỗ trợ.
// xlsx nạp động (dynamic import) để không phình bundle.

/* eslint-disable @typescript-eslint/no-explicit-any */
type FileHandle = any;

declare global {
  interface Window {
    showSaveFilePicker?: (opts?: any) => Promise<FileHandle>;
  }
}

const EXP_DB = 'hstc_export_fs';
const EXP_STORE = 'handles';
const EXP_KEY = 'nscl_target';
const SHEET_KEY = 'hstc_export_sheet';

export function fsSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
}

export function expSheetName(): string {
  try {
    return localStorage.getItem(SHEET_KEY) || 'BangCong';
  } catch {
    return 'BangCong';
  }
}

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(EXP_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(EXP_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbSet(val: FileHandle): Promise<void> {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction(EXP_STORE, 'readwrite');
    tx.objectStore(EXP_STORE).put(val, EXP_KEY);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
async function idbGet(): Promise<FileHandle | null> {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction(EXP_STORE, 'readonly');
    const r = tx.objectStore(EXP_STORE).get(EXP_KEY);
    r.onsuccess = () => res(r.result || null);
    r.onerror = () => rej(r.error);
  });
}

async function ensurePerm(handle: FileHandle): Promise<boolean> {
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  return (await handle.requestPermission(opts)) === 'granted';
}

// An toàn ghi đè = file rỗng hoặc đúng 1 sheet do app tạo.
async function isSafeTarget(handle: FileHandle, sheetName: string): Promise<{ safe: boolean; sheets: string[] }> {
  try {
    const f = await handle.getFile();
    if (!f || f.size === 0) return { safe: true, sheets: [] };
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', bookSheets: true });
    const names: string[] = wb.SheetNames || [];
    if (names.length === 0) return { safe: true, sheets: names };
    if (names.length === 1 && names[0] === sheetName) return { safe: true, sheets: names };
    return { safe: false, sheets: names };
  } catch {
    return { safe: true, sheets: [] };
  }
}

export interface LinkedInfo {
  name: string;
  sheet: string;
}

export async function getLinkedInfo(): Promise<LinkedInfo | null> {
  if (!fsSupported()) return null;
  try {
    const h = await idbGet();
    if (h) return { name: h.name, sheet: expSheetName() };
  } catch {
    /* chưa liên kết */
  }
  return null;
}

// Chọn/tạo file đích (gọi ngay trong user-gesture). Trả về {name,sheet} | null (hủy) | {unsafe,sheets}.
export async function pickTarget(
  sheetName: string,
): Promise<{ name: string; sheet: string } | { unsafe: true; fileName: string; sheets: string[] } | null> {
  const sheet = (sheetName || 'BangCong').slice(0, 31);
  let handle: FileHandle;
  try {
    handle = await window.showSaveFilePicker!({
      suggestedName: 'bang_cong.xlsx',
      types: [
        {
          description: 'Excel Workbook',
          accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
        },
      ],
    });
  } catch (e: any) {
    if (e && e.name === 'AbortError') return null;
    throw e;
  }
  if (!(await ensurePerm(handle))) return null;
  const chk = await isSafeTarget(handle, sheet);
  if (!chk.safe) return { unsafe: true, fileName: handle.name, sheets: chk.sheets };
  await idbSet(handle);
  try {
    localStorage.setItem(SHEET_KEY, sheet);
  } catch {
    /* ignore */
  }
  return { name: handle.name, sheet };
}

// Ghi aoa vào file đã liên kết (ghi MỚI hoàn toàn, giữ đúng 1 sheet).
// null = chưa liên kết (nơi gọi tự fallback tải về); false = lỗi/thiếu quyền (đã báo); {name,sheet} = OK.
export async function writeToTarget(
  aoa: (string | number)[][],
  cols: { wch: number }[],
): Promise<{ name: string; sheet: string } | false | null | { unsafe: true; fileName: string; sheets: string[] }> {
  let handle: FileHandle | null = null;
  try {
    handle = await idbGet();
  } catch {
    /* bỏ qua */
  }
  if (!handle) return null;
  if (!(await ensurePerm(handle))) return false;

  const sheetName = expSheetName();
  const chk = await isSafeTarget(handle, sheetName);
  if (!chk.safe) return { unsafe: true, fileName: handle.name, sheets: chk.sheets };

  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = cols;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const writable = await handle.createWritable();
  await writable.write(out);
  await writable.close();
  return { name: handle.name, sheet: sheetName };
}

// Tải file về (fallback khi máy chưa liên kết / không hỗ trợ File System Access).
export async function downloadXlsx(
  aoa: (string | number)[][],
  cols: { wch: number }[],
  sheetName: string,
  fileName: string,
): Promise<void> {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = cols;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}
