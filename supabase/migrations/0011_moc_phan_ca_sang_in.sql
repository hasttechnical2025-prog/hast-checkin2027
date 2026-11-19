-- =====================================================================
-- 0011_moc_phan_ca_sang_in.sql — Sửa MỐC PHÂN CA "Vào sáng" 09:00 -> 10:00
--
-- Vì sao: theo quy định công ty, "Vào sáng" chấm B đến tận 10:00
--   (≤08:05 A, 08:05<t≤10:00 B). Nhưng trigger đang phân ca "Vào sáng"
--   chỉ tới 09:00 (v_hhmm <= 900): người chấm 09:00–10:00 bị xếp NHẦM sang
--   "Ra sáng" -> Vào sáng thành D. Đổi ranh giới sang 10:00 (<= 1000).
--
-- Các mốc còn lại GIỮ NGUYÊN: Ra sáng ≤12:45, Vào chiều ≤15:00, còn lại Ra chiều.
-- Chỉ thay DUY NHẤT dòng phân ca; phần còn lại y hệt 0004.
-- Hàm chấm điểm chamcong_calculate_session_grade KHÔNG đổi.
--
-- CREATE OR REPLACE giữ nguyên trigger trg_process_attendance_log đang trỏ tới.
-- Chạy trong SQL Editor (vai postgres). Idempotent.
-- =====================================================================

CREATE OR REPLACE FUNCTION chamcong_process_attendance_log()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_ts      timestamp;   -- giờ VN (không tz)
  v_date    date;
  v_time    time;
  v_hhmm    int;
  v_session text;
  v_loai_ca text;
  v_name    text;
  r         RECORD;
  v_grades  text;
BEGIN
  v_ts   := (NEW.checked_at AT TIME ZONE 'Asia/Ho_Chi_Minh');
  v_date := v_ts::date;
  v_time := v_ts::time;
  v_hhmm := EXTRACT(HOUR FROM v_ts)::int * 100 + EXTRACT(MINUTE FROM v_ts)::int;

  -- Phân ca theo mốc hardcode. ĐỔI: Vào sáng tới 10:00 (trước đây 09:00).
  IF    v_hhmm <= 1000 THEN v_session := 'morning_in';
  ELSIF v_hhmm <= 1245 THEN v_session := 'morning_out';
  ELSIF v_hhmm <= 1500 THEN v_session := 'afternoon_in';
  ELSE                      v_session := 'afternoon_out';
  END IF;

  SELECT loai_ca, name INTO v_loai_ca, v_name
    FROM chamcong_employees WHERE id = NEW.employee_id;
  v_loai_ca := COALESCE(v_loai_ca, 'tieu_chuan');

  -- Đảm bảo có dòng ngày
  INSERT INTO chamcong_attendance_records (employee_id, employee_name, date, grades)
  VALUES (NEW.employee_id, COALESCE(NEW.employee_name, v_name), v_date, 'D,D,D,D')
  ON CONFLICT (employee_id, date) DO NOTHING;

  -- Khóa dòng ngày để smart-pick an toàn khi chấm dồn
  SELECT * INTO r
    FROM chamcong_attendance_records
   WHERE employee_id = NEW.employee_id AND date = v_date
   FOR UPDATE;

  IF v_session = 'morning_in' THEN
    IF r.morning_in IS NULL OR v_time < r.morning_in THEN
      UPDATE chamcong_attendance_records SET morning_in = v_time WHERE id = r.id;
    END IF;
  ELSIF v_session = 'morning_out' THEN
    IF r.morning_out IS NULL OR v_time > r.morning_out THEN
      UPDATE chamcong_attendance_records SET morning_out = v_time WHERE id = r.id;
    END IF;
  ELSIF v_session = 'afternoon_in' THEN
    IF r.afternoon_in IS NULL OR v_time < r.afternoon_in THEN
      UPDATE chamcong_attendance_records SET afternoon_in = v_time WHERE id = r.id;
    END IF;
  ELSE
    IF r.afternoon_out IS NULL OR v_time > r.afternoon_out THEN
      UPDATE chamcong_attendance_records SET afternoon_out = v_time WHERE id = r.id;
    END IF;
  END IF;

  -- Đọc lại record sau cập nhật và tính grades
  SELECT * INTO r FROM chamcong_attendance_records WHERE id = r.id;

  v_grades :=
    chamcong_calculate_session_grade(r.morning_in,    v_loai_ca, 'morning_in')    || ',' ||
    chamcong_calculate_session_grade(r.morning_out,   v_loai_ca, 'morning_out')   || ',' ||
    chamcong_calculate_session_grade(r.afternoon_in,  v_loai_ca, 'afternoon_in')  || ',' ||
    chamcong_calculate_session_grade(r.afternoon_out, v_loai_ca, 'afternoon_out');

  UPDATE chamcong_attendance_records
     SET grades = v_grades, updated_at = now()
   WHERE id = r.id;

  RETURN NEW;
END;
$$;
