import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { POSPaymentForm } from '@/components/pos/POSPaymentForm';
import type { CartItem } from '@/pages/POSPage';

const mockCartItems: CartItem[] = [
  {
    medicine: {
      id: 1,
      name: 'Panadol 500mg',
      generic_name: 'Paracetamol',
      unit: 'Strip',
      retail_price: 50.0,
      current_stock: 100,
      reorder_level: 10,
      shelf_location: 'A1',
    },
    quantity: 2,
    item_discount: 0,
  },
];

describe('POSPaymentForm Component', () => {
  it('calculates subtotal and total accurately', () => {
    render(
      <POSPaymentForm
        cartItems={mockCartItems}
        billDiscount={0}
        onBillDiscountChange={vi.fn()}
        taxEnabled={false}
        onTaxToggle={vi.fn()}
        taxRatePercent={0}
        paymentMethod="Cash"
        onPaymentMethodChange={vi.fn()}
        customerName=""
        onCustomerNameChange={vi.fn()}
        onConfirm={vi.fn()}
        billDiscountRef={React.createRef()}
        taxToggleRef={React.createRef()}
        paymentRef={React.createRef()}
        customerNameRef={React.createRef()}
        confirmRef={React.createRef()}
        loading={false}
        currencySymbol="Rs."
      />
    );

    // 2 * 50 = 100 (both subtotal and total)
    expect(screen.getAllByText('Rs. 100.00').length).toBeGreaterThanOrEqual(1);
  });

  it('calculates change due when cash tendered exceeds total', () => {
    render(
      <POSPaymentForm
        cartItems={mockCartItems}
        billDiscount={0}
        onBillDiscountChange={vi.fn()}
        taxEnabled={false}
        onTaxToggle={vi.fn()}
        taxRatePercent={0}
        paymentMethod="Cash"
        onPaymentMethodChange={vi.fn()}
        customerName=""
        onCustomerNameChange={vi.fn()}
        onConfirm={vi.fn()}
        billDiscountRef={React.createRef()}
        taxToggleRef={React.createRef()}
        paymentRef={React.createRef()}
        customerNameRef={React.createRef()}
        confirmRef={React.createRef()}
        loading={false}
        currencySymbol="Rs."
      />
    );

    // Enter cash tendered = 150
    const cashInput = screen.getByLabelText(/Cash Tendered/i);
    fireEvent.change(cashInput, { target: { value: '150' } });

    // 150 - 100 = 50 change due
    expect(screen.getAllByText(/50.00/i).length).toBeGreaterThan(0);
  });
});
