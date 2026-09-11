import { useState } from 'react';

/**
 * The one image component -- the root storefront's, with this shop's
 * placeholder tile. See src/ui/Img.jsx for why the frame reserves the ratio
 * and why `srcset` is never emitted empty.
 */
export function Img({
  src,
  srcSet,
  sizes,
  alt = '',
  ratio = '4/5',
  radius = 0,
  width,
  height,
  priority = false,
  className,
  style,
  onError,
}) {
  const [failed, setFailed] = useState(false);
  const missing = !src || failed;

  const frame = {
    position: 'relative',
    aspectRatio: ratio,
    borderRadius: radius || undefined,
    overflow: 'hidden',
    background: 'var(--bl-sand)',
    ...style,
  };

  if (missing) {
    return <div className={className} style={frame} role="img" aria-label={alt} />;
  }

  return (
    <div className={className} style={frame}>
      <img
        src={src}
        srcSet={srcSet || undefined}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        width={width || undefined}
        height={height || undefined}
        loading={priority ? 'eager' : 'lazy'}
        fetchpriority={priority ? 'high' : undefined}
        decoding="async"
        onError={() => {
          setFailed(true);
          onError?.();
        }}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
}

export const SIZES = {
  card: '(max-width: 560px) 50vw, (max-width: 900px) 33vw, 300px',
  productMain: '(max-width: 900px) 100vw, 600px',
  thumb: '84px',
  cartLine: '84px',
  summaryLine: '56px',
  categoryTile: '(max-width: 900px) 100vw, 400px',
  hero: '(max-width: 900px) 100vw, 600px',
};
