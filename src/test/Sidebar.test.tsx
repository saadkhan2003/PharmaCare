import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Sidebar } from '@/components/layout/Sidebar';

beforeAll(() => {
  window.matchMedia = window.matchMedia || (() => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
});

const mockSession = {
  token: 'test-token',
  user_id: 1,
  username: 'owner',
  role: 'owner' as const,
  full_name: 'Test Owner',
};

function renderSidebar() {
  return render(
    <MemoryRouter>
      <SidebarProvider>
        <Sidebar session={mockSession} mobileOpen={false} onMobileClose={() => {}} />
      </SidebarProvider>
    </MemoryRouter>
  );
}

describe('Sidebar', () => {
  it('renders the PharmaCare brand', () => {
    renderSidebar();
    expect(screen.getByText('PharmaCare')).toBeInTheDocument();
  });

  it('shows the user role', () => {
    renderSidebar();
    expect(screen.getByText('owner')).toBeInTheDocument();
  });

  it('renders navigation items for owner role', () => {
    renderSidebar();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Medicines')).toBeInTheDocument();
    expect(screen.getByText('POS')).toBeInTheDocument();
  });
});
