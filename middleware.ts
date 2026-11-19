import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Bảo vệ khu vực TBP/Admin:
 *   - Chưa đăng nhập        -> /login
 *   - Đăng nhập nhưng chưa có vai (chamcong_app_roles) -> /login?e=norole
 *   - Vào /admin mà không phải admin -> đẩy về /tbp
 * Đồng thời refresh phiên Supabase (ghi lại cookie) mỗi request.
 * Khu vực CBNV /c/[token] KHÔNG qua đây — định danh bằng token-path, xử lý trong route.
 */
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;

  if (!user) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  const { data: role } = await supabase
    .from('chamcong_app_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!role) {
    return NextResponse.redirect(new URL('/login?e=norole', req.url));
  }

  // Khu /admin (gồm cả Duyệt thiết bị /admin/thiet-bi) chỉ dành cho Admin.
  if (path.startsWith('/admin') && role.role !== 'admin') {
    return NextResponse.redirect(new URL('/tbp', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/tbp/:path*', '/admin/:path*'],
};
