/**
 * The English twins of the shared helpers that speak Indonesian.
 *
 * Everything that *decides* -- sale windows, pre-order rules, the cart ladder,
 * contact normalisation -- is imported from src/lib and src/shared unchanged.
 * What lives here is only the sentence each decision turns into, because this
 * storefront reads in English and those modules were written for one that
 * does not. The server's own error messages stay as they arrive.
 *
 * Kept as pure functions so they are tested the same way the originals are.
 */

import {
  closesAt,
  isBlocking,
  isEnded,
  isScheduled,
  opensAt,
  saleState,
  SCHEDULED,
  ENDED,
  SOLD_OUT,
} from '../../../../src/lib/availability.js';
import { leadDays } from '../../../../src/lib/preorder.js';
import {
  CHANNEL_WHATSAPP,
  normalizeContact,
  normalizePhone,
} from '../../../../src/lib/contact.js';

// --- dates ------------------------------------------------------------------

const DATE_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const SHORT_DATE_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

function asDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "12 Sep 2026" */
export function fmtDate(value) {
  const d = asDate(value);
  return d ? DATE_FMT.format(d) : '';
}

/** "12 Sep, 14:30" -- the clock as everyone writes it, never "2.30 pm". */
export function fmtDateTime(value) {
  const d = asDate(value);
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${SHORT_DATE_FMT.format(d)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// --- availability -----------------------------------------------------------

/** The card overlay: two lines, the second optional; null when buyable. */
export function overlayLabel(product) {
  switch (saleState(product)) {
    case SCHEDULED: {
      const at = opensAt(product);
      return { title: 'COMING SOON', detail: at ? fmtDateTime(at) : null };
    }
    case ENDED:
      return { title: 'SALE ENDED', detail: null };
    case SOLD_OUT:
      return { title: 'SOLD OUT', detail: null };
    default:
      return null;
  }
}

/** The sentence under a product about its window, or null. `tone` is a CSS token name. */
export function windowNote(product) {
  if (isScheduled(product)) {
    const at = opensAt(product);
    return { text: at ? `Opens ${fmtDateTime(at)}` : 'Not open yet', tone: 'gold' };
  }
  if (isEnded(product)) return { text: 'This sale has ended', tone: 'terra' };
  const until = closesAt(product);
  if (!until) return null;
  return { text: `Available until ${fmtDateTime(until)}`, tone: 'muted' };
}

/** The label on a disabled buy button, or null when it should work. */
export function buyLabel(product) {
  switch (saleState(product)) {
    case SCHEDULED: {
      const at = opensAt(product);
      return at ? `Opens ${fmtDateTime(at)}` : 'Not open yet';
    }
    case ENDED:
      return 'Sale closed';
    case SOLD_OUT:
      return 'Sold out';
    default:
      return null;
  }
}

// --- pre-order and stock ----------------------------------------------------

/** The one-line note under a product: pre-order first, then the stock ladder. */
export function stockNote(product, originCity) {
  if (!product) return null;
  if (product.preorder) {
    const days = leadDays(product);
    return {
      text: days
        ? `Pre-order · made after payment, ready to ship in ±${days} days`
        : 'Pre-order · made after payment',
      tone: 'green',
    };
  }
  const stock = product.stock ?? 0;
  if (stock <= 0) return { text: 'Out of stock — restocking soon', tone: 'terra' };
  if (stock < 10) return { text: `Only ${stock} left — don’t miss out`, tone: 'gold' };
  return {
    text: `In stock (${stock} pcs)${originCity ? ` — ships from ${originCity} in 1–2 business days` : ''}`,
    tone: 'green',
  };
}

/** The short form for a cart line. */
export function shortNote(product) {
  if (!product?.preorder) return null;
  const days = leadDays(product);
  return days ? `Pre-order · ±${days} days after payment` : 'Pre-order · made after ordering';
}

/** One sentence for a whole cart or order, given the longest wait on it. */
export function orderNote(days) {
  if (!days) return null;
  return `Includes pre-order items · ships ±${days} days after payment is received`;
}

/** What a cart line says under its price for a given ladder status, or null. */
export function cartLineNote(status, product, available) {
  switch (status) {
    case 'loading':
      return { text: 'Checking availability…', tone: 'muted' };
    case 'gone':
      return { text: 'No longer sold', tone: 'terra' };
    case 'error':
      return { text: 'Couldn’t check this item — try again', tone: 'gold' };
    case 'scheduled': {
      const at = opensAt(product);
      return { text: at ? `Not open yet · opens ${fmtDateTime(at)}` : 'Not open yet', tone: 'gold' };
    }
    case 'ended':
      return { text: 'Sale has ended', tone: 'terra' };
    case 'soldout':
      return { text: 'Sold out', tone: 'terra' };
    case 'overstock':
      return { text: `Only ${available} left.`, tone: 'gold' };
    default: {
      const s = shortNote(product);
      return s ? { text: s, tone: 'green' } : null;
    }
  }
}

/** What the cart says above the checkout button, or null when nothing blocks. */
export function blockerNotice(statuses) {
  const blocking = (statuses ?? []).filter(isBlocking);
  if (blocking.length === 0) return null;
  if (blocking.every((s) => s === SCHEDULED)) {
    return 'Something in your cart isn’t open for sale yet. Keep it here and come back when the sale starts, or remove it to check out now.';
  }
  return 'Something in your cart is no longer available. Remove it before continuing to checkout.';
}

// --- campaigns --------------------------------------------------------------

export function discountLabel(campaign, fmt) {
  if (campaign.discount_type === 'percentage') return `−${campaign.discount_value}%`;
  return `−${fmt(campaign.discount_value)}`;
}

// --- contact ----------------------------------------------------------------

export function contactField(channel) {
  if (channel === CHANNEL_WHATSAPP) {
    return {
      label: 'WhatsApp number',
      placeholder: '08xx xxxx xxxx',
      type: 'tel',
      inputMode: 'tel',
      autoComplete: 'tel',
      noun: 'WhatsApp',
    };
  }
  return {
    label: 'Email',
    placeholder: 'name@email.com',
    type: 'email',
    inputMode: 'email',
    autoComplete: 'email',
    noun: 'email',
  };
}

function looksLikeEmail(s) {
  const at = s.indexOf('@');
  if (at <= 0 || at === s.length - 1) return false;
  if ((s.match(/@/g) || []).length !== 1) return false;
  const domain = s.slice(at + 1);
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) return false;
  if (s.includes('..')) return false;
  return !/\s/.test(s);
}

/** The failure, or null when the value is acceptable. Same rules as src/lib/contact.js. */
export function validateContact(channel, raw) {
  if (String(raw ?? '').trim() === '') return `${contactField(channel).label} is required.`;
  const v = normalizeContact(channel, raw);
  if (channel === CHANNEL_WHATSAPP) {
    return v.length >= 10 ? null : 'That WhatsApp number doesn’t look valid.';
  }
  return v && looksLikeEmail(v) ? null : 'That email address doesn’t look valid.';
}

export function validatePhone(raw) {
  if (String(raw ?? '').trim() === '') return 'Phone number is required.';
  return normalizePhone(raw).length >= 10 ? null : 'That phone number doesn’t look valid.';
}

/** "name, address and city" */
export function listPhrase(items) {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export const FIELD_LABELS = {
  customer_name: 'Full name',
  address: 'Address',
  city: 'City',
  contact: 'Contact',
  phone: 'Phone number',
};

/**
 * Which required fields are still empty, in the order they appear on screen.
 * The destination is a picked object under live rates and free text under
 * flat ones; phoneAsked is false under a WhatsApp tenant.
 */
export function missingFields({ form, liveShipping, destination, contactLabel, phoneAsked = true }) {
  const out = [];
  if (!form.customer_name.trim()) out.push('your name');
  if (!String(form.contact ?? '').trim()) out.push(contactLabel.toLowerCase());
  if (phoneAsked && !String(form.phone ?? '').trim()) out.push('phone number');
  if (!form.address.trim()) out.push('address');
  if (liveShipping) {
    if (!destination) out.push('delivery area');
  } else if (!form.city.trim()) {
    out.push('city');
  }
  return out;
}

/** Why this cart cannot use this method, in the buyer's terms. */
export function outOfRangeReason(method, base, fmt) {
  const min = method?.min_order_total ?? 0;
  const max = method?.max_order_total ?? 0;
  if (min > 0 && base < min) return `Minimum ${fmt(min)} for this method.`;
  if (max > 0 && base > max) return `Maximum ${fmt(max)} for this method.`;
  return '';
}

// --- vouchers ---------------------------------------------------------------

/** The notes a draft's voucher outcome adds under the summary. */
export function voucherNotes(draft) {
  const v = draft?.voucher;
  if (!v || !v.code) return [];
  if (!v.applied) return [{ tone: 'warn', text: v.message || 'That code can’t be used.' }];
  const outbid = Number(v.outbid) || 0;
  const amount = Number(v.amount) || 0;
  if (outbid <= amount) return [];
  const name = v.outbid_name ? `The “${v.outbid_name}” promotion` : 'The shop’s own promotion';
  return [{ tone: 'muted', text: `${name} would have taken more off, but code ${v.code} was applied instead.` }];
}

export function voucherLabel(draft, fallback) {
  const v = draft?.voucher;
  if (v?.applied && v.code) return `Code ${v.code}`;
  return fallback;
}

// --- orders -----------------------------------------------------------------

/** Why a terminal order ended, or null while it is alive. */
export function terminalNote(order) {
  if (order?.status === 'expired') {
    const allPreorder = (order.lines ?? []).length > 0 && order.lines.every((l) => l.preorder);
    return (
      'This order expired because the payment didn’t arrive in time.' +
      (allPreorder ? '' : ' The stock has been released.')
    );
  }
  if (order?.status === 'cancelled') return 'This order was cancelled.';
  return null;
}

/**
 * The one OTP failure. The API returns a single indistinguishable 400 for
 * wrong, expired, too many attempts and bound elsewhere, so its message
 * carries nothing this English string does not.
 */
export const OTP_INVALID = 'That code didn’t work. Check it, or request a new one.';

export const PAY_TITLES = {
  va: 'Pay by virtual account',
  qr: 'Pay with QRIS',
  qr_image: 'Pay with QRIS',
  redirect: 'Continue to the payment page',
  manual_transfer: 'Pay by bank transfer',
  manual_qris: 'Pay with our shop QRIS',
};

// --- document title ---------------------------------------------------------

/** The page half of the tab title, '' while its data has not loaded. */
export function pageName(pathname, { product, taglineShort } = {}) {
  if (pathname === '/' || pathname === '') return String(taglineShort ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (pathname.startsWith('/katalog')) return 'Shop';
  if (pathname.startsWith('/tentang')) return 'Our story';
  if (pathname.startsWith('/keranjang')) return 'Cart';
  if (pathname.startsWith('/checkout')) return 'Checkout';
  if (pathname.startsWith('/lacak')) return 'Track order';
  if (pathname.startsWith('/produk/')) return product?.name ?? '';
  if (pathname.startsWith('/pesanan/') || pathname.startsWith('/track/')) return 'Order';
  return '';
}
