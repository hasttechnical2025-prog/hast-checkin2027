-- =====================================================================
-- 0010_admin_set_day.sql — Admin SỬA CÔNG NGÀY cho 1 nhân viên
--
-- Vì sao: trigger 0004 chỉ chạy khi INSERT log mới. Sửa/xóa log thô KHÔNG
-- tự tính lại bảng ngày. Hàm này cho admin ghi thẳng 4 mốc giờ của 1
-- (nhân viên, ngày) rồi TÍNH LẠI A/B/D bằng ĐÚNG hàm chấm điểm của trigger
-- (chamcong_calculate_session_grade) — không chế thêm luật mới.
--
-- Chỉ đụng 4 mốc giờ + grades + updated_at. GIỮ NGUYÊN các cột khác của dòng
-- ngày (giải trình, duyệt, NSCL...). Nếu chưa có dòng ngày -> tạo mới (dùng để
-- bổ sung công cho ngày quên chấm). Truyền NULL cho mốc nào không có.
-- Khóa dòng ngày = (employee_id, date). Log thô (audit) KHÔNG bị đụng.
--
-- Chạy trong SQL Editor (vai postgres). Idempotent.
-- =====================================================================

CREATE OR REPLACE FUNCTION chamcong_admin_set_day(
  p_employee_id   int,
  p_date          date,
  p_morning_in    time,
  p_morning_out   time,
  p_afternoon_in  time,
  p_afternoon_out time
) RETURNS chamcong_attendance_records
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_loai_ca text;
  v_name    text;
  v_grades  text;
  r         chamcong_attendance_records;
BEGIN
  SELECT COALESCE(loai_ca, 'tieu_chuan'), name
    INTO v_loai_ca, v_name
    FROM chamcong_employees
   WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nhân viên không tồn tại (id=%)', p_employee_id;
  END IF;

  -- Tính lại grades bằng đúng luật của trigger.
  v_grades :=
    chamcong_calculate_session_grade(p_morning_in,    v_loai_ca, 'morning_in')    || ',' ||
    chamcong_calculate_session_grade(p_morning_out,   v_loai_ca, 'morning_out')   || ',' ||
    chamcong_calculate_session_grade(p_afternoon_in,  v_loai_ca, 'afternoon_in')  || ',' ||
    chamcong_calculate_session_grade(p_afternoon_out, v_loai_ca, 'afternoon_out');

  INSERT INTO chamcong_attendance_records
    (employee_id, employee_name, date,
     morning_in, morning_out, afternoon_in, afternoon_out, grades, updated_at)
  VALUES
    (p_employee_id, v_name, p_date,
     p_morning_in, p_morning_out, p_afternoon_in, p_afternoon_out, v_grades, now())
  ON CONFLICT (employee_id, date) DO UPDATE SET
    morning_in    = EXCLUDED.morning_in,
    morning_out   = EXCLUDED.morning_out,
    afternoon_in  = EXCLUDED.afternoon_in,
    afternoon_out = EXCLUDED.afternoon_out,
    grades        = EXCLUDED.grades,
    updated_at    = now()
  RETURNING * INTO r;

  RETURN r;
END;
$$;

-- Chỉ server (service_role) được gọi; chặn anon/authenticated (giống RPC định danh).
REVOKE ALL ON FUNCTION chamcong_admin_set_day(int, date, time, time, time, time) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION chamcong_admin_set_day(int, date, time, time, time, time) TO service_role;
