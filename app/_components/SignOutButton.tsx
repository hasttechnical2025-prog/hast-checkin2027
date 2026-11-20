import { Icon } from '@/app/_components/icons';

export default function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        className="btn"
        type="submit"
        style={{
          background: 'transparent',
          color: 'var(--accent)',
          padding: '6px 0',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Icon name="logout" size={16} /> Đăng xuất
      </button>
    </form>
  );
}
