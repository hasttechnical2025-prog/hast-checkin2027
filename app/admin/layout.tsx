import AdminSidebar from './admin-sidebar';
import RememberGuard from '@/app/_components/RememberGuard';
import { ConfirmProvider } from '@/lib/confirm';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <RememberGuard />
      <AdminSidebar />
      <main className="admin-content">
        <ConfirmProvider>{children}</ConfirmProvider>
      </main>
    </div>
  );
}
