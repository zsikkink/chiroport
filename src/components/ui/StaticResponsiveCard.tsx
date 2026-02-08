import { ReactNode } from 'react';
import { StaticHeading } from './StaticTypography';

/**
 * Props for the StaticResponsiveCard component
 */
interface StaticResponsiveCardProps {
  title?: string;         // Card heading text (optional)
  children: ReactNode;    // Card content
  className?: string;     // Optional additional CSS classes
}

/**
 * StaticResponsiveCard Component (Server-Side Rendered)
 * 
 * A server-rendered card component that:
 * - Displays content in a visually distinct container
 * - Adapts to different screen sizes with responsive spacing
 * - Features a frosted glass effect with backdrop blur
 * - Can be customized with additional classes
 * - No client-side interactivity (no click handlers)
 * 
 * @param {StaticResponsiveCardProps} props - Component properties
 * @returns A responsive card with title and content
 */
export default function StaticResponsiveCard({ 
  title, 
  children, 
  className = ''
}: StaticResponsiveCardProps) {
  const cardClasses = [
    'bg-slate-50',
    'rounded-xl',
    'border',
    'border-slate-200',
    'shadow-[0_12px_28px_-20px_rgba(15,23,42,0.18)]',
    'overflow-hidden',
    className
  ].filter(Boolean).join(' ');
  
  return (
    <div className={cardClasses}>
      {/* Card inner content with responsive padding */}
      <div className="p-4 sm:p-6">
        {/* Card title with responsive text size (if provided) */}
        {title && <StaticHeading className="mb-3 sm:mb-5">{title}</StaticHeading>}
        {/* Card body content */}
        <div>
          {children}
        </div>
      </div>
    </div>
  );
} 
