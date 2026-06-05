import { useState, type ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import type { SessionDto } from '@/types/session';

interface AppShellProps {
  session: SessionDto;
  onLogout: () => void;
  children: ReactNode;
}

export function AppShell({ session, onLogout, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
    >
      <div className="flex h-svh w-full overflow-hidden bg-background">
          <Sidebar
            session={session}
            mobileOpen={mobileSidebarOpen}
            onMobileClose={() => setMobileSidebarOpen(false)}
          />
        <div className="flex flex-1 flex-col min-w-0">
          <Header
            session={session}
            onLogout={onLogout}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            onOpenMobile={() => setMobileSidebarOpen(true)}
          />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
