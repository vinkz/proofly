import type { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

export type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'surface-card border border-white/10 bg-surface-elevated/90 text-muted-foreground shadow-brand backdrop-blur-sm',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('space-y-2 px-6 pb-2 pt-5', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={clsx('text-lg font-semibold text-muted', className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={clsx('text-sm text-muted-foreground/80', className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('px-6 pb-5 pt-2', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('flex items-center gap-3 border-t border-white/5 px-6 py-4', className)} {...props} />;
}
