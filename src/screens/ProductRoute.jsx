import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import ProductCard from '../components/ProductCard.jsx';
import { WhatsAppIcon } from '../components/icons.jsx';
import { Img, SIZES } from '../ui/Img.jsx';
import { EmptyState, ErrorState, Skeleton } from '../ui/states.jsx';
import { useProduct } from '@sepetakhq/storefront-kit/hooks/queries';
import { useCart } from '@sepetakhq/storefront-kit/cart/CartProvider';
import { isSoldOut, leadDays, maxQty } from '@sepetakhq/storefront-kit/lib/preorder';
import { isImminent, isScheduled, msUntilOpen } from '@sepetakhq/storefront-kit/lib/availability';
import { useConfig } from '@sepetakhq/storefront-kit/config/ConfigProvider';
import { useToast } from '@sepetakhq/storefront-kit/ui/ToastProvider';
import { fmt, fmtClock, paragraphs } from '@sepetakhq/storefront-kit/shared/format';
import { CHOOSE_VARIANT, FROM, buyLabel, chooseAxis, overlayLabel, pillState, stockNote, windowNote } from '../lib/copy.js';
import {
  availableValues,
  galleryFor,
  initialSelection,
  isPriceRange,
  matchVariant,
  select,
  withVariant,
} from '@sepetakhq/storefront-kit/lib/variants';

const TONE = { green: 'var(--bl-green)', gold: 'var(--bl-gold)', terra: 'var(--bl-terra-dark)', muted: 'var(--bl-muted)' };

export default function ProductRoute() {
  const { slug } = useParams();
  const { data: product, isPending, isError, error, refetch } = useProduct(slug);

  if (isPending) return <ProductSkeleton />;

  if (isError) {
    if (error?.status === 404) {
      return (
        <main className="bl-wrap" style={{ flex: 1, padding: '36px 32px 20px' }}>
          <EmptyState
            title="This product is no longer available"
            action={
              <Link to="/katalog" className="bl-btn ghost sm">
                Back to catalog
              </Link>
            }
          />
        </main>
      );
    }
    return (
      <main className="bl-wrap" style={{ flex: 1, padding: '36px 32px 20px' }}>
        <ErrorState error={error} onRetry={refetch} title="The product couldn’t load" />
      </main>
    );
  }

  return <ProductView key={slug} product={product} onOpen={refetch} />;
}

/**
 * Ticks a countdown to the opening and asks the server when it runs out. The
 * tick is cosmetic: reaching zero never enables the buy button on its own.
 */
