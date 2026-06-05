import { LogOut, BadgeCheck, PanelLeftClose, PanelLeft, Menu } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { SessionDto } from '@/types/session';

interface HeaderProps {
  session: SessionDto;
  onLogout: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenMobile: () => void;
}

export function Header({ session, onLogout, sidebarOpen, onToggleSidebar, onOpenMobile }: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <Button variant="ghost" size="icon-sm" onClick={onOpenMobile} className="md:hidden -ml-1">
        <Menu className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onToggleSidebar} className="hidden md:inline-flex -ml-1">
        {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeft className="size-4" />}
      </Button>
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex flex-1 items-center gap-2 min-w-0">
        <span className="text-sm font-medium text-foreground truncate">
          {session.full_name}
        </span>
        <Badge
          variant={session.role === 'owner' ? 'default' : 'secondary'}
          className="capitalize shrink-0"
        >
          <BadgeCheck className="mr-1 h-3 w-3" />
          {session.role}
        </Badge>
      </div>
      <Button variant="ghost" size="sm" onClick={onLogout} className="shrink-0">
        <LogOut className="mr-2 h-4 w-4" />
        <span className="hidden sm:inline">Sign Out</span>
      </Button>
    </header>
  );
}
