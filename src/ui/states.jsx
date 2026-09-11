// Loading, empty and failure, in this shop's own cream. Quiet on purpose:
// the storefront spends its boldness on the photography and the green.

/** A shape that stands in for content while it loads. */
export function Skeleton({ ratio, height, width = '100%', radius = 8, style }) {
  return (
    <div
      aria-hidden="true"
      className="bl-shimmer"
      style={{
        aspectRatio: ratio,
        height: ratio ? undefined : height || 14,
        width,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className="bl-grid" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton ratio="4/5" radius={14} />
          <Skeleton height={13} width="70%" style={{ marginTop: 12 }} />
          <Skeleton height={13} width="40%" style={{ marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

/** An empty screen is an invitation to act, so it always carries one. */
export function EmptyState({ title, body, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '70px 0', color: 'var(--bl-muted)' }}>
      <div className="bl-display" style={{ fontSize: 26, color: 'var(--bl-ink)' }}>
        {title}
      </div>
      {body ? <div style={{ marginTop: 8, fontSize: 14.5 }}>{body}</div> : null}
      {action ? <div style={{ marginTop: 20 }}>{action}</div> : null}
    </div>
  );
}

/**
 * Failures explain themselves and offer the next move. `error.message` is the
 * server's own copy, rendered as-is.
 */
export function ErrorState({ error, onRetry, title, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '70px 0', maxWidth: 460, margin: '0 auto' }}>
      <div className="bl-display" style={{ fontSize: 26 }}>
        {title || 'Couldn’t load this page'}
      </div>
      <p className="bl-muted" style={{ fontSize: 15, lineHeight: 1.65, margin: '12px 0 0' }}>
        {error?.message || 'Something went wrong on the way here.'}
      </p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="bl-btn ghost sm" style={{ marginTop: 22 }}>
          Try again
        </button>
      ) : null}
      {action ? <div style={{ marginTop: 16 }}>{action}</div> : null}
      {error?.requestId ? (
        <p style={{ fontSize: 11, color: 'var(--bl-faint)', marginTop: 18 }}>
          Error reference: {error.requestId.slice(0, 8)}
        </p>
      ) : null}
    </div>
  );
}

/** An inline failure that must not take over the page. */
export function InlineError({ error, onRetry }) {
  return (
    <div
      role="alert"
      className="bl-note error"
      style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}
    >
      <span>{error?.message || 'Couldn’t load this.'}</span>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="bl-btn xs" style={{ border: '1px solid currentColor', color: 'inherit' }}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
