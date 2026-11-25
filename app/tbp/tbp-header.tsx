'use client';

import Link, { useLinkStatus } from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { Icon, type IconName } from '@/app/_components/icons';

const pad = (n: number) => String(n).padStart(2, '0');
const toM = (i: number) => `${Math.floor((i - 1) / 12)}-${pad(((i - 1) % 12) + 1)}`;

/** URL giữ đồng thời tháng (?m) và phòng (?dept) -> đổi cái này không mất cái kia. */
function mkHref(base: string, mIdx: number, deptVal: string): string {
  const params = new URLSearchParams();
  params.set('m', toM(mIdx));
  if (deptVal) params.set('dept', deptVal);
  return `${base}?${params.toString()}`;
}

/** Đổi icon thành spinner khi link đang điều hướng (chuyển tháng -> hết "ngơ"). */
function NavIcon({ name }: { name: IconName }) {
  const { pending } = useLinkStatus();
  return pending ? <span className="nav-spinner" aria-hidden /> : <Icon name={name} size={18} />;
}

/**
 * Header dùng chung cho cả 2 tab TBP: [tab] + [chọn phòng] + [chọn tháng].
 * - Tháng ở ?m, phòng ở ?dept -> chuyển tab/tháng/phòng đều giữ các lựa chọn còn lại.
 * - Bộ chọn phòng chỉ hiện với vai Xem toàn công ty / Admin (seeAll).
 * - Không cho sang tháng tương lai (clamp theo giờ VN).
 */
export default function TbpHeader({
  departments,
  seeAll,
}: {
  departments: string[];
  seeAll: boolean;
}) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const router = useRouter();

  const vn = new Date(Date.now() + 7 * 3600 * 1000);
  const curIdx = vn.getUTCFullYear() * 12 + (vn.getUTCMonth() + 1);

  const m = sp.get('m');
  let idx = curIdx;
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const y = Number(m.slice(0, 4));
    const mo = Number(m.slice(5, 7));
    const cand = y * 12 + mo;
    if (mo >= 1 && mo <= 12 && cand <= curIdx) idx = cand;
  }
  const year = Math.floor((idx - 1) / 12);
  const month = ((idx - 1) % 12) + 1;

  const dept = sp.get('dept') || '';

  const isNscl = pathname.startsWith('/tbp/nscl');
  const base = isNscl ? '/tbp/nscl' : '/tbp';
  const prevHref = mkHref(base, idx - 1, dept);
  const nextHref = idx + 1 <= curIdx ? mkHref(base, idx + 1, dept) : null;

  const showDept = seeAll && departments.length > 1;

  return (
    <div className="tbp-headrow">
      <div className="tbp-tabs">
        <Link href={mkHref('/tbp', idx, dept)} className={`tbp-tablink${isNscl ? '' : ' active'}`}>
          Duyệt giải trình
        </Link>
        <Link href={mkHref('/tbp/nscl', idx, dept)} className={`tbp-tablink${isNscl ? ' active' : ''}`}>
          Bảng điểm NSCL
        </Link>
      </div>

      <div className="tbp-scope">
        {showDept && (
          <select
            className="tbp-select tbp-scope-dept"
            value={dept}
            onChange={(e) => router.push(mkHref(base, idx, e.target.value))}
            aria-label="Chọn phòng"
          >
            <option value="">Tất cả phòng</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}

        <div className="ls-nav">
          <Link href={prevHref} className="ls-navbtn" aria-label="Tháng trước">
            <NavIcon name="chevLeft" />
          </Link>
          <div className="ls-month">
            Tháng {month}/{year}
          </div>
          {nextHref ? (
            <Link href={nextHref} className="ls-navbtn" aria-label="Tháng sau">
              <NavIcon name="chevRight" />
            </Link>
          ) : (
            <span className="ls-navbtn disabled">
              <Icon name="chevRight" size={18} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