function useOpeningCountdown(product, onOpen) {
  const [now, setNow] = useState(() => Date.now());
  const ticking = isScheduled(product) && isImminent(product, now);

  useEffect(() => {
    if (!ticking) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  const remaining = msUntilOpen(product, now);
  useEffect(() => {
    if (remaining === 0) onOpen?.();
  }, [remaining, onOpen]);

  if (!ticking || remaining === null) return null;
  return fmtClock(remaining);
}

function ProductView({ product, onOpen }) {
  const { brand, freeShipping, freeShippingMinLabel, copy } = useConfig();
  const cart = useCart();
  const showToast = useToast();
  const navigate = useNavigate();

  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const [openTab, setOpenTab] = useState('desc');
  const [broken, setBroken] = useState(() => new Set());

  // Which value is picked per axis; `variant` is the one combination the
  // picks name, or null while one is missing. Decisions live in
  // src/lib/variants.js, shared with the Indonesian storefront.
  const [selected, setSelected] = useState(() => initialSelection(product));
  const variant = matchVariant(product.variants, selected);
  const sellable = withVariant(product, variant);
  const needsChoice = Boolean(product.has_variants) && !variant;
  const pick = (axis, value) => {
    setSelected((cur) => select(product, cur, axis, value));
    setActive(0);
    setQty(1);
  };

  const all = product.images?.length ? product.images : [{ url: product.image, srcset: product.image_srcset, alt: product.name }];
  const images = galleryFor(all, variant).filter((im) => !broken.has(im.url));
  const gallery = images.length ? images : all.slice(0, 1);
  const main = gallery[Math.min(active, gallery.length - 1)];

  const overlay = overlayLabel(sellable);
  // Never null for a product (copy.js keeps that contract, including for
  // unlimited stock), so .tone below is read unguarded. Hidden until a
  // variant is picked: the picker is where the stock answer lives.
  const stock = stockNote(sellable, brand.origin_city);
  const saleWindow = windowNote(product);
  const label = buyLabel(sellable);
  const blocked = isSoldOut(sellable) || Boolean(label);
  const max = maxQty(sellable);
  const countdown = useOpeningCountdown(product, onOpen);
  const days = leadDays(product);

  // The details panel: description, care, shipping. Each resolved server-side
  // from the most specific tier, substituted here; a section that has nothing
  // to say is not drawn.
  const care = paragraphs(copy(product.care_copy));
  const spec = paragraphs(product.material_spec);
  const shipping = [
    product.preorder
      ? days
        ? `Made after your payment lands. Estimated ready to ship ±${days} days after payment is received, then dispatched as usual.`
        : 'Made after your payment lands, then dispatched as usual.'
      : '',
    brand.productShippingCopy,
    freeShipping ? `Free shipping on orders over ${freeShippingMinLabel}.` : '',
  ].filter(Boolean);
  const tabs = [
    { key: 'desc', label: 'Description', paras: paragraphs(product.description), spec: spec.join(' '), specLabel: product.spec_label || 'Material' },
    { key: 'care', label: 'Care', paras: care },
    { key: 'ship', label: 'Shipping & delivery', paras: shipping },
  ].filter((t) => t.paras.length > 0 || t.spec);

  const add = () => {
    cart.add(product, qty, variant?.id ?? null);
    showToast('Added to cart ✓');
    navigate('/keranjang');
  };

  return (
    <main aria-label="Product" className="bl-wrap" style={{ flex: 1, padding: '36px 32px 20px' }}>
      <div className="bl-muted" style={{ fontSize: 13 }}>
        <Link to="/">Home</Link>&nbsp;/&nbsp;
        <Link to={`/katalog?cat=${encodeURIComponent(product.category_key ?? '')}`}>{product.category_label}</Link>
        &nbsp;/&nbsp;{product.name}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 52, marginTop: 26, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ position: 'relative' }}>
            <Img
              src={main.url}
              srcSet={main.srcset}
              sizes={SIZES.productMain}
              alt={main.alt || product.name}
              ratio="5/4"
              radius={18}
              width={main.width}
              height={main.height}
              priority
              onError={() => setBroken((b) => new Set(b).add(main.url))}
            />
            {overlay ? (
              <span className="bl-overlay" style={{ borderRadius: 18 }}>
                <span className="t" style={{ fontSize: 15, letterSpacing: '0.16em' }}>
                  {overlay.title}
                </span>
                {overlay.detail ? <span className="d" style={{ fontSize: 13 }}>{overlay.detail}</span> : null}
              </span>
            ) : null}
          </div>
          {gallery.length > 1 ? (
            <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
              {gallery.map((im, i) => (
                <button
                  key={im.url || i}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Photo ${i + 1} of ${gallery.length}`}
                  aria-current={i === active}
                  style={{ width: 84, borderRadius: 12, overflow: 'hidden', border: `1.5px solid ${i === active ? 'var(--bl-ink)' : 'var(--bl-line)'}`, lineHeight: 0 }}
                >
                  <Img src={im.url} srcSet={im.srcset} sizes={SIZES.thumb} alt="" ratio="1/1" onError={() => setBroken((b) => new Set(b).add(im.url))} />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div style={{ minWidth: 0 }}>
          <div className="bl-muted" style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {product.category_label}
          </div>
          <h1 className="bl-display" style={{ fontSize: 36, margin: '10px 0 0' }}>
            {product.name}
          </h1>
          <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', marginTop: 16, flexWrap: 'wrap' }}>
            {needsChoice && isPriceRange(product) ? <span className="bl-muted" style={{ fontSize: 15, fontWeight: 600 }}>{FROM}</span> : null}
            {sellable.on_sale ? <span style={{ fontSize: 16, color: 'var(--bl-faint)', textDecoration: 'line-through' }}>{fmt(sellable.compare_at_price)}</span> : null}
            <span style={{ fontSize: 27, fontWeight: 800, color: 'var(--bl-green)' }}>
              {fmt(needsChoice ? product.price : sellable.price)}
            </span>
            {sellable.on_sale && sellable.badge ? <span className="bl-badge" style={{ fontSize: 11 }}>{sellable.badge}</span> : null}
            {product.preorder ? <span className="bl-badge preorder" style={{ marginLeft: 0, fontSize: 11 }}>PRE-ORDER</span> : null}
          </div>
          {/* The description lives in the details panel below, as designed;
              up here it read twice on every product. */}
          {product.has_variants ? <VariantPicker product={product} selected={selected} onPick={pick} /> : null}
          {!needsChoice ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13.5, color: TONE[stock.tone] }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', flex: 'none' }} />
              {stock.text}
            </div>
          ) : null}
          {saleWindow ? (
            <div style={{ marginTop: 8, fontSize: 13.5, color: TONE[saleWindow.tone] }}>
              {saleWindow.text}
            </div>
          ) : null}
          {countdown ? (
            <div className="bl-muted" style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 10, background: 'var(--bl-white)', border: '1px solid var(--bl-line)', borderRadius: 12, padding: '10px 14px', fontSize: 13 }}>
              Opens in{' '}
              <span style={{ fontWeight: 700, fontSize: 16, fontVariantNumeric: 'tabular-nums', color: 'var(--bl-ink)' }}>{countdown}</span>
            </div>
          ) : null}

          <div className="bl-rule" style={{ margin: '24px 0' }} />

          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
            {needsChoice ? (
              <button type="button" disabled className="bl-btn disabled-look" style={{ flex: 1, height: 48, padding: '0 28px' }}>
                {CHOOSE_VARIANT}
              </button>
            ) : !blocked ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--bl-line)', borderRadius: 999, background: 'var(--bl-white)' }}>
                  <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity" style={stepper}>
                    −
                  </button>
                  <span style={{ minWidth: 26, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>{qty}</span>
                  <button type="button" onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max} aria-label="Increase quantity" style={stepper}>
                    +
                  </button>
                </div>
                <button type="button" onClick={add} className="bl-btn primary" style={{ flex: 1, minWidth: 220, height: 48, padding: '0 28px' }}>
                  Add to cart — {fmt(sellable.price * qty)}
                </button>
              </>
            ) : (
              <button type="button" disabled className="bl-btn disabled-look" style={{ flex: 1, height: 48, padding: '0 28px' }}>
                {label ?? 'Sold out'}
              </button>
            )}
          </div>
          {product.preorder ? (
            <div className="bl-note info" style={{ marginTop: 12, color: 'var(--bl-muted)' }}>
              Pre-order: we make this after your payment lands{days ? `, and ship in about ${days} days.` : '.'}
            </div>
          ) : null}
          {brand.whatsapp_url ? (
            <a
              href={`${brand.whatsapp_url}?text=${encodeURIComponent(`Hi! I have a question about "${product.name}".`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bl-btn wa-outline block"
              style={{ marginTop: 12 }}
            >
              <WhatsAppIcon size={18} color="var(--bl-wa)" />
              Ask about this product on WhatsApp
            </a>
          ) : null}

          {tabs.length ? (
            <div style={{ marginTop: 26, background: 'var(--bl-white)', border: '1px solid var(--bl-line)', borderRadius: 16, overflow: 'hidden' }}>
              {tabs.map((t) => {
                const open = openTab === t.key;
                return (
                  <div key={t.key} style={{ borderBottom: '1px solid var(--bl-sand-2)' }}>
                    <button
                      type="button"
                      onClick={() => setOpenTab(open ? '' : t.key)}
                      aria-expanded={open}
                      style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 22px', fontWeight: 700, fontSize: 14, textAlign: 'left' }}
                    >
                      {t.label}
                      <span style={{ fontWeight: 400, color: 'var(--bl-faint)', fontSize: 18 }} aria-hidden="true">
                        {open ? '−' : '+'}
                      </span>
                    </button>
                    {open ? (
                      <div style={{ padding: '0 22px 18px' }}>
                        {t.paras.map((pg, i) => (
                          <p key={i} className="bl-muted" style={{ fontSize: 14.5, lineHeight: 1.7, margin: '0 0 10px', textWrap: 'pretty' }}>
                            {pg}
                          </p>
                        ))}
                        {t.spec ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 22px', fontSize: 13.5, marginTop: 6 }}>
                            <span className="bl-muted">{t.specLabel}</span>
                            <span style={{ fontWeight: 600 }}>{t.spec}</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {product.related?.length > 0 ? (
        <section style={{ marginTop: 70 }}>
          <h2 className="bl-display" style={{ fontSize: 28, margin: '0 0 20px' }}>
            You may also like
          </h2>
          <div className="bl-grid">
            {product.related.map((p) => (
              <ProductCard key={p.id} p={p} compact />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

const stepper = { fontWeight: 700, fontSize: 18, width: 44, height: 48, color: 'var(--bl-ink)' };

function ProductSkeleton() {
  return (
    <main aria-busy="true" className="bl-wrap" style={{ flex: 1, padding: '36px 32px 20px' }}>
      <Skeleton height={13} width={220} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 52, marginTop: 26 }}>
        <Skeleton ratio="5/4" radius={18} />
        <div>
          <Skeleton height={12} width={100} />
          <Skeleton height={40} style={{ marginTop: 14 }} />
          <Skeleton height={28} width={160} style={{ marginTop: 16 }} />
          <Skeleton height={14} style={{ marginTop: 22 }} />
          <Skeleton height={14} width="80%" style={{ marginTop: 8 }} />
          <Skeleton height={48} radius={999} style={{ marginTop: 26 }} />
        </div>
      </div>
    </main>
  );
}

/**
 * One row of pills per axis, the Bali Linen way: same decisions as the
 * Indonesian storefront (src/lib/variants.js), rendered as .bl-tile pills. A
 * combination the shop does not sell is dashed, a sold-out one struck through.
 */
function VariantPicker({ product, selected, onPick }) {
  return (
    <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
      {product.options.map((axis) => (
        <div key={axis.name} role="group" aria-label={chooseAxis(axis.name)}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            {chooseAxis(axis.name, selected[axis.name])}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {availableValues(product, axis.name, selected).map((v) => {
              const on = selected[axis.name] === v.value;
              const off = !v.exists || v.soldOut;
              return (
                <button
                  key={v.value}
                  type="button"
                  className="bl-tile"
                  onClick={() => onPick(axis.name, v.value)}
                  disabled={off}
                  aria-pressed={on}
                  aria-label={pillState(v.value, v)}
                  style={{
                    width: 'auto',
                    borderRadius: 999,
                    padding: '9px 16px',
                    fontSize: 13.5,
                    fontWeight: 600,
                    borderStyle: v.exists ? 'solid' : 'dashed',
                    textDecoration: v.soldOut ? 'line-through' : 'none',
                  }}
                >
                  {v.value}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
