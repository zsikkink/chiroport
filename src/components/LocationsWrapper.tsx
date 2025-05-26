'use client';

import { useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import { PrimaryButton } from './Button';
import LocationsList from './LocationsDropdown';

interface LocationsWrapperProps {
  buttonText: string;
  className?: string;
}

/**
 * LocationsWrapper Component
 * 
 * Dynamic width-based expandable menu that:
 * - Constantly monitors screen width
 * - Uses 5% margins on each side (90% total screen width)
 * - Closed state: 80% of screen width
 * - Open state: 90% of screen width (full available space)
 * - Dynamically scales text to fit without wrapping
 */
export default function LocationsWrapper({ 
  buttonText,
  className = '' 
}: LocationsWrapperProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [screenWidth, setScreenWidth] = useState(0);
  const [maxHeight, setMaxHeight] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Monitor screen width constantly
  useEffect(() => {
    const updateScreenWidth = () => {
      setScreenWidth(window.innerWidth);
    };

    // Set initial width
    updateScreenWidth();

    // Add resize listener
    window.addEventListener('resize', updateScreenWidth);
    
    return () => window.removeEventListener('resize', updateScreenWidth);
  }, []);

  // Calculate dynamic widths based on screen size
  const getWidths = useCallback(() => {
    const margin = screenWidth * 0.05; // 5% margin on each side
    const availableWidth = screenWidth - (margin * 2); // 90% total
    
    // Calculate the exact width needed for the text (no arrow space needed)
    const textLength = buttonText.length;
    const fontSize = screenWidth > 768 ? 32 : 24; // Larger font on desktop
    const estimatedTextWidth = textLength * fontSize * 0.6; // Character width estimation
    const paddingSpace = screenWidth > 768 ? 32 : 24; // More padding on desktop
    const minButtonWidth = estimatedTextWidth + paddingSpace; // No arrow space
    
    // Use a reasonable minimum but allow button to grow with content
    const closedWidth = Math.max(
      screenWidth > 768 ? 250 : 150, // Smaller minimum since no arrow
      Math.min(screenWidth > 768 ? 500 : 350, minButtonWidth) // Smaller maximum since no arrow
    );
    
    // Calculate open width - more reasonable on desktop
    const openWidth = screenWidth > 768 
      ? Math.min(800, availableWidth) // Max 800px on desktop, or available width if smaller
      : availableWidth; // Full available width on mobile
    
    return {
      closedWidth: closedWidth,
      openWidth: openWidth,
      marginLeft: margin,
      marginRight: margin
    };
  }, [screenWidth, buttonText]);

  // Calculate dynamic text size based on button width
  const getTextSize = useCallback(() => {
    const { closedWidth } = getWidths();
    
    // Calculate available space for text (no arrow space needed)
    const paddingSpace = screenWidth > 768 ? 32 : 24; // More padding on desktop
    const availableTextWidth = closedWidth - paddingSpace;
    
    // Estimate text width - rough calculation based on character count and font size
    const textLength = buttonText.length;
    
    // Start with larger base size on desktop
    let fontSize = screenWidth > 768 ? 32 : 24; // Larger starting size on desktop
    
    // Calculate the optimal font size that fits exactly
    const targetTextWidth = availableTextWidth;
    const optimalFontSize = targetTextWidth / (textLength * 0.6);
    
    // Use the optimal size but keep it within reasonable bounds
    const minSize = screenWidth > 768 ? 20 : 16; // Higher minimum on desktop
    const maxSize = screenWidth > 768 ? 40 : 28; // Higher maximum on desktop
    fontSize = Math.max(minSize, Math.min(maxSize, optimalFontSize));
    
    return {
      fontSize: `${fontSize}px`,
      lineHeight: '1.2'
    };
  }, [screenWidth, getWidths, buttonText]);

  // Function to measure and update height
  const updateHeight = useCallback(() => {
    if (isOpen && panelRef.current) {
      setMaxHeight(panelRef.current.scrollHeight);
    } else {
      setMaxHeight(0);
    }
  }, [isOpen]);

  // Re-measure content height whenever open state changes
  useLayoutEffect(() => {
    updateHeight();
  }, [updateHeight]);

  // Set up ResizeObserver to watch for content changes
  useLayoutEffect(() => {
    if (!panelRef.current || !isOpen) return;

    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });

    resizeObserver.observe(panelRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isOpen, updateHeight]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const { closedWidth, openWidth, marginLeft } = getWidths();
  const currentWidth = isOpen ? openWidth : closedWidth;
  const textStyle = getTextSize();

  // Calculate centering margins
  const centeringMargin = isOpen 
    ? marginLeft // When open, use the 5% margin (already positioned correctly)
    : (screenWidth - closedWidth) / 2; // When closed, center the 80% width

  return (
    <div 
      className="transition-all duration-300 ease-in-out"
      style={{
        width: `${currentWidth}px`,
        marginLeft: `${centeringMargin}px`,
        marginRight: `${centeringMargin}px`
      }}
    >
      {/* Container with proper overflow handling */}
      <div className="
        border-2 border-white rounded-lg 
        overflow-hidden 
        transition-all duration-300 ease-in-out
        w-full
      ">
        {/* Main Button - Dynamically sized */}
        <PrimaryButton
          ref={buttonRef}
          onClick={handleToggle}
          className={`
            w-full !border-0 !rounded-none 
            transition-all duration-300 ease-in-out
            ${screenWidth > 768 ? 'px-4' : 'px-3'}
            flex items-center justify-center
            overflow-hidden
            font-bold
            hover:bg-primary-dark hover:bg-opacity-90
          `}
          style={{
            fontSize: textStyle.fontSize,
            lineHeight: textStyle.lineHeight,
            minHeight: `${Math.max(48, parseInt(textStyle.fontSize) * 2)}px`
          }}
        >
          <span className="
            text-center
            overflow-hidden
            whitespace-nowrap
            w-full
          ">
            {buttonText}
          </span>
        </PrimaryButton>
        
        {/* Expanding Panel */}
        <div
          style={{ maxHeight: maxHeight }}
          className="
            overflow-hidden 
            transition-all duration-300 ease-in-out 
            bg-primary
            w-full
          "
        >
          {/* Content container */}
          <div 
            ref={panelRef} 
            className="p-4 w-full"
          >
            <LocationsList 
              onClose={handleClose}
              screenWidth={screenWidth}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 