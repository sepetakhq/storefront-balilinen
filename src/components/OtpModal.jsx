import { useEffect, useRef, useState } from 'react';

import { CountdownClock, CountdownWords } from '../ui/Countdown.jsx';

/**
 * The verification step. One error message covers every failure, because the
 * API returns one: wrong, expired, too many attempts and a code bound to
 * another checkout are deliberately indistinguishable, so the UI never
 * guesses at a reason.
 */
export default function OtpModal({ otp, verifying, resending, onVerify, onResend, onCancel }) {
  const [code, setCode] = useState('');
  const [expired, setExpired] = useState(false);
  const [cooling, setCooling] = useState(() => isCooling(otp.nextAllowedAt));
  const inputRef = useRef(null);
  const dialogRef = useRef(null);

  // A resend replaces the challenge, so the field must not keep the old code.
  useEffect(() => {
    setCode('');
    setExpired(false);
    setCooling(isCooling(otp.nextAllowedAt));
    inputRef.current?.focus();
  }, [otp.expiresAt, otp.nextAllowedAt]);

  // Escape closes; focus stays inside.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') return onCancel();
      if (e.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll('button:not([disabled]), input, [href], [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const canVerify = code.length === 6 && !verifying && !expired;
  const submit = () => canVerify && onVerify(code);
  const tooMany = otp.attempts >= 2;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(38,37,31,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Enter the verification code"
        style={{ background: 'var(--bl-white)', borderRadius: 20, padding: '30px 30px 26px', width: '100%', maxWidth: 420, boxShadow: '0 30px 80px rgba(38,37,31,0.3)' }}
      >
        <div className="bl-display" style={{ fontSize: 26 }}>
          Enter the code
        </div>
        <div className="bl-muted" style={{ fontSize: 14, marginTop: 8, lineHeight: 1.55 }}>
          We sent a 6-digit code to <b style={{ color: 'var(--bl-ink)' }}>{otp.masked}</b>. A new code replaces any earlier one.
        </div>

        <input
          ref={inputRef}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="••••••"
          aria-label="Verification code"
          aria-invalid={Boolean(otp.error)}
          disabled={verifying}
          autoFocus
          className="bl-field otp"
          style={{ marginTop: 20, borderColor: otp.error ? 'var(--bl-terra)' : undefined }}
        />

        <div className="bl-muted" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginTop: 10, minHeight: 18 }}>
          {expired ? (
            <span style={{ color: 'var(--bl-terra-dark)' }}>The code has expired. Resend to get a new one.</span>
          ) : (
            <span>
              Code valid for <CountdownClock until={otp.expiresAt} onExpire={() => setExpired(true)} />
            </span>
          )}
        </div>

        {otp.error ? (
          <div role="alert" className="bl-note error" style={{ marginTop: 12, fontSize: 13 }}>
            {otp.error}
          </div>
        ) : null}

        <button type="button" onClick={submit} disabled={!canVerify || tooMany} className="bl-btn primary block" style={{ marginTop: 16, padding: 14 }}>
          {verifying ? 'Verifying…' : tooMany ? 'Request a new code below' : 'Verify & place order'}
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <button type="button" onClick={onResend} disabled={cooling || resending} className="bl-link" style={{ fontSize: 13.5, padding: '6px 0' }}>
            {resending ? (
              'Sending…'
            ) : cooling ? (
              <>
                Resend code in <CountdownWords until={otp.nextAllowedAt} onExpire={() => setCooling(false)} />
              </>
            ) : (
              'Resend code'
            )}
          </button>
          <button type="button" onClick={onCancel} className="bl-muted" style={{ fontSize: 13.5, fontWeight: 600, padding: '6px 0' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function isCooling(nextAllowedAt) {
  return Boolean(nextAllowedAt) && Date.parse(nextAllowedAt) > Date.now();
}
