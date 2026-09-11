import { describe, expect, it } from 'vitest';

import {
  blockerNotice,
  buyLabel,
  cartLineNote,
  fmtDateTime,
  listPhrase,
  orderNote,
  overlayLabel,
  pageName,
  PAY_TITLES,
  stockNote,
  terminalNote,
  validateContact,
  validatePhone,
  voucherNotes,
  WA_MESSAGE,
  windowNote,
} from './copy.js';
import { orderMessage } from '../../../../src/lib/whatsapp.js';

describe('availability copy', () => {
  it('names each closed state the way the card overlay does', () => {
    expect(overlayLabel({ availability: 'sold_out' })).toEqual({ title: 'SOLD OUT', detail: null });
    expect(overlayLabel({ availability: 'ended' })).toEqual({ title: 'SALE ENDED', detail: null });
    expect(overlayLabel({ availability: 'scheduled', sell_from: '2026-12-01T09:00:00Z' }).title).toBe('COMING SOON');
    expect(overlayLabel({ availability: 'available' })).toBeNull();
    expect(overlayLabel({})).toBeNull();
  });

  it('puts the opening on the disabled button and the closing under the price', () => {
    const scheduled = { availability: 'scheduled', sell_from: '2026-12-01T09:00:00Z' };
    expect(buyLabel(scheduled)).toMatch(/^Opens /);
    expect(windowNote(scheduled).tone).toBe('gold');
    expect(buyLabel({ availability: 'ended' })).toBe('Sale closed');
    expect(buyLabel({ availability: 'available' })).toBeNull();
    expect(windowNote({ sell_until: '2026-12-01T09:00:00Z' }).text).toMatch(/^Available until /);
    expect(windowNote({})).toBeNull();
  });
});

describe('stock copy', () => {
  it('never quotes a stock count on a pre-order', () => {
    expect(stockNote({ preorder: true, preorder_lead_days: 10, stock: 0 }).text).toBe(
      'Pre-order · made after payment, ready to ship in ±10 days',
    );
    expect(stockNote({ preorder: true, stock: 0 }).text).toBe('Pre-order · made after payment');
  });

  it('walks the stock ladder', () => {
    expect(stockNote({ stock: 0 }).tone).toBe('terra');
    expect(stockNote({ stock: 3 }).text).toBe('Only 3 left — don’t miss out');
    expect(stockNote({ stock: 40 }, 'Denpasar').text).toBe(
      'In stock (40 pcs) — ships from Denpasar in 1–2 business days',
    );
    expect(stockNote(null)).toBeNull();
  });

  // Not counted: buyable at any number, so the number is never quoted and
  // the line never turns terra. The shipping promise still rides along.
  it('says in stock for an unlimited product, whatever the counter reads', () => {
    expect(stockNote({ unlimited_stock: true, stock: 0 })).toEqual({ text: 'In stock', tone: 'green' });
    expect(stockNote({ unlimited_stock: true, stock: 42 }).text).toBe('In stock');
    expect(stockNote({ unlimited_stock: true, stock: 0 }, 'Denpasar').text).toBe(
      'In stock — ships from Denpasar in 1–2 business days',
    );
  });

  it('gives every cart status a sentence, and a plain line none', () => {
    for (const s of ['loading', 'gone', 'error', 'scheduled', 'ended', 'soldout']) {
      expect(cartLineNote(s, {}, 0)?.text).toBeTruthy();
    }
    expect(cartLineNote('overstock', { stock: 2 }, 2).text).toBe('Only 2 left.');
    expect(cartLineNote('ok', { stock: 5 }, 5)).toBeNull();
    expect(cartLineNote('ok', { preorder: true, preorder_lead_days: 7 }, 99).text).toBe(
      'Pre-order · ±7 days after payment',
    );
  });

  it('asks for opposite actions on a scheduled and a dead line', () => {
    expect(blockerNotice(['ok', 'scheduled'])).toMatch(/come back/);
    expect(blockerNotice(['ok', 'soldout'])).toMatch(/Remove it/);
    expect(blockerNotice(['ok', 'overstock'])).toBeNull();
    expect(orderNote(0)).toBeNull();
    expect(orderNote(5)).toMatch(/±5 days/);
  });
});

