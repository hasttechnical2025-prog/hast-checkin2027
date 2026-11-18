-- =====================================================================
-- 0009_fix_pin_searchpath.sql — Sửa search_path cho các RPC dùng pgcrypto
--
-- Trên Supabase, pgcrypto cài ở schema `extensions` (không phải public). Các RPC
-- SECURITY DEFINER đặt `SET search_path = public` nên KHÔNG tìm thấy crypt/gen_salt
-- -> lỗi "function gen_salt(unknown) does not exist". Thêm `extensions` vào search_path.
-- CREATE OR REPLACE -> an toàn chạy lại trên DB đã migrate.
-- =====================================================================

CREATE OR REPLACE FUNCTION chamcong_create_employee(
  p_ma_nv        text,
  p_name         text,
  p_department   text,
  p_pin          text,
  p_role         text DEFAULT 'CBNV',
  p_loai_ca      text DEFAULT 'tieu_chuan',
  p_telegram     bigint DEFAULT NULL,
  p_email        text DEFAULT NULL,
  p_ngay_vao_lam date DEFAULT NULL,
  p_mien_cham    boolean DEFAULT false
) RETURNS TABLE (id int, ma_nv text, token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO chamcong_employees
    (ma_nv, name, department, role, loai_ca, telegram_chat_id, email, ngay_vao_lam, mien_cham_cong, pin_hash)
  VALUES
    (p_ma_nv, p_name, p_department, p_role, p_loai_ca, p_telegram, p_email, p_ngay_vao_lam, p_mien_cham,
     crypt(p_pin, gen_salt('bf')))
  RETURNING chamcong_employees.id, chamcong_employees.ma_nv, chamcong_employees.token;
END;
$$;

CREATE OR REPLACE FUNCTION chamcong_verify_pin(p_ma_nv text, p_pin text)
RETURNS TABLE (id int, ma_nv text, name text, department text, role text, token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.ma_nv, e.name, e.department, e.role, e.token
    FROM chamcong_employees e
   WHERE e.ma_nv = p_ma_nv
     AND e.status = 'Đang làm việc'
     AND e.pin_hash IS NOT NULL
     AND e.pin_hash = crypt(p_pin, e.pin_hash);
END;
$$;

CREATE OR REPLACE FUNCTION chamcong_reset_pin(p_employee_id int, p_pin text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  UPDATE chamcong_employees SET pin_hash = crypt(p_pin, gen_salt('bf')) WHERE id = p_employee_id;
  RETURN FOUND;
END;
$$;
