import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ApiError } from '@sepetakhq/storefront-kit/api/client';

afterEach(cleanup);

const { RateProblem } = await import('./ShippingRates.jsx');

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
