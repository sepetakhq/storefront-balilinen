import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getMapPlace, getShippingRates } from '@sepetakhq/storefront-kit/api/endpoints';
import { qk } from '@sepetakhq/storefront-kit/api/queryKeys';
import { useConfig } from '@sepetakhq/storefront-kit/config/ConfigProvider';
import { fmt } from '@sepetakhq/storefront-kit/shared/format';
import {
  defaultGroup,
  defaultOption,
  destinationLines,
  groupRates,
  isStillOffered,
  weightInKg,
} from '@sepetakhq/storefront-kit/lib/shipping';
import MapPicker from '@sepetakhq/storefront-kit/map/MapPicker';
import { useBuyerPoint } from '@sepetakhq/storefront-kit/hooks/useBuyerPoint';
import { OptionTile } from './OptionTile.jsx';

/**
 * The live rate list. The options carry a quote id each; that id, never a
 * price, is what checkout submits.
 */
export default function ShippingRates({ destination, items, selected, onSelect, onRetry }) {
  const { instantShipping } = useConfig();
  // GoSend/Grab are priced from a pin the buyer drops on the map.
  const loc = useBuyerPoint(destination?.ref ?? '');
  const [open, setOpen] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  // Set when a pin is confirmed: select Instan's cheapest once it is priced.
  const [wantInstant, setWantInstant] = useState(false);
  const cartKey = items.map((i) => `${i.product_id}:${i.variant_id ?? ''}:${i.qty}`).sort().join('|');

  const rates = useQuery({
    queryKey: qk.rates(destination?.ref ?? '', cartKey, loc.point),
    queryFn: ({ signal }) =>
      getShippingRates(
        { destination_ref: destination.ref, destination_label: destination.label, items, destination_point: loc.point ?? undefined },
        signal,
      ),
    enabled: Boolean(destination?.ref) && items.length > 0,
    staleTime: 10 * 60_000,
    retry: false,
  });

  // Where the picked kecamatan is: the map opens there. Free to be missing.
  const place = useQuery({
    queryKey: qk.mapPlace(destination?.ref ?? ''),
    queryFn: ({ signal }) => getMapPlace(destination.ref, signal),
    enabled: Boolean(destination?.ref) && instantShipping && mapOpen,
    staleTime: Infinity,
    retry: false,
  });

  const options = rates.data?.options ?? [];
  const groups = groupRates(options);
  // A shop selling only GoSend/Grab answers "share your location" until the
  // buyer drops a pin: the Instan row is then the whole answer.
  const needsPoint = rates.isError && rates.error?.code === 'location_needed';
  const instantRow = instantShipping && !groups.some((g) => g.key === 'instant');
  const shown = instantRow ? [{ key: 'instant', label: 'Instan', eta: '1–3 jam', options: [], from: null }, ...groups] : groups;

  // Land on the cheapest of the type in view, and re-pick when a choice stops
  // being offered.
  useEffect(() => {
    if (options.length === 0) return;
    const key = open && groups.some((g) => g.key === open) ? open : defaultGroup(groups, selected);
    if (key !== open) setOpen(key);
    const instant = groups.find((g) => g.key === 'instant');
    if (wantInstant && instant) {
      setWantInstant(false);
      setOpen('instant');
      if (!instant.options.some((o) => o.quote_id === selected)) onSelect(defaultOption(instant.options));
      return;
    }
    if (isStillOffered(options, selected)) return;
    const group = groups.find((g) => g.key === key);
    onSelect(defaultOption(group?.options ?? options));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, selected]);

  const pick = (g) => {
    if (g.key === 'instant' && !loc.point) {
      setMapOpen(true);
      return;
    }
    setOpen(g.key);
    if (g.options.length > 0 && !g.options.some((o) => o.quote_id === selected)) onSelect(defaultOption(g.options));
  };
  const free = Boolean(rates.data?.free_shipping);

  const sub = !destination
    ? 'Pick a delivery area above to see rates.'
    : rates.data
      ? `Rates for ${weightInKg(rates.data.weight_grams) || '1'} kg to ${destinationLines(destination).primary}`
      : 'Fetching rates…';

  return (
    <div>
      <div className="bl-muted" style={{ fontSize: 12.5, marginBottom: 14 }}>
        {sub}
      </div>
      {!destination ? null : rates.isPending ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-busy="true">
          <div className="bl-shimmer" style={{ height: 52, borderRadius: 12 }} />
          <div className="bl-shimmer" style={{ height: 52, borderRadius: 12 }} />
        </div>
      ) : rates.isError && !needsPoint ? (
        <RateProblem error={rates.error} onRetry={() => rates.refetch()} onEdit={onRetry} />
      ) : shown.length === 0 ? (
        <RateProblem error={null} onRetry={() => rates.refetch()} onEdit={onRetry} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown.map((g) => (
            <div key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <GroupRow group={g} free={free} open={open === g.key} needsPin={g.key === 'instant' && !loc.point}
                unavailable={g.key === 'instant' && Boolean(loc.point) && g.options.length === 0 && rates.isSuccess} onClick={() => pick(g)} />
              {open === g.key ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 10 }}>
                  {g.options.map((o) => {
                    const cost = rates.data.free_shipping ? 0 : o.cost;
                    return (
                      <OptionTile
                        key={o.quote_id}
                        selected={selected === o.quote_id}
                        onClick={() => onSelect(o)}
                        logo={o.courier_logo_url}
                        right={<span style={{ fontWeight: 800, fontSize: 14, color: cost === 0 ? 'var(--bl-green)' : 'var(--bl-ink)', whiteSpace: 'nowrap' }}>{cost === 0 ? 'FREE' : fmt(cost)}</span>}
                      >
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{o.name}</span>{' '}
                        <span className="bl-muted" style={{ fontSize: 12.5 }}>
                          · {o.courier_name || (o.courier_code ?? '').toUpperCase()} · {o.etd}
                        </span>
                      </OptionTile>
                    );
                  })}
                  {g.key === 'instant' && loc.point ? (
                    <PinLine none={g.options.length === 0 && rates.isSuccess} onEdit={() => setMapOpen(true)} />
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {mapOpen ? (
        <MapSheet
          center={loc.point ?? place.data ?? null}
          near={place.data ?? null}
          onCancel={() => setMapOpen(false)}
          onConfirm={(p) => {
            loc.set(p);
            setMapOpen(false);
            setOpen('instant');
            setWantInstant(true);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * One delivery type: what the buyer chooses first, the courier second.
 * "mulai Rp X" is the cheapest inside it; Instan before a pin asks for one.
 * The words are shop-system wording, fixed in Indonesian like the kit's own.
 */
export function GroupRow({ group, free, open, needsPin, unavailable, onClick }) {
  return (
    <button
      type="button"
      className="bl-tile"
      aria-expanded={Boolean(open)}
      onClick={onClick}
      style={{ minHeight: 52, ...(open ? { borderColor: 'var(--bl-green-2)', background: 'var(--bl-lime-wash-3)' } : null) }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: 14 }}>{group.label}</span>
        {group.eta || needsPin ? (
          <span className="bl-muted" style={{ display: 'block', fontSize: 12.5 }}>
            {needsPin ? 'Pilih titik di peta untuk lihat ongkir' : group.eta}
          </span>
        ) : null}
      </span>
      <span style={{ fontWeight: 800, fontSize: 14, color: free && !needsPin ? 'var(--bl-green)' : 'var(--bl-ink)', whiteSpace: 'nowrap' }}>
        {needsPin ? 'Pilih titik' : unavailable ? 'Tidak tersedia' : free ? 'Gratis' : group.from != null ? `mulai ${fmt(group.from)}` : ''}
      </span>
      <span aria-hidden="true" style={{ color: 'var(--bl-green)' }}>{open ? '▴' : '▾'}</span>
    </button>
  );
}

/** Under the Instan couriers: where they were priced to, and the way to move it. */
export function PinLine({ none, onEdit }) {
  return (
    <div className="bl-muted" style={{ fontSize: 13, display: 'grid', gap: 4 }}>
      {none ? <span style={{ color: 'var(--bl-ink)' }}>GoSend/Grab tidak tersedia untuk titik ini.</span> : null}
      <span>
        Dihitung ke titik yang kamu pilih di peta ·{' '}
        <button
          type="button"
          onClick={onEdit}
          className="bl-link"
          style={{ fontSize: 13, textDecoration: 'underline', padding: '0 4px', display: 'inline-flex', alignItems: 'center', minHeight: 44 }}
        >
          Ubah titik
        </button>
      </span>
    </div>
  );
}

const pill = { borderRadius: 999, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' };
const mapButtons = {
  confirm: { ...pill, border: '1.5px solid var(--bl-green-2)', background: 'var(--bl-green-2)', color: 'var(--bl-white)' },
  secondary: { ...pill, border: '1.5px solid var(--bl-ink)', background: 'transparent', color: 'var(--bl-ink)' },
};

/** The map, in this template's own sheet. */
export function MapSheet({ center, near, onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(38,37,31,0.45)', display: 'grid', placeItems: 'center', padding: 12 }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pilih titik pengiriman"
        className="bl-map-sheet"
        style={{
          background: 'var(--bl-white)',
          borderRadius: 20,
          padding: '20px 18px 16px',
          width: 'min(560px,100%)',
          maxHeight: '100%',
          overflow: 'auto',
          boxShadow: '0 30px 80px rgba(38,37,31,0.3)',
          color: 'var(--bl-ink)',
        }}
      >
        <h2 className="bl-display" style={{ fontSize: 24, fontWeight: 400, margin: '0 0 10px' }}>Titik pengiriman</h2>
        <MapPicker center={center} near={near} onConfirm={onConfirm} onCancel={onCancel} buttons={mapButtons} />
      </div>
    </div>
  );
}

/**
 * What to say when there is no list. Whether waiting helps is the distinction:
 * a quota or an outage clears on its own; a route nobody serves does not.
 */
export function RateProblem({ error, onRetry, onEdit }) {
  const status = error?.status;
  const code = error?.code;
  const retryable = !error || status === 503 || status >= 500 || error?.isNetwork;
  // The shop has spent its live rate checks for the month. The API's
  // message is Indonesian, so this template says it in its own language.
  const exhausted = !retryable && code === 'rate_checks_exhausted';
  const heading = retryable
    ? 'Rates can’t be worked out right now.'
    : exhausted
      ? 'Live shipping rates are unavailable right now.'
      : code === 'shipping_unavailable'
      ? 'Rates for these products can’t be worked out yet.'
      : 'No courier serves this area yet.';
  const body = retryable
    ? 'Try again in a moment.'
    : exhausted
      ? 'Please contact the shop to complete your order.'
      : code === 'shipping_unavailable'
      ? 'Please contact the shop — the product data is incomplete.'
      : 'Try a neighbouring kecamatan.';

  return (
    <div role="alert" className="bl-note error" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
      <span>
        <span style={{ display: 'block', fontWeight: 700 }}>{heading}</span>
        <span style={{ display: 'block', fontSize: 13, marginTop: 2 }}>{body}</span>
      </span>
      <button type="button" onClick={retryable ? onRetry : onEdit} className="bl-btn xs" style={{ border: '1px solid currentColor', color: 'inherit' }}>
        {retryable ? 'Recalculate' : 'Change area'}
      </button>
    </div>
  );
}
