import { LogOut, BadgeCheck, PanelLeftClose, PanelLeft, Menu, Sun, Moon, KeyRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ChangePasswordDialog } from '@/components/users/ChangePasswordDialog';
import { useIsDark, toggleTheme } from '@/hooks/useIsDark';
import { playClick } from '@/lib/sounds';
import type { SessionDto } from '@/types/session';

interface HeaderProps {
  session: SessionDto;
  onLogout: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenMobile: () => void;
}

export function Header({ session, onLogout, sidebarOpen, onToggleSidebar, onOpenMobile }: HeaderProps) {
  const isDark = useIsDark();

  const handleToggleTheme = () => {
    playClick();
    toggleTheme();
  };

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
        <span className="text-sm font-semibold text-foreground truncate">
          {session.full_name}
        </span>
        <Badge
          variant={session.role === 'owner' ? 'default' : 'secondary'}
          className="capitalize shrink-0 font-medium"
        >
          <BadgeCheck className="mr-1 h-3 w-3" />
          {session.role}
        </Badge>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleToggleTheme}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className="text-muted-foreground hover:text-foreground"
        >
          {isDark ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4 text-slate-700" />}
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* Change Password (accessible to ALL roles) */}
        <ChangePasswordDialog
          session={session}
          trigger={
            <Button
              variant="ghost"
              size="icon-sm"
              title="Change your password"
              className="text-muted-foreground hover:text-foreground"
            >
              <KeyRound className="size-4" />
              <span className="sr-only">Change password</span>
            </Button>
          }
        />

        <Separator orientation="vertical" className="mx-1 h-4" />

        {/* Logout */}
        <Button variant="ghost" size="sm" onClick={onLogout} className="shrink-0 text-muted-foreground hover:text-destructive">
          <LogOut className="mr-1.5 h-4 w-4" />
          <span className="hidden sm:inline">Sign Out</span>
        </Button>
      </div>
    </header>
  );
}
