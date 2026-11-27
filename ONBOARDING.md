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
├── layout.tsx               root layout
├── page.tsx                 "/"  — đăng nhập CBNV (Mã NV + PIN) [NvLogin]
├── globals.css              TOÀN BỘ css (design tokens :root, chỉ Light mode)
├── login/                   đăng nhập TBP/Admin (Supabase Auth)
│   ├── page.tsx             vỏ trang (logo + tiêu đề)
│   └── login-form.tsx       form + checkbox "Ghi nhớ đăng nhập" (mắt hiện/ẩn mật khẩu)
├── auth/signout/route.ts    đăng xuất (POST)
├── c/[token]/               CBNV: page.tsx, cham-cong.tsx, device-block.tsx, loading.tsx,
│                            lich-su/ (dữ liệu tháng + giải trình), pwa-client.tsx,
│                            manifest.webmanifest/ (PWA động theo token)
├── tbp/                     TBP — 2 tab THEO ROUTE (/tbp ↔ /tbp/nscl), không phải tab client
│   ├── layout.tsx           khung chung: identity + tab + thanh tháng (trong StickyTop) + RememberGuard
│   ├── StickyTop.tsx        bọc khối đầu trang thành sticky; đo chiều cao → biến CSS --tbp-stick
│   ├── tbp-header.tsx       tab (Link giữ ?m) + thanh tháng (spinner khi tải: useLinkStatus)
│   ├── page.tsx + tbp-giaitrinh.tsx   Duyệt giải trình
│   ├── loading.tsx          khung chờ khi đổi tab
│   └── nscl/                page.tsx, nscl-grid.tsx, export-excel.tsx, loading.tsx
├── admin/                   layout.tsx (admin-sidebar gom 3 nhóm + link /tbp) + các mục:
│   │                        nhan-vien, bang-cong, log, thiet-bi, ngay-le, ca, cau-hinh,
│   │                        tai-khoan, huong-dan; mỗi mục page.tsx(server) + *-admin.tsx(client)
│   ├── _components/          AdminTabs (sub-tab theo route: DATA=[Bảng công|Log], CONFIG=[Chung|Ca|Lễ]) · pc-hint
│   ├── bang-cong/            Bảng công tháng (ma trận NV×ngày, bấm ô sửa công inline) — thay "sua-cong" cũ
│   └── loading.tsx
├── api/                     Route Handlers — ĐƯỜNG GHI (service role)
│   ├── checkin/             chấm công (đường ghi CBNV duy nhất)
│   ├── nv-login/            xác thực Mã NV + PIN
│   ├── justification/       gửi giải trình
│   ├── tbp/                 approve, nscl, nscl-lock, export-nscl, device
│   ├── admin/               employee, log, holiday, shift, config, account, guide, day
│   ├── cron/reminder/       bot nhắc nhở (Vercel Cron)
│   └── sync/nghi-phep/      webhook 1 chiều từ app "Sổ Công tác"
└── _components/             DateField, NvLogin, QrCode, SignOutButton, RememberGuard, icons.tsx

lib/                         config, attendance, auth (getStaffSession bọc React cache()),
                             device, telegram, nscl, giaitrinh, month, bangcong (ma trận Bảng công),
                             view-month (resolveViewMonth: tháng mặc định theo ngày ≤10),
                             export-nscl, fs-export, version, confirm, supabase/{server,admin,client}
