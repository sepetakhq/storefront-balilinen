import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import ProductCard from '../components/ProductCard.jsx';
import { WhatsAppIcon } from '../components/icons.jsx';
import { Img, SIZES } from '../ui/Img.jsx';
import { CountdownClockSeconds } from '../ui/Countdown.jsx';
import { ErrorState, ProductGridSkeleton, Skeleton } from '../ui/states.jsx';
import { useHome } from '@sepetakhq/storefront-kit/hooks/queries';
import { qk } from '@sepetakhq/storefront-kit/api/queryKeys';
import { useConfig } from '@sepetakhq/storefront-kit/config/ConfigProvider';
import { fmt } from '@sepetakhq/storefront-kit/shared/format';
import { discountLabel, heroSecondaryLabel, sectionText, withArrow } from '../lib/copy.js';

const h2 = { fontSize: 32 };
const sectionHead = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  marginBottom: 22,
  gap: 12,
  flexWrap: 'wrap',
};

export default function HomeRoute() {
  const { data, isPending, isError, error, refetch } = useHome();

  if (isPending) return <HomeSkeleton />;
  if (isError) return <ErrorState error={error} onRetry={refetch} title="The home page couldn’t load" />;

  // Sections are dropped server-side when they resolve to nothing, so the
  // page has to read correctly with any subset, including none.
  const sections = data.sections ?? [];
  if (sections.length === 0) return <EmptyHome />;

  return (
    <main aria-label="Home" style={{ flex: 1 }}>
      {sections.map((sec, i) => (
        <Section key={sec.id} sec={sec} first={i === 0} />
      ))}
    </main>
  );
}

function Section({ sec, first }) {
  switch (sec.type) {
    case 'hero':
      return <Hero hero={sec.hero} />;
    case 'cats':
      return <Categories cats={sec.cats} />;
    case 'campaign':
      return <Campaign campaign={sec.campaign} />;
    case 'grid':
    case 'carousel':
      return <Grid grid={sec.grid} priority={first} />;
    case 'banner':
      return <Banner banner={sec.banner} />;
    case 'story':
      return <Story story={sec.story} />;
    default:
      return null;
  }
}

