// Màn chờ hiện NGAY khi điều hướng tới trang chấm công (trong lúc server truy vấn DB).
export default function Loading() {
  return (
    <main className="cc-loading" aria-busy="true" aria-label="Đang tải">
      <div className="cc-loading-spinner" />
      <p className="cc-loading-text">Đang tải…</p>
    </main>
  );
}
