import { Link, useSearchParams } from 'react-router-dom';

import ProductCard from '../components/ProductCard.jsx';
import { EmptyState, ErrorState, InlineError, ProductGridSkeleton } from '../ui/states.jsx';
import { useCategories, useProducts } from '@sepetakhq/storefront-kit/hooks/queries';
import { useConfig } from '@sepetakhq/storefront-kit/config/ConfigProvider';

const ALL = 'Semua'; // the API's own word for "no category filter"

const SORTS = [
  ['featured', 'Sort: Featured'],
  ['priceAsc', 'Price: low to high'],
  ['priceDesc', 'Price: high to low'],
  ['nameAsc', 'Name A–Z'],
];

export default function CatalogRoute() {
  // Filters live in the URL, not in state: a filtered catalogue is a link
  // worth sharing, and the back button should unwind a filter change.
  const [params, setParams] = useSearchParams();
  const cat = params.get('cat') || ALL;
  const sort = params.get('sort') || 'featured';
  const { brand } = useConfig();

  const categories = useCategories();
  const products = useProducts({ cat, sort });

  const hrefFor = (nextCat, nextSort = sort) => {
    const q = new URLSearchParams();
    if (nextCat && nextCat !== ALL) q.set('cat', nextCat);
    if (nextSort && nextSort !== 'featured') q.set('sort', nextSort);
    const s = q.toString();
    return s ? `/katalog?${s}` : '/katalog';
  };

  const items = (products.data?.pages ?? []).flatMap((p) => p.products);
  const current = (categories.data ?? []).find((c) => c.key === cat);
  const title = current?.label ?? 'All products';

  return (
    <main aria-label="Shop" className="bl-wrap" style={{ flex: 1, padding: '36px 32px 20px' }}>
      <div className="bl-muted" style={{ fontSize: 13 }}>
        <Link to="/">Home</Link>&nbsp;/&nbsp;{title}
      </div>
      <h1 className="bl-display" style={{ fontSize: 38, margin: '12px 0 4px' }}>
        {title}
      </h1>
      <div className="bl-muted" style={{ fontSize: 14, minHeight: 20 }}>
        {current?.material_spec || brand.tagline_short}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, margin: '24px 0 26px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip to={hrefFor(ALL)} active={cat === ALL} label="All products" />
          {(categories.data ?? []).map((c) => (
            <Chip key={c.key} to={hrefFor(c.key)} active={cat === c.key} label={c.label} />
          ))}
        </div>
        <select
          value={sort}
          aria-label="Sort"
          // A sort tweak is not a navigation and should not add a history entry.
          onChange={(e) => {
            const next = new URLSearchParams(params);
            if (e.target.value === 'featured') next.delete('sort');
            else next.set('sort', e.target.value);
            setParams(next, { replace: true });
          }}
          style={{ padding: '10px 14px', border: '1px solid var(--bl-line)', borderRadius: 10, fontSize: 13.5, background: 'var(--bl-white)', cursor: 'pointer' }}
        >
          {SORTS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {categories.isError ? (
        <div style={{ marginBottom: 18 }}>
          <InlineError error={categories.error} onRetry={categories.refetch} />
        </div>
      ) : null}

      {products.isPending ? (
        <ProductGridSkeleton count={8} />
      ) : products.isError ? (
        <ErrorState error={products.error} onRetry={products.refetch} title="The catalogue couldn’t load" />
      ) : items.length === 0 ? (
        <EmptyState
          title="No products here yet"
          body={cat === ALL ? 'The collection is being set up. Check back soon.' : 'This room is empty for now.'}
          action={
            cat === ALL ? null : (
              <Link to="/katalog" className="bl-btn ghost sm">
                All products
              </Link>
            )
          }
        />
      ) : (
        <>
          <div className="bl-grid">
            {items.map((p, i) => (
              <ProductCard key={p.id} p={p} priority={i < 4} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
            {products.hasNextPage ? (
              <button
                type="button"
                className="bl-btn ghost sm"
                disabled={products.isFetchingNextPage}
                onClick={() => products.fetchNextPage()}
              >
                {products.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </button>
            ) : (
              <span style={{ color: 'var(--bl-faint)', fontSize: 13 }}>That’s the whole collection.</span>
            )}
          </div>
        </>
      )}
    </main>
  );
}

function Chip({ to, active, label }) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      style={{
        fontWeight: 600,
        fontSize: 13,
        padding: '9px 16px',
        borderRadius: 999,
        border: `1px solid ${active ? 'var(--bl-ink)' : 'var(--bl-line)'}`,
        background: active ? 'var(--bl-ink)' : 'var(--bl-white)',
        color: active ? 'var(--bl-white)' : 'var(--bl-ink)',
      }}
    >
      {label}
    </Link>
  );
}
