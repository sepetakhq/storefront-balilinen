import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { resolveDestination, searchDestinations } from '@sepetakhq/storefront-kit/api/endpoints';
import { qk } from '@sepetakhq/storefront-kit/api/queryKeys';
import { destinationLines, isUnserved, matchRange, unservedAlternatives } from '@sepetakhq/storefront-kit/lib/shipping';

const MIN_QUERY = 3;

/**
 * Where the parcel is going, under live rates. The provider quotes from an
 * opaque location id, so something has to turn what the buyer typed into one
 * before a price exists; searching is free, resolving asks the couriers and
 * runs once per choice.
 */
export default function DestinationPicker({ value, onChange, disabled }) {
  const listId = useId();
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [resolving, setResolving] = useState(false);
  const [unserved, setUnserved] = useState(null);
  const boxRef = useRef(null);

  useEffect(() => {
    const id = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);

  const results = useQuery({
    queryKey: qk.destinations(term),
    queryFn: ({ signal }) => searchDestinations(term, signal),
    enabled: term.length >= MIN_QUERY,
    placeholderData: (prev) => prev,
    staleTime: Infinity,
  });
  const rows = results.data ?? [];

  useEffect(() => {
    function onAway(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onAway);
    return () => document.removeEventListener('mousedown', onAway);
  }, []);

  async function pick(row) {
    if (!row || resolving) return;
    setResolving(true);
    setUnserved(null);
    try {
      const { destination } = await resolveDestination(row.ref);
      onChange(destination);
      setQ('');
      setOpen(false);
      setActive(0);
    } catch (err) {
      setUnserved(err);
      setOpen(false);
    } finally {
      setResolving(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') return setOpen(false);
    if (!open || rows.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % rows.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + rows.length) % rows.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(rows[active]);
    }
  }

  if (value) {
    const { primary, secondary } = destinationLines(value);
    return (
      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--bl-green)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--bl-lime)', flex: 'none' }} />
          <span>
            Deliver to {primary}
            {secondary ? <span className="bl-muted"> · {secondary}</span> : null}
          </span>
        </span>
        <button type="button" onClick={() => onChange(null)} className="bl-btn chip">
          Change
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} style={{ gridColumn: '1 / -1', position: 'relative' }}>
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && rows.length ? `${listId}-${active}` : undefined}
        aria-label="Delivery area"
        autoComplete="off"
        disabled={disabled}
        value={q}
        placeholder="Search area — kecamatan, city or postcode"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="bl-field"
      />

      {open && term.length >= MIN_QUERY ? (
        <ul
          id={listId}
          role="listbox"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 'calc(100% + 6px)',
            zIndex: 20,
            margin: 0,
            padding: 0,
            listStyle: 'none',
            background: 'var(--bl-white)',
            border: '1px solid var(--bl-line)',
            borderRadius: 12,
            boxShadow: '0 14px 34px var(--bl-shadow)',
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          {results.isError ? (
            <li style={{ padding: '12px 14px', fontSize: 13, color: 'var(--bl-terra-dark)' }}>Search failed. Try again in a moment.</li>
          ) : rows.length === 0 ? (
            <li className="bl-muted" style={{ padding: '12px 14px', fontSize: 13 }}>
              {results.isFetching ? 'Searching…' : 'No areas match. Try the kecamatan name.'}
            </li>
          ) : (
            rows.map((row, i) => {
              const { primary, secondary } = destinationLines(row);
              return (
                <li
                  key={row.ref}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(row);
                  }}
                  style={{ padding: '11px 14px', cursor: 'pointer', borderBottom: '1px solid var(--bl-sand-2)', background: i === active ? 'var(--bl-lime-wash-3)' : 'transparent' }}
                >
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    <Highlight text={primary} query={term} />
                  </div>
                  {secondary ? <div className="bl-muted" style={{ fontSize: 12 }}>{secondary}</div> : null}
                </li>
              );
            })
          )}
        </ul>
      ) : null}

      {unserved ? <Unserved error={unserved} onPick={pick} /> : null}
    </div>
  );
}

/** The refusal, and the nearby places that do resolve. */
function Unserved({ error, onPick }) {
  const alternatives = isUnserved(error) ? unservedAlternatives(error) : [];
  return (
    <div role="alert" style={{ marginTop: 8 }}>
      <div style={{ fontSize: 13, color: 'var(--bl-terra-dark)' }}>
        {error?.message || 'That area can’t be used. Try another one nearby.'}
      </div>
      {alternatives.length ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {alternatives.map((row) => (
            <button key={row.ref} type="button" onClick={() => onPick(row)} className="bl-btn chip">
              {destinationLines(row).primary}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Highlight({ text, query }) {
  const at = matchRange(text, query);
  if (!at) return text;
  return (
    <>
      {text.slice(0, at.start)}
      <mark style={{ background: 'transparent', color: 'var(--bl-green)', fontWeight: 700 }}>{text.slice(at.start, at.end)}</mark>
      {text.slice(at.end)}
    </>
  );
}
