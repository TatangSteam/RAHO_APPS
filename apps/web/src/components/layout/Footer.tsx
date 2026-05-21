/**
 * Footer Component
 * Reusable footer with auto-updating copyright year
 */

import { clsx } from 'clsx';

interface FooterProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Footer({ className, style }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={clsx(
        'border-t border-neutral-200 dark:border-neutral-800 py-4 px-6 text-center text-xs text-neutral-500 dark:text-neutral-500 transition-colors duration-300',
        className
      )}
      style={style}
    >
      © {currentYear} <span className="text-amber-600 dark:text-amber-500">Raho Premier Club</span>. All rights reserved.
    </footer>
  );
}
