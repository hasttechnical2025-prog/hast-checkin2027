import AdminSidebar from './admin-sidebar';
import { ConfirmProvider } from '@/lib/confirm';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <AdminSidebar />
      <main className="admin-content">
        <ConfirmProvider>{children}</ConfirmProvider>
      </main>
    </div>
  );
}
