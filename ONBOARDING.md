# ONBOARDING — App Chấm Công HSTC 2027

Chào mừng bạn vào dự án **Chấm Công Siêu Thanh Hà Nội (HSTC Group)** bản 2027.
Tài liệu này giúp bạn chạy được app trong máy, hiểu kiến trúc, và biết chỗ nào **không được đổi**.

> Bản 2027 là **bản dựng lại** (Next.js + Vercel + Supabase mới), chạy **song song, độc lập** với app 2026 cũ (`D:\Claude Code\_github\hast_chamcong`). **Không migrate dữ liệu 2026.**
> Xem thêm: [README.md](README.md) (trạng thái + cách chạy migration), [CLAUDE.md](CLAUDE.md) (quy ước code + nghiệp vụ bất biến).

---

## 1. App này là gì?

Ứng dụng chấm công nội bộ, **1 app Next.js — 3 vai theo route**:

| Vai | Route | Việc |
|---|---|---|
| **CBNV** | `/c/[token]` | Chấm công bằng GPS, xem dữ liệu tháng, gửi giải trình. Đăng nhập Mã NV + PIN ở `/`. |
| **TBP** (Trưởng bộ phận) | `/tbp` | Duyệt/từ chối giải trình, lưới điểm NSCL, Ký & Khóa, Xuất Excel — theo phòng. |
| **Admin** | `/admin/*` | Quản lý nhân viên/QR, log, ngày lễ, cấu hình ca, cấu hình hệ thống, tài khoản, duyệt thiết bị. |

- **Định danh CBNV** = token ngẫu nhiên trong path (`/c/<token>`), server tự đổi token → tên (client **không** gõ tên → chống chấm hộ).
- **TBP/Admin** = tài khoản **Supabase Auth** (cookie), phân vai qua bảng `chamcong_app_roles`.

---

## 2. Tech stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**, deploy **Vercel**.
- **Supabase** (Postgres + RLS + Trigger + RPC) — backend gói gọn trong Supabase, **không có server riêng**.
- `@supabase/ssr` + `@supabase/supabase-js`, `xlsx` (xuất Excel), `qrcode` (QR nhân viên).
- Thông báo **Telegram** (bot), nhắc nhở qua **Vercel Cron**.
- Reverse geocode: OpenStreetMap Nominatim (miễn phí, best-effort).
- UI/text tiếng Việt, chỉ **Light mode**, font Inter.

---

## 3. Chạy trong máy (local)

Yêu cầu: **Node 18+**, npm.

```bash
npm install
```

Tạo `.env.local` từ mẫu rồi điền key THẬT (xem [.env.example](.env.example) — **không commit** `.env.local`):

```bash
cp .env.example .env.local
```

6 biến môi trường:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (công khai, an toàn cho client)
- `SUPABASE_SERVICE_ROLE_KEY` (**bí mật, chỉ server** — bỏ qua RLS)
- `TELEGRAM_BOT_TOKEN`, `CRON_SECRET`, `SYNC_SECRET` (bí mật)

Chạy migration lên Supabase (lần đầu) — xem thứ tự `0001 → 0011` trong [README.md](README.md).

Chạy dev:

```bash
npm run dev
```

→ http://localhost:3100 (cổng 3100, vì 3000 có thể bị app 2026 chiếm). Có thể dùng `.claude/launch.json` (config `dev`).

> ⚠️ **KHÔNG chạy `next build` khi đang `next dev`** — chung thư mục `.next` → hỏng CSS / lỗi 500. Muốn kiểm kiểu thì dùng `npx tsc --noEmit`; muốn build thật thì **dừng dev trước**.

Tài khoản test: tạo nhân viên bằng RPC (xem cuối README). Lưu ý màn `/c/[token]` cần **token thật** + **quyền GPS trên điện thoại** mới chạy đủ — preview trên PC không có GPS.

---

## 4. Cấu trúc thư mục

```
app/
├── page.tsx                 "/"  — đăng nhập CBNV (Mã NV + PIN)
├── login/                   đăng nhập TBP/Admin (Supabase Auth)
├── c/[token]/               CBNV: cham-cong.tsx (màn chấm), lich-su/ (dữ liệu tháng + giải trình),
│                            manifest.webmanifest/ (PWA động theo token), pwa-client.tsx
├── tbp/                     Duyệt giải trình + NSCL (nscl/) + xuất Excel
├── admin/                   nhan-vien, log, ngay-le, ca, cau-hinh, tai-khoan, huong-dan, sua-cong, thiet-bi
├── api/                     Route Handlers — ĐƯỜNG GHI (service role)
│   ├── checkin/             chấm công (đường ghi CBNV duy nhất)
│   ├── nv-login/            xác thực Mã NV + PIN
│   ├── justification/       gửi giải trình
│   ├── tbp/                 approve, nscl, nscl-lock, export-nscl, device
│   ├── admin/               employee, log, holiday, shift, config, account, guide, day
│   ├── cron/reminder/       bot nhắc nhở (Vercel Cron)
│   └── sync/nghi-phep/      webhook 1 chiều từ app "Sổ Công tác"
├── _components/             DateField, NvLogin, QrCode, SignOutButton, icons.tsx
└── globals.css

lib/                         config, attendance, auth, device, telegram, nscl, giaitrinh, month,
                             export-nscl, fs-export, version, confirm, supabase/{server,admin,client}
supabase/migrations/         0001..0011 (danh mục, vận hành, index, trigger chấm điểm, auth/RLS, seed, grants, …)
middleware.ts                chặn /tbp + /admin theo vai
vercel.json                  2 cron nhắc nhở (sáng/chiều, T2–T6)
```

