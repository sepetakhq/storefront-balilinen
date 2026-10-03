import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getShippingRates } from '@sepetakhq/storefront-kit/api/endpoints';
import { qk } from '@sepetakhq/storefront-kit/api/queryKeys';
import { fmt } from '@sepetakhq/storefront-kit/shared/format';
import { defaultOption, destinationLines, isStillOffered, weightInKg } from '@sepetakhq/storefront-kit/lib/shipping';
import { OptionTile } from './OptionTile.jsx';

/**
 * The live rate list. The options carry a quote id each; that id, never a
 * price, is what checkout submits.
 */
export default function ShippingRates({ destination, items, selected, onSelect, onRetry }) {
  const cartKey = items.map((i) => `${i.product_id}:${i.variant_id ?? ''}:${i.qty}`).sort().join('|');

  const rates = useQuery({
    queryKey: qk.rates(destination?.ref ?? '', cartKey),
    queryFn: ({ signal }) =>
      getShippingRates({ destination_ref: destination.ref, destination_label: destination.label, items }, signal),
    enabled: Boolean(destination?.ref) && items.length > 0,
    staleTime: 10 * 60_000,
    retry: false,
  });

  const options = rates.data?.options ?? [];

  // Land on the cheapest once the list arrives, and re-pick when a choice
  // stops being offered.
  useEffect(() => {
    if (options.length === 0) return;
    if (isStillOffered(options, selected)) return;
    onSelect(defaultOption(options));
  }, [options, selected, onSelect]);

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
      ) : rates.isError || options.length === 0 ? (
        <RateProblem error={rates.isError ? rates.error : null} onRetry={() => rates.refetch()} onEdit={onRetry} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {options.map((o) => {
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
        </div>
      )}
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
