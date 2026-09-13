import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Img, SIZES } from '../ui/Img.jsx';
import { CountdownClock } from '../ui/Countdown.jsx';
import OtpModal from '../components/OtpModal.jsx';
import DestinationPicker from '../components/DestinationPicker.jsx';
import ShippingRates from '../components/ShippingRates.jsx';
import { OptionTile } from '../components/OptionTile.jsx';
import { useCart } from '../../../../src/cart/CartProvider.jsx';
import { useCartLines } from '../../../../src/cart/useCartLines.js';
import { useConfig } from '../../../../src/config/ConfigProvider.jsx';
import { createDraft, sendCheckoutCode, verifyCheckoutCode } from '../../../../src/api/endpoints.js';
import { qk } from '../../../../src/api/queryKeys.js';
import { lineKey } from '../../../../src/lib/variants.js';
import { fmt } from '../../../../src/shared/format.js';
import { confirmStep, estimatePaymentFee, estimateShipping, methodFits, storeNotReady } from '../../../../src/lib/checkout.js';
import { CHANNEL_WHATSAPP, normalizeContact, normalizePhone } from '../../../../src/lib/contact.js';
import { destinationSummary } from '../../../../src/lib/shipping.js';
import { MAX_VOUCHER_LEN, normalizeVoucherInput } from '../../../../src/lib/voucher.js';
import { clearCheckout, keyForAttempt, resetKeyForAttempt, saveCheckout } from '../../../../src/checkout/checkoutStorage.js';
import { recordRetryAfter, recordSend, clearCooldown } from '../../../../src/checkout/otpCooldown.js';
import { rememberOrder } from '../../../../src/checkout/orderTokens.js';
import {
  FIELD_LABELS,
  contactField,
  listPhrase,
  missingFields,
  orderNote,
  OTP_INVALID,
  outOfRangeReason,
  validateContact,
  validatePhone,
  voucherLabel,
  voucherNotes,
} from '../lib/copy.js';

// Server-side caps, counted in runes, enforced here so the buyer is told
// before a round-trip.
const LIMITS = { customer_name: 120, address: 500, city: 80, contact: 254, phone: 20 };
const ALREADY_PLACED = 'This order has already been placed. Check your confirmation message or open Track order.';

export default function CheckoutRoute() {
  const cart = useCart();
  // Once an order is placed the cart empties; the guard must not bounce the
  // buyer to an empty cart page mid-navigation.
  const [placed, setPlaced] = useState(false);
  if (cart.isEmpty && !placed) return <Navigate to="/keranjang" replace />;
  return <Checkout onPlaced={() => setPlaced(true)} />;
}

