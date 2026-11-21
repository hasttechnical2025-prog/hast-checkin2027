'use client';

import { useEffect, useRef } from 'react';

/**
 * Bọc khối đầu trang TBP (định danh + tab + thanh tháng) thành một mảng dính (sticky).
 * Đo chiều cao thật rồi đặt biến --tbp-stick để hàng tiêu đề bảng (thead) bám ngay dưới.
 */
export default function StickyTop({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () =>
      document.documentElement.style.setProperty('--tbp-stick', `${Math.round(el.offsetHeight)}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="tbp-stickytop" ref={ref}>
      {children}
    </div>
  );
}
