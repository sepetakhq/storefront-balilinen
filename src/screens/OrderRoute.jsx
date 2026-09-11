import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router-dom';

import { Img, SIZES } from '../ui/Img.jsx';
import { QrCode, QrImage } from '../ui/Qr.jsx';
import { CountdownClock } from '../ui/Countdown.jsx';
import { EmptyState, ErrorState, Skeleton } from '../ui/states.jsx';
import { CheckIcon } from '../components/icons.jsx';
import { useOrder } from '../../../../src/hooks/queries.js';
import { useConfig } from '../../../../src/config/ConfigProvider.jsx';
import { serverNow } from '../../../../src/api/client.js';
import { fmt } from '../../../../src/shared/format.js';
import { claimPayment, reopenPayment } from '../../../../src/api/endpoints.js';
import { qk } from '../../../../src/api/queryKeys.js';
import {
  PAY_DEAD,
  canClaimPayment,
  isDisplayableImageURL,
  isManualPayment,
  isQrImageURL,
  isQrisPayload,
  isUsableRedirect,
  paymentState,
  splitUniqueCode,
} from '../../../../src/lib/payment.js';
import { useToast } from '../../../../src/ui/ToastProvider.jsx';
import { orderMessage, waLink } from '../../../../src/lib/whatsapp.js';
import { PAY_TITLES, WA_MESSAGE, fmtDate, fmtDateTime, terminalNote } from '../lib/copy.js';

const panel = { marginTop: 26, background: 'var(--bl-white)', border: '1px solid var(--bl-line)', borderRadius: 18 };