function Checkout({ onPlaced }) {
  const { couriers, paymentMethods, contactChannel, freeShipping, freeShippingMin, liveShipping, brand } = useConfig();
  const cart = useCart();
  const { lines, subtotal, isLoading, hasBlockers, preorderLeadDays } = useCartLines();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({ customer_name: '', contact: '', phone: '', address: '', city: '' });
  const [courier, setCourier] = useState(() => couriers[0]?.code ?? '');
  const [method, setMethod] = useState(() => paymentMethods[0]?.code ?? '');
  const [formErr, setFormErr] = useState('');
  const [destination, setDestination] = useState(null);
  const [quote, setQuote] = useState(null);
  const [draft, setDraft] = useState(null);
  const [voucherCode, setVoucherCode] = useState('');
  const [otp, setOtp] = useState(null);
  const [otpOpen, setOtpOpen] = useState(false);

  const contactMeta = contactField(contactChannel);
  // Under a WhatsApp tenant the contact already is the courier's number.
  const phoneAsked = contactChannel !== CHANNEL_WHATSAPP;
  const setField = (e) => {
    setFormErr('');
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const cartPrices = useMemo(() => {
    const m = new Map();
    for (const l of lines) if (l.product) m.set(l.key, l.product.price);
    return m;
  }, [lines]);

  // variant_id rides along only when the line names one, so a cart of plain
  // products sends exactly the body it always did.
  const cartItems = useMemo(
    () => cart.items.map((it) => ({ product_id: it.productId, qty: it.qty, ...(it.variantId ? { variant_id: it.variantId } : {}) })),
    [cart.items],
  );

  const draftMutation = useMutation({
    mutationFn: () =>
      createDraft({
        items: cartItems,
        courier_code: courier,
        shipping_quote_id: quote?.quote_id ?? '',
        payment_method: method,
        contact: normalizeContact(contactChannel, form.contact),
        customer_name: form.customer_name.trim(),
        phone: phoneAsked ? normalizePhone(form.phone) : '',
        address: form.address.trim(),
        city: liveShipping ? destinationSummary(destination) : form.city.trim(),
        voucher_code: voucherCode,
      }),
    onSuccess: (d) => {
      setFormErr('');
      setDraft(d);
      saveCheckout({ draftId: d.draft_id, expiresAt: d.expires_at });
      clearCooldown(d.draft_id);
    },
    onError: (err) => handleDraftError(err),
  });

  const sendMutation = useMutation({
    mutationFn: () => sendCheckoutCode(draft.draft_id),
    onSuccess: (res) => {
      const state = recordSend(draft.draft_id);
      setOtpOpen(true);
      setOtp({
        channel: res.channel,
        masked: res.masked,
        expiresAt: new Date(Date.now() + res.expires_in_seconds * 1000).toISOString(),
        nextAllowedAt: state.nextAllowedAt,
        attempts: 0,
        error: '',
      });
    },
    onError: (err) => handleSendError(err),
  });

  const verifyMutation = useMutation({
    mutationFn: async (code) => {
      const key = keyForAttempt(draft.draft_id, code);
      try {
        return await verifyCheckoutCode(draft.draft_id, code, key);
      } catch (err) {
        // A reused key with a different body is our bug, not the buyer's.
        if (err?.status === 422) {
          return verifyCheckoutCode(draft.draft_id, code, resetKeyForAttempt(draft.draft_id, code));
        }
        throw err;
      }
    },
    onSuccess: ({ data }) => {
      // Before anything that can throw: the track token is returned exactly
      // once and no endpoint can give it back.
      const saved = rememberOrder({
        token: data.track_token,
        number: data.order.number,
        total: data.order.total,
        placedAt: data.order.placed_at,
      });
      queryClient.setQueryData(qk.track(data.track_token), { order: data.order, payment: data.payment ?? null });
      onPlaced();
      clearCheckout();
      clearCooldown(draft.draft_id);
      cart.clear();
      setOtp(null);
      setOtpOpen(false);
      navigate(`/pesanan/${data.track_token}`, { replace: true, state: { justPlaced: true, tokenAtRisk: !saved } });
    },
    onError: (err) => handleVerifyError(err),
  });

  function handleDraftError(err) {
    if (err?.status === 409 && err.code === 'unavailable') {
      queryClient.invalidateQueries({ queryKey: ['product'] });
      navigate('/keranjang', { state: { stockChanged: true } });
      return;
    }
    setFormErr(err?.message || 'Checkout failed. Please try again.');
  }

  function handleSendError(err) {
    if (err?.code === 'draft_expired') return resetDraft('This checkout expired. Please start again.');
    if (err?.code === 'draft_consumed' || err?.code === 'order_exists') return setFormErr(ALREADY_PLACED);
    if (err?.status === 409 && err.code === 'unavailable') return handleDraftError(err);
    if (err?.status === 429) {
      if (err.retryAfter) recordRetryAfter(draft.draft_id, err.retryAfter);
      setFormErr(err.message);
      return;
    }
    setFormErr(err?.message || 'The code couldn’t be sent.');
  }

  function handleVerifyError(err) {
    // The browser was trusted when the draft was priced and is not any more:
    // fall back to the ordinary code flow.
    if (err?.code === 'otp_required') {
      setFormErr('');
      sendMutation.mutate();
      return;
    }
    if (err?.status === 429) return setFormErr(err.message);
    // Wrong, expired, too many, bound elsewhere: one 400 by design.
    if (err?.status === 400) {
      setOtp((o) => o && { ...o, error: OTP_INVALID, attempts: o.attempts + 1 });
      return;
    }
    if (err?.status === 409 && err.code === 'unavailable') {
      setOtp(null);
      setOtpOpen(false);
      queryClient.invalidateQueries({ queryKey: ['product'] });
      navigate('/keranjang', { state: { stockChanged: true, afterVerify: true } });
      return;
    }
    if (err?.code === 'order_exists' || err?.code === 'draft_consumed') {
      setOtp(null);
      setOtpOpen(false);
      setFormErr(ALREADY_PLACED);
      return;
    }
    setOtp((o) => o && { ...o, error: err?.message || 'Verification failed. Please try again.' });
  }

  function resetDraft(message) {
    setDraft(null);
    setOtp(null);
    setOtpOpen(false);
    clearCheckout();
    setFormErr(message);
  }

  function submitForm(e) {
    e.preventDefault();
    for (const [key, max] of Object.entries(LIMITS)) {
      if ([...(form[key] || '')].length > max) {
        return setFormErr(`${FIELD_LABELS[key]} is too long (${max} characters at most).`);
      }
    }
    const missing = missingFields({ form, liveShipping, destination, contactLabel: contactMeta.label, phoneAsked });
    if (missing.length > 0) return setFormErr(`Please fill in ${listPhrase(missing)} first.`);
    if (liveShipping && !quote) return setFormErr('Pick a shipping service first.');
    const contactErr = validateContact(contactChannel, form.contact);
    if (contactErr) return setFormErr(contactErr);
    if (phoneAsked) {
      const phoneErr = validatePhone(form.phone);
      if (phoneErr) return setFormErr(phoneErr);
    }
    setFormErr('');
    draftMutation.mutate();
  }

  if (draft) {
    return (
      <Review
        draft={draft}
        cartPrices={cartPrices}
        courier={liveShipping ? quote : couriers.find((c) => c.code === courier)}
        method={paymentMethods.find((m) => m.code === method)}
        contactNoun={contactMeta.noun}
        error={formErr}
        otp={otp}
        otpOpen={otpOpen}
        sending={sendMutation.isPending}
        verifying={verifyMutation.isPending}
        onSend={() => {
          setFormErr('');
          sendMutation.mutate();
        }}
        onReopenOtp={() => {
          setFormErr('');
          setOtpOpen(true);
        }}
        onVerify={(code) => verifyMutation.mutate(code)}
        onPlace={() => {
          setFormErr('');
          verifyMutation.mutate('');
        }}
        onCancelOtp={() => setOtpOpen(false)}
        onEdit={() => resetDraft('')}
        onExpire={() => resetDraft('This checkout expired. Please start again.')}
      />
    );
  }

  const free = { enabled: freeShipping, min: freeShippingMin };
  const estShipping = liveShipping
    ? estimateShipping(subtotal, quote ? { cost: quote.cost } : null, free)
    : estimateShipping(subtotal, couriers.find((c) => c.code === courier), free);
  const estBase = subtotal + estShipping;
  const selMethod = paymentMethods.find((p) => p.code === method);
  const estFee = estimatePaymentFee(estBase, selMethod);
  const shipPicked = liveShipping ? Boolean(quote) : Boolean(courier);
  const notReady = storeNotReady({ couriers, paymentMethods, liveShipping });
  const busy = draftMutation.isPending || isLoading || hasBlockers || notReady.shipping || notReady.payment;

  return (
    <main aria-label="Checkout" className="bl-wrap" style={{ flex: 1, maxWidth: 1140, padding: '44px 32px 20px' }}>
      <h1 className="bl-display" style={{ fontSize: 38, margin: '0 0 26px' }}>
        Checkout
      </h1>

      {/* noValidate: the browser's own bubble speaks its own language and
          fires before onSubmit; the message comes from validateContact. */}
      <form noValidate onSubmit={submitForm} className="bl-two">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <section className="bl-card">
            <div className="bl-card-title">
              <span className="n">1.</span> Shipping address
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, alignItems: 'start' }}>
              <input name="customer_name" value={form.customer_name} onChange={setField} placeholder="Full name" aria-label="Full name" autoComplete="name" maxLength={LIMITS.customer_name} className="bl-field" />
              <div>
                <input
                  name="contact"
                  value={form.contact}
                  onChange={setField}
                  placeholder={contactMeta.placeholder}
                  aria-label={contactMeta.label}
                  type={contactMeta.type}
                  inputMode={contactMeta.inputMode}
                  autoComplete={contactMeta.autoComplete}
                  maxLength={LIMITS.contact}
                  className="bl-field"
                />
                <div className="bl-hint">
                  {contactMeta.label} · a verification code is sent to this {contactMeta.noun}.
                </div>
              </div>
              {phoneAsked ? (
                <input name="phone" value={form.phone} onChange={setField} placeholder="Phone number for the courier" aria-label="Phone number" type="tel" inputMode="tel" autoComplete="tel" maxLength={LIMITS.phone} className="bl-field" />
              ) : null}
              <textarea
                name="address"
                value={form.address}
                onChange={setField}
                placeholder="Street address, building, unit"
                aria-label="Address"
                autoComplete="street-address"
                maxLength={LIMITS.address}
                rows={2}
                className="bl-field"
                style={{ gridColumn: '1 / -1', resize: 'vertical' }}
              />
              {liveShipping ? (
                <DestinationPicker
                  value={destination}
                  onChange={(d) => {
                    setFormErr('');
                    setDestination(d);
                    setQuote(null);
                  }}
                />
              ) : (
                <input name="city" value={form.city} onChange={setField} placeholder="City / regency" aria-label="City" autoComplete="address-level2" maxLength={LIMITS.city} className="bl-field" style={{ gridColumn: '1 / -1' }} />
              )}
            </div>
          </section>

          <section className="bl-card">
            <div className="bl-card-title" style={{ marginBottom: 4 }}>
              <span className="n">2.</span> Shipping
            </div>
            {liveShipping ? (
              <ShippingRates
                destination={destination}
                items={cartItems}
                selected={quote?.quote_id ?? ''}
                onSelect={setQuote}
                onRetry={() => {
                  setDestination(null);
                  setQuote(null);
                }}
              />
            ) : notReady.shipping ? (
              <div className="bl-muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                This shop has not set up shipping yet. Please contact the seller before ordering.
              </div>
            ) : (
              <>
                <div className="bl-muted" style={{ fontSize: 12.5, marginBottom: 14 }}>
                  Flat rates from {brand.origin_city}
                  {freeShipping ? ` · free over ${fmt(freeShippingMin)}` : ''}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {couriers.map((c) => {
                    const cost = estimateShipping(subtotal, c, free);
                    return (
                      <OptionTile
                        key={c.code}
                        selected={courier === c.code}
                        onClick={() => setCourier(c.code)}
                        right={<span style={{ fontWeight: 800, fontSize: 14, color: cost === 0 ? 'var(--bl-green)' : 'var(--bl-ink)', whiteSpace: 'nowrap' }}>{cost === 0 ? 'FREE' : fmt(cost)}</span>}
                      >
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</span>{' '}
                        <span className="bl-muted" style={{ fontSize: 12.5 }}>
                          · {c.eta}
                        </span>
                      </OptionTile>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          <section className="bl-card">
            <div className="bl-card-title">
              <span className="n">3.</span> Payment
            </div>
            {notReady.payment ? (
              <div className="bl-muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                This shop has not set up a payment method yet. Please contact the seller before ordering.
              </div>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {paymentMethods.map((p) => {
                const fits = methodFits(p, estBase);
                const fee = estimatePaymentFee(estBase, p);
                return (
                  <OptionTile
                    key={p.code}
                    selected={method === p.code}
                    disabled={!fits}
                    onClick={() => fits && setMethod(p.code)}
                    right={<span className="bl-muted" style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{fee ? `+ ${fmt(fee)}` : 'No fee'}</span>}
                  >
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</span>
                    {p.sub ? (
                      <span className="bl-muted" style={{ fontSize: 12.5 }}>
                        {' '}
                        · {p.sub}
                      </span>
                    ) : null}
                    {!fits ? (
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--bl-terra-dark)', marginTop: 2 }}>
                        {outOfRangeReason(p, estBase, fmt)}
                      </span>
                    ) : null}
                  </OptionTile>
                );
              })}
            </div>
          </section>

          <section className="bl-card">
            <div className="bl-card-title">
              <span className="n">4.</span> Have a voucher code?
            </div>
            <input
              value={voucherCode}
              onChange={(e) => setVoucherCode(normalizeVoucherInput(e.target.value))}
              maxLength={MAX_VOUCHER_LEN}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Enter code"
              aria-label="Voucher code"
              className="bl-field"
              style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
            />
            <div className="bl-hint" style={{ marginTop: 8, lineHeight: 1.6 }}>
              Optional. The discount shows in the summary before you pay.
            </div>
          </section>
        </div>

        <aside className="bl-card bl-sticky" style={{ maxWidth: 440 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Order summary</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 220, overflow: 'auto' }}>
            {lines
              .filter((l) => l.product)
              .map((l) => (
                <div key={l.key} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <Img src={l.product.image} srcSet={l.product.image_srcset} sizes={SIZES.summaryLine} alt="" ratio="1/1" radius={8} style={{ width: 44, flex: 'none' }} />
                  <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.35 }}>
                    <span style={{ fontWeight: 700 }}>{l.item.qty}×</span> {l.product.name}
                    {l.label ? <span className="bl-muted"> · {l.label}</span> : null}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{fmt(l.lineTotal)}</div>
                </div>
              ))}
          </div>
          <div className="bl-rule" />
          <div className="bl-row">
            <span className="k">Subtotal</span>
            <span className="v">{fmt(subtotal)}</span>
          </div>
          <div className="bl-row">
            <span className="k">Shipping</span>
            <span className="v">{!shipPicked ? 'Not selected' : estShipping === 0 ? 'FREE' : fmt(estShipping)}</span>
          </div>
          <div className="bl-row">
            <span className="k">Admin fee</span>
            <span className="v">{selMethod ? fmt(estFee) : '—'}</span>
          </div>
          <div className="bl-rule" style={{ margin: '12px 0' }} />
          <div className="bl-total" style={{ fontSize: 17 }}>
            <span>Estimated total</span>
            <span className="v">{fmt(estBase + estFee)}</span>
          </div>
          <div className="bl-hint" style={{ lineHeight: 1.5 }}>
            Estimate, admin fee included. The exact total appears at the next step.
          </div>
          {preorderLeadDays ? (
            <div className="bl-note info" style={{ marginTop: 12 }}>
              {orderNote(preorderLeadDays)}
            </div>
          ) : null}
          <button type="submit" disabled={busy} className="bl-btn primary block" style={{ marginTop: 16, padding: 15 }}>
            {draftMutation.isPending ? 'Checking prices & stock…' : 'Review order'}
          </button>
          {formErr ? (
            <div role="alert" className="bl-note error" style={{ marginTop: 12, fontSize: 13 }}>
              {formErr}
            </div>
          ) : null}
        </aside>
      </form>
    </main>
  );
}

/**
 * The review step. Not optional: the draft is the first time the server
 * prices this cart, and it re-prices silently. The buyer approves the real
 * total here, before a code is spent.
 */
function Review({ draft, cartPrices, courier, method, contactNoun, error, otp, otpOpen, sending, verifying, onSend, onReopenOtp, onVerify, onPlace, onCancelOtp, onEdit, onExpire }) {
  const step = confirmStep({ otpRequired: draft.otp_required, otp });
  const liveCode = step === 'reopen';
  const skipsCode = step === 'place';
  const changed = draft.lines.filter((l) => {
    const before = cartPrices.get(lineKey(l));
    return before !== undefined && before !== l.unit_price;
  });
  const netShip = draft.shipping_cost - draft.shipping_discount;

  return (
    <main aria-label="Review your order" className="bl-wrap" style={{ flex: 1, maxWidth: 1140, padding: '44px 32px 20px' }}>
      <h1 className="bl-display" style={{ fontSize: 38, margin: '0 0 26px' }}>
        Checkout
      </h1>
      <div className="bl-two">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {changed.length > 0 ? (
            <div role="status" className="bl-note warn" style={{ padding: '14px 18px' }}>
              <div style={{ fontWeight: 700 }}>Some prices changed since you added them</div>
              {changed.map((l) => (
                <div key={lineKey(l)}>
                  {l.name}{l.variant_label ? ` (${l.variant_label})` : ''}: <s>{fmt(cartPrices.get(lineKey(l)))}</s> → <b>{fmt(l.unit_price)}</b>
                </div>
              ))}
            </div>
          ) : null}

          <section className="bl-card">
            <div className="bl-card-title">Review your order</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {draft.lines.map((l) => (
                <div key={lineKey(l)} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <Img src={l.image} srcSet={l.image_srcset} sizes={SIZES.summaryLine} alt="" ratio="1/1" radius={10} style={{ width: 56, flex: 'none' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.35 }}>{l.name}</div>
                    {l.variant_label ? <div style={{ fontSize: 12.5, marginTop: 2 }}>{l.variant_label}</div> : null}
                    <div className="bl-muted" style={{ fontSize: 12.5, marginTop: 3 }}>
                      {l.qty} × {fmt(l.unit_price)}
                      {l.promotion_name ? <span style={{ color: 'var(--bl-terra)', fontWeight: 700 }}> · {l.promotion_name}</span> : null}
                    </div>
                    {l.preorder ? <div className="bl-muted" style={{ fontSize: 12, marginTop: 2 }}>Pre-order · made after payment</div> : null}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{fmt(l.line_total)}</div>
                </div>
              ))}
            </div>
            <div className="bl-rule" style={{ margin: '18px 0' }} />
            <div className="bl-row">
              <span className="k">Subtotal</span>
              <span className="v">{fmt(draft.subtotal)}</span>
            </div>
            {draft.discount_total > 0 ? (
              <div className="bl-row">
                <span className="k">{voucherLabel(draft, draft.promotion_name ? `Discount · ${draft.promotion_name}` : 'Discount')}</span>
                <span className="v" style={{ color: 'var(--bl-terra)' }}>
                  − {fmt(draft.discount_total)}
                </span>
              </div>
            ) : null}
            <div className="bl-row">
              <span className="k">
                Shipping · {courier?.name ?? ''}
                {draft.shipping_promotion_name ? ` · ${draft.shipping_promotion_name}` : ''}
              </span>
              <span className="v" style={{ color: netShip === 0 ? 'var(--bl-green)' : undefined }}>
                {netShip === 0 ? 'FREE' : fmt(netShip)}
              </span>
            </div>
            {draft.payment_fee > 0 ? (
              <div className="bl-row">
                <span className="k">Admin fee</span>
                <span className="v">{fmt(draft.payment_fee)}</span>
              </div>
            ) : null}
            {draft.unique_code > 0 ? (
              <div className="bl-row">
                <span className="k">Unique code</span>
                <span className="v">{fmt(draft.unique_code)}</span>
              </div>
            ) : null}
            <div className="bl-rule" style={{ margin: '12px 0' }} />
            <div className="bl-total">
              <span>Total</span>
              <span className="v">{fmt(draft.total)}</span>
            </div>
            {draft.preorder_lead_days > 0 ? (
              <div className="bl-note info" style={{ marginTop: 14 }}>
                {orderNote(draft.preorder_lead_days)}
              </div>
            ) : null}
            {voucherNotes(draft).map((n, i) => (
              <p key={i} style={{ margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.6, fontWeight: n.tone === 'warn' ? 600 : 400, color: n.tone === 'warn' ? 'var(--bl-gold)' : 'var(--bl-faint)' }}>
                {n.text}
              </p>
            ))}
          </section>
        </div>

        <aside className="bl-card bl-sticky" style={{ maxWidth: 440 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Confirm &amp; verify</div>
          <div className="bl-muted" style={{ marginTop: 14, fontSize: 13.5, lineHeight: 1.7 }}>
            <div>
              Paying with <b style={{ color: 'var(--bl-ink)' }}>{method?.name}</b>
            </div>
            <div>
              {skipsCode ? 'Confirmation goes to ' : 'Code will be sent to '}
              <b style={{ color: 'var(--bl-ink)' }}>{draft.contact.masked}</b> via {contactNoun}
            </div>
          </div>
          <div className="bl-muted" style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bl-cream)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
            This review is held for
            <CountdownClock until={draft.expires_at} onExpire={onExpire} style={{ fontWeight: 700, fontSize: 15, color: 'var(--bl-ink)' }} />
          </div>
          <button
            type="button"
            onClick={skipsCode ? onPlace : liveCode ? onReopenOtp : onSend}
            disabled={sending || verifying}
            className="bl-btn primary block"
            style={{ marginTop: 16, padding: 15 }}
          >
            {skipsCode ? (verifying ? 'Placing order…' : 'Place order') : sending ? 'Sending…' : liveCode ? 'Enter code' : 'Send verification code'}
          </button>
          <button type="button" onClick={onEdit} className="bl-link block" style={{ width: '100%', marginTop: 10, padding: 10 }}>
            Edit order
          </button>
          {error ? (
            <div role="alert" className="bl-note error" style={{ marginTop: 12, fontSize: 13 }}>
              {error}
            </div>
          ) : null}
        </aside>
      </div>

      {otp && otpOpen ? (
        <OtpModal otp={otp} verifying={verifying} onVerify={onVerify} onResend={onSend} resending={sending} onCancel={onCancelOtp} />
      ) : null}
    </main>
  );
}
