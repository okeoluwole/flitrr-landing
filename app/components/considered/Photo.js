/**
 * A marketing photograph, served as WebP with a JPEG fallback.
 *
 * Every source in public/images ships a `-1920.webp` and a `-960.webp`
 * beside the original .jpg (see the WebP re-export in the design pass), so
 * a phone pulls roughly a sixth of the bytes the desktop hero does.
 *
 * `priority` marks the LCP image: it fetches at high priority and skips
 * lazy loading. Everything else stays lazy.
 */
export default function Photo({ src, alt = '', priority = false, sizes = '100vw', className }) {
  const base = src.replace(/\.jpg$/, '');
  return (
    <picture>
      <source
        type="image/webp"
        srcSet={`${base}-960.webp 960w, ${base}-1920.webp 1920w`}
        sizes={sizes}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={className}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : undefined}
      />
    </picture>
  );
}
