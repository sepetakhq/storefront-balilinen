import { useCountdown } from '../../../../src/hooks/useCountdown.js';
import { fmtClock } from '../../../../src/shared/format.js';
import { serverNow } from '../../../../src/api/client.js';

const HOUR = 60 * 60 * 1000;

/**
 * The isolation boundary that lets a one-second tick stay small: these render
 * nothing but the number, so a repaint is one span, not a screen.
 */

/** h:mm:ss for the campaign strip, ticking every second while it is on screen. */
export function CountdownClockSeconds({ until, onExpire, className, style }) {
  const { ms, active } = useCountdown(until, { onExpire, resolution: 'second' });
  if (!active) return null;
  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums', ...style }}>
      {fmtClock(ms)}
    </span>
  );
}

/** mm:ss for the OTP and payment deadlines; relaxes to minutes past an hour. */
export function CountdownClock({ until, onExpire, className, style }) {
  const far = Date.parse(until) - serverNow() > HOUR;
  const { ms, active } = useCountdown(until, { onExpire, resolution: far ? 'adaptive' : 'second' });
  if (!active) return null;
  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums', ...style }}>
      {fmtClock(ms)}
    </span>
  );
}

/** "45s" / "5 min", for a resend button label. */
export function CountdownWords({ until, onExpire }) {
  const { ms, active } = useCountdown(until, { onExpire });
  if (!active) return null;
  const secs = Math.ceil(ms / 1000);
  return <>{secs < 60 ? `${secs}s` : `${Math.ceil(secs / 60)} min`}</>;
}
