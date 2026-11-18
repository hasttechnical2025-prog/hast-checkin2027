export default function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        className="btn"
        type="submit"
        style={{ background: 'transparent', color: 'var(--accent)', padding: '6px 0' }}
      >
        Đăng xuất
      </button>
    </form>
  );
}