export default function OrderRoute() {
  const { token } = useParams();
  const location = useLocation();
  const justPlaced = Boolean(location.state?.justPlaced);
  const tokenAtRisk = Boolean(location.state?.tokenAtRisk);

  const { data, isPending, isError, error, refetch, isFetching } = useOrder(token, { poll: true });
  const queryClient = useQueryClient();

  const retry = useMutation({
    mutationFn: () => reopenPayment(token),
    onSuccess: (payment) => {
      queryClient.setQueryData(qk.track(token), (prev) => (prev ? { ...prev, payment } : prev));
    },
    onError: (err) => {
      if (err?.status === 409) refetch();
    },
  });

  const claim = useMutation({
    mutationFn: () => claimPayment(token),
    onSuccess: (next) => {
      if (next?.order) queryClient.setQueryData(qk.track(token), next);
    },
    onError: (err) => {
      if (err?.status === 409) refetch();
    },
  });

  if (isPending) {
    return (
      <main aria-busy="true" className="bl-wrap" style={{ flex: 1, maxWidth: 920, padding: '44px 32px 20px' }}>
        <Skeleton height={120} radius={16} />
      </main>
    );
  }

  if (isError) {
    if (error?.status === 404) {
      return (
        <main className="bl-wrap" style={{ flex: 1, maxWidth: 920, padding: '44px 32px 20px' }}>
          <EmptyState
            title="Order not found"
            body="Check the link, or find it again from Track order."
            action={
              <Link to="/lacak" className="bl-btn ghost sm">
                Track order
              </Link>
            }
          />
        </main>
      );
    }
    return (
      <main className="bl-wrap" style={{ flex: 1, maxWidth: 920, padding: '44px 32px 20px' }}>
        <ErrorState error={error} onRetry={refetch} title="The order couldn’t load" />
      </main>
    );
  }

  const { order, payment } = data;
  const awaiting = order.status === 'awaiting_payment';
  const note = terminalNote(order);
  const netShip = order.shipping_cost - order.shipping_discount;

  return (
    <main aria-label="Order" className="bl-wrap" style={{ flex: 1, maxWidth: 920, padding: '44px 32px 20px' }}>
      {justPlaced ? (
        <div className="bl-note ok" style={{ marginBottom: 22, borderRadius: 14, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <CheckIcon />
          <div style={{ fontSize: 14, lineHeight: 1.55 }}>
            <b>Thank you — your order is in.</b> We sent the tracking link to {order.contact_masked}.
            {tokenAtRisk ? (
              <>
                {' '}
                <span>This browser could not save the link, so keep it now:</span>
                <code style={{ display: 'block', marginTop: 6, fontSize: 12, wordBreak: 'break-all', background: 'var(--bl-white)', padding: '8px 10px', borderRadius: 8 }}>
                  {`${window.location.origin}/pesanan/${token}`}
                </code>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <h1 className="bl-display" style={{ fontSize: 36 }}>
          Order {order.number}
        </h1>
        <span className={`bl-pill ${order.status || 'unknown'}`}>{order.status_label}</span>
      </div>
      <div className="bl-muted" style={{ fontSize: 14, marginTop: 8 }}>
        Placed {fmtDateTime(order.placed_at)} · {order.customer_name} · {order.city}
      </div>
      {order.preorder_lead_days > 0 && !['cancelled', 'expired', 'completed', 'shipped'].includes(order.status) ? (
        <div className="bl-note info" style={{ marginTop: 12, display: 'inline-block' }}>
          {order.preorder_ship_estimate
            ? `Pre-order · estimated to ship ${fmtDate(order.preorder_ship_estimate)}`
            : `Pre-order · estimated to ship ±${order.preorder_lead_days} days after payment is received`}
        </div>
      ) : null}

      {awaiting ? (
        <PaymentPanel
          order={order}
          payment={payment}
          onRefresh={refetch}
          refreshing={isFetching}
          onRetry={retry.mutate}
          retrying={retry.isPending}
          retryError={retry.error}
          onClaim={claim.mutate}
          claiming={claim.isPending}
          claimError={claim.error}
        />
      ) : null}

      {/* Rendered from order.timeline, never recomputed from status. */}
      <section style={{ ...panel, padding: '24px 26px' }}>
        {note ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
            <div className="bl-muted" style={{ fontSize: 14, lineHeight: 1.55, textWrap: 'pretty' }}>
              {note}
            </div>
            <Link to="/katalog" className="bl-link" style={{ fontSize: 13.5, whiteSpace: 'nowrap' }}>
              Shop again →
            </Link>
          </div>
        ) : null}
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: `repeat(${order.timeline.length || 4}, 1fr)`, gap: 8 }}>
          {order.timeline.map((t) => (
            <li key={t.key} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ height: 4, borderRadius: 2, background: t.done ? 'var(--bl-green-2)' : 'var(--bl-line)' }} />
              <div style={{ fontWeight: 700, fontSize: 12.5, color: t.done ? 'var(--bl-ink)' : 'var(--bl-faint)' }}>{t.label}</div>
            </li>
          ))}
        </ol>
      </section>

      <section style={{ ...panel, marginTop: 18, padding: '24px 26px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {order.lines.map((l, i) => (
            <div key={`${l.name}-${i}`} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <Img src={l.image} srcSet={l.image_srcset} sizes={SIZES.summaryLine} alt="" ratio="1/1" radius={10} style={{ width: 56, flex: 'none' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.35 }}>{l.name}</div>
                <div className="bl-muted" style={{ fontSize: 12.5, marginTop: 3 }}>
                  {l.qty} × {fmt(l.unit_price)}
                  {l.preorder ? ' · Pre-order' : ''}
                </div>
              </div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{fmt(l.line_total)}</div>
            </div>
          ))}
        </div>
        <div className="bl-rule" style={{ margin: '18px 0' }} />
        <div className="bl-row">
          <span className="k">Subtotal</span>
          <span className="v">{fmt(order.subtotal)}</span>
        </div>
        {order.discount_total > 0 ? (
          <div className="bl-row">
            <span className="k">
              {order.voucher_code ? `Code ${order.voucher_code}` : order.promotion_name ? `Discount · ${order.promotion_name}` : 'Discount'}
            </span>
            <span className="v" style={{ color: 'var(--bl-terra)' }}>
              − {fmt(order.discount_total)}
            </span>
          </div>
        ) : null}
        <div className="bl-row">
          <span className="k">
            Shipping · {String(order.courier_code || '').toUpperCase()}
            {order.shipping_promotion_name ? ` · ${order.shipping_promotion_name}` : ''}
          </span>
          <span className="v" style={{ color: netShip === 0 ? 'var(--bl-green)' : undefined }}>
            {netShip === 0 ? 'FREE' : fmt(netShip)}
          </span>
        </div>
        {order.payment_fee > 0 ? (
          <div className="bl-row">
            <span className="k">Admin fee</span>
            <span className="v">{fmt(order.payment_fee)}</span>
          </div>
        ) : null}
        {order.unique_code > 0 ? (
          <div className="bl-row">
            <span className="k">Unique code</span>
            <span className="v">{fmt(order.unique_code)}</span>
          </div>
        ) : null}
        <div className="bl-rule" style={{ margin: '12px 0' }} />
        <div className="bl-total">
          <span>Total</span>
          <span className="v">{fmt(order.total)}</span>
        </div>
        {order.awb ? (
          <div style={{ marginTop: 14, fontSize: 13.5, background: 'var(--bl-cream)', borderRadius: 10, padding: '10px 14px' }}>
            Tracking number <b style={{ fontVariantNumeric: 'tabular-nums' }}>{order.awb}</b> · {String(order.courier_code || '').toUpperCase()}
          </div>
        ) : null}
      </section>
    </main>
  );
}

