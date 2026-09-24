import { useState } from 'react';

import { useConfig } from '@sepetakhq/storefront-kit/config/ConfigProvider';

/**
 * The shop's mark: the logo uploaded in the backoffice (brand.logo_image),
 * else the shop's wordmark set in the display face, else its name. This
 * template serves every shop that picks it, so it ships no logo of its own.
 * A logo that fails to load steps down to the wordmark rather than leaving a
 * hole -- the media pipeline never retries an asset it once refused.
 */
export function Logo({ height = 36, maxWidth = 220, style }) {
  const { brand, tenant } = useConfig();
  const [failed, setFailed] = useState(false);
  const logo = brand.logoImage;
  const name = [brand.wordmark_primary, brand.wordmark_accent].filter(Boolean).join(' ') || tenant?.name || '';

  if (logo?.url && !failed) {
    return (
      <img
        src={logo.url}
        srcSet={logo.srcset || undefined}
        sizes={logo.srcset ? `${maxWidth}px` : undefined}
        alt={logo.alt || name}
        height={height}
        onError={() => setFailed(true)}
        style={{ height, width: 'auto', maxWidth, display: 'block', objectFit: 'contain', ...style }}
      />
    );
  }

  return (
    <span
      className="bl-display"
      style={{ fontSize: height * 0.72, lineHeight: 1, letterSpacing: '0.02em', color: 'var(--bl-ink)', ...style }}
    >
      {name}
    </span>
  );
}
