// Màn chờ khi mở Bảng công tháng (trong lúc server truy vấn cả tháng).
export default function Loading() {
  return (
    <div className="cc-loading" aria-busy="true" aria-label="Đang tải">
      <div className="cc-loading-spinner" />
      <p className="cc-loading-text">Đang tải bảng công…</p>
    </div>
  );
}
