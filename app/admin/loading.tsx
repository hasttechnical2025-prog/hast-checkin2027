// Màn chờ chung khi chuyển trang trong khu Admin (tránh cảm giác "ngơ").
export default function Loading() {
  return (
    <div className="cc-loading" aria-busy="true" aria-label="Đang tải">
      <div className="cc-loading-spinner" />
      <p className="cc-loading-text">Đang tải…</p>
    </div>
  );
}
