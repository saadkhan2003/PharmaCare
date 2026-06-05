import { LogOut, BadgeCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import type { SessionDto } from '@/types/session';

interface HeaderProps {
  session: SessionDto;
  onLogout: () => void;
}

export function Header({ session, onLogout }: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex flex-1 items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          {session.full_name}
        </span>
        <Badge
          variant={session.role === 'owner' ? 'default' : 'secondary'}
          className="capitalize"
        >
          <BadgeCheck className="mr-1 h-3 w-3" />
          {session.role}
        </Badge>
      </div>
      <Button variant="ghost" size="sm" onClick={onLogout}>
        <LogOut className="mr-2 h-4 w-4" />
        Sign Out
      </Button>
    </header>
  );
}
