import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@sepetakhq/storefront-kit/api/client';

const JNE = 'http://api.test/logos/courier/jne.svg';
vi.mock('@sepetakhq/storefront-kit/api/endpoints', () => ({
  getShippingRates: async () => ({
    weight_grams: 1000,
    free_shipping: false,
    options: [
      { quote_id: 'q1', name: 'Reguler', courier_code: 'jne', courier_name: 'JNE', courier_logo_url: JNE, cost: 12000, etd: '2-3 days' },
      { quote_id: 'q2', name: 'Kilat', courier_code: 'toko', courier_name: 'Kurir Toko', cost: 15000, etd: '1 day' },
    ],
  }),
}));

const { default: ShippingRates, RateProblem } = await import('./ShippingRates.jsx');

afterEach(cleanup);

describe('RateProblem', () => {
  it('offers a retry for a provider outage', () => {
    const err = new ApiError(503, 'rates_unavailable', 'Ongkir belum bisa dihitung sekarang.');
    render(<RateProblem error={err} onRetry={() => {}} onEdit={() => {}} />);
    expect(screen.getByText('Rates can’t be worked out right now.')).toBeTruthy();
  });

  // The shop spent its monthly live rate checks. The API's message is
  // Indonesian, so this English template says it in its own words.
  it('says the rate checks are used up without offering a retry', () => {
    const err = new ApiError(409, 'rate_checks_exhausted', 'Ongkir otomatis toko ini sedang tidak tersedia.');
    render(<RateProblem error={err} onRetry={() => {}} onEdit={() => {}} />);
    expect(screen.getByText('Live shipping rates are unavailable right now.')).toBeTruthy();
    expect(screen.getByText('Please contact the shop to complete your order.')).toBeTruthy();
  });
});

// The badge is the server's; the name stays beside it, so the picture is
// decorative and a row without one simply has none.
describe('ShippingRates', () => {
  it("draws the server's courier badge beside the name, and none when it sends none", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ShippingRates destination={{ ref: 'd1', label: 'Ubud' }} items={[{ product_id: 'p1', qty: 1 }]} selected="q1" onSelect={() => {}} onRetry={() => {}} />
      </QueryClientProvider>,
    );
    const withBadge = (await screen.findByText(/JNE/)).closest('button');
    const img = withBadge.querySelector('img.bl-choice-logo');
    expect(img.getAttribute('src')).toBe(JNE);
    expect(img.getAttribute('alt')).toBe('');
    expect(screen.getByText(/Kurir Toko/).closest('button').querySelector('img')).toBeNull();
  });
});
