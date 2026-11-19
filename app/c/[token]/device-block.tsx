import QrCode from '@/app/_components/QrCode';

/** Màn chặn khi mở trang chấm công trên máy tính / máy tính bảng / iPad. */
export default function DeviceBlock({ url, employeeName }: { url: string; employeeName: string }) {
  return (
    <main className="cc-wrap cc-block">
      <div className="cc-block-card">
        <div className="cc-block-emoji">📱</div>
        <h2 className="cc-block-title">Chỉ chấm công trên điện thoại</h2>
        <p className="cc-block-sub">
          Xin chào <b>{employeeName}</b>. Trang chấm công chỉ hoạt động trên <b>điện thoại</b>.
          Máy tính, máy tính bảng và iPad không được phép chấm công.
        </p>
        <p className="cc-block-hint">Dùng điện thoại quét mã QR dưới đây để mở:</p>
        <div className="cc-block-qr">
          <QrCode text={url} size={200} />
        </div>
        <div className="cc-block-url">{url}</div>
      </div>
    </main>
  );
}
