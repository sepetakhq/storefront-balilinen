/**
 * One courier or payment option: a radio dot, a label, something on the
 * right, and the server's badge beside it when it sends one.
 */
export function OptionTile({ selected, disabled, onClick, right, logo, children }) {
  return (
    <button type="button" className="bl-tile" aria-pressed={selected} disabled={disabled} onClick={onClick}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span className="dot" aria-hidden="true" />
        <span>{children}</span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 'none' }}>
        {/* Decorative: the name beside it already says what it is. */}
        {logo ? <img className="bl-choice-logo" src={logo} alt="" /> : null}
        {right}
      </span>
    </button>
  );
}
