import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

let product = {};
vi.mock('@sepetakhq/storefront-kit/config/ConfigProvider', () => ({
  useConfig: () => ({ brand: { sections: {} }, freeShipping: false, freeShippingMinLabel: '', copy: (s) => s }),
}));
vi.mock('@sepetakhq/storefront-kit/hooks/queries', () => ({
  useProduct: () => ({ data: product, isPending: false, isError: false, refetch: () => {} }),
}));
const cartCalls = [];
vi.mock('@sepetakhq/storefront-kit/cart/CartProvider', () => ({
  useCart: () => ({ add: (...args) => cartCalls.push(args) }),
}));
vi.mock('@sepetakhq/storefront-kit/ui/ToastProvider', () => ({ useToast: () => () => {} }));

const { default: ProductRoute } = await import('./ProductRoute.jsx');

function draw(p) {
  cartCalls.length = 0;
  product = {
    id: 'p1', slug: 'linen', name: 'Linen', price: 80000, stock: 5, availability: 'available',
    images: [], related: [], description: '', ...p,
  };
  render(
    <MemoryRouter initialEntries={['/produk/linen']}>
      <ProductRoute />
    </MemoryRouter>,
  );
}

// A product sold by weight counts grams: the stepper starts at qty_min, moves
// by qty_step, and the price reads per kg. Pieces stay a bare number.
describe('ProductRoute sale units', () => {
  it('prices per kg and steps the weight from its minimum', () => {
    draw({ unit: 'kg', qty_step: 100, qty_min: 500, stock: 5000 });
    expect(screen.getByText('/kg')).toBeTruthy();
    expect(screen.getByText('0,5 kg')).toBeTruthy();
    expect(screen.getByText('Only 5 kg left — don’t miss out')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Decrease quantity' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(screen.getByText('0,6 kg')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Add to cart — Rp 48\.000$/ }));
    expect(cartCalls[0][1]).toBe(600);
  });

  it('keeps pieces as before', () => {
    draw({ stock: 2 });
    expect(screen.queryByText('/pcs')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Increase quantity' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: /^Add to cart — Rp 160\.000$/ })).toBeTruthy();
  });
});
