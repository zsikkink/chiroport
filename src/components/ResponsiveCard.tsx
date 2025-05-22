'use client'; // Mark as client component

import { ReactNode } from 'react';
import { Heading } from './Typography';

/**
 * Props for the ResponsiveCard component
 */
interface ResponsiveCardProps {
  title?: string;         // Card heading text (optional)
  children: ReactNode;    // Card content
  className?: string;     // Optional additional CSS classes
}

/**
 * ResponsiveCard Component
 * 
 * A reusable card component that:
 * - Displays content in a visually distinct container
 * - Adapts to different screen sizes with responsive spacing
 * - Features a frosted glass effect with backdrop blur
 * - Can be customized with additional classes
 * 
 * @param {ResponsiveCardProps} props - Component properties
 * @returns A responsive card with title and content
 */
export default function ResponsiveCard({ title, children, className = '' }: ResponsiveCardProps) {
  return (
    <div className={`bg-white/10 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden ${className}`}>
      {/* Card inner content with responsive padding */}
      <div className="p-4 sm:p-6">
        {/* Card title with responsive text size (if provided) */}
        {title && <Heading className="mb-3 sm:mb-5">{title}</Heading>}
        {/* Card body content */}
        <div>
          {children}
        </div>
      </div>
    </div>
  );
} 