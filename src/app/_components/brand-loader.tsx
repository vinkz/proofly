import Image from 'next/image';

/**
 * Animated branded loading screen. The certnow logo asset is rendered as-is (frozen brand mark);
 * only its presentation is animated — a soft breathe, a light shimmer masked to the logo's own
 * shape, and an indeterminate progress bar. Honors prefers-reduced-motion via globals.css.
 */
export function BrandLoader({
  label = 'Loading…',
  className = '',
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex min-h-[70vh] w-full flex-col items-center justify-center gap-6 ${className}`}
    >
      <div className="relative">
        <Image
          src="/certnow-logo.svg"
          alt="certnow"
          width={180}
          height={40}
          priority
          className="brand-loader-logo h-auto w-[150px] sm:w-[180px]"
        />
        <span aria-hidden="true" className="brand-loader-shine" />
      </div>
      <span className="relative h-[3px] w-[132px] overflow-hidden rounded-full bg-[var(--color-border-tertiary)]">
        <span className="brand-loader-bar" />
      </span>
      <span className="sr-only">{label}</span>
    </div>
  );
}
