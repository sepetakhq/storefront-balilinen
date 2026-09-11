/** The two glyphs the design draws itself. Everything else is type. */

export function WhatsAppIcon({ size = 20, detailed = false, color = 'var(--bl-white)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.6a9.3 9.3 0 0 0-8 14L2.7 21l4.6-1.2A9.3 9.3 0 1 0 12 2.6z" style={{ fill: color }} />
      {detailed ? (
        <path
          d="M9.2 7.4c-.3-.6-.5-.6-.8-.6h-.7c-.2 0-.6.1-.9.4-.3.4-1.2 1.2-1.2 2.9s1.2 3.3 1.4 3.6c.2.2 2.4 3.8 5.9 5.2 2.9 1.1 3.5.9 4.1.9.6-.1 2-.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.2-.3-.2-.7-.4l-2.4-1.2c-.3-.1-.6-.2-.8.2l-1 1.3c-.2.2-.4.2-.7.1-.4-.2-1.5-.6-2.8-1.8-1-.9-1.7-2-1.9-2.4-.2-.4 0-.5.2-.7l.5-.6c.2-.2.2-.4.4-.6.1-.2.1-.5 0-.7l-1.1-2.4z"
          style={{ fill: 'var(--bl-wa)' }}
        />
      ) : null}
    </svg>
  );
}

export function BagIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5.5 8h13l-1.1 12.2a1 1 0 0 1-1 .8H7.6a1 1 0 0 1-1-.8L5.5 8z"
        style={{ fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinejoin: 'round' }}
      />
      <path
        d="M9 10V7a3 3 0 0 1 6 0v3"
        style={{ fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' }}
      />
    </svg>
  );
}

export function CheckIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ flex: 'none' }}>
      <circle cx="32" cy="32" r="30" style={{ fill: 'var(--bl-green-2)' }} />
      <path
        d="M20 33l8 8 16-17"
        style={{ fill: 'none', stroke: 'var(--bl-white)', strokeWidth: 5, strokeLinecap: 'round', strokeLinejoin: 'round' }}
      />
    </svg>
  );
}
