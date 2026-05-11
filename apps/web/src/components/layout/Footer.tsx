/**
 * Footer Component
 * Reusable footer with auto-updating copyright year
 */

interface FooterProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Footer({ className, style }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={className}
      style={{
        borderTop: '1px solid var(--surface-border)',
        padding: '16px 24px',
        textAlign: 'center',
        fontSize: 12,
        color: 'var(--text-muted)',
        ...style,
      }}
    >
      © {currentYear} RAHO Klinik. All rights reserved.
    </footer>
  );
}