**Mỗi route HTML là vỏ mỏng**; logic GHI gom về `app/api/*` (service role, `lib/supabase/admin.ts`), ĐỌC qua Server Components.

---

## 5. Luồng nghiệp vụ chính

- **Chấm công** (`app/api/checkin`): giải token → chặn ngày nghỉ → tính khoảng cách (Haversine) → cảnh báo trùng ca → ghi log; **trigger** tổng hợp record ngày + chấm A/B/D. Geocode + Telegram chạy nền.
- **Phân ca (hardcode trong trigger, GIỮ NGUYÊN):** Vào sáng ≤10:00 · Ra sáng ≤12:45 · Vào chiều ≤15:00 · còn lại Ra chiều. **Smart-pick:** IN sớm nhất, OUT muộn nhất.
- **Chấm điểm A/B/D** đọc ngưỡng từ bảng `chamcong_shift_config` (Admin sửa, không cần deploy).
- **Chống chấm hộ:** token path + **bind thiết bị** (1 thiết bị active/người, Admin duyệt).
- **Giải trình + NSCL (TBP):** duyệt lẻ/hàng loạt, chặn ô B/D chưa duyệt, Ký & Khóa theo phòng, **Xuất Excel** ghi đè file đích (File System Access — xem `lib/fs-export.ts`).
- **Overlay nghỉ phép:** webhook `/api/sync/nghi-phep` nhận đơn đã duyệt từ app Sổ Công tác (khóa `ma_nv`), Chấm Công chỉ **đọc + overlay** (cả ngày → P/Ô, nửa buổi → 5).
- **4 sự kiện Telegram:** xác nhận chấm công · báo TBP có giải trình · báo CBNV kết quả duyệt · bot nhắc nhở (cron).

---

## 6. Bảo mật (bắt buộc nắm)

- `service_role` key + Telegram token + các secret **chỉ sống ở server** (`process.env`, không tiền tố `NEXT_PUBLIC_`). **Tuyệt đối không** đưa vào file client hay `localStorage`.
- **RLS deny-public:** không có policy INSERT/UPDATE/DELETE — mọi GHI đi qua Route Handler dùng service role. Anon chỉ được những gì policy SELECT cho phép; CBNV đọc gián tiếp qua server.
- PIN băm **bcrypt** (pgcrypto); token **thu hồi được**.

---

## 7. Deploy (Vercel)

- Khai đủ **6 biến môi trường** ở Settings → Environment Variables (Production + Preview).
- Cron nhắc nhở nằm ở `vercel.json` (chỉ chạy khi deploy trên Vercel).
- Trước go-live: **đối chiếu ngưỡng `shift_config`** trong `0007_seed.sql` với bảng LIVE của hệ thống cũ; thêm `public/letterhead.png` + `public/chuky/<ten_khong_dau>.png` cho mẫu in NSCL.

---

## 8. Bẫy hay gặp (gotchas)

- **Không `next build` khi đang `next dev`** (hỏng `.next`). Dùng `tsc --noEmit` để kiểm kiểu.
- Service Worker **không đăng ký được trong preview pane** (giới hạn môi trường) — verify PWA trên thiết bị thật; iOS A2HS không cần SW.
- `status` nhân viên trong dữ liệu cũ có nhiều biến thể; bản 2027 chuẩn hoá `'Đang làm việc' | 'Đã nghỉ việc'`.
- Manifest CBNV **động theo token**, `start_url`/`scope` = `/c/<token>` **không có "/" cuối** (nếu có sẽ không vào standalone).
- Màn CBNV `/c/[token]` **khoá cứng** `height: 100dvh` + `overflow: hidden` (không cuộn, không xê dịch) — khi thêm nội dung phải cân lại để không bị cắt ở đáy trên máy nhỏ.
- RPC dùng `crypt/gen_salt` phải `SET search_path = public, extensions` (pgcrypto ở schema `extensions`).

---

## 9. Quy ước đóng góp

- TypeScript, Next App Router; mọi `await` Supabase/fetch bọc `try/catch`; Telegram/Nominatim lỗi thì **bỏ qua, không chặn luồng chấm công**.
- Gom magic string trạng thái thành hằng (`'Chờ' | 'Đồng ý' | 'Từ chối'`, `'✓ Hợp lệ' | '✗ Ngoài phạm vi'`).
- Nghiệp vụ **không được đổi** — xem [CLAUDE.md](CLAUDE.md) §"Không được đổi".
