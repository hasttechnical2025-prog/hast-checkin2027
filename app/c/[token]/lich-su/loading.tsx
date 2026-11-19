// Màn chờ hiện NGAY khi mở Dữ liệu tháng (trong lúc server truy vấn dữ liệu tháng).
export default function Loading() {
  return (
    <main className="cc-loading" aria-busy="true" aria-label="Đang tải">
      <div className="cc-loading-spinner" />
      <p className="cc-loading-text">Đang tải dữ liệu tháng…</p>
    </main>
  );
}
