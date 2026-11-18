-- =====================================================================
-- 0008_grants.sql — Cấp QUYỀN cấp-bảng cho các vai Supabase
--
-- Vì sao cần: bật RLS (0006) chỉ LỌC DÒNG, nhưng PostgREST còn kiểm tra GRANT
-- cấp-bảng trước. Bảng tạo trong SQL Editor KHÔNG tự có GRANT cho service_role/
-- authenticated -> mọi truy vấn qua API báo "permission denied for table".
-- File này cấp quyền tường minh + đặt mặc định cho bảng/hàm tạo SAU này.
--
-- Mô hình quyền:
--   service_role (server, bỏ qua RLS): TOÀN QUYỀN bảng/sequence/hàm.
--   authenticated (TBP/Admin đăng nhập): chỉ SELECT (RLS lọc dòng theo policy).
--   anon: KHÔNG cấp gì trên bảng (CBNV đi qua server) -> deny-public.
-- Chạy trong SQL Editor (vai postgres). Idempotent.
-- =====================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- service_role: toàn quyền
GRANT ALL     ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL     ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- authenticated: chỉ đọc (RLS vẫn gác theo policy)
GRANT SELECT  ON ALL TABLES    IN SCHEMA public TO authenticated;

-- Mặc định cho đối tượng tạo SAU này (migration/bảng mới)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL     ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL     ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT  ON TABLES    TO authenticated;

-- LƯU Ý: các RPC định danh (chamcong_verify_pin/create_employee/reset_pin/revoke_token)
-- đã REVOKE khỏi PUBLIC ở 0005 nên anon/authenticated KHÔNG gọi được (chống brute-force);
-- dòng GRANT EXECUTE ... TO service_role ở trên mở lại cho server gọi — đúng ý đồ.