function Hero({ hero }) {
  const { brand } = useConfig();
  const photo = brand.heroImages?.[0];
  const stats = brand.heroStats ?? [];
  if (!hero) return null;

  return (
    <section
      className="bl-wrap"
      style={{
        padding: '64px 32px 24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: 56,
        alignItems: 'center',
      }}
    >
      <div style={{ minWidth: 0 }}>
        {brand.hero_eyebrow ? <div className="bl-eyebrow">{brand.hero_eyebrow}</div> : null}
        <h1 className="bl-display" style={{ fontSize: 'clamp(38px, 4.2vw, 56px)', lineHeight: 1.08, margin: '18px 0 0' }}>
          {hero.title}
          {hero.em?.trim() ? (
            <>
              {' '}
              <em style={{ fontStyle: 'italic', color: 'var(--bl-green)' }}>{hero.em}</em>
            </>
          ) : null}
        </h1>
        <p className="bl-muted" style={{ margin: '20px 0 0', fontSize: 16.5, lineHeight: 1.65, maxWidth: 480, textWrap: 'pretty' }}>
          {hero.sub}
        </p>
        <div style={{ display: 'flex', gap: 14, marginTop: 32, flexWrap: 'wrap' }}>
          <Link to="/katalog" className="bl-btn primary">
            {hero.cta || 'Shop now'}
          </Link>
          {/* The merchant's hero_secondary_cta, else the name the nav gives
              the page -- not the story section's "Read more". */}
          <Link to="/tentang" className="bl-btn ghost">
            {heroSecondaryLabel(brand.sections, brand.nav)}
          </Link>
        </div>
        {stats.length ? (
          <div data-testid="hero-stats" style={{ marginTop: 36, display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            {stats.map((st) => (
              <div key={st.label}>
                <div className="bl-display" style={{ fontSize: 24, color: 'var(--bl-green)' }}>
                  {st.value}
                </div>
                <div className="bl-muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                  {st.label}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {/* A shop with no hero picture gets the placeholder tile, not an
          empty column: the grid still reads as two halves. */}
      <Img
        src={photo?.url}
        srcSet={photo?.srcset}
        sizes={SIZES.hero}
        alt={photo?.alt || ''}
        ratio="600/470"
        radius={20}
        priority
        style={{ minWidth: 0 }}
      />
    </section>
  );
}

function Categories({ cats }) {
  const { brand } = useConfig();
  if (!cats?.length) return null;

  return (
    <section className="bl-wrap" style={{ padding: '56px 32px 8px' }}>
      <div style={sectionHead}>
        <h2 className="bl-display" style={h2}>
          {sectionText(brand.sections, 'cats_heading')}
        </h2>
        <Link to="/katalog" className="bl-link">
          {withArrow(sectionText(brand.sections, 'grid_see_all'))}
        </Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
        {cats.map((c) => (
          <Link
            key={c.key}
            to={`/katalog?cat=${encodeURIComponent(c.key)}`}
            className="bl-product-card"
            style={{ position: 'relative', height: 230, borderRadius: 18, background: 'var(--bl-sand)' }}
          >
            <Img src={c.image} srcSet={c.image_srcset} sizes={SIZES.categoryTile} alt="" ratio={undefined} style={{ position: 'absolute', inset: 0 }} />
            <div
              style={{
                position: 'absolute',
                inset: 'auto 0 0 0',
                padding: '20px 26px 18px',
                background: 'linear-gradient(transparent, rgba(250,247,242,0.96) 60%)',
              }}
            >
              <div className="bl-display" style={{ fontSize: 24 }}>
                {c.label}
              </div>
              {c.subtitle ? (
                <div className="bl-muted" style={{ fontSize: 13, marginTop: 3 }}>
                  {c.subtitle}
                </div>
              ) : null}
              <div className="bl-link" style={{ fontSize: 13, marginTop: 10 }}>
                Shop now →
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

const HOURS_72 = 72 * 60 * 60 * 1000;

function Campaign({ campaign }) {
  const { brand } = useConfig();
  const queryClient = useQueryClient();
  if (!campaign) return null;
  const endsAt = campaign.ends_at;
  // A countdown earns its place only when the deadline is close enough to
  // change a decision.
  const showCountdown = endsAt && Date.parse(endsAt) - Date.now() < HOURS_72;

  return (
    <section className="bl-wrap" style={{ marginTop: 56 }}>
      <div style={{ background: 'var(--bl-peach-wash)', border: '1px solid var(--bl-peach-line)', borderRadius: 20, padding: '36px 36px 40px' }}>
        <div style={{ ...sectionHead, alignItems: 'flex-end', gap: 14 }}>
          <div>
            {/* The merchant's badge; while the clock runs and there is none,
                the design's own eyebrow. */}
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--bl-terra)' }}>
              {campaign.badge || (showCountdown ? 'Limited time' : '')}
            </div>
            <h2 className="bl-display" style={{ fontSize: 30, margin: '6px 0 0' }}>
              {campaign.title} <span style={{ color: 'var(--bl-terra)' }}>{discountLabel(campaign, fmt)}</span>
            </h2>
          </div>
          {showCountdown ? (
            <div className="bl-muted" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5 }}>
              <span>{sectionText(brand.sections, 'countdown_label')}</span>
              <CountdownClockSeconds
                until={endsAt}
                onExpire={() => queryClient.invalidateQueries({ queryKey: qk.home })}
                style={{
                  fontWeight: 700,
                  fontSize: 15,
                  background: 'var(--bl-white)',
                  border: '1px solid var(--bl-peach-line)',
                  borderRadius: 10,
                  padding: '8px 12px',
                  color: 'var(--bl-ink)',
                }}
              />
            </div>
          ) : null}
        </div>
        <div className="bl-grid">
          {campaign.products.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Grid({ grid, priority }) {
  const { brand } = useConfig();
  if (!grid) return null;

  return (
    <section className="bl-wrap" style={{ padding: '60px 32px 8px' }}>
      <div style={sectionHead}>
        <h2 className="bl-display" style={h2}>
          {grid.title}
        </h2>
        <Link to="/katalog" className="bl-link">
          {withArrow(sectionText(brand.sections, 'grid_see_all'))}
        </Link>
      </div>
      <div className="bl-grid">
        {grid.products.map((p, i) => (
          <ProductCard key={p.id} p={p} priority={priority && i < 4} />
        ))}
      </div>
    </section>
  );
}

/**
 * The banner's `bg` is the merchant's word for a tone -- the API vocabulary
 * is "butter" or "pink" -- and this design has one warm wash and one dark
 * one, so the two names map onto those.
 */
function Banner({ banner }) {
  const { brand } = useConfig();
  if (!banner) return null;
  const dark = banner.bg === 'pink';

  return (
    <section className="bl-wrap" style={{ marginTop: 64 }}>
      <div
        style={{
          background: dark ? 'var(--bl-ink-2)' : 'var(--bl-peach-wash)',
          borderRadius: 22,
          padding: '52px 56px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 40,
          alignItems: 'center',
        }}
      >
        <h2 className="bl-display" style={{ fontSize: 30, lineHeight: 1.25, color: dark ? 'var(--bl-cream)' : 'var(--bl-ink)', textWrap: 'pretty' }}>
          {banner.text}
        </h2>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {brand.whatsapp_url ? (
            <a href={brand.whatsapp_url} target="_blank" rel="noopener noreferrer" className="bl-btn wa">
              <WhatsAppIcon />
              {banner.cta}
            </a>
          ) : (
            <Link to="/katalog" className="bl-btn primary">
              {banner.cta}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function Story({ story }) {
  const { brand } = useConfig();
  if (!story) return null;
  const portrait = brand.aboutImage;

  return (
    <section
      className="bl-wrap"
      style={{
        marginTop: 64,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 48,
        alignItems: 'center',
      }}
    >
      <Img src={portrait?.url} srcSet={portrait?.srcset} sizes={SIZES.hero} alt={portrait?.alt || ''} ratio="600/380" radius={20} />
      <div>
        <div className="bl-eyebrow plain">{sectionText(brand.sections, 'story_eyebrow')}</div>
        <h2 className="bl-display" style={{ fontSize: 34, lineHeight: 1.2, margin: '14px 0 0' }}>
          {story.title}
        </h2>
        <p className="bl-muted" style={{ fontSize: 15.5, lineHeight: 1.7, margin: '16px 0 0', textWrap: 'pretty' }}>
          {story.text}
        </p>
        <Link to="/tentang" className="bl-link" style={{ display: 'inline-block', marginTop: 22 }}>
          {withArrow(sectionText(brand.sections, 'story_cta'))}
        </Link>
      </div>
    </section>
  );
}

function HomeSkeleton() {
  return (
    <main style={{ flex: 1 }} aria-busy="true" aria-label="Loading">
      <section className="bl-wrap" style={{ padding: '64px 32px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 56 }}>
        <div>
          <Skeleton height={14} width={180} />
          <Skeleton height={54} style={{ marginTop: 18 }} />
          <Skeleton height={54} width="70%" style={{ marginTop: 10 }} />
          <Skeleton height={16} width="90%" style={{ marginTop: 20 }} />
          <Skeleton height={50} width={200} radius={999} style={{ marginTop: 32 }} />
        </div>
        <Skeleton ratio="600/470" radius={20} />
      </section>
      <section className="bl-wrap" style={{ padding: '40px 32px' }}>
        <ProductGridSkeleton count={4} />
      </section>
    </main>
  );
}

function EmptyHome() {
  return (
    <main style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '80px 32px' }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <h1 className="bl-display" style={{ fontSize: 34 }}>
          The collection is being set up
        </h1>
        <p className="bl-muted" style={{ fontSize: 15, lineHeight: 1.7, margin: '12px 0 24px' }}>
          Nothing is on the home page yet. The catalogue is still open.
        </p>
        <Link to="/katalog" className="bl-btn ghost sm">
          Browse the catalogue
        </Link>
      </div>
    </main>
  );
}
