# App Chấm Công HSTC — 2027

Bản dựng lại (Next.js + Vercel + Supabase mới) của app Chấm Công Siêu Thanh Hà Nội.
Chạy **song song, độc lập** với app 2026 cũ (`D:\Claude Code\_github\hast_chamcong`) — không migrate dữ liệu 2026.

- Tài liệu phương án: artifact **Phương Án Final 2027** (`U465vUT6dhjTCRN6DPXrV4`).
- Kiến trúc: 1 app Next.js, 3 vai theo route — CBNV `/c/[token]`, TBP `/tbp`, Admin `/admin/*`.
- Ghi qua Route Handlers (service role chỉ ở server); đọc qua Server Components + cache.

## Trạng thái

> Toàn bộ 7 bước **đã code xong** (code-complete). Việc còn lại là **vận hành/go-live**:
> chạy migration lên Supabase thật, đối chiếu ngưỡng `shift_config`, cấu hình env trên Vercel,
> và tiếp tục tinh chỉnh giao diện (design pass CBNV đã làm phần lớn — xem git log).

| Bước | Nội dung | Trạng thái |
|---|---|---|
| **1** | Supabase mới + schema sạch (`supabase/migrations/` — hiện `0001`→`0011`) | ✅ SQL viết xong — cần chạy lên project thật |
| 2 | Khung Next.js 15 (App Router) + `middleware.ts` phân vai TBP/Admin | ✅ Đã làm |
| 3 | CBNV `/c/[token]` (Hướng C): chấm công GPS, dữ liệu tháng (`/lich-su`), giải trình | ✅ Đã làm |
| 4 | Định danh: login Mã NV/PIN (`/api/nv-login` + bcrypt RPC) + bind thiết bị (TBP/Admin duyệt) | ✅ Đã làm |
| 5 | TBP: duyệt giải trình + lưới NSCL + Ký&Khóa + Xuất Excel (`xlsx`) | ✅ Đã làm |
| 6 | Admin: nhân viên/QR, log, lễ, ca, cấu hình, tài khoản, hướng dẫn, sửa công | ✅ Đã làm |
| 7 | Vercel Cron nhắc nhở (`vercel.json` + `/api/cron/reminder`) + 4 Telegram + sync nghỉ phép (`/api/sync/nghi-phep`) | ✅ Đã làm |

> **Lưu ý khi dev:** đừng chạy `next build` khi đang `next dev` (chung thư mục `.next` → hỏng CSS / lỗi 500). Dừng dev trước khi build, hoặc chỉ dùng `tsc` để kiểm kiểu.

## Bước 1 — chạy migration

Thứ tự **bắt buộc** `0001 → 0011`:

| File | Nội dung |
|---|---|
| `0001_danh_muc.sql` | extension + bảng danh mục (employees, shift_config, holidays, guide, system_config, nscl_print_config) |
| `0002_van_hanh.sql` | logs, records, nscl_lock, device_bind, nghi_phep_dong_bo |
| `0003_chi_muc.sql` | index |
| `0004_grade_trigger.sql` | hàm chấm A/B/D + trigger tổng hợp (Smart-pick) |
| `0005_auth_roles.sql` | app_roles + helper RLS + RPC PIN/token |
| `0006_rls.sql` | bật RLS deny-public + policy SELECT |
| `0007_seed.sql` | seed shift_config, system_config, guide, cấu hình in |
| `0008_grants.sql` | cấp quyền cấp-bảng cho service_role/authenticated (BẮT BUỘC, nếu không API báo "permission denied") |
| `0009_fix_pin_searchpath.sql` | vá `search_path` cho RPC PIN/token (crypt/gen_salt ở schema `extensions`) |
| `0010_admin_set_day.sql` | RPC Admin sửa công 1 ngày (ghi đè giờ/điểm record) |
| `0011_moc_phan_ca_sang_in.sql` | đổi mốc **phân ca** "Vào sáng" `≤09:00` → `≤10:00` (chỉ 1 dòng, trigger `CREATE OR REPLACE`) |

**Cách chạy** (1 trong 2):
- **Dashboard**: Supabase project mới → SQL Editor → dán & chạy từng file theo thứ tự.
- **CLI**: `supabase link` tới project mới rồi `supabase db push`.

**Sau khi chạy SQL:**
1. Authentication → Users → tạo tài khoản admin + TBP; rồi `INSERT INTO chamcong_app_roles ...` (xem cuối `0007_seed.sql`).
2. (DEV) tạo nhân viên test: `SELECT * FROM chamcong_create_employee('ST001','Nhân Viên Mẫu','Kinh doanh','1234');`

## ⚠️ Cần đối chiếu trước go-live
- **Ngưỡng `shift_config`** trong `0007_seed.sql` lấy từ `context/business_rules.md` của app cũ. Phải so lại với bảng `chamcong_shift_config` **LIVE** trên Supabase cũ phòng khi KTHC đã chỉnh.
- Ngưỡng **phân ca** (Vào sáng ≤10:00 sau `0011` / ≤12:45 / ≤15:00) và **Smart-pick** hardcode trong trigger — giữ nguyên.

## Quyết định đã chốt (Bước 1)
- Khóa nội bộ `employee_id`; `ma_nv` ST001–ST999 (Admin gán tay); `employee_name` denorm để hiển thị/Excel.
- PIN **4 số** ngẫu nhiên (bcrypt); `token` thu hồi được; `device_id` token/thiết-bị do server cấp.
- TBP/Admin dùng Supabase Auth; CBNV định danh token-path + PIN (xử lý ở server).
- RLS deny-public: mọi GHI qua service role; không migrate dữ liệu 2026.
