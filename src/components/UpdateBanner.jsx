import { useLocation } from 'react-router-dom';

import { useBuildUpdate } from '@sepetakhq/storefront-kit/shared/useBuildUpdate';

// Where a buyer is mid-transaction. A reload is safe on both, but offering one
// to someone halfway through paying is the worst moment to interrupt.
const QUIET_PREFIXES = ['/checkout', '/pesanan/', '/track/'];

/** Offers a reload when a newer build has shipped under an open tab. Never reloads on its own. */
export default function UpdateBanner() {
  const { updateReady, dismiss } = useBuildUpdate();
  const { pathname } = useLocation();

  if (!updateReady) return null;
  if (QUIET_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '10px 16px',
        background: 'var(--bl-lime-wash-3)',
        borderBottom: '1px solid var(--bl-lime-line)',
        fontSize: 13.5,
      }}
    >
      <span>A newer version of the shop is available.</span>
      <span style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => window.location.reload()} className="bl-btn primary xs">
          Reload
        </button>
        <button type="button" onClick={dismiss} className="bl-btn chip">
          Later
        </button>
      </span>
    </div>
  );
}
