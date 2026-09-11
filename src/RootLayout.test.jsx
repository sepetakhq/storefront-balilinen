import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { StoreUnavailable, Splash } from './RootLayout.jsx';

afterEach(cleanup);

// The gates render outside the config they wait for, so they must never name
// a shop, and each failure must say what happened.
describe('the store gates', () => {
  it('waits without words', () => {
    const { container } = render(<Splash />);
    expect(container.textContent).toBe('');
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('tells an unknown host apart from a closed shop and a stale bundle', () => {
    render(<StoreUnavailable error={{ status: 404 }} />);
    expect(screen.getByText('Store not found')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    cleanup();

    render(<StoreUnavailable error={{ status: 503 }} onRetry={() => {}} />);
    expect(screen.getByText('Store temporarily closed')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
    cleanup();

    render(<StoreUnavailable error={{ code: 'unsupported_api_version' }} />);
    expect(screen.getByText('Please reload')).toBeTruthy();
    cleanup();

    // A 5xx carries the client's Indonesian fallback; the English shop never
    // shows it.
    render(<StoreUnavailable error={{ status: 500, message: 'Ada gangguan di sisi kami.' }} onRetry={() => {}} />);
    expect(screen.getByText('Couldn’t reach the shop')).toBeTruthy();
    expect(screen.queryByText(/Ada gangguan/)).toBeNull();
    expect(screen.getByText('Please try again in a moment.')).toBeTruthy();
  });
});