supabase/migrations/         0001..0011 (danh mục, vận hành, index, trigger chấm điểm, auth/RLS, seed, grants, …)
middleware.ts                chặn /tbp + /admin theo vai
vercel.json                  2 cron nhắc nhở (sáng/chiều, T2–T6)
```

**Mỗi route HTML là vỏ mỏng**; logic GHI gom về `app/api/*` (service role, `lib/supabase/admin.ts`), ĐỌC qua Server Components.

### 4b. Đăng nhập & giao diện TBP (patterns cần biết)

- **"Ghi nhớ đăng nhập" (login-form + RememberGuard):** checkbox mặc định **bật**. Bật → lưu `cc_remember='1'` + `cc_email` vào `localStorage` (tự điền email lần sau); tắt → xoá email và **đăng xuất khi ĐÓNG trình duyệt**. Lý do: `@supabase/ssr` **ép cookie phiên 400 ngày** (không tạo được session-cookie). `RememberGuard` (mount ở layout TBP + admin) dùng **heartbeat `localStorage['cc_seen']`**: mỗi tab ghi mốc thời gian định kỳ (5s); khi tải trang mà `cc_remember='0'` và `cc_seen` quá cũ (>20s → không tab nào còn sống → trình duyệt đã đóng) thì `signOut()` + về `/login`. Dùng localStorage (chia sẻ tab) thay sessionStorage → **mở tab mới KHÔNG bị đăng xuất oan**.
- **Tab TBP là điều hướng route** (`/tbp` ↔ `/tbp/nscl`), **không** phải tab client. Nên KHÔNG dùng Radix Tabs. Tháng lưu ở `?m=YYYY-MM`: đổi tab giữ tháng, đổi tháng giữ tab (xem `tbp-header.tsx`). Mỗi route có `loading.tsx` → bấm tab là hiện khung chờ ngay (hết cảm giác treo).
- **Khối đầu trang TBP sticky:** `StickyTop` bọc identity + tab + tháng, đo chiều cao đặt `--tbp-stick`; hàng tiêu đề bảng giải trình (`.gt-table thead th`) dùng `top: var(--tbp-stick)` để bám ngay dưới. Bảng giải trình bỏ `overflow` ở khung (layout cố định) để thead bám được viewport.
- **getStaffSession bọc `cache()`** → layout + page gọi chung 1 lần/request.
- **Khu Admin:** sidebar gom **3 nhóm**; các trang cùng nhóm dùng **sub-tab theo route** (`AdminTabs`, giữ `?m`). Khuôn "dashboard": KPI cards (`.ac-kpis`), **chip pill** (`.badge` chỉ bo tròn trong scope `.tbp-page`/`.admin-content`), nút 3 cấp, menu "⋯" cho thao tác phụ. **Bảng công tháng** (`lib/bangcong.ts` dựng ma trận NV×ngày) thay "Sửa công ngày" — bấm ô → dialog gọi `/api/admin/day`. ⏳ **Giao diện admin đang chờ chủ dự án chốt hướng — đừng đại tu mà chưa hỏi.**
- **Tháng hiển thị mặc định (TBP/Admin):** `resolveViewMonth` (`lib/view-month.ts`) — mở màn chưa chọn `?m`: ngày **≤10 → tháng trước** (còn đang chốt tháng trước), **≥11 → tháng hiện tại**; ‹ › tới tối đa tháng hiện tại. Dùng **CHUNG** cho data (server page) + thanh tháng (`tbp-header` / prevHref-nextHref admin) để luôn khớp.

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
- **`@supabase/ssr` ép cookie phiên 400 ngày** → không tạo được "cookie phiên" để quên khi đóng trình duyệt; phần tắt "Ghi nhớ" dùng `RememberGuard` (xem §4b).
- **`useSearchParams` (client) phải bọc `<Suspense>`** nếu không `next build` sẽ lỗi — `tbp-header.tsx` được bọc trong layout TBP. `tsc` KHÔNG bắt lỗi này, chỉ lộ khi build.
- **thead sticky không bám viewport nếu khung bảng có `overflow`**: `overflow-x:auto` khiến `overflow-y` thành `auto` → tạo vùng cuộn riêng. Bảng giải trình (layout cố định) đã bỏ overflow; bảng admin/NSCL (cần cuộn ngang) thì thead chỉ sticky trong vùng cuộn của nó.
- **`--tbp-stick`** do `StickyTop` đo bằng JS (ResizeObserver); nếu sửa chiều cao khối đầu trang thì thead tự bám theo, không cần số cứng.

---

## 9. Quy ước đóng góp

- TypeScript, Next App Router; mọi `await` Supabase/fetch bọc `try/catch`; Telegram/Nominatim lỗi thì **bỏ qua, không chặn luồng chấm công**.
- Gom magic string trạng thái thành hằng (`'Chờ' | 'Đồng ý' | 'Từ chối'`, `'✓ Hợp lệ' | '✗ Ngoài phạm vi'`).
- Nghiệp vụ **không được đổi** — xem [CLAUDE.md](CLAUDE.md) §"Không được đổi".
