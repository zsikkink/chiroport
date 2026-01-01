'use client'; // Mark as client component to enable React hooks

import { ReactNode, useEffect, useState } from 'react';

/**
 * Props for the ResponsiveLayout component
 */
interface ResponsiveLayoutProps {
  children: ReactNode; // Content to be wrapped by the layout
}

/**
 * ResponsiveLayout Component
 * 
 * A wrapper component that provides:
 * - Responsive containment for all page content
 * - Overflow handling to prevent horizontal scrolling
 * - Print-specific styling
 * - Client-side feature detection capabilities
 * 
 * @param {ResponsiveLayoutProps} props - Component properties
 * @returns The responsive layout wrapped around children content
 */
export default function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  // Track whether component has mounted on the client
  // This prevents hydration mismatches between server and client renders
  const [mounted, setMounted] = useState(false);
  
  // Set mounted to true after component mounts on the client
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="w-full overflow-x-hidden min-h-screen">
      {/* Print-specific styles using CSS-in-JS approach */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important; /* Hide non-printable elements when printing */
          }
        }
      `}</style>
      
      {/* Main content container with responsive constraints */}
      <div className="mx-auto w-full max-w-7xl relative pt-4 sm:pt-6 md:pt-8 pb-4 min-h-screen box-border">
        {children}
      </div>
      
      {/* Client-side only features - only rendered after hydration */}
      {mounted && (
        <div aria-hidden="true" className="hidden">
          {/* Hidden container for client-only features that shouldn't affect layout */}
        </div>
      )}
    </div>
  );
} 