'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';

interface WaitwhileEmbedProps {
  locationId: string;
  className?: string;
  showServiceSelection?: boolean;
}

/**
 * WaitwhileEmbed Component
 * 
 * Embeds a Waitwhile join queue widget inline using the official Waitwhile embed API.
 * Focused on service selection and queue joining.
 * 
 * @param {string} locationId - The Waitwhile location ID
 * @param {boolean} showServiceSelection - Whether to show the service selection step (default true)
 * @param {string} className - Additional CSS classes to apply
 */
export default function WaitwhileEmbed({ 
  locationId, 
  showServiceSelection = true,
  className = ''
}: WaitwhileEmbedProps) {
  const scriptLoaded = useRef<boolean>(false);
  const waitwhileInitialized = useRef<boolean>(false);
  
  useEffect(() => {
    // Only run this effect if the script has loaded but Waitwhile hasn't been initialized yet
    if (scriptLoaded.current && !waitwhileInitialized.current && typeof window !== 'undefined' && (window as any).Waitwhile) {
      try {
        // Configure Waitwhile embed with options
        const waitwhileConfig = {
          locationId: locationId,
          // Optimize for queue joining experience
          flow: 'waitlist',
          // Skip initial button click and show services directly
          initialScreen: 'services',
          // Additional customization options
          language: 'en',
          // Custom labels to focus on queue joining
          labels: {
            addToWaitlist: 'Join Queue',
            joinWaitlist: 'Join Queue',
            buttonSubmit: 'Join Queue'
          }
        };
        
        // Following the exact pattern from Waitwhile documentation
        const waitwhile = (window as any).Waitwhile.Embed(waitwhileConfig);
        
        // Render the embed to our container div
        waitwhile.render('#waitwhile-container');
        
        waitwhileInitialized.current = true;
        console.log('Waitwhile widget initialized successfully');
      } catch (error) {
        console.error('Error initializing Waitwhile widget:', error);
      }
    }
  }, [locationId, showServiceSelection, scriptLoaded.current]);

  // Handle script load event
  const handleScriptLoad = () => {
    scriptLoaded.current = true;
    // Reset initialization flag when script loads or reloads
    waitwhileInitialized.current = false;
    console.log('Waitwhile script loaded');
  };

  return (
    <>
      <Script
        src="https://waitwhile.com/embed/waitwhile.js"
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
      />
      <div
        id="waitwhile-container" 
        className={`waitwhile-embed ${className}`}
      />
    </>
  );
} 