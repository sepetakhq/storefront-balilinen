import { useState } from 'react';

import { useConfig } from '@sepetakhq/storefront-kit/config/ConfigProvider';
import logoFile from '../assets/logo.png';

/**
 * The shop's mark, in the order the design settled on: the logo uploaded in
 * the backoffice (brand.logo_image), else the logo file that ships with this
 * template, else the wordmark set in the display face.
 *
 * Bundling the file is fine here and nowhere else: this template *is* Bali
 * Linen's, so the mark is part of the design rather than merchant data. On a
 * failed load it steps down a rung rather than leaving a hole -- the media
 * pipeline never retries an asset it once refused.
 */
export function Logo({ height = 36, maxWidth = 220, style }) {
  const { brand } = useConfig();
  const [failed, setFailed] = useState(false);
  const logo = brand.logoImage;
  const name = [brand.wordmark_primary, brand.wordmark_accent].filter(Boolean).join(' ');

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

  return <BundledLogo height={height} maxWidth={maxWidth} name={name} style={style} />;
}

/**
 * The template's own file, with no config behind it -- so the splash can show
 * it before /storefront/config has answered.
 */
export function BundledLogo({ height = 36, maxWidth = 220, name = 'Bali Linen', style }) {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return (
      <img
        src={logoFile}
        alt={name}
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
