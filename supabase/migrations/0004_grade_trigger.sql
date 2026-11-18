-- =====================================================================
-- 0004_grade_trigger.sql — Logic server GIỮ NGUYÊN hành vi
--   (1) chamcong_calculate_session_grade: chấm A/B/D data-driven từ shift_config
--   (2) chamcong_process_attendance_log : trigger tổng hợp log -> record ngày
-- =====================================================================

-- ---------------------------------------------------------------------
-- (1) CHẤM ĐIỂM 1 CA  -> 'A' | 'B' | 'D'
--   p_time NULL (không chấm)  -> 'D'
--   Không có config           -> 'D'
--   IN  (morning_in/afternoon_in): <= a_end -> A ; <= b_end -> B ; else D
--   OUT sáng (morning_out):        a_start <= t <= a_end2 -> A ; t < a_start -> B ; else D
--   OUT chiều (afternoon_out):     t >= a_end -> A ; else B   (D CHỈ khi không chấm)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION chamcong_calculate_session_grade(
  p_time       time,
  p_shift_type text,
  p_session    text
) RETURNS text
LANGUAGE plpgsql STABLE
AS $$
DECLARE c RECORD;
BEGIN
  IF p_time IS NULL THEN
    RETURN 'D';
  END IF;

  SELECT a_start, a_end, a_end2, b_end
    INTO c
    FROM chamcong_shift_config
   WHERE shift_type = COALESCE(p_shift_type, 'tieu_chuan')
     AND session    = p_session;

  IF NOT FOUND THEN
    RETURN 'D';
  END IF;

  IF p_session IN ('morning_in', 'afternoon_in') THEN
    IF p_time <= c.a_end THEN
      RETURN 'A';
    ELSIF c.b_end IS NOT NULL AND p_time <= c.b_end THEN
      RETURN 'B';
    ELSE
      RETURN 'D';
    END IF;

  ELSIF p_session = 'morning_out' THEN
    IF c.a_start IS NOT NULL AND p_time >= c.a_start AND p_time <= c.a_end2 THEN
      RETURN 'A';
    ELSIF c.a_start IS NOT NULL AND p_time < c.a_start THEN
      RETURN 'B';
    ELSE
      RETURN 'D';
    END IF;

  ELSIF p_session = 'afternoon_out' THEN
    -- p_time chắc chắn NOT NULL ở đây: có chấm -> A/B, KHÔNG BAO GIỜ D.
    IF p_time >= c.a_end THEN
      RETURN 'A';
    ELSE
      RETURN 'B';
    END IF;
  END IF;

  RETURN 'D';
END;
$$;

-- ---------------------------------------------------------------------
-- (2) TRIGGER: AFTER INSERT trên logs -> tổng hợp record ngày
--   - Đổi checked_at (UTC) -> giờ VN (Asia/Ho_Chi_Minh)
--   - Phân ca theo MỐC HARDCODE: <=09:00 morning_in ; <=12:45 morning_out ;
--     <=15:00 afternoon_in ; còn lại afternoon_out
--   - Upsert dòng ngày (employee_id, date) DO NOTHING
--   - Smart-pick: IN lấy SỚM nhất, OUT lấy MUỘN nhất
--   - Tính lại grades (CSV 4 ca) theo loai_ca của nhân viên
-- ---------------------------------------------------------------------
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

  IF    v_hhmm <= 900  THEN v_session := 'morning_in';
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

DROP TRIGGER IF EXISTS trg_process_attendance_log ON chamcong_attendance_logs;
CREATE TRIGGER trg_process_attendance_log
AFTER INSERT ON chamcong_attendance_logs
FOR EACH ROW EXECUTE FUNCTION chamcong_process_attendance_log();
