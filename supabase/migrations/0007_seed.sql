-- =====================================================================
-- 0007_seed.sql — Dữ liệu khởi tạo
--   - shift_config: 3 loại ca × 4 ca (NGƯỠNG LẤY TỪ context/business_rules.md app cũ —
--     ⚠️ ĐỐI CHIẾU LẠI với bảng shift_config LIVE trên Supabase cũ trước go-live).
--   - system_config: GPS + công tắc + tên công ty.
--   - guide_content p1..p4: tiêu đề mẫu (Admin sửa sau).
--   - nscl_print_config: 1 dòng rỗng.
-- =====================================================================

-- ------- NGƯỠNG CHẤM A/B/D -------------------------------------------
-- A/B/D: IN dùng (a_end,b_end); OUT sáng dùng (a_start,a_end2); OUT chiều dùng (a_end).
INSERT INTO chamcong_shift_config (shift_type, session, a_start, a_end, a_end2, b_end) VALUES
  -- Tiêu chuẩn
  ('tieu_chuan',  'morning_in',    NULL,     '08:05', NULL,    '09:00'),
  ('tieu_chuan',  'morning_out',   '12:00',  NULL,    '12:45', NULL),
  ('tieu_chuan',  'afternoon_in',  NULL,     '13:05', NULL,    '15:00'),
  ('tieu_chuan',  'afternoon_out', NULL,     '17:00', NULL,    NULL),
  -- Ngoại lệ 1: chỉ khác IN sáng (A <= 08:30)
  ('ngoai_le_1',  'morning_in',    NULL,     '08:30', NULL,    '09:00'),
  ('ngoai_le_1',  'morning_out',   '12:00',  NULL,    '12:45', NULL),
  ('ngoai_le_1',  'afternoon_in',  NULL,     '13:05', NULL,    '15:00'),
  ('ngoai_le_1',  'afternoon_out', NULL,     '17:00', NULL,    NULL),
  -- Ngoại lệ 2: IN sáng A <= 09:00 (không B) + OUT chiều A >= 16:00
  ('ngoai_le_2',  'morning_in',    NULL,     '09:00', NULL,    NULL),
  ('ngoai_le_2',  'morning_out',   '12:00',  NULL,    '12:45', NULL),
  ('ngoai_le_2',  'afternoon_in',  NULL,     '13:05', NULL,    '15:00'),
  ('ngoai_le_2',  'afternoon_out', NULL,     '16:00', NULL,    NULL)
ON CONFLICT (shift_type, session) DO NOTHING;

-- ------- CẤU HÌNH HỆ THỐNG -------------------------------------------
INSERT INTO chamcong_system_config (key, value) VALUES
  ('company_name',      'CÔNG TY CP SIÊU THANH HÀ NỘI'),
  ('office_name',       'Siêu Thanh Hà Nội'),
  ('company_address',   'Số 5 Nguyễn Ngọc Vũ, Phường Thanh Xuân, TP Hà Nội'),
  ('office_lat',        '21.00861322599807'),
  ('office_lng',        '105.81294998643875'),
  ('office_radius',     '200'),      -- mét (trong bán kính = hợp lệ)
  ('max_distance',      '15000'),    -- mét (vượt = chặn)
  ('gps_expire_ms',     '60000'),    -- GPS hết hạn sau 1 phút
  ('allow_holiday',     'false'),    -- cho chấm ngày lễ
  ('allow_multiple',    'false'),    -- cho chấm trùng ca
  ('leave_symbol_mode', 'merged')    -- merged: cả ngày luôn P ; split: P/Ô/N theo loại
ON CONFLICT (key) DO NOTHING;

-- ------- HƯỚNG DẪN (overlay) -----------------------------------------
INSERT INTO chamcong_guide_content (id, title, content) VALUES
  ('p1', 'Giới thiệu',            ''),
  ('p2', 'Cách chấm công',        ''),
  ('p3', 'Cài app vào màn hình',  ''),
  ('p4', 'Giải trình & câu hỏi',  '')
ON CONFLICT (id) DO NOTHING;

-- ------- CẤU HÌNH IN NSCL (singleton) --------------------------------
INSERT INTO chamcong_nscl_print_config (id, config) VALUES (1, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- TÀI KHOẢN ADMIN/TBP (Supabase Auth) — KHÔNG tạo bằng SQL.
-- Bước thủ công trên Dashboard:
--   1) Authentication -> Users -> Add user (email + mật khẩu) cho admin & từng TBP.
--   2) Gán vai theo EMAIL (khỏi copy UUID) — thay email đúng của bạn:
--
--   INSERT INTO chamcong_app_roles (user_id, role, department, view_all)
--   SELECT u.id, v.role, v.department, v.view_all
--   FROM (VALUES
--     ('admin@cong-ty.com',    'admin', NULL,                  true),   -- admin: toàn công ty
--     ('tbp.kd@cong-ty.com',   'TBP',   'Kinh doanh',          false),
--     ('tbp.kthc@cong-ty.com', 'TBP',   'Kế toán-Hành chính',  true),   -- KTHC: xem toàn công ty
--     ('tbp.kt@cong-ty.com',   'TBP',   'Kỹ thuật',            false)
--   ) AS v(email, role, department, view_all)
--   JOIN auth.users u ON lower(u.email) = lower(v.email)
--   ON CONFLICT (user_id) DO UPDATE
--     SET role = EXCLUDED.role, department = EXCLUDED.department, view_all = EXCLUDED.view_all;
--
--   Lưu ý: department phải KHỚP TUYỆT ĐỐI với chamcong_employees.department.
--   admin đã toàn-công-ty nhờ role='admin' (view_all chỉ để tường minh). view_all cho TBP =
--   CHỈ mở rộng quyền XEM; chấm/duyệt vẫn giới hạn phòng mình (server chặn).
-- =====================================================================

-- =====================================================================
-- (DEV) Nhân viên mẫu để test chấm công ngay — PIN test '1234'.
-- ⚠️ CHỈ dùng trên project DEV; XÓA trước khi chạy thật.
--   SELECT * FROM chamcong_create_employee('ST001','Nhân Viên Mẫu','Kinh doanh','1234');
--   -> trả về token để mở /c/<token>.
-- =====================================================================
