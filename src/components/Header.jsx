import { Link, NavLink } from 'react-router-dom';

import { useConfig } from '../../../../src/config/ConfigProvider.jsx';
import { useCart } from '../../../../src/cart/CartProvider.jsx';
import { Logo } from './Logo.jsx';
import { BagIcon } from './icons.jsx';

/**
 * Sticky, translucent, one row. The nav wraps rather than collapsing into a
 * drawer: four short labels fit on a phone at 14px, and a burger menu for
 * four links is a second tap for nothing.
 */
export default function Header() {
  const { brand } = useConfig();
  const { count } = useCart();

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--bl-line)',
      }}
    >
      <div className="bl-wrap bl-header-row" style={{ minHeight: 70, display: 'flex', alignItems: 'center', paddingBlock: 10 }}>
        <Link to="/" style={{ display: 'flex', flex: 'none' }} aria-label="Home">
          <Logo height={36} />
        </Link>
        <nav className="bl-nav">
          {brand.nav.map((n) => (
            <NavLink key={n.path} to={n.path} end={n.path === '/'}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <Link
          to="/keranjang"
          aria-label={count > 0 ? `Cart, ${count} items` : 'Cart'}
          className="bl-nav-cart"
          style={{ position: 'relative', padding: 8, borderRadius: 999, display: 'flex', alignItems: 'center', color: 'var(--bl-ink)' }}
        >
          <BagIcon />
          {count > 0 ? (
            <span
              style={{
                position: 'absolute',
                top: 2,
                right: 0,
                background: 'var(--bl-green-2)',
                color: 'var(--bl-white)',
                fontWeight: 700,
                fontSize: 10.5,
                minWidth: 17,
                height: 17,
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
              }}
            >
              {count}
            </span>
          ) : null}
        </Link>
      </div>
    </header>
  );
}
