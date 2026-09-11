import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';

import { sendLookupCode, verifyLookupCode } from '../../../../src/api/endpoints.js';
import { useConfig } from '../../../../src/config/ConfigProvider.jsx';
import { normalizeContact } from '../../../../src/lib/contact.js';
import { extractToken, forgetOrder, listOrders } from '../../../../src/checkout/orderTokens.js';
import { deviceRows, tokensOf } from '../../../../src/lib/deviceOrders.js';
import { useOrdersByToken } from '../../../../src/hooks/queries.js';
import { recordRetryAfter, recordSend, cooldown } from '../../../../src/checkout/otpCooldown.js';
import { fmt } from '../../../../src/shared/format.js';
import { CountdownWords } from '../ui/Countdown.jsx';
import { contactField, fmtDate, OTP_INVALID, validateContact } from '../lib/copy.js';

/**
 * Finding an order again. No endpoint looks an order up by number -- that
 * would be an unauthenticated lookup over a guessable identifier -- so there
 * are three honest routes back in.
 */
export default function LookupRoute() {
  const { contactChannel } = useConfig();
  const meta = contactField(contactChannel);
  const navigate = useNavigate();

  const [deviceOrders, setDeviceOrders] = useState(listOrders);
  const deviceChecks = useOrdersByToken(tokensOf(deviceOrders));
  const rows = deviceRows(deviceOrders, deviceChecks);
  const dropRow = (token) => {
    forgetOrder(token);
    setDeviceOrders((list) => list.filter((o) => o.token !== token));
  };

  const [link, setLink] = useState('');
  const [linkErr, setLinkErr] = useState('');
  const [contact, setContact] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(null);
  const [err, setErr] = useState('');
  const [orders, setOrders] = useState(null);

  const scope = normalizeContact(contactChannel, contact);
  const cool = sent ? cooldown(scope) : null;
  const cooling = Boolean(cool?.nextAllowedAt) && Date.parse(cool.nextAllowedAt) > Date.now();

  const sendMutation = useMutation({
    mutationFn: () => sendLookupCode(scope),
    onSuccess: (res) => {
      recordSend(scope);
      setErr('');
      setSent(res);
    },
    onError: (e) => {
      if (e?.status === 429 && e.retryAfter) recordRetryAfter(scope, e.retryAfter);
      setErr(e?.message || 'The code couldn’t be sent.');
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () => verifyLookupCode(scope, code),
    onSuccess: (list) => {
      setErr('');
      setOrders(list);
    },
    // A 400 is the one indistinguishable OTP failure; anything else (429 with
    // its wait, 5xx) keeps the API's message.
    onError: (e) => setErr(e?.status === 400 ? OTP_INVALID : e?.message || 'Verification failed.'),
  });

  const openLink = (e) => {
    e.preventDefault();
    const token = extractToken(link);
    if (!token) return setLinkErr('That link or order code isn’t recognised.');
    setLinkErr('');
    navigate(`/pesanan/${token}`);
  };

  const startLookup = (e) => {
    e.preventDefault();
    const invalid = validateContact(contactChannel, contact);
    if (invalid) return setErr(invalid);
    setErr('');
    sendMutation.mutate();
  };

  return (
    <main aria-label="Track order" className="bl-wrap" style={{ flex: 1, maxWidth: 760, padding: '44px 32px 20px' }}>
      <h1 className="bl-display" style={{ fontSize: 38 }}>
        Track order
      </h1>
      <p className="bl-muted" style={{ fontSize: 15, margin: '10px 0 0', lineHeight: 1.6 }}>
        Three ways back to your order.
      </p>

      <section className="bl-card" style={{ marginTop: 28 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Orders placed on this device</div>
        {rows.length === 0 ? (
          <div className="bl-muted" style={{ fontSize: 14, marginTop: 8 }}>
            None yet.
          </div>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
          {rows.map((o) => {
            const gone = o.state === 'gone';
            const sub = o.state === 'ok'
              ? `${fmtDate(o.placedAt)} · ${fmt(o.total)}`
              : gone
                ? 'No longer on file'
                : o.state === 'loading'
                  ? 'Checking…'
                  : `${fmtDate(o.placedAt)} · couldn’t check right now`;
            return (
              <div key={o.token} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--bl-sand-2)', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, color: gone ? 'var(--bl-faint)' : 'var(--bl-ink)', textDecoration: gone ? 'line-through' : 'none' }}>
                  {gone ? (
                    <span style={{ fontWeight: 700, fontSize: 14.5 }}>{o.number}</span>
                  ) : (
                    <Link to={`/pesanan/${o.token}`} style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--bl-ink)' }}>
                      {o.number}
                    </Link>
                  )}
                  <div className="bl-muted" style={{ fontSize: 12.5, marginTop: 3 }}>
                    {sub}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {o.statusLabel ? <span className={`bl-pill ${o.status || 'unknown'}`} style={{ fontSize: 11.5 }}>{o.statusLabel}</span> : null}
                  {gone ? (
                    <button type="button" onClick={() => dropRow(o.token)} className="bl-btn chip" style={{ color: 'var(--bl-muted)' }}>
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bl-card" style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Paste a tracking link or code</div>
        <form onSubmit={openLink} style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="The link from your confirmation, or the 26-character code" aria-label="Tracking link or code" className="bl-field" style={{ flex: 1, minWidth: 220, width: 'auto' }} />
          <button type="submit" className="bl-btn ink sm">
            Open
          </button>
        </form>
        {linkErr ? (
          <div role="alert" style={{ fontSize: 13, color: 'var(--bl-terra-dark)', marginTop: 8 }}>
            {linkErr}
          </div>
        ) : null}
      </section>

      <section className="bl-card" style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Find by {meta.label.toLowerCase()}</div>
        <div className="bl-muted" style={{ fontSize: 13, marginTop: 4 }}>
          We’ll send a code to confirm it’s you.
        </div>

        {orders ? (
          <LookupResults orders={orders} />
        ) : (
          <>
            <form onSubmit={startLookup} style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder={meta.placeholder}
                aria-label={meta.label}
                type={meta.type}
                inputMode={meta.inputMode}
                autoComplete={meta.autoComplete}
                disabled={Boolean(sent)}
                className="bl-field"
                style={{ flex: 1, minWidth: 200, width: 'auto' }}
              />
              <button type="submit" disabled={sendMutation.isPending || (sent && cooling)} className="bl-btn primary sm">
                {sendMutation.isPending ? 'Sending…' : sent ? (cooling ? <>Resend in <CountdownWords until={cool.nextAllowedAt} /></> : 'Resend') : 'Send code'}
              </button>
            </form>
            {sent ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  verifyMutation.mutate();
                }}
                style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}
              >
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="6-digit code"
                  aria-label="Verification code"
                  autoFocus
                  className="bl-field"
                  style={{ width: 160, fontWeight: 700, fontSize: 16, letterSpacing: '0.2em' }}
                />
                <button type="submit" disabled={code.length !== 6 || verifyMutation.isPending} className="bl-btn ink sm">
                  {verifyMutation.isPending ? 'Checking…' : 'Verify'}
                </button>
                <span className="bl-muted" style={{ fontSize: 12.5 }}>
                  Sent to {sent.masked}
                </span>
              </form>
            ) : null}
          </>
        )}

        {err ? (
          <div role="alert" style={{ fontSize: 13, color: 'var(--bl-terra-dark)', marginTop: 8, lineHeight: 1.6 }}>
            {err}
          </div>
        ) : null}
      </section>
    </main>
  );
}

/**
 * The lookup response carries no track token, so these render in full and
 * deliberately link nowhere: there is nowhere to link to.
 */
function LookupResults({ orders }) {
  if (orders.length === 0) {
    return (
      <div className="bl-muted" style={{ fontSize: 14, marginTop: 16 }}>
        No orders are linked to this contact.
      </div>
    );
  }
  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column' }}>
      {orders.map((o) => (
        <div key={o.id} style={{ padding: '12px 0', borderTop: '1px solid var(--bl-sand-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{o.number}</div>
              <div className="bl-muted" style={{ fontSize: 12.5, marginTop: 3 }}>
                {fmtDate(o.placed_at)} · {fmt(o.total)} · {o.customer_name}
              </div>
            </div>
            <span className={`bl-pill ${o.status || 'unknown'}`} style={{ fontSize: 11.5 }}>
              {o.status_label}
            </span>
          </div>
          <div className="bl-muted" style={{ fontSize: 12.5, marginTop: 6 }}>
            {(o.lines ?? []).map((l) => `${l.name} ×${l.qty}`).join(', ')}
          </div>
          {o.awb ? (
            <div style={{ fontSize: 13, marginTop: 6 }}>
              Tracking number <b>{o.awb}</b> · {String(o.courier_code || '').toUpperCase()}
            </div>
          ) : null}
          {o.status === 'awaiting_payment' ? (
            <div className="bl-note info" style={{ marginTop: 10, color: 'var(--bl-muted)' }}>
              The payment instructions are in your confirmation message — open the link there to finish paying.
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
