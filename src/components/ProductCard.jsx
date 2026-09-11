import { Link } from 'react-router-dom';

import { Img, SIZES } from '../ui/Img.jsx';
import { overlayLabel } from '../lib/copy.js';
import { fmt } from '../../../../src/shared/format.js';

/**
 * `p` is the API's productCard DTO, consumed directly: the price here comes
 * from the same promo engine that prices the order.
 *
 * One card for every grid. `compact` drops the category line and the old
 * price for the related-products row, where the name and the price are all a
 * buyer needs before they click.
 */
export default function ProductCard({ p, compact = false, priority = false, imageHeight }) {
  const overlay = overlayLabel(p);

  return (
    <Link to={`/produk/${p.slug}`} className="bl-product-card">
      <div style={{ position: 'relative' }}>
        <Img
          src={p.image}
          srcSet={p.image_srcset}
          sizes={SIZES.card}
          alt={p.name}
          ratio={imageHeight ? undefined : '5/4'}
          width={p.image_width}
          height={p.image_height}
          priority={priority}
          style={imageHeight ? { height: imageHeight, opacity: overlay ? 0.55 : 1 } : { opacity: overlay ? 0.55 : 1 }}
        />
        {p.badge || p.preorder ? (
          <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', flexWrap: 'wrap', gap: 6, pointerEvents: 'none' }}>
            {p.badge ? <span className="bl-badge">{p.badge}</span> : null}
            {p.preorder ? <span className="bl-badge preorder">PRE-ORDER</span> : null}
          </div>
        ) : null}
        {overlay ? (
          <span className="bl-overlay">
            <span className="t">{overlay.title}</span>
            {overlay.detail ? <span className="d">{overlay.detail}</span> : null}
          </span>
        ) : null}
      </div>
      <div className="body">
        {!compact && p.category_label ? <div className="cat">{p.category_label}</div> : null}
        <div className="name" style={compact ? { marginTop: 0 } : undefined}>
          {p.name}
        </div>
        <div className="price">
          {!compact && p.on_sale ? <span className="was">{fmt(p.compare_at_price)}</span> : null}
          <span className="now">{fmt(p.price)}</span>
        </div>
      </div>
    </Link>
  );
}
