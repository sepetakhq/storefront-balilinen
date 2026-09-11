import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

// Mocked rather than wrapped in a real ConfigProvider, which would need a
// network request and a QueryClient to answer a question about rendering.
vi.mock('../../../../src/config/ConfigProvider.jsx', () => ({
  useConfig: () => ({
    brand: { whatsapp_url: 'https://wa.me/628110000000', whatsapp_text: 'Chat with us' },
    payment: { qris_merchant_name: 'BALI LINEN', qris_nmid: 'ID10269876543', account_holder: 'a/n BALI LINEN' },
  }),
}));
vi.mock('../../../../src/ui/ToastProvider.jsx', () => ({ useToast: () => () => {} }));

const { PaymentPanel } = await import('./OrderRoute.jsx');

const emvco =
  '00020101021226670016COM.NOBUBANK.WWW01189360050300000898240214' +
  '1234567890123450303UMI51440014ID.CO.QRIS.WWW0215ID10261234567890303UMI' +
  '5204541153033605802ID5910BALI LINEN6010DENPASAR61055111162070703A016304ABCD';

const order = {
  number: 'BL-260911-0001',
  status: 'awaiting_payment',
  total: 350000,
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
  timeline: [],
  lines: [],
};

// The copy the buyer sees when the storefront cannot render what it was
// given. Its presence is the failure this file exists to catch.
const DEAD_END = /test mode|not available/i;

function panel(payment, props = {}) {
  render(<PaymentPanel order={order} payment={payment} onRefresh={() => {}} {...props} />);
}

describe('PaymentPanel renders every kind the backend can emit', () => {
  it('va: shows the account number to transfer to', () => {
    panel({ kind: 'va', method: 'BCA', amount: 350000, va_bank: 'BCA', va_number: '31086616057511859904943' });
    expect(screen.getByText(/31086616057511859904943/)).toBeTruthy();
    expect(screen.getByText(/Pay by virtual account/)).toBeTruthy();
    expect(screen.queryByText(DEAD_END)).toBeNull();
  });

  it('qr: encodes an EMVCo payload rather than refusing it', () => {
    panel({ kind: 'qr', method: 'QRIS', amount: 350000, qr_payload: emvco });
    expect(screen.getByText(/Scan with any bank/)).toBeTruthy();
    expect(screen.queryByText(DEAD_END)).toBeNull();
  });

  it('qr: refuses the stub payload and says so', () => {
    panel({ kind: 'qr', method: 'QRIS', amount: 350000, qr_payload: 'STUB-QRIS|abc' });
    expect(screen.getByText(/QRIS in test mode/)).toBeTruthy();
  });

  it('qr_image: shows the image the provider drew', () => {
    panel({ kind: 'qr_image', method: 'QRIS', amount: 350000, qr_image_url: 'https://gateway.example/qr/TRX1.png' });
    expect(screen.getByAltText(/QRIS/i).getAttribute('src')).toContain('gateway.example');
    expect(screen.queryByText(DEAD_END)).toBeNull();
  });

  it('redirect: offers a link that leaves this site, and an inert panel for the stub', () => {
    panel({ kind: 'redirect', method: 'GOPAY', amount: 350000, redirect_url: 'https://pay.example/abc' });
    expect(screen.getByRole('link', { name: /Continue to the payment page/ }).getAttribute('href')).toBe('https://pay.example/abc');
    cleanup();
    panel({ kind: 'redirect', method: 'GOPAY', amount: 350000, redirect_url: '/dev/pay/abc' });
    expect(screen.getByText(/Test mode/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Continue to the payment page/ })).toBeNull();
  });

  it('manual_transfer: shows the shop account, marks the unique code, and offers the claim', () => {
    const onClaim = vi.fn();
    panel(
      { kind: 'manual_transfer', method: 'MANUAL_BCA', amount: 350123, status: 'pending', manual_bank: 'BCA', manual_account_number: '8808081100000000', manual_account_holder: 'Bali Linen' },
      { onClaim },
    );
    expect(screen.getByText(/8808081100000000/)).toBeTruthy();
    expect(screen.getByText(/a\/n Bali Linen/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /I’ve paid/ }));
    expect(onClaim).toHaveBeenCalled();
  });

  it('manual_transfer: reports a missing account instead of drawing an empty plate', () => {
    panel({ kind: 'manual_transfer', method: 'MANUAL_BCA', amount: 350000, status: 'pending' });
    expect(screen.getByText(/Account not available/)).toBeTruthy();
  });

  it('manual_qris: shows the shop image and tells the buyer to type the amount', () => {
    panel({ kind: 'manual_qris', method: 'MANUAL_QRIS', amount: 350000, status: 'pending', manual_qr_image_url: 'https://cdn.example/t/x/products/qris.png' });
    expect(screen.getByAltText(/QRIS/i)).toBeTruthy();
    expect(screen.getByText(/carries no amount/)).toBeTruthy();
  });

  it('manual_whatsapp: opens a chat with the order already written, and offers the claim', () => {
    const onClaim = vi.fn();
    panel(
      { kind: 'manual_whatsapp', method: 'MANUAL_WHATSAPP', amount: 350000, status: 'pending', manual_whatsapp_phone: '628110000000' },
      { onClaim },
    );
    expect(screen.getByText(/Send your order on WhatsApp/)).toBeTruthy();
    const link = screen.getByText(/Open WhatsApp/).closest('a');
    expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/628110000000\?text=/);
    expect(decodeURIComponent(link.getAttribute('href'))).toContain('#BL-260911-0001');
    // The buyer reads what they are about to send, in English.
    expect(screen.getByText(/Hi, I’d like to order #BL-260911-0001/)).toBeTruthy();
    // No account chrome: nothing to copy.
    expect(screen.queryByRole('button', { name: /^Copy$/ })).toBeNull();
    expect(screen.queryByText(DEAD_END)).toBeNull();
    // The claim is worded for a chat, not a transfer.
    expect(screen.getByText(/Paid as agreed on WhatsApp/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /I’ve paid/ }));
    expect(onClaim).toHaveBeenCalled();
  });

  it('manual_whatsapp: reports a missing number instead of a blank panel', () => {
    panel({ kind: 'manual_whatsapp', method: 'MANUAL_WHATSAPP', amount: 350000, status: 'pending' });
    expect(screen.getByText(/WhatsApp number not available/)).toBeTruthy();
    expect(screen.queryByText(/Open WhatsApp/)).toBeNull();
  });

  it('dead intent: the order is still payable and a retry is offered', () => {
    const onRetry = vi.fn();
    panel(null, { onRetry });
    expect(screen.getByText(/Payment couldn’t be opened/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Try payment again/ }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('past the deadline: checks rather than declares expiry', () => {
    render(<PaymentPanel order={{ ...order, expires_at: new Date(Date.now() - 60_000).toISOString() }} payment={{ kind: 'va', amount: 1, va_number: '1' }} onRefresh={() => {}} />);
    expect(screen.getByText(/Payment window closed/)).toBeTruthy();
    expect(screen.queryByText(/Expired/)).toBeNull();
  });
});
