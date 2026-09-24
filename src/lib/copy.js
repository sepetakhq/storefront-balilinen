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
} from '@sepetakhq/storefront-kit/lib/availability';
import { leadDays } from '@sepetakhq/storefront-kit/lib/preorder';
import {
  CHANNEL_WHATSAPP,
  normalizeContact,
  normalizePhone,
} from '@sepetakhq/storefront-kit/lib/contact';

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

/**
 * The one-line note under a product: pre-order first, then the stock ladder.
 * Where it ships from is the shop's city behind its origin_prefix label; no
 * dispatch time is promised, since no merchant ever set one.
 */
export function stockNote(product, originCity, sections) {
  if (!product) return null;
  const from = originCity ? ` — ${sectionText(sections, 'origin_prefix')} ${originCity}` : '';
  if (product.preorder) {
    const days = leadDays(product);
    return {
      text: days
        ? `Pre-order · made after payment, ready to ship in ±${days} days`
        : 'Pre-order · made after payment',
      tone: 'green',
    };
  }
  // Not counted: no number to quote, and the shipping line still applies.
  // Never null for a product -- ProductRoute reads .tone unguarded.
  if (product.unlimited_stock) {
    return {
      text: `In stock${from}`,
      tone: 'green',
    };
  }
  const stock = product.stock ?? 0;
  if (stock <= 0) return { text: 'Out of stock — restocking soon', tone: 'terra' };
  if (stock < 10) return { text: `Only ${stock} left — don’t miss out`, tone: 'gold' };
  return {
    text: `In stock (${stock} pcs)${from}`,
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
    case 'variant_required':
      return { text: 'This product now comes in variants. Pick one, then remove this line.', tone: 'gold' };
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
  if (blocking.every((s) => s === 'variant_required')) {
    return 'Something in your cart needs a variant picked. Open the product and choose one.';
  }
  return 'Something in your cart is no longer available. Remove it before continuing to checkout.';
}

// --- variants ---------------------------------------------------------------

/** The heading above one row of variant pills. */
export function chooseAxis(axis, picked) {
  return picked ? `Choose ${axis}: ${picked}` : `Choose ${axis}`;
}

/** What a greyed-out pill says to a screen reader. */
export function pillState(value, { exists, soldOut }) {
  if (soldOut) return `${value} (sold out)`;
  if (!exists) return `${value} (not available)`;
  return value;
}

export const CHOOSE_VARIANT = 'Choose a variant';
export const FROM = 'from';
export const VARIANT_GONE = 'This variant is no longer sold';

// --- campaigns --------------------------------------------------------------

/** What follows the campaign's title: the merchant's headline, else what it takes off. */
export function discountLabel(campaign, fmt) {
  const own = String(campaign?.headline ?? '').trim();
  if (own) return own;
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
    // Only lines that reserved stock had any to release: a pre-order is
    // made after payment, an unlimited product is not counted.
    const nothingReserved =
      (order.lines ?? []).length > 0 && order.lines.every((l) => l.preorder || l.unlimited_stock);
    return (
      'This order expired because the payment didn’t arrive in time.' +
      (nothingReserved ? '' : ' The stock has been released.')
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
  manual_whatsapp: 'Send your order on WhatsApp',
};

/**
 * The words in the WhatsApp order message. The layout is src/lib/whatsapp.js's
 * (orderMessage); this is the English set it is called with here.
 */
export const WA_MESSAGE = {
  greeting: (number) => `Hi, I’d like to order #${number}`,
  subtotal: 'Subtotal',
  discount: 'Discount',
  shipping: 'Shipping',
  shippingDiscount: 'Shipping discount',
  total: 'Total',
  onBehalf: (name, city) => `For ${name}${city ? `, ${city}` : ''}`,
  detail: 'Order details',
};

// --- document title ---------------------------------------------------------

/** The page half of the tab title, '' while its data has not loaded. */
export function pageName(pathname, { product, taglineShort, nav } = {}) {
  if (pathname === '/' || pathname === '') return String(taglineShort ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (pathname.startsWith('/katalog')) return navLabel(nav, '/katalog') || 'Shop';
  if (pathname.startsWith('/tentang')) return navLabel(nav, '/tentang') || DEFAULT_LABELS.hero_secondary_cta;
  if (pathname.startsWith('/keranjang')) return 'Cart';
  if (pathname.startsWith('/checkout')) return 'Checkout';
  if (pathname.startsWith('/lacak')) return 'Track order';
  if (pathname.startsWith('/produk/')) return product?.name ?? '';
  if (pathname.startsWith('/pesanan/') || pathname.startsWith('/track/')) return 'Order';
  return '';
}

// --- merchant labels --------------------------------------------------------

/**
 * This template's own wording for every section_copy label it draws. The
 * merchant's text from the backoffice replaces each one; blank keeps these,
 * so a shop that never touched them reads as the design does.
 */
export const DEFAULT_LABELS = {
  cats_heading: 'Shop by category',
  grid_see_all: 'Browse all',
  story_eyebrow: 'Our story',
  story_cta: 'Read our story',
  hero_secondary_cta: 'Our story',
  product_details_heading: 'Description',
  product_care_heading: 'Care',
  product_shipping_heading: 'Shipping & delivery',
  related_heading: 'You may also like',
  product_ask_label: 'Ask about this product on WhatsApp',
  product_ask_message: 'Hi! I have a question about "{product}".',
  footer_categories_heading: 'Shop',
  footer_payment_heading: 'Payment methods',
  footer_shipping_heading: 'Shipping',
  origin_prefix: 'ships from',
  countdown_label: 'Ends in',
};

/** One label: the merchant's section_copy text, trimmed, else the template's. */
export function sectionText(sections, key) {
  return String(sections?.[key] ?? '').trim() || DEFAULT_LABELS[key] || '';
}

/** A link label with the design's arrow, unless the merchant already typed one. */
export function withArrow(text) {
  return /→\s*$/.test(text) ? text : `${text} →`;
}

/** The label the merchant's nav gives a page, or ''. */
export function navLabel(nav, path) {
  return String((nav ?? []).find((n) => n?.path === path)?.label ?? '').trim();
}

/**
 * The hero's second button: the merchant's hero_secondary_cta, else the name
 * the nav gives the story page, else the template's.
 */
export function heroSecondaryLabel(sections, nav) {
  return String(sections?.hero_secondary_cta ?? '').trim() || navLabel(nav, '/tentang') || DEFAULT_LABELS.hero_secondary_cta;
}

/**
 * The "ask about this product" link: the shop's WhatsApp URL with the
 * merchant's question (or the template's) set through URL, so a URL that
 * already carries a query keeps it. Anything not http(s) gives no link.
 */
export function askLink(whatsappUrl, sections, productName) {
  let url;
  try {
    url = new URL(whatsappUrl);
  } catch {
    return '';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
  url.searchParams.set('text', sectionText(sections, 'product_ask_message').replaceAll('{product}', String(productName ?? '')));
  return url.toString();
}
