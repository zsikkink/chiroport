import { ReactNode } from 'react';

/**
 * Props for the StaticLayout component
 */
interface StaticLayoutProps {
  children: ReactNode; // Content to be wrapped by the layout
}

/**
 * StaticLayout Component (Server-Side Rendered)
 * 
 * A wrapper component that provides:
 * - Responsive containment for all page content
 * - Overflow handling to prevent horizontal scrolling
 * - Print-specific styling via CSS classes
 * - No client-side JavaScript required
 * 
 * @param {StaticLayoutProps} props - Component properties
 * @returns The static layout wrapped around children content
 */
export default function StaticLayout({ children }: StaticLayoutProps) {
  return (
    <div className="w-full overflow-x-hidden min-h-screen">
      {/* Main content container with responsive constraints */}
      <div className="mx-auto w-full max-w-7xl relative pt-4 sm:pt-6 md:pt-8 pb-4 min-h-screen box-border">
        {children}
      </div>
    </div>
  );
} 