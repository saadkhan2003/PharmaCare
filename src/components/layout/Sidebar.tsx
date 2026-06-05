import { useLocation, useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  SidebarContent as SidebarContentPrimitive,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { LayoutDashboard, ShoppingCart, Users, ScrollText, Building2, Pill, Truck, Package, AlertTriangle, PanelLeftClose, PanelLeft } from 'lucide-react';
import type { SessionDto } from '@/types/session';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: ('owner' | 'pharmacist')[];
}

const navItems: NavItem[] = [
  { title: 'POS', url: '/pos', icon: ShoppingCart, roles: ['owner', 'pharmacist'] },
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, roles: ['owner', 'pharmacist'] },
  { title: 'Users', url: '/users', icon: Users, roles: ['owner'] },
  { title: 'Audit Log', url: '/audit', icon: ScrollText, roles: ['owner'] },
  { title: 'Medicines', url: '/medicines', icon: Pill, roles: ['owner', 'pharmacist'] },
  { title: 'Suppliers', url: '/suppliers', icon: Truck, roles: ['owner'] },
  { title: 'Purchases', url: '/purchases', icon: Package, roles: ['owner'] },
  { title: 'Expiry Report', url: '/expiry-report', icon: AlertTriangle, roles: ['owner'] },
];

interface SidebarProps {
  session: SessionDto;
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function SidebarNav({ session, collapsed }: { session: SessionDto; collapsed: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(session.role)
  );

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground overflow-hidden">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className={collapsed ? 'justify-center px-0' : ''}>
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Building2 className="size-4" />
              </div>
              {!collapsed && (
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">PharmaCare</span>
                  <span className="truncate text-xs capitalize">{session.role}</span>
                </div>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContentPrimitive>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Navigation</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.url}
                    onClick={() => navigate(item.url)}
                    tooltip={collapsed ? item.title : undefined}
                    className={collapsed ? 'justify-center px-0' : ''}
                  >
                    <item.icon />
                    {!collapsed && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContentPrimitive>

      <SidebarFooter className="mt-auto">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="sm"
              onClick={() => {}}
              className={`text-sidebar-foreground/60 hover:text-sidebar-foreground ${collapsed ? 'justify-center px-0' : ''}`}
            >
              <span className="text-xs">{collapsed ? 'v0.1' : 'v0.1.0'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </div>
  );
}

export function Sidebar({ session, collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(session.role)
  );

  return (
    <>
      {/* Mobile: sheet/drawer */}
      <Sheet open={mobileOpen} onOpenChange={(open) => !open && onMobileClose?.()}>
        <SheetContent side="left" className="w-64 p-0 [&>button]:top-3">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>App navigation menu</SheetDescription>
          </SheetHeader>
          <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
            <SidebarHeader>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton size="lg">
                    <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                      <Building2 className="size-4" />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">PharmaCare</span>
                      <span className="truncate text-xs capitalize">{session.role}</span>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarHeader>
            <SidebarContentPrimitive>
              <SidebarGroup>
                <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visibleItems.map((item) => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          isActive={location.pathname === item.url}
                          onClick={() => { navigate(item.url); onMobileClose?.(); }}
                        >
                          <item.icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContentPrimitive>
            <SidebarFooter className="mt-auto">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton size="sm" className="text-xs text-sidebar-foreground/60">
                    <span>v0.1.0</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop: fixed sidebar */}
      <div className="hidden md:flex h-full flex-col bg-sidebar text-sidebar-foreground border-r overflow-hidden transition-[width] duration-200 ease-linear"
        style={{ width: collapsed ? '3rem' : '16rem' }}
      >
        <SidebarNav session={session} collapsed={collapsed} />
        <div className="border-t p-2">
          <button
            onClick={onToggle}
            className="flex w-full items-center justify-center gap-2 rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
            {!collapsed && <span className="text-xs">Collapse</span>}
          </button>
        </div>
      </div>
    </>
  );
}
