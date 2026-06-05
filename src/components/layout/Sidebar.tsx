import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { LayoutDashboard, Users, ScrollText, Building2, Pill, Truck, Package, AlertTriangle } from 'lucide-react';
import type { SessionDto } from '@/types/session';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: ('owner' | 'pharmacist')[];
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: LayoutDashboard,
    roles: ['owner', 'pharmacist'],
  },
  {
    title: 'Users',
    url: '/users',
    icon: Users,
    roles: ['owner'],
  },
  {
    title: 'Audit Log',
    url: '/audit',
    icon: ScrollText,
    roles: ['owner'],
  },
  {
    title: 'Medicines',
    url: '/medicines',
    icon: Pill,
    roles: ['owner', 'pharmacist'],
  },
  {
    title: 'Suppliers',
    url: '/suppliers',
    icon: Truck,
    roles: ['owner'],
  },
  {
    title: 'Purchases',
    url: '/purchases',
    icon: Package,
    roles: ['owner'],
  },
  {
    title: 'Expiry Report',
    url: '/expiry-report',
    icon: AlertTriangle,
    roles: ['owner'],
  },
];

interface SidebarProps {
  session: SessionDto;
}

export function Sidebar({ session }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(session.role)
  );

  return (
    <SidebarPrimitive collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="group-data-[collapsible=icon]:!p-2">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
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
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.url}
                    onClick={() => navigate(item.url)}
                    tooltip={item.title}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" className="text-xs text-sidebar-foreground/60">
              <span>v0.1.0</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </SidebarPrimitive>
  );
}
