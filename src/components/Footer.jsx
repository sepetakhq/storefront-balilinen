import { Link } from 'react-router-dom';

import { useConfig } from '@sepetakhq/storefront-kit/config/ConfigProvider';
import { useCategories } from '@sepetakhq/storefront-kit/hooks/queries';
import { Logo } from './Logo.jsx';
import { sectionText } from '../lib/copy.js';

const heading = { fontWeight: 700, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 };
const chip = { border: '1px solid var(--bl-line)', borderRadius: 8, padding: '6px 11px', fontSize: 12, color: 'var(--bl-muted)' };

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
            {paymentMethods.map((m) => (
              <span key={m.code} style={chip}>
                {m.name}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div style={heading}>{sectionText(brand.sections, 'footer_shipping_heading')}</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {couriers.map((c) => (
              <span key={c.code} style={chip}>
                {c.name}
              </span>
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
