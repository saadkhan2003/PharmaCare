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

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Sales & Checkout',
    items: [
      { title: 'POS', url: '/pos', icon: ShoppingCart, roles: ['owner', 'pharmacist'], shortcut: '⌘1' },
      { title: 'POS History', url: '/pos/history', icon: History, roles: ['owner', 'pharmacist'] },
      { title: 'Customer Return', url: '/returns/customer', icon: Undo2, roles: ['owner', 'pharmacist'] },
    ],
  },
  {
    title: 'Inventory & Stock',
    items: [
      { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, roles: ['owner', 'pharmacist'], shortcut: '⌘2' },
      { title: 'Medicines', url: '/medicines', icon: Pill, roles: ['owner', 'pharmacist'], shortcut: '⌘3' },
      { title: 'Purchases', url: '/purchases', icon: Package, roles: ['owner'] },
      { title: 'Batches', url: '/batches', icon: Boxes, roles: ['owner'] },
      { title: 'Suppliers', url: '/suppliers', icon: Truck, roles: ['owner'] },
      { title: 'Supplier Return', url: '/returns/supplier', icon: RotateCcw, roles: ['owner'] },
      { title: 'Write Off', url: '/returns/write-off', icon: Trash2, roles: ['owner'] },
    ],
  },
  {
    title: 'Finance & Reports',
    items: [
      { title: 'Reports', url: '/reports', icon: BarChart3, roles: ['owner'], shortcut: '⌘R' },
      { title: 'Expiry Report', url: '/expiry-report', icon: AlertTriangle, roles: ['owner'] },
      { title: 'Debts', url: '/debts', icon: HandCoins, roles: ['owner'] },
      { title: 'Supplier Debts', url: '/supplier-debts', icon: CircleDollarSign, roles: ['owner'], shortcut: '⌘8' },
      { title: 'Return History', url: '/returns/history', icon: ScrollText, roles: ['owner'] },
    ],
  },
  {
    title: 'Administration',
    items: [
      { title: 'Users', url: '/users', icon: Users, roles: ['owner'] },
      { title: 'Audit Log', url: '/audit', icon: ScrollText, roles: ['owner'] },
      { title: 'Settings', url: '/settings', icon: Settings, roles: ['owner'], shortcut: '⌘L' },
    ],
  },
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
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
                <Building2 className="size-4" />
              </div>
              {!isCollapsed && (
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-bold tracking-tight text-foreground">PharmaCare</span>
                  <span className="truncate text-[11px] capitalize text-muted-foreground">{session.role} Portal</span>
                </div>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="space-y-2 py-1">
        {navSections.map((section) => {
          const visibleItems = section.items.filter((item) => item.roles.includes(session.role));
          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={section.title} className="py-1">
              {!isCollapsed && (
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  {section.title}
                </div>
              )}
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
                          location.pathname === item.url && !isCollapsed && 'border-l-2 border-l-emerald-600 font-semibold bg-sidebar-accent text-sidebar-accent-foreground'
                        )}
                      >
                        <item.icon className={cn("size-4", location.pathname === item.url && "text-emerald-600 dark:text-emerald-400")} />
                        {!isCollapsed && (
                          <span className="flex-1 text-xs">{item.title}</span>
                        )}
                        {!isCollapsed && item.shortcut && (
                          <kbd className="ml-auto text-[10px] text-muted-foreground bg-muted/60 px-1 py-0.5 rounded font-mono">{item.shortcut}</kbd>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="mt-auto border-t border-border/40 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="sm"
              onClick={toggleSidebar}
              tooltip={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={cn(
                'text-sidebar-foreground/70 hover:text-sidebar-foreground',
                isCollapsed ? 'justify-center px-0' : ''
              )}
            >
              {isCollapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
              {!isCollapsed && <span className="text-xs">Collapse</span>}
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
                  <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
                    <Building2 className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-bold text-foreground">PharmaCare</span>
                    <span className="truncate text-[11px] capitalize text-muted-foreground">{session.role} Portal</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent className="space-y-2 py-1">
            {navSections.map((section) => {
              const visibleItems = section.items.filter((item) => item.roles.includes(session.role));
              if (visibleItems.length === 0) return null;

              return (
                <SidebarGroup key={section.title} className="py-1">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    {section.title}
                  </div>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {visibleItems.map((item) => (
                        <SidebarMenuItem key={item.url}>
                          <SidebarMenuButton
                            isActive={location.pathname === item.url}
                            onClick={() => { navigate(item.url); onClose(); }}
                            className={cn(
                              'transition-all duration-150',
                              location.pathname === item.url && 'border-l-2 border-l-emerald-600 font-semibold bg-sidebar-accent text-sidebar-accent-foreground'
                            )}
                          >
                            <item.icon className={cn("size-4", location.pathname === item.url && "text-emerald-600 dark:text-emerald-400")} />
                            <span className="flex-1 text-xs">{item.title}</span>
                            {item.shortcut && (
                              <kbd className="ml-auto text-[10px] text-muted-foreground bg-muted/60 px-1 py-0.5 rounded font-mono">{item.shortcut}</kbd>
                            )}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              );
            })}
          </SidebarContent>
          <SidebarFooter className="mt-auto border-t border-border/40 p-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <div className="px-3 py-1.5 text-xs text-muted-foreground">
                  PharmaCare v0.1.0
                </div>
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
