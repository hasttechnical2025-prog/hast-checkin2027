# CLAUDE.md — App Chấm Công HSTC 2027

Hướng dẫn cho Claude Code khi làm việc trong repo này (Next.js 15 + Vercel + Supabase mới).
Người mới xem [ONBOARDING.md](ONBOARDING.md); trạng thái + migration xem [README.md](README.md).

> Bản dựng lại 2027, chạy **song song, độc lập** app 2026 cũ (`D:\Claude Code\_github\hast_chamcong`). **Không migrate dữ liệu 2026.** Khi không chắc một quyết định nghiệp vụ: **giữ nguyên hành vi** và để `// TODO: confirm with DK`.

## Kiến trúc (tóm tắt)

- **1 app, 3 vai theo route:** CBNV `/c/[token]`, TBP `/tbp`, Admin `/admin/*`.
- **GHI** đi qua **Route Handlers** (`app/api/*`) dùng **service role** (`lib/supabase/admin.ts`, `server-only`). **ĐỌC** qua Server Components.
- **Định danh:** CBNV = token-path + PIN (xử lý ở server, client không gõ tên). TBP/Admin = Supabase Auth, phân vai qua `chamcong_app_roles` (`middleware.ts`).
- Cấu trúc thư mục chi tiết: xem ONBOARDING.md §4.

## Lệnh

```bash
npm run dev        # cổng 3100
npx tsc --noEmit   # kiểm kiểu (KHÔNG build khi đang dev)
```

> ⚠️ **Không `next build` khi đang `next dev`** — chung `.next` → hỏng CSS/500. Dừng dev trước khi build.

## Quy ước code

1. TypeScript; mỗi file một trách nhiệm; không biến toàn cục ngầm.
2. Mọi `await supabase/fetch` bọc `try/catch`. **Telegram & Nominatim lỗi → bỏ qua, KHÔNG chặn luồng chấm công.**
3. Gom magic string trạng thái thành hằng: `'Chờ' | 'Đồng ý' | 'Từ chối'`, `'✓ Hợp lệ' | '✗ Ngoài phạm vi'`.
4. CSS biến `:root` cho màu (`--accent` #2563eb, `--ok`, `--warn`, `--err`). Chỉ Light mode.
5. **TUYỆT ĐỐI không** đưa `service_role` key / Telegram token / secret vào file client hay `localStorage`. Secret chỉ ở `process.env` phía server (không tiền tố `NEXT_PUBLIC_`).
6. CORS GitHub Pages/webhook → Supabase phải kèm `Content-Type: application/json`.

## KHÔNG được đổi (nghiệp vụ)

- **Ngưỡng phân ca** hardcode trong trigger: Vào sáng **≤10:00** (sửa ở `0011`, trước là 9:00) · Ra sáng ≤12:45 · Vào chiều ≤15:00 · còn lại Ra chiều. **Smart-pick:** IN sớm nhất, OUT muộn nhất.
- **Luật chấm A/B/D** theo `chamcong_shift_config` (data-driven, Admin sửa). OUT chiều: có chấm = A/B, **không bao giờ D**.
- **GPS bắt buộc**; trong `radius` = hợp lệ; ngoài `radius` nhưng ≤ `max_distance` = vẫn ghi (cảnh báo); vượt `max_distance` = chặn; GPS hết hạn sau `gpsExpireMs`.
- **Chặn ngày nghỉ** (T7/CN + `chamcong_holidays`); **cảnh báo chấm trùng ca** (cần `confirm`).
- **Record ảo** `grades='D,D,D,D'` cho ngày làm việc đã qua chưa chấm (để hiển thị + giải trình).
- **Overlay nghỉ phép** (`chamcong_nghi_phep_dong_bo`): chỉ ĐỌC + overlay (cả ngày → P/Ô theo `leave_symbol_mode`, nửa buổi → 5). Webhook `/api/sync/nghi-phep` MỘT CHIỀU, khóa `ma_nv`.
- **4 sự kiện Telegram:** xác nhận chấm công (CBNV) · báo TBP có giải trình · báo CBNV kết quả duyệt (TBP) · bot nhắc nhở (cron).
- **Xuất Excel NSCL (#35):** giữ y cơ chế ghi đè **1 file đích cố định** qua File System Access (`lib/fs-export.ts`) — KHÔNG thay bằng "tải về" thường (sẽ ra `(1).xlsx` làm đứt link Power Query của file lương). App KHÔNG đụng file lương.

## Bảo mật & RLS

- **RLS deny-public:** không có policy INSERT/UPDATE/DELETE cho bảng nào — mọi GHI qua service role. SELECT chỉ cho TBP/Admin đã đăng nhập (theo phòng); CBNV đọc gián tiếp qua server.
- PIN băm bcrypt (pgcrypto, `search_path = public, extensions`); token thu hồi được.
- Chống chấm hộ: token-path + bind thiết bị (1 thiết bị active/người, Admin duyệt).

## Dữ liệu (prefix `chamcong_`)

`employees` (ma_nv ST001–ST999, token, pin_hash, loai_ca, telegram_chat_id) · `attendance_logs` (log thô) · `attendance_records` (ngày, grades CSV, approve_status, nscl_*) · `shift_config` (ngưỡng A/B/D) · `holidays` · `guide_content` · `system_config` (key/value) · `nscl_print_config` · `nscl_lock` · `device_bind` · `nghi_phep_dong_bo` · `app_roles`.

## Checklist trước go-live

- [ ] Đối chiếu ngưỡng `shift_config` (`0007_seed.sql`) với bảng LIVE hệ thống cũ.
- [ ] 6 biến môi trường trên Vercel (Prod + Preview); điền `telegram_chat_id` nhân viên.
- [ ] `public/letterhead.png` + `public/chuky/<ten_khong_dau>.png` cho mẫu in NSCL.
- [ ] Verify runtime toàn bộ TBP/Admin (cần đăng nhập) + CBNV trên thiết bị thật (token + GPS).
- [ ] Sửa app Sổ Công tác POST webhook `/api/sync/nghi-phep` + thêm `ma_nv`.