describe('contact copy', () => {
  it('separates empty from malformed', () => {
    expect(validateContact('email', '')).toBe('Email is required.');
    expect(validateContact('email', 'nope')).toBe('That email address doesn’t look valid.');
    expect(validateContact('email', 'a@b.co')).toBeNull();
    expect(validateContact('whatsapp', '')).toBe('WhatsApp number is required.');
    expect(validateContact('whatsapp', '0812')).toMatch(/doesn’t look valid/);
    expect(validateContact('whatsapp', '0812 3456 789')).toBeNull();
    expect(validatePhone('')).toBe('Phone number is required.');
    expect(validatePhone('081234567890')).toBeNull();
  });

  it('lists fields the way a sentence does', () => {
    expect(listPhrase([])).toBe('');
    expect(listPhrase(['name'])).toBe('name');
    expect(listPhrase(['name', 'address', 'city'])).toBe('name, address and city');
  });
});

describe('order copy', () => {
  it('only mentions released stock when something was reserved', () => {
    expect(terminalNote({ status: 'expired', lines: [{ preorder: true }] })).not.toMatch(/stock/);
    expect(terminalNote({ status: 'expired', lines: [{ unlimited_stock: true }] })).not.toMatch(/stock/);
    expect(terminalNote({ status: 'expired', lines: [{ preorder: false }] })).toMatch(/stock has been released/);
    // One counted line is enough: something really was put back.
    expect(
      terminalNote({ status: 'expired', lines: [{ unlimited_stock: true }, { preorder: false }] }),
    ).toMatch(/stock has been released/);
    expect(terminalNote({ status: 'cancelled', lines: [] })).toBe('This order was cancelled.');
    expect(terminalNote({ status: 'processing' })).toBeNull();
  });

  it('reports a refused code and an outbid one, and stays silent otherwise', () => {
    expect(voucherNotes({})).toEqual([]);
    expect(voucherNotes({ voucher: { code: 'X', applied: false, message: 'Expired.' } })).toEqual([
      { tone: 'warn', text: 'Expired.' },
    ]);
    expect(voucherNotes({ voucher: { code: 'X', applied: true, amount: 5000, outbid: 5000 } })).toEqual([]);
    expect(voucherNotes({ voucher: { code: 'X', applied: true, amount: 5000, outbid: 9000, outbid_name: 'Payday' } })[0].text)
      .toMatch(/“Payday”.*code X/);
  });

  it('formats the clock with a colon, never a dot', () => {
    expect(fmtDateTime(new Date(2026, 8, 12, 14, 5))).toBe('12 Sept, 14:05');
    expect(fmtDateTime('garbage')).toBe('');
  });
});

describe('page names', () => {
  it('titles every route in English and leaves an unloaded product blank', () => {
    expect(pageName('/', { taglineShort: 'Bali · Hotel-grade linen' })).toBe('Bali · Hotel-grade linen');
    expect(pageName('/katalog?cat=Bedroom')).toBe('Shop');
    expect(pageName('/produk/bath-towel')).toBe('');
    expect(pageName('/produk/bath-towel', { product: { name: 'Bath Towel' } })).toBe('Bath Towel');
    expect(pageName('/pesanan/ABC')).toBe('Order');
    expect(pageName('/nothing')).toBe('');
  });
});

describe('WhatsApp order message', () => {
  it('titles the panel and reads as one English message', () => {
    expect(PAY_TITLES.manual_whatsapp).toBe('Send your order on WhatsApp');
    const order = {
      number: 'BL-260912-0003',
      customer_name: 'Made',
      city: 'Denpasar',
      courier_code: 'jne',
      subtotal: 450000,
      shipping_cost: 25000,
      shipping_discount: 25000,
      total: 450000,
      lines: [{ qty: 1, name: 'Bed Sheet Set Plain White — Queen TC-200' }],
    };
    expect(orderMessage(order, 'https://balilinen.test/pesanan/tok', WA_MESSAGE)).toBe(
      [
        'Hi, I’d like to order #BL-260912-0003',
        '',
        '- 1× Bed Sheet Set Plain White — Queen TC-200',
        '',
        'Subtotal: Rp 450.000',
        'Shipping: Rp 25.000 (jne)',
        'Shipping discount: -Rp 25.000',
        'Total: Rp 450.000',
        '',
        'For Made, Denpasar',
        'Order details: https://balilinen.test/pesanan/tok',
      ].join('\n'),
    );
  });
});
