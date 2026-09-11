import { Link, useLocation } from 'react-router-dom';

import { Img, SIZES } from '../ui/Img.jsx';
import { EmptyState, InlineError, Skeleton } from '../ui/states.jsx';
import { useCart, MAX_QTY } from '../../../../src/cart/CartProvider.jsx';
import { useCartLines } from '../../../../src/cart/useCartLines.js';
import { fmt } from '../../../../src/shared/format.js';
import { blockerNotice, cartLineNote, orderNote } from '../lib/copy.js';

const TONE = { green: 'var(--bl-green)', gold: 'var(--bl-gold)', terra: 'var(--bl-terra-dark)', muted: 'var(--bl-muted)' };
const DIMMED = ['soldout', 'scheduled', 'ended', 'gone'];

export default function CartRoute() {
  const cart = useCart();
  const location = useLocation();
  const { lines, statuses, subtotal, isLoading, hasBlockers, preorderLeadDays } = useCartLines();
  // Sent back here by the checkout when the draft refused the cart: the lines
  // below re-hydrate and say which product moved.
  const stockChanged = Boolean(location.state?.stockChanged);

  return (
    <main aria-label="Cart" className="bl-wrap" style={{ flex: 1, maxWidth: 1100, padding: '44px 32px 20px' }}>
      <h1 className="bl-display" style={{ fontSize: 38, margin: '0 0 20px' }}>
        Your cart{' '}
        <span className="bl-muted" style={{ fontFamily: 'var(--bl-body)', fontSize: 16 }}>
          ({cart.count} {cart.count === 1 ? 'item' : 'items'})
        </span>
      </h1>

      {stockChanged && !cart.isEmpty ? (
        <div role="status" className="bl-note warn" style={{ marginBottom: 18 }}>
          {location.state?.afterVerify
            ? 'Stock changed while your order was being placed. Check the lines below and try again.'
            : 'Stock or prices changed since you added these. Check the lines below.'}
        </div>
      ) : null}

      {cart.isEmpty ? (
        <EmptyState
          title="Your cart is empty"
          body="Crisp sheets and plush towels are waiting."
          action={
            <Link to="/katalog" className="bl-btn primary">
              Browse products
            </Link>
          }
        />
      ) : (
        <div className="bl-two">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {lines.map((line) => (
              <CartLine key={line.item.productId} line={line} onQty={cart.setQty} onRemove={cart.remove} />
            ))}
          </div>

          <aside className="bl-card bl-sticky" style={{ maxWidth: 420 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Order summary</div>
            <div className="bl-row" style={{ padding: '7px 0' }}>
              <span className="k">Subtotal</span>
              <span className="v">{isLoading ? '…' : fmt(subtotal)}</span>
            </div>
            <div className="bl-row" style={{ padding: '7px 0' }}>
              <span className="k">Shipping</span>
              <span className="k">Calculated at checkout</span>
            </div>
            <div className="bl-rule" style={{ margin: '12px 0' }} />
            <div className="bl-muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              Final total, shipping and any discounts are worked out at the next step.
            </div>
            {preorderLeadDays ? (
              <div className="bl-note info" style={{ marginTop: 14 }}>
                {orderNote(preorderLeadDays)}
              </div>
            ) : null}
            {hasBlockers ? (
              <div role="alert" className="bl-note error" style={{ marginTop: 14, fontSize: 13 }}>
                {blockerNotice(statuses)}
              </div>
            ) : null}
            <Link
              to="/checkout"
              className="bl-btn primary block"
              aria-disabled={hasBlockers || isLoading}
              onClick={(e) => {
                if (hasBlockers || isLoading) e.preventDefault();
              }}
              style={{ marginTop: 16 }}
            >
              Continue to checkout
            </Link>
            <Link to="/katalog" className="bl-link" style={{ display: 'block', textAlign: 'center', marginTop: 10, padding: 10 }}>
              Continue shopping
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}

function CartLine({ line, onQty, onRemove }) {
  const { item, product, status, error, refetch, available } = line;
  const remove = () => onRemove(item.productId);

  if (status === 'loading') {
    return (
      <div className="bl-card" style={{ display: 'flex', gap: 18, alignItems: 'center', padding: '14px 18px', borderRadius: 14 }}>
        <Skeleton width={84} height={84} radius={10} />
        <div style={{ flex: 1 }}>
          <Skeleton height={15} width="60%" />
          <Skeleton height={13} width="30%" style={{ marginTop: 10 }} />
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="bl-card" style={{ padding: '14px 18px', borderRadius: 14 }}>
        <InlineError error={error} onRetry={refetch} />
      </div>
    );
  }

  const note = cartLineNote(status, product, available);
  const dimmed = DIMMED.includes(status);
  const name = product?.name ?? item.slug;
  const price = product?.price ?? 0;

  return (
    <div
      className="bl-card"
      style={{ display: 'grid', gridTemplateColumns: '84px 1fr auto', gap: 18, alignItems: 'center', padding: '14px 18px', borderRadius: 14 }}
    >
      <Img src={product?.image} srcSet={product?.image_srcset} sizes={SIZES.cartLine} alt="" ratio="1/1" radius={10} style={{ opacity: dimmed ? 0.45 : 1 }} />
      <div style={{ minWidth: 0 }}>
        {product ? (
          <Link to={`/produk/${product.slug}`} style={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.35, color: 'var(--bl-ink)' }}>
            {name}
          </Link>
        ) : (
          <span style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--bl-muted)' }}>{name}</span>
        )}
        {product ? (
          <div style={{ fontSize: 13, color: 'var(--bl-green)', fontWeight: 700, marginTop: 4 }}>{fmt(price)} each</div>
        ) : null}
        {note ? (
          <div style={{ fontSize: 12.5, marginTop: 5, color: TONE[note.tone] }}>
            {note.text}{' '}
            {status === 'overstock' ? (
              <button type="button" onClick={() => onQty(item.productId, available)} className="bl-link" style={{ fontSize: 12.5, textDecoration: 'underline' }}>
                Adjust to {available}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {!dimmed ? (
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--bl-line)', borderRadius: 999 }}>
            <button type="button" aria-label="Decrease quantity" disabled={item.qty <= 1} onClick={() => onQty(item.productId, item.qty - 1)} style={qtyButton}>
              −
            </button>
            <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>{item.qty}</span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={item.qty >= Math.min(MAX_QTY, available)}
              onClick={() => onQty(item.productId, item.qty + 1)}
              style={qtyButton}
            >
              +
            </button>
          </div>
        ) : null}
        {product && !dimmed ? <div style={{ fontWeight: 800, fontSize: 14.5, minWidth: 92, textAlign: 'right' }}>{fmt(price * item.qty)}</div> : null}
        <button type="button" onClick={remove} title="Remove" aria-label={`Remove ${name}`} style={{ color: 'var(--bl-faint)', fontSize: 20, padding: 4 }}>
          ×
        </button>
      </div>
    </div>
  );
}

const qtyButton = { fontWeight: 700, fontSize: 16, width: 36, height: 36, color: 'var(--bl-ink)' };
