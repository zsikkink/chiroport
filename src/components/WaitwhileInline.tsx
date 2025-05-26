'use client';

import { useEffect, useRef, useState } from 'react';
import { InlineLoader } from './LoadingSpinner';

interface WaitwhileInlineProps {
  locationId: string;
  /** Optional Tailwind classes for container width/margins */
  className?: string;
}

type LoadingState = 'loading' | 'loaded' | 'error';

export default function WaitwhileInline({
  locationId,
  className = 'w-full max-w-md mx-auto my-8',
}: WaitwhileInlineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const embedRef = useRef<any>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const initializeWaitwhile = () => {
      try {
        if (typeof window === 'undefined' || !window.Waitwhile) {
          setError('Waitwhile service is not available');
          setLoadingState('error');
          return;
        }

        // Clear any existing content
        containerRef.current!.innerHTML = '';
        setLoadingState('loading');
        setError(null);

        // Create new embed
        const embed = window.Waitwhile.Embed({
          locationId,
        });

        // Store reference for cleanup
        embedRef.current = embed;

        // Render the embed
        embed.render(containerRef.current!);
        
        // Set loaded state after a brief delay to ensure rendering
        setTimeout(() => {
          setLoadingState('loaded');
        }, 1000);

      } catch (err) {
        console.error('Failed to initialize Waitwhile:', err);
        setError('Failed to load queue system. Please try refreshing the page.');
        setLoadingState('error');
      }
    };

    // Check if Waitwhile is already loaded
    if (window.Waitwhile) {
      initializeWaitwhile();
    } else {
      // Wait for Waitwhile to load
      const checkWaitwhile = setInterval(() => {
        if (window.Waitwhile) {
          clearInterval(checkWaitwhile);
          initializeWaitwhile();
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkWaitwhile);
        if (!window.Waitwhile) {
          setError('Queue system failed to load. Please check your internet connection and try again.');
          setLoadingState('error');
        }
      }, 10000);

      return () => clearInterval(checkWaitwhile);
    }

    // Cleanup function
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      embedRef.current = null;
    };
  }, [locationId]);

  const handleRetry = () => {
    setLoadingState('loading');
    setError(null);
    // Trigger re-initialization by changing a dependency
    window.location.reload();
  };

  if (loadingState === 'error') {
    return (
      <div className={`${className} text-center`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-red-800 mb-2">
            Queue System Unavailable
          </h3>
          <p className="text-red-700 mb-4 text-sm">
            {error}
          </p>
          <button
            onClick={handleRetry}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {loadingState === 'loading' && (
        <InlineLoader text="Loading queue system..." />
      )}
      <div 
        ref={containerRef} 
        className={loadingState === 'loading' ? 'hidden' : ''}
      />
    </div>
  );
} 