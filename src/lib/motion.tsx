'use client';

import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';

type MotionHover = { y?: number };

type MotionProps = HTMLAttributes<HTMLDivElement> & {
  whileHover?: MotionHover;
};

const MotionDiv = forwardRef<HTMLDivElement, MotionProps>(
  ({ whileHover, className, style, onMouseEnter, onMouseLeave, ...rest }, ref) => {
    const hoverY = whileHover?.y ?? 0;
    return (
      <div
        ref={ref}
        className={`transition-transform duration-200 ${className ?? ''}`}
        style={{ ...style }}
        onMouseEnter={(event) => {
          if (hoverY) {
            event.currentTarget.style.transform = `translateY(${hoverY}px)`;
          }
          onMouseEnter?.(event);
        }}
        onMouseLeave={(event) => {
          if (hoverY) {
            event.currentTarget.style.transform = 'translateY(0px)';
          }
          onMouseLeave?.(event);
        }}
        {...rest}
      />
    );
  },
);
MotionDiv.displayName = 'MotionDiv';

export const motion = {
  div: MotionDiv,
};
