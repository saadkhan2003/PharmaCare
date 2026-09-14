import { useLocation, useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { LayoutDashboard, ShoppingCart, Users, ScrollText, Building2, Pill, Truck, Package, AlertTriangle, Undo2, RotateCcw, Trash2, BarChart3, Settings, PanelLeftClose, PanelLeft, HandCoins, History, Boxes, CircleDollarSign } from 'lucide-react';
import { playClick } from '@/lib/sounds';
import type { SessionDto } from '@/types/session';
import { cn } from '@/lib/utils';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: ('owner' | 'pharmacist')[];
  shortcut?: string;
}

const navItems: NavItem[] = [
  { title: 'POS', url: '/pos', icon: ShoppingCart, roles: ['owner', 'pharmacist'] },
  { title: 'POS History', url: '/pos/history', icon: History, roles: ['owner', 'pharmacist'] },
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, roles: ['owner', 'pharmacist'] },
  { title: 'Medicines', url: '/medicines', icon: Pill, roles: ['owner', 'pharmacist'] },
  { title: 'Suppliers', url: '/suppliers', icon: Truck, roles: ['owner'] },
  { title: 'Purchases', url: '/purchases', icon: Package, roles: ['owner'] },
  { title: 'Batches', url: '/batches', icon: Boxes, roles: ['owner'] },
  { title: 'Reports', url: '/reports', icon: BarChart3, roles: ['owner'] },
  { title: 'Expiry Report', url: '/expiry-report', icon: AlertTriangle, roles: ['owner'] },
  { title: 'Debts', url: '/debts', icon: HandCoins, roles: ['owner'] },
  { title: 'Supplier Debts', url: '/supplier-debts', icon: CircleDollarSign, roles: ['owner'], shortcut: '⌘8' },
  { title: 'Users', url: '/users', icon: Users, roles: ['owner'] },
  { title: 'Audit Log', url: '/audit', icon: ScrollText, roles: ['owner'] },
  { title: 'Customer Return', url: '/returns/customer', icon: Undo2, roles: ['owner', 'pharmacist'] },
  { title: 'Supplier Return', url: '/returns/supplier', icon: RotateCcw, roles: ['owner'] },
  { title: 'Write Off', url: '/returns/write-off', icon: Trash2, roles: ['owner'] },
  { title: 'Return History', url: '/returns/history', icon: ScrollText, roles: ['owner'] },
  { title: 'Settings', url: '/settings', icon: Settings, roles: ['owner'] },
];

interface SidebarProps {
  session: SessionDto;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function DesktopSidebar({ session }: { session: SessionDto }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(session.role)
  );

  return (
    <div
      className={cn(
        "flex flex-col bg-sidebar text-sidebar-foreground border-r overflow-hidden transition-[width] duration-200 ease-linear h-full",
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className={isCollapsed ? 'justify-center px-0' : ''}>
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Building2 className="size-4" />
              </div>
              {!isCollapsed && (
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">PharmaCare</span>
                  <span className="truncate text-xs capitalize">{session.role}</span>
                </div>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.url}
                    onClick={() => { playClick(); navigate(item.url); }}
                    tooltip={isCollapsed ? item.title : undefined}
                    className={cn(
                      'transition-all duration-150',
                      isCollapsed ? 'justify-center px-0' : '',
                      location.pathname === item.url && !isCollapsed && 'border-l-2 border-l-sidebar-primary rounded-l-none'
                    )}
                  >
                    <item.icon />
                    {!isCollapsed && (
                      <span className="flex-1">{item.title}</span>
                    )}
                    {!isCollapsed && item.shortcut && (
                      <kbd className="ml-auto text-[10px] text-muted-foreground bg-muted px-1 rounded">{item.shortcut}</kbd>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="mt-auto">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="sm"
              onClick={toggleSidebar}
              tooltip={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={cn(
                'text-sidebar-foreground/60 hover:text-sidebar-foreground',
                isCollapsed ? 'justify-center px-0' : ''
              )}
            >
              {isCollapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
              {!isCollapsed && <span>Collapse</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" className={cn('text-xs text-sidebar-foreground/60', isCollapsed ? 'justify-center px-0' : '')}>
              <span>v0.1.0</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </div>
  );
}

function MobileSidebar({ session, onClose }: { session: SessionDto; onClose: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(session.role)
  );

  return (
    <Sheet open={true} onOpenChange={(open) => !open && onClose()}>
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
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        isActive={location.pathname === item.url}
                        onClick={() => { navigate(item.url); onClose(); }}
                      >
                        <item.icon />
                        <span className="flex-1">{item.title}</span>
                        {item.shortcut && (
                          <kbd className="ml-auto text-[10px] text-muted-foreground bg-muted px-1 rounded">{item.shortcut}</kbd>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
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
  );
}

export function Sidebar({ session, mobileOpen, onMobileClose }: SidebarProps) {
  return (
    <>
      {mobileOpen && (
        <MobileSidebar session={session} onClose={() => onMobileClose?.()} />
      )}
      <div className="hidden md:block h-full">
        <DesktopSidebar session={session} />
      </div>
    </>
  );
}
