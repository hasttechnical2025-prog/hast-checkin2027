-- =====================================================================
-- 0003_chi_muc.sql — Chỉ mục hiệu năng
-- =====================================================================

-- logs: admin nạp theo tháng (checked_at) — bảng tăng nhanh nhất
CREATE INDEX idx_logs_checked_at   ON chamcong_attendance_logs (checked_at);
CREATE INDEX idx_logs_emp_checked  ON chamcong_attendance_logs (employee_id, checked_at);

-- records: giaitrinh nạp cả tháng mọi người (chỉ-theo-date).
-- Tra theo (employee_id, date) đã có UNIQUE dẫn đầu bằng employee_id.
CREATE INDEX idx_records_date      ON chamcong_attendance_records (date);

-- nghỉ phép đồng bộ: render theo ma_nv+ngày; xóa theo đơn gốc
CREATE INDEX idx_npdb_manv_ngay    ON chamcong_nghi_phep_dong_bo (ma_nv, ngay);
CREATE INDEX idx_npdb_nguon        ON chamcong_nghi_phep_dong_bo (nguon_id);

-- device bind: tra theo nhân viên
CREATE INDEX idx_device_emp        ON chamcong_device_bind (employee_id);
