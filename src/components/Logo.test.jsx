import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

let config;
vi.mock('@sepetakhq/storefront-kit/config/ConfigProvider', () => ({ useConfig: () => config }));

const { Logo } = await import('./Logo.jsx');

afterEach(cleanup);

describe('Logo', () => {
  it("draws the shop's uploaded logo", () => {
    config = { brand: { logoImage: { url: 'https://cdn/x.png', alt: 'Mark' } }, tenant: { name: 'Toko' } };
    const { container } = render(<Logo />);
    expect(container.querySelector('img').getAttribute('src')).toBe('https://cdn/x.png');
  });

  it('falls back to the wordmark, then the shop name, never a bundled mark', () => {
    config = { brand: { wordmark_primary: 'Kain', wordmark_accent: 'Putih' }, tenant: { name: 'Toko' } };
    let { container } = render(<Logo />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('Kain Putih');
    cleanup();

    config = { brand: {}, tenant: { name: 'Toko Contoh' } };
    ({ container } = render(<Logo />));
    expect(container.textContent).toBe('Toko Contoh');
  });
});
