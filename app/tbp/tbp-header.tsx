'use client';

import Link, { useLinkStatus } from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Icon, type IconName } from '@/app/_components/icons';

const pad = (n: number) => String(n).padStart(2, '0');
const toM = (i: number) => `${Math.floor((i - 1) / 12)}-${pad(((i - 1) % 12) + 1)}`;

/** Đổi icon thành spinner khi link đang điều hướng (chuyển tháng -> hết "ngơ"). */
function NavIcon({ name }: { name: IconName }) {
  const { pending } = useLinkStatus();
  return pending ? <span className="nav-spinner" aria-hidden /> : <Icon name={name} size={18} />;
}

/**
 * Header dùng chung cho cả 2 tab TBP: [tab] + [thanh chọn tháng].
 * - Tháng lưu ở ?m -> chuyển tab vẫn giữ tháng; chuyển tháng vẫn giữ tab.
 * - Không cho sang tháng tương lai (clamp theo giờ VN).
 */
export default function TbpHeader() {
  const pathname = usePathname();
  const sp = useSearchParams();

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

  const isNscl = pathname.startsWith('/tbp/nscl');
  const base = isNscl ? '/tbp/nscl' : '/tbp';
  const mSuffix = `?m=${toM(idx)}`;
  const prevHref = `${base}?m=${toM(idx - 1)}`;
  const nextHref = idx + 1 <= curIdx ? `${base}?m=${toM(idx + 1)}` : null;

  return (
    <>
      <div className="tbp-tabs">
        <Link href={`/tbp${mSuffix}`} className={`tbp-tablink${isNscl ? '' : ' active'}`}>
          Duyệt giải trình
        </Link>
        <Link href={`/tbp/nscl${mSuffix}`} className={`tbp-tablink${isNscl ? ' active' : ''}`}>
          Bảng điểm NSCL
        </Link>
      </div>

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

      {/* Thanh tab đáy — chỉ hiện trên mobile (CSS) */}
      <nav className="botnav tbp-botnav" aria-label="Chuyển mục">
        <Link href={`/tbp${mSuffix}`} className={`botnav-item${isNscl ? '' : ' active'}`}>
          <Icon name="checks" size={20} />
          <span>Giải trình</span>
        </Link>
        <Link href={`/tbp/nscl${mSuffix}`} className={`botnav-item${isNscl ? ' active' : ''}`}>
          <Icon name="sheet" size={20} />
          <span>Bảng điểm</span>
        </Link>
      </nav>
    </>
  );
}
