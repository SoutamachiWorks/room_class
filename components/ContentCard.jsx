/**
 * ContentCard — Shared Layout UI Kit Component
 *
 * A versatile card container with optional header, body, and footer sections.
 * Used as the primary content wrapper across all dashboard modules.
 *
 * Usage:
 *   import ContentCard from '@/components/ContentCard';
 *
 *   // Simple card with padded body
 *   <ContentCard padded>
 *     <p>Content goes here</p>
 *   </ContentCard>
 *
 *   // Card with header and footer
 *   <ContentCard
 *     header={<FilterSection />}
 *     footer={<PaginationControls />}
 *   >
 *     <table>...</table>
 *   </ContentCard>
 *
 *   // Interactive card with hover effect
 *   <ContentCard hoverable padded>
 *     <p>Clickable card</p>
 *   </ContentCard>
 *
 * Props:
 *   header    — JSX for the top section (filters, search, etc.)
 *   footer    — JSX for the bottom section (pagination, actions)
 *   padded    — boolean, adds padding to the body
 *   hoverable — boolean, adds hover shadow effect
 *   className — additional custom class
 *   children  — main body content
 */

import styles from './ContentCard.module.css';

export default function ContentCard({
  header,
  footer,
  padded = false,
  hoverable = false,
  className = '',
  children,
  ...rest
}) {
  const cardClasses = [
    styles.card,
    hoverable && styles.hoverable,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const bodyClasses = padded ? styles.bodyPadded : styles.body;

  return (
    <div className={cardClasses} {...rest}>
      {header && <div className={styles.header}>{header}</div>}
      <div className={bodyClasses}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
