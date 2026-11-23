'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

const DISMISS_KEY = 'hstc_a2hs_dismiss';

export default function PwaClient() {
  const [hint, setHint] = useState<'ios' | 'inapp' | null>(null);
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Service worker đã được đăng ký SỚM bằng script inline trong page.tsx (để trang được
    // SW kiểm soát ngay từ đầu -> Chrome Android mới mời Cài đặt). Ở đây chỉ lo gợi ý A2HS.
    const ua = navigator.userAgent || '';
    const standalone =
      (navigator as unknown as { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;

    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      /* ignore */
    }

    if (standalone || dismissed) return;

    const inApp = /FBAN|FBAV|Instagram|Zalo|Messenger|Line\//i.test(ua);
    const isIOS = /iphone|ipad|ipod/i.test(ua);

    if (inApp) setHint('inapp');
    else if (isIOS) setHint('ios');

    const onBip = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setHint(null);
    setInstallEvt(null);
  }

  async function install() {
    if (!installEvt) return;
    await installEvt.prompt();
    // Chỉ ẩn banner cho phiên này; KHÔNG đặt cờ tắt vĩnh viễn.
    // Nếu người dùng cài thành công -> lần sau mở là standalone nên banner tự ẩn.
    // Nếu họ hủy / chỉ ra shortcut -> lần sau beforeinstallprompt lại kích, banner hiện lại.
    setInstallEvt(null);
    setHint(null);
  }

  if (installEvt) {
    return (
      <div className="pwa-hint">
        <span>📲 Cài ứng dụng Chấm Công vào máy để mở nhanh hơn.</span>
        <div className="pwa-hint-btns">
          <button className="pwa-hint-btn" onClick={install}>
            Cài đặt
          </button>
          <button className="pwa-hint-x" onClick={dismiss} aria-label="Đóng">
            ✕
          </button>
        </div>
      </div>
    );
  }

  if (hint === 'inapp') {
    return (
      <div className="pwa-hint pwa-hint-warn">
        <span>
          ⚠️ Bạn đang mở trong ứng dụng (Zalo/Messenger…). Hãy bấm <b>⋯</b> → <b>Mở trong trình duyệt</b>{' '}
          (Safari/Chrome) để cài app và chấm công ổn định.
        </span>
        <button className="pwa-hint-x" onClick={dismiss} aria-label="Đóng">
          ✕
        </button>
      </div>
    );
  }

  if (hint === 'ios') {
    return (
      <div className="pwa-hint">
        <span>
          📲 Cài vào Màn hình chính: bấm <b>Chia sẻ</b> ⬆️ → <b>Thêm vào MH chính</b> để mở nhanh và tránh lỗi
          đăng nhập.
        </span>
        <button className="pwa-hint-x" onClick={dismiss} aria-label="Đóng">
          ✕
        </button>
      </div>
    );
  }

  return null;
}
