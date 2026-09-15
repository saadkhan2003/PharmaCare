import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { cn } from '@/lib/utils';
import type { SessionDto } from '@/types/session';

interface AppShellProps {
  session: SessionDto;
  onLogout: () => void;
  children: ReactNode;
}

export function AppShell({ session, onLogout, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const isPos = location.pathname === '/pos';

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
          <main className={cn("flex-1", isPos ? "p-3 overflow-y-auto" : "p-4 md:p-6 overflow-auto")}>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