/**
 * Payment instructions. There is no push and no payment-status endpoint, so
 * this learns about a successful payment only by polling the order; `useOrder`
 * owns that, this owns what the buyer does in the meantime.
 *
 * Exported for PaymentPanel.test.jsx, which holds it to the contract that
 * every kind the backend can emit renders something a buyer can act on.
 */
export function PaymentPanel({ order, payment, onRefresh, refreshing, onRetry, retrying, retryError, onClaim, claiming, claimError }) {
  const { brand, payment: payConfig } = useConfig();
  const showToast = useToast();
  const [pastDeadline, setPastDeadline] = useState(() => Boolean(order.expires_at) && serverNow() > Date.parse(order.expires_at));

  // Past the deadline the worker sweeps once a minute; saying "expired" here
  // would be a lie to anyone whose payment landed seconds before it.
  if (pastDeadline) {
    return (
      <section style={{ ...panel, padding: 26 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Payment window closed</div>
        <div className="bl-muted" style={{ fontSize: 14, marginTop: 6 }}>
          Checking the latest status of your order…
        </div>
        <div className="bl-shimmer" style={{ marginTop: 16, height: 14, borderRadius: 6, width: '60%' }} />
      </section>
    );
  }

  // A charge that dies at checkout returns no payment at all; one that dies
  // later returns a row with every payload column empty. Same failure.
  if (paymentState(payment) === PAY_DEAD) {
    return <PaymentUnavailable order={order} brand={brand} onRetry={onRetry} retrying={retrying} retryError={retryError} />;
  }

  const copy = (value, label) => {
    navigator.clipboard?.writeText(value).then(
      () => showToast(`${label} copied ✓`),
      () => showToast('Couldn’t copy'),
    );
  };

  const kind = payment.kind;
  const manual = isManualPayment(payment);
  const whatsapp = brand.whatsapp_url ? (
    <a href={brand.whatsapp_url} target="_blank" rel="noopener noreferrer" className="bl-link" style={{ display: 'inline-block', marginTop: 10, fontSize: 13.5 }}>
      {brand.whatsapp_text || 'Contact us'}
    </a>
  ) : null;

  // Branch on kind, never on method: the gateway decides which fields it
  // populates, and a method can change kind under us.
  let block = null;
  let qr = null;
  if (kind === 'va') {
    block = (
      <Account label={`${payment.va_bank} Virtual Account`} number={payment.va_number} onCopy={() => copy(payment.va_number, 'VA number')} holder={payConfig.account_holder} />
    );
  } else if (kind === 'manual_transfer') {
    block = payment.manual_account_number ? (
      <Account
        label={`Bank transfer · ${payment.manual_bank}`}
        number={payment.manual_account_number}
        onCopy={() => copy(payment.manual_account_number, 'Account number')}
        holder={payment.manual_account_holder ? `a/n ${payment.manual_account_holder}` : ''}
        note="This is our regular account, shared across orders — the exact amount is what ties the transfer to yours. We confirm by hand, usually within a day."
      />
    ) : (
      <TestNote title="Account not available" body="The shop’s account details aren’t set up right now. Your order is saved and still payable — please contact us." extra={whatsapp} />
    );
  } else if (kind === 'redirect') {
    block = isUsableRedirect(payment.redirect_url) ? (
      <div style={{ marginTop: 22 }}>
        <a href={payment.redirect_url} rel="noopener noreferrer" className="bl-btn primary sm">
          Continue to the payment page →
        </a>
        <div className="bl-muted" style={{ fontSize: 12.5, marginTop: 10, lineHeight: 1.5 }}>
          You’ll leave this page. Note your order number <b style={{ color: 'var(--bl-ink)' }}>{order.number}</b> — it’s how you find this order again from Track order.
        </div>
      </div>
    ) : (
      <TestNote title="Test mode" body={`This method isn’t connected to a live payment page yet. Contact us to complete order ${order.number}.`} raw={payment.redirect_url} extra={whatsapp} />
    );
  } else if (kind === 'qr') {
    if (isQrisPayload(payment.qr_payload)) {
      qr = <QrCode payload={payment.qr_payload} />;
      block = <QrisNote config={payConfig} />;
    } else {
      block = <TestNote title="QRIS in test mode" body="QRIS isn’t active in this shop yet. Contact us to pay another way." raw={payment.qr_payload} extra={whatsapp} />;
    }
  } else if (kind === 'qr_image') {
    if (isQrImageURL(payment.qr_image_url)) {
      qr = <QrImage url={payment.qr_image_url} />;
      block = <QrisNote config={payConfig} />;
    } else {
      block = <TestNote title="QRIS in test mode" body="QRIS isn’t active in this shop yet. Contact us to pay another way." raw={payment.qr_image_url} extra={whatsapp} />;
    }
  } else if (kind === 'manual_qris') {
    if (isDisplayableImageURL(payment.manual_qr_image_url)) {
      qr = <QrImage url={payment.manual_qr_image_url} />;
      block = (
        <div className="bl-muted" style={{ marginTop: 22, fontSize: 12.5, lineHeight: 1.5 }}>
          Our shop QRIS carries no amount — type <b style={{ color: 'var(--bl-ink)' }}>{fmt(payment.amount)}</b> exactly.
          {payConfig.qris_merchant_name ? ` Merchant ${payConfig.qris_merchant_name}.` : ''}
          {payConfig.qris_nmid ? ` NMID ${payConfig.qris_nmid}.` : ''} We confirm by hand.
        </div>
      );
    } else {
      block = <TestNote title="QRIS not available" body="The shop hasn’t uploaded its QRIS for this method yet. Your order is saved — please contact us." extra={whatsapp} />;
    }
  } else if (kind === 'manual_whatsapp') {
    block = payment.manual_whatsapp_phone ? (
      <WhatsAppBlock phone={payment.manual_whatsapp_phone} order={order} />
    ) : (
      <TestNote title="WhatsApp number not available" body="The shop hasn’t set the number this order goes to. Your order is saved — please contact us." extra={whatsapp} />
    );
  }

  return (
    <section style={{ ...panel, overflow: 'hidden' }}>
      <div style={{ padding: '22px 26px', borderBottom: '1px solid var(--bl-sand-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{PAY_TITLES[kind] || 'Payment'}</div>
          {order.expires_at ? (
            <div className="bl-muted" style={{ fontSize: 13, marginTop: 3 }}>
              Pay before {fmtDateTime(order.expires_at)}
            </div>
          ) : null}
        </div>
        {order.expires_at ? (
          <div className="bl-muted" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            Time left <CountdownClock until={order.expires_at} onExpire={() => setPastDeadline(true)} style={{ fontWeight: 700, fontSize: 18, color: 'var(--bl-ink)' }} />
          </div>
        ) : null}
      </div>
      <div style={{ padding: '22px 26px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 26, alignItems: 'start' }}>
        <div>
          <PayableAmount amount={payment.amount} uniqueCode={order.unique_code} onCopy={() => copy(String(payment.amount), 'Amount')} />
          {block}
        </div>
        {qr ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {qr}
            <div className="bl-label" style={{ letterSpacing: '0.1em' }}>
              QRIS
            </div>
          </div>
        ) : null}
      </div>
      {manual ? <ManualClaim order={order} kind={kind} onClaim={onClaim} claiming={claiming} claimError={claimError} canClaim={canClaimPayment(order, payment)} /> : null}
      <div className="bl-muted" style={{ padding: '14px 26px', borderTop: '1px solid var(--bl-sand-2)', background: 'var(--bl-cream)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12.5 }}>
        This page updates by itself once the payment lands.
        <button type="button" onClick={onRefresh} className="bl-link" style={{ fontSize: 13 }}>
          {refreshing ? 'Checking…' : 'Check now'}
        </button>
      </div>
    </section>
  );
}

/**
 * The amount, which on a manual order is also the reference: the last three
 * digits are the only thing tying a bank credit to this order.
 */
function PayableAmount({ amount, uniqueCode, onCopy }) {
  const text = fmt(amount);
  const split = splitUniqueCode(text, uniqueCode);
  return (
    <div>
      <div className="bl-label">Amount to pay</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
        <div style={{ fontWeight: 800, fontSize: 30, fontVariantNumeric: 'tabular-nums', color: 'var(--bl-green)' }}>
          {split ? (
            <>
              {split.head}
              <span style={{ textDecoration: 'underline', textDecorationThickness: 3, textUnderlineOffset: 5, textDecorationColor: 'var(--bl-terra)' }}>{split.code}</span>
            </>
          ) : (
            text
          )}
        </div>
        <button type="button" onClick={onCopy} className="bl-btn chip">
          Copy amount
        </button>
      </div>
      {split ? (
        <div className="bl-muted" style={{ fontSize: 12.5, marginTop: 8, lineHeight: 1.5 }}>
          Transfer the exact amount — the last three digits are how we match your payment.
        </div>
      ) : null}
    </div>
  );
}

function Account({ label, number, onCopy, holder, note }) {
  return (
    <div style={{ marginTop: 22 }}>
      <div className="bl-label">{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 800, fontSize: 26, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>{number}</span>
        <button type="button" onClick={onCopy} className="bl-btn chip">
          Copy
        </button>
      </div>
      {holder ? (
        <div className="bl-muted" style={{ fontSize: 13, marginTop: 6 }}>
          {holder}
        </div>
      ) : null}
      {note ? (
        <div className="bl-muted" style={{ fontSize: 12.5, marginTop: 10, lineHeight: 1.5 }}>
          {note}
        </div>
      ) : null}
    </div>
  );
}

function QrisNote({ config }) {
  return (
    <div className="bl-muted" style={{ marginTop: 22, fontSize: 12.5, lineHeight: 1.5 }}>
      Scan with any bank or e-wallet app that supports QRIS. The amount is already filled in.
      {config.qris_merchant_name ? (
        <>
          <br />
          <b style={{ color: 'var(--bl-ink)' }}>{config.qris_merchant_name}</b>
        </>
      ) : null}
      {config.qris_nmid ? (
        <>
          <br />
          NMID {config.qris_nmid}
        </>
      ) : null}
    </div>
  );
}

/**
 * The order handed to the shop as the first message of a chat.
 *
 * The message is shown in full before the button because the buyer sends it
 * under their own name: nothing in it should surprise them. The link inside
 * it is this page's own URL, so the shop lands where the buyer is looking.
 */
function WhatsAppBlock({ phone, order }) {
  const message = orderMessage(order, typeof window === 'undefined' ? '' : window.location.href, WA_MESSAGE);
  return (
    <div style={{ marginTop: 22 }}>
      <div className="bl-muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
        We’ll agree shipping and payment in the chat.
      </div>
      <div className="bl-note info" style={{ marginTop: 10, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {message}
      </div>
      <a href={waLink(phone, message)} target="_blank" rel="noopener noreferrer" className="bl-btn primary sm" style={{ marginTop: 14 }}>
        Open WhatsApp →
      </a>
      <div className="bl-muted" style={{ fontSize: 12.5, marginTop: 10, lineHeight: 1.5 }}>
        The message is already written — just send it.
      </div>
    </div>
  );
}

/** A method whose instructions cannot be followed: the stub gateway, or a missing account. */
function TestNote({ title, body, raw, extra }) {
  return (
    <div className="bl-note test" style={{ marginTop: 22 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--bl-gold)' }}>{title}</div>
      <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5, color: 'var(--bl-ink)' }}>{body}</div>
      {extra}
      {raw ? (
        <code className="bl-muted" style={{ display: 'block', marginTop: 8, fontSize: 11, wordBreak: 'break-all' }}>
          {raw}
        </code>
      ) : null}
    </div>
  );
}

/** The order is fine; the instructions for paying it are not. */
function PaymentUnavailable({ order, brand, onRetry, retrying, retryError }) {
  return (
    <section role="alert" style={{ ...panel, background: 'var(--bl-terra-wash)', borderColor: 'var(--bl-terra-line)', padding: 26 }}>
      <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--bl-terra-dark)' }}>Payment couldn’t be opened</div>
      <p style={{ fontSize: 14, lineHeight: 1.6, margin: '8px 0 0', textWrap: 'pretty' }}>
        Your order is saved as <b>{order.number}</b> and can still be paid — only the payment instructions failed to be created.
        {order.expires_at ? (
          <>
            {' '}
            Try again before <b>{fmtDateTime(order.expires_at)}</b>.
          </>
        ) : null}
      </p>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 18, flexWrap: 'wrap' }}>
        {onRetry ? (
          <button type="button" onClick={onRetry} disabled={retrying} className="bl-btn ink sm">
            {retrying ? 'Opening payment…' : 'Try payment again'}
          </button>
        ) : null}
        {brand.whatsapp_url ? (
          <a href={`${brand.whatsapp_url}?text=${encodeURIComponent(`Hi, I need help paying order ${order.number}.`)}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--bl-terra-dark)', textDecoration: 'underline' }}>
            Contact us instead
          </a>
        ) : null}
      </div>
      {retryError ? (
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--bl-terra-dark)' }}>{retryError.message}</div>
      ) : null}
    </section>
  );
}

/** "I've paid", and what it turns into. A manual payment produces no callback. */
function ManualClaim({ order, kind, onClaim, claiming, claimError, canClaim }) {
  // A chat has no transfer to have "already" made; the amount is agreed there.
  const prompt =
    kind === 'manual_whatsapp'
      ? 'Paid as agreed on WhatsApp? Let us know and we’ll hold the order while we check.'
      : 'Already transferred? Let us know and we’ll hold the order while we check.';
  if (order.buyer_claimed_at) {
    return (
      <div style={{ padding: '14px 26px', borderTop: '1px solid var(--bl-sand-2)', fontSize: 13.5, color: 'var(--bl-green)' }}>
        ✓ Thanks — you told us you’ve paid at {fmtDateTime(order.buyer_claimed_at)}. We’re checking.
      </div>
    );
  }
  if (!canClaim) return null;
  return (
    <div style={{ padding: '16px 26px', borderTop: '1px solid var(--bl-sand-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <div className="bl-muted" style={{ fontSize: 13.5 }}>
        {prompt}
        {claimError ? (
          <span role="alert" style={{ display: 'block', color: 'var(--bl-terra-dark)', marginTop: 4 }}>
            {claimError.message}
          </span>
        ) : null}
      </div>
      <button type="button" onClick={onClaim} disabled={claiming} className="bl-btn ghost xs" style={{ fontSize: 13.5, padding: '10px 18px' }}>
        {claiming ? 'Sending…' : 'I’ve paid'}
      </button>
    </div>
  );
}
