-- =====================================================================
-- 0006_rls.sql — RLS deny-public
--   - Bật RLS mọi bảng chamcong_.
--   - KHÔNG có policy INSERT/UPDATE/DELETE => mọi GHI chỉ qua SERVICE ROLE
--     (Next.js Route Handler) — service role bỏ qua RLS.
--   - SELECT: chỉ tài khoản TBP/Admin đã đăng nhập (Supabase Auth). CBNV đọc
--     gián tiếp qua server (service role), KHÔNG query trực tiếp => anon = 0 quyền.
-- =====================================================================

ALTER TABLE chamcong_employees            ENABLE ROW LEVEL SECURITY;
ALTER TABLE chamcong_shift_config         ENABLE ROW LEVEL SECURITY;
ALTER TABLE chamcong_holidays             ENABLE ROW LEVEL SECURITY;
ALTER TABLE chamcong_guide_content        ENABLE ROW LEVEL SECURITY;
ALTER TABLE chamcong_system_config        ENABLE ROW LEVEL SECURITY;
ALTER TABLE chamcong_nscl_print_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE chamcong_attendance_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE chamcong_attendance_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE chamcong_nscl_lock            ENABLE ROW LEVEL SECURITY;
ALTER TABLE chamcong_device_bind          ENABLE ROW LEVEL SECURITY;
ALTER TABLE chamcong_nghi_phep_dong_bo    ENABLE ROW LEVEL SECURITY;
ALTER TABLE chamcong_app_roles            ENABLE ROW LEVEL SECURITY;

-- Vai của chính mình
CREATE POLICY app_roles_self ON chamcong_app_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Bảng cấu hình/danh mục: TBP/Admin đã đăng nhập đều đọc
CREATE POLICY shift_read   ON chamcong_shift_config      FOR SELECT TO authenticated USING (chamcong_is_staff());
CREATE POLICY holiday_read ON chamcong_holidays          FOR SELECT TO authenticated USING (chamcong_is_staff());
CREATE POLICY guide_read   ON chamcong_guide_content     FOR SELECT TO authenticated USING (chamcong_is_staff());
CREATE POLICY syscfg_read  ON chamcong_system_config     FOR SELECT TO authenticated USING (chamcong_is_staff());
CREATE POLICY printcfg_read ON chamcong_nscl_print_config FOR SELECT TO authenticated USING (chamcong_is_staff());
CREATE POLICY nscllock_read ON chamcong_nscl_lock        FOR SELECT TO authenticated USING (chamcong_is_staff());

-- Nhân viên: admin/view_all xem tất cả; TBP xem phòng mình
CREATE POLICY emp_read ON chamcong_employees
  FOR SELECT TO authenticated USING (chamcong_can_see_dept(department));

-- Bản ghi ngày: theo phòng của nhân viên
CREATE POLICY rec_read ON chamcong_attendance_records
  FOR SELECT TO authenticated
  USING (chamcong_can_see_dept((SELECT e.department FROM chamcong_employees e WHERE e.id = employee_id)));

-- Log thô: CHỈ admin
CREATE POLICY logs_read ON chamcong_attendance_logs
  FOR SELECT TO authenticated USING (chamcong_is_admin());

-- Bind thiết bị: theo phòng của nhân viên (TBP duyệt bind phòng mình)
CREATE POLICY device_read ON chamcong_device_bind
  FOR SELECT TO authenticated
  USING (chamcong_can_see_dept((SELECT e.department FROM chamcong_employees e WHERE e.id = employee_id)));

-- Nghỉ phép đồng bộ (overlay): TBP/Admin đều đọc (server lọc thêm theo phòng khi render)
CREATE POLICY npdb_read ON chamcong_nghi_phep_dong_bo
  FOR SELECT TO authenticated USING (chamcong_is_staff());

-- GHI CHÚ: KHÔNG tạo policy INSERT/UPDATE/DELETE cho bất kỳ bảng nào.
-- Mọi thao tác GHI đi qua Route Handler dùng service_role key (bỏ qua RLS).
