'use client';

import { useEffect, useRef } from 'react';

interface WaitwhileInlineProps {
  locationId: string;
  /** Optional Tailwind classes for container width/margins */
  className?: string;
}

export default function WaitwhileInline({
  locationId,
  className = 'w-full max-w-md mx-auto my-8',
}: WaitwhileInlineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const embedRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.Waitwhile || !containerRef.current) return;

    // Clear any existing content in the container
    containerRef.current.innerHTML = '';

    // Create new embed
    const embed = window.Waitwhile.Embed({
      locationId,
    });

    // Store reference to embed for cleanup
    embedRef.current = embed;

    // Render the embed
    embed.render(containerRef.current);

    // Cleanup function
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      embedRef.current = null;
    };
  }, [locationId]);

  return <div ref={containerRef} className={className} />;
} 