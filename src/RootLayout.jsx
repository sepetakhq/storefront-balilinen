import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom';

import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Toast from './components/Toast.jsx';
import UpdateBanner from './components/UpdateBanner.jsx';
import { WhatsAppIcon } from './components/icons.jsx';
import { BundledLogo } from './components/Logo.jsx';
import { ConfigProvider, useConfig } from '../../../src/config/ConfigProvider.jsx';
import { CartProvider } from '../../../src/cart/CartProvider.jsx';
import { ToastProvider } from '../../../src/ui/ToastProvider.jsx';
import { useHome, useProduct } from '../../../src/hooks/queries.js';
import { useDocumentTitle } from '../../../src/hooks/useDocumentTitle.js';
import { pageTitle } from '../../../src/lib/seo.js';
import { pageName } from './lib/copy.js';

export default function RootLayout() {
  return (
    <ConfigProvider
      fallback={<Splash />}
      errorFallback={(error, retry) => <StoreUnavailable error={error} onRetry={retry} />}
    >
      <CartProvider>
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </CartProvider>
    </ConfigProvider>
  );
}

function Shell() {
  const { brand } = useConfig();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ScrollRestoration />
      <DocumentTitle />
      <UpdateBanner />
      <Announcement />
      <Header />
      <Outlet />
      <Footer />
      <Toast />
      {brand.whatsapp_url ? (
        <a
          href={brand.whatsapp_url}
          target="_blank"
          rel="noopener noreferrer"
          title={brand.whatsapp_text || 'Chat on WhatsApp'}
          aria-label={brand.whatsapp_text || 'Chat on WhatsApp'}
          style={{
            position: 'fixed',
            right: 26,
            bottom: 26,
            zIndex: 60,
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--bl-wa)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 26px rgba(37, 211, 102, 0.4)',
          }}
        >
          <WhatsAppIcon size={28} detailed />
        </a>
      ) : null}
    </div>
  );
}

/**
 * The promo strip, from the same payload as the home sections. Through the
 * same substitution as every other brand string: a bar promising free
 * shipping the checkout would refuse is withheld rather than interpolated.
 */
export function Announcement() {
  const { data } = useHome();
  const { copy } = useConfig();
  const announcement = data?.announcement;
  if (!announcement?.enabled) return null;
  const text = copy(announcement.text);
  if (!text) return null;

  return (
    <div
      style={{
        background: 'var(--bl-ink-2)',
        color: 'var(--bl-line-2)',
        fontSize: 12.5,
        letterSpacing: '0.04em',
        textAlign: 'center',
        padding: '9px 16px',
      }}
    >
      {text}
    </div>
  );
}

/** Keeps the tab title in step as the buyer moves around. Renders nothing. */
function DocumentTitle() {
  const { pathname } = useLocation();
  const { brand, tenant } = useConfig();
  const slug = pathname.startsWith('/produk/') ? pathname.slice('/produk/'.length) : '';
  const { data: product } = useProduct(slug);
  const brandName =
    [brand?.wordmark_primary, brand?.wordmark_accent].filter(Boolean).join(' ') || tenant?.name || '';
  useDocumentTitle(pageTitle(pageName(pathname, { product, taglineShort: brand?.tagline_short }), brandName));
  return null;
}

/**
 * The gate states. The splash is wordless: it renders outside the config it
 * is waiting for and cannot know whose shop this is.
 */
export function Splash() {
  return (
    <div
      aria-busy="true"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        padding: 40,
      }}
    >
      <div className="bl-shimmer" style={{ width: 220, height: 36, borderRadius: 8 }} />
      <div className="bl-shimmer" style={{ width: 320, maxWidth: '100%', height: 14, borderRadius: 6 }} />
    </div>
  );
}

/** Unknown host (404), suspended store (503), or a bundle the API no longer speaks. */
export function StoreUnavailable({ error, onRetry }) {
  const stale = error?.code === 'unsupported_api_version';
  const suspended = error?.status === 503;
  const notFound = error?.status === 404;

  // Not error.message: a 5xx or a proxy error carries the client's Indonesian
  // fallback, and nothing in it would help the buyer here anyway.
  let title = 'Couldn’t reach the shop';
  let body = 'Please try again in a moment.';
  if (notFound) {
    title = 'Store not found';
    body = 'There is no storefront at this address.';
  } else if (suspended) {
    title = 'Store temporarily closed';
    body = 'This shop is not taking orders right now. Please check back later.';
  } else if (stale) {
    title = 'Please reload';
    body = 'This version of the shop is out of date. Reload to get the latest.';
  }
  const retry = stale ? () => window.location.reload() : notFound ? null : onRetry;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ maxWidth: 460, textAlign: 'center' }}>
        {/* The bundled mark, not <Logo/>: this renders before the config that
            would carry an uploaded one. */}
        <BundledLogo height={38} style={{ opacity: 0.7, margin: '0 auto' }} />
        <h1 className="bl-display" style={{ fontSize: 30, margin: '26px 0 0' }}>
          {title}
        </h1>
        <p className="bl-muted" style={{ fontSize: 15, lineHeight: 1.65, margin: '12px 0 0', textWrap: 'pretty' }}>
          {body}
        </p>
        {retry ? (
          <button type="button" onClick={retry} className="bl-btn ghost sm" style={{ marginTop: 22 }}>
            Reload
          </button>
        ) : null}
      </div>
    </div>
  );
}
