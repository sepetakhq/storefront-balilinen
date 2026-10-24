import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

let config;
vi.mock('@sepetakhq/storefront-kit/config/ConfigProvider', () => ({ useConfig: () => config }));
vi.mock('@sepetakhq/storefront-kit/hooks/queries', () => ({ useCategories: () => ({ data: [] }) }));

const { default: Footer } = await import('./Footer.jsx');

afterEach(cleanup);

describe('Footer', () => {
  it("draws the server's badge in place of a name, once per badge, and keeps names it has none for", () => {
    const bca = 'http://api.test/logos/payment/bca.svg';
    const jne = 'http://api.test/logos/courier/jne.svg';
    config = {
      tenant: { name: 'Toko' },
      brand: { sections: {} },
      paymentMethods: [
        { code: 'BCA', name: 'VA BCA', logo_url: bca },
        { code: 'MANUAL_BCA', name: 'Transfer BCA', logo_url: bca },
        { code: 'MANUAL_BANK_1', name: 'Transfer SeaBank' },
      ],
      couriers: [
        { code: 'toko', name: 'Kurir Toko' },
        { code: 'jne', name: 'JNE REG', logo_url: jne },
        { code: 'jne', name: 'JNE YES', logo_url: jne },
      ],
    };
    const { container } = render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );
    const imgs = [...container.querySelectorAll('.bl-logo-chip img')];
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual([bca, jne]);
    // The first name behind a badge is how it is read aloud.
    expect(screen.getByRole('img', { name: 'VA BCA' })).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Transfer BCA' })).toBeNull();
    expect(screen.getByText('Transfer SeaBank')).toBeTruthy();
    expect(screen.getByText('Kurir Toko')).toBeTruthy();
  });

  // The platform's mark rides the plan. An older API version strips the
  // field, and then nothing is drawn.
  it('shows the Sepetak badge only when the shop carries it', () => {
    const setup = (tenant) => {
      config = {
        tenant,
        paymentMethods: [{ code: 'QRIS', name: 'QRIS', enabled: true }],
        couriers: [],
        brand: { nav: [], wordmark_primary: 'Toko', copyright: '© Toko', sections: {} },
      };
      return render(
        <MemoryRouter>
          <Footer />
        </MemoryRouter>,
      );
    };
    setup({});
    expect(screen.getByText('© Toko')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Dibuat dengan Sepetak' })).toBeNull();
    cleanup();
    setup({ sepetak_badge: true });
    const a = screen.getByRole('link', { name: 'Dibuat dengan Sepetak' });
    expect(a.getAttribute('href')).toBe('https://sepetak.com/?ref=toko');
    expect(a.getAttribute('target')).toBe('_blank');
  });
});
