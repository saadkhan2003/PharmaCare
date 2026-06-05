import type { ReactNode } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import type { SessionDto } from '@/types/session';

interface AppShellProps {
  session: SessionDto;
  onLogout: () => void;
  children: ReactNode;
}

export function AppShell({ session, onLogout, children }: AppShellProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar session={session} />
      <SidebarInset>
        <Header session={session} onLogout={onLogout} />
        <div className="flex flex-1 flex-col gap-4 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
