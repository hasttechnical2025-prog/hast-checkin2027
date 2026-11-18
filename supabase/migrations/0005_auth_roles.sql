-- =====================================================================
-- 0005_auth_roles.sql — Supabase Auth cho TBP/Admin + RPC định danh CBNV (PIN/token)
--   - chamcong_app_roles : map auth.users -> role/department/view_all
--   - helper RLS (SECURITY DEFINER, đọc app_roles không đệ quy)
--   - RPC quản lý nhân viên + PIN (server gọi bằng service role)
-- CBNV KHÔNG dùng Supabase Auth: định danh bằng token-path + PIN, xử lý ở server.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Vai của tài khoản TBP/Admin (tài khoản tạo ở Authentication -> Users)
-- ---------------------------------------------------------------------
CREATE TABLE chamcong_app_roles (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL,                 -- 'admin' | 'TBP'
  department text,                          -- phòng của TBP (null cho admin)
  view_all   boolean NOT NULL DEFAULT false,-- TBP KTHC: xem toàn công ty, chấm/duyệt phòng mình
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chamcong_app_roles_role_chk CHECK (role IN ('admin','TBP'))
);

-- ---------------------------------------------------------------------
-- Helper RLS — SECURITY DEFINER để đọc app_roles mà không kẹt RLS/đệ quy
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION chamcong_is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM chamcong_app_roles WHERE user_id = auth.uid()) $$;

CREATE OR REPLACE FUNCTION chamcong_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM chamcong_app_roles WHERE user_id = auth.uid() AND role = 'admin') $$;

-- true nếu user hiện tại được xem phòng p_dept (admin / view_all / đúng phòng)
CREATE OR REPLACE FUNCTION chamcong_can_see_dept(p_dept text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chamcong_app_roles r
     WHERE r.user_id = auth.uid()
       AND (r.role = 'admin' OR r.view_all OR r.department = p_dept)
  )
$$;

REVOKE ALL ON FUNCTION chamcong_is_staff()            FROM public;
REVOKE ALL ON FUNCTION chamcong_is_admin()            FROM public;
REVOKE ALL ON FUNCTION chamcong_can_see_dept(text)    FROM public;
GRANT EXECUTE ON FUNCTION chamcong_is_staff()         TO authenticated;
GRANT EXECUTE ON FUNCTION chamcong_is_admin()         TO authenticated;
GRANT EXECUTE ON FUNCTION chamcong_can_see_dept(text) TO authenticated;

-- ---------------------------------------------------------------------
-- RPC định danh CBNV (gọi từ Next.js server bằng SERVICE ROLE — KHÔNG lộ ra client).
-- PIN băm bằng bcrypt (pgcrypto bf). Token do DB sinh; thu hồi bằng chamcong_revoke_token.
-- ---------------------------------------------------------------------

-- Tạo nhân viên: hash PIN, trả về token (để in QR / sinh link /c/[token]).
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

-- Xác thực đăng nhập CBNV: ma_nv + PIN -> trả danh tính nếu đúng & đang làm việc.
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

-- Đặt lại PIN
CREATE OR REPLACE FUNCTION chamcong_reset_pin(p_employee_id int, p_pin text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  UPDATE chamcong_employees SET pin_hash = crypt(p_pin, gen_salt('bf')) WHERE id = p_employee_id;
  RETURN FOUND;
END;
$$;

-- Thu hồi token (QR lộ) -> cấp token mới, trả token mới.
CREATE OR REPLACE FUNCTION chamcong_revoke_token(p_employee_id int)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE v_new uuid;
BEGIN
  UPDATE chamcong_employees SET token = gen_random_uuid()
   WHERE id = p_employee_id
   RETURNING token INTO v_new;
  RETURN v_new;
END;
$$;

-- CHỈ server (service role) được gọi các RPC này. Chặn anon/authenticated brute-force.
REVOKE ALL ON FUNCTION chamcong_create_employee(text,text,text,text,text,text,bigint,text,date,boolean) FROM public;
REVOKE ALL ON FUNCTION chamcong_verify_pin(text,text) FROM public;
REVOKE ALL ON FUNCTION chamcong_reset_pin(int,text)   FROM public;
REVOKE ALL ON FUNCTION chamcong_revoke_token(int)     FROM public;
