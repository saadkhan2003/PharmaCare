import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BatchesPage } from '@/pages/BatchesPage';
import { ToastProvider } from '@/components/ui/toast-provider';
import type { BatchListDto } from '@/types/batch';
import type { SessionDto } from '@/types/session';

const mockBatches: BatchListDto[] = [
  {
    id: 1,
    purchase_id: 10,
    medicine_id: 101,
    medicine_name: 'Amoxicillin 500mg',
    batch_code: 'AMX-2026',
    expiry_date: '2026-12-31', // future: good
    quantity: 100,
    remaining_qty: 40,
    purchase_price: 15.0,
    received_date: '2026-01-10',
  },
  {
    id: 2,
    purchase_id: 11,
    medicine_id: 102,
    medicine_name: 'Panadol Extra',
    batch_code: 'PAN-001',
    expiry_date: '2020-01-01', // expired
    quantity: 50,
    remaining_qty: 10,
    purchase_price: 5.0,
    received_date: '2019-12-01',
  },
  {
    id: 3,
    purchase_id: null,
    medicine_id: 103,
    medicine_name: 'Cough Syrup Expectorant',
    batch_code: 'CS-ZERO',
    expiry_date: '2027-05-20',
    quantity: 20,
    remaining_qty: 0, // zero stock
    purchase_price: 30.0,
    received_date: '2026-02-01',
  },
];

vi.mock('@/lib/tauri', () => ({
  tauri: {
    batches: {
      list: vi.fn(),
      update: vi.fn(),
    },
    settings: {
      get: vi.fn().mockResolvedValue({ currency_symbol: 'Rs.' }),
    },
  },
}));

vi.mock('@/lib/eventBus', () => ({
  useAutoRefresh: () => [0],
}));

const mockSession: SessionDto = {
  token: 'mock-token',
  user_id: 1,
  username: 'owner',
  role: 'owner',
  full_name: 'Owner User',
};

describe('BatchesPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders batches correctly after loading', async () => {
    const { tauri } = await import('@/lib/tauri');
    vi.mocked(tauri.batches.list).mockResolvedValue(mockBatches);

    render(
      <ToastProvider>
        <BatchesPage session={mockSession} />
      </ToastProvider>
    );

    expect(screen.getByText(/Loading inventory batches.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Amoxicillin 500mg')).toBeInTheDocument();
      expect(screen.getByText('Panadol Extra')).toBeInTheDocument();
      expect(screen.getByText('Cough Syrup Expectorant')).toBeInTheDocument();
    });

    expect(screen.getByText('AMX-2026')).toBeInTheDocument();
    expect(screen.getByText('3 Total Batches')).toBeInTheDocument();
  });

  it('filters batches based on search query', async () => {
    const { tauri } = await import('@/lib/tauri');
    vi.mocked(tauri.batches.list).mockResolvedValue(mockBatches);

    render(
      <ToastProvider>
        <BatchesPage session={mockSession} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Amoxicillin 500mg')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by medicine name, lot code, or #ID.../i);
    fireEvent.change(searchInput, { target: { value: 'Panadol' } });

    expect(screen.getByText('Panadol Extra')).toBeInTheDocument();
    expect(screen.queryByText('Amoxicillin 500mg')).not.toBeInTheDocument();
  });

  it('filters batches by expired and zero stock status tabs', async () => {
    const { tauri } = await import('@/lib/tauri');
    vi.mocked(tauri.batches.list).mockResolvedValue(mockBatches);

    render(
      <ToastProvider>
        <BatchesPage session={mockSession} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Amoxicillin 500mg')).toBeInTheDocument();
    });

    // Click Expired tab
    const expiredTab = screen.getByRole('button', { name: /^Expired$/i });
    fireEvent.click(expiredTab);

    expect(screen.getByText('Panadol Extra')).toBeInTheDocument();
    expect(screen.queryByText('Amoxicillin 500mg')).not.toBeInTheDocument();
    expect(screen.queryByText('Cough Syrup Expectorant')).not.toBeInTheDocument();

    // Click Zero Qty tab
    const zeroTab = screen.getByRole('button', { name: /Zero Qty/i });
    fireEvent.click(zeroTab);

    expect(screen.getByText('Cough Syrup Expectorant')).toBeInTheDocument();
    expect(screen.queryByText('Panadol Extra')).not.toBeInTheDocument();
    expect(screen.queryByText('Amoxicillin 500mg')).not.toBeInTheDocument();
  });
});
