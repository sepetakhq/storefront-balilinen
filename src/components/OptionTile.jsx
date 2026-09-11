/** One courier or payment option: a radio dot, a label, something on the right. */
export function OptionTile({ selected, disabled, onClick, right, children }) {
  return (
    <button type="button" className="bl-tile" aria-pressed={selected} disabled={disabled} onClick={onClick}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span className="dot" aria-hidden="true" />
        <span>{children}</span>
      </span>
      {right}
    </button>
  );
}
