import { Link } from 'react-router-dom';

import { useConfig } from '@sepetakhq/storefront-kit/config/ConfigProvider';
import { useCategories } from '@sepetakhq/storefront-kit/hooks/queries';
import { Logo } from './Logo.jsx';
import { sectionText } from '../lib/copy.js';

const heading = { fontWeight: 700, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 };
const chip = { display: 'inline-flex', alignItems: 'center', minHeight: 30, border: '1px solid var(--bl-line)', borderRadius: 8, padding: '6px 11px', fontSize: 12, color: 'var(--bl-muted)' };

export default function Footer() {
  const { brand, couriers, paymentMethods } = useConfig();
  const { data: cats } = useCategories();

  return (
    <footer style={{ marginTop: 72, background: 'var(--bl-white)', borderTop: '1px solid var(--bl-line)' }}>
      <div
        className="bl-wrap"
        style={{
          padding: '52px 32px 28px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 36,
        }}
      >
        <div>
          <Logo height={34} />
          <p className="bl-muted" style={{ fontSize: 13.5, lineHeight: 1.65, margin: '14px 0 0', maxWidth: 260 }}>
            {brand.tagline}
          </p>
          <div className="bl-muted" style={{ fontSize: 13, marginTop: 14, lineHeight: 1.7 }}>
            {brand.address_line1}
            {brand.address_line2 ? (
              <>
                <br />
                {brand.address_line2}
              </>
            ) : null}
          </div>
        </div>
        <div>
          <div style={heading}>{sectionText(brand.sections, 'footer_categories_heading')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, alignItems: 'flex-start' }}>
            {(cats ?? []).map((c) => (
              <Link key={c.key} to={`/katalog?cat=${encodeURIComponent(c.key)}`} style={{ fontSize: 14, color: 'var(--bl-muted)' }}>
                {c.label}
              </Link>
            ))}
            <Link to="/katalog" style={{ fontSize: 14, color: 'var(--bl-muted)' }}>
              All products
            </Link>
          </div>
        </div>
        <div>
          <div style={heading}>{sectionText(brand.sections, 'footer_payment_heading')}</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {chips(paymentMethods).map((m) => (
              <Chip key={m.code} item={m} />
            ))}
          </div>
        </div>
        <div>
          <div style={heading}>{sectionText(brand.sections, 'footer_shipping_heading')}</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {chips(couriers).map((c, i) => (
              <Chip key={`${c.code}-${i}`} item={c} />
            ))}
          </div>
          {brand.productShippingCopy ? (
            <div className="bl-muted" style={{ fontSize: 13, marginTop: 14, lineHeight: 1.6 }}>
              {brand.productShippingCopy}
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--bl-sand-2)' }}>
        <div
          className="bl-wrap"
          style={{
            padding: '16px 32px',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            fontSize: 12.5,
            color: 'var(--bl-faint)',
          }}
        >
          <span>{brand.copyright}</span>
          <Link to="/lacak" style={{ color: 'var(--bl-faint)' }}>
            Track order
          </Link>
        </div>
      </div>
    </footer>
  );
}

/**
 * One chip per badge: "VA BCA" and "Transfer BCA", or JNE REG and JNE YES,
 * are the same mark to a buyer checking whether the shop takes their bank or
 * ships with their courier. A name the platform has no badge for stays text.
 */
export function chips(items) {
  const seen = new Set();
  return items.filter((x) => !x.logo_url || (!seen.has(x.logo_url) && seen.add(x.logo_url)));
}

function Chip({ item }) {
  if (!item.logo_url) return <span style={chip}>{item.name}</span>;
  return (
    <span className="bl-logo-chip" style={{ ...chip, background: 'var(--bl-white)' }} title={item.name}>
      <img src={item.logo_url} alt={item.name} loading="lazy" />
    </span>
  );
}
