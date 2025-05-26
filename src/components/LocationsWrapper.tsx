'use client';

import { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { PrimaryButton } from './Button';
import LocationsList from './LocationsDropdown';

interface LocationsWrapperProps {
  buttonText: string;
  className?: string;
}

/**
 * LocationsWrapper Component
 * 
 * An expandable menu that smoothly animates between collapsed and expanded states.
 * Uses dynamic height measurement for smooth transitions regardless of content size.
 * Automatically re-measures when internal content changes (e.g., airport expansions).
 */
export default function LocationsWrapper({ 
  buttonText,
  className = '' 
}: LocationsWrapperProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState(0);

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

  return (
    <div 
      className={`
        inline-block origin-top transition-transform duration-300
        ${isOpen ? 'scale-x-105' : ''}
        ${className}
      `}
    >
      {/* Border wrapper for the entire component */}
      <div className="border-2 border-white rounded-lg overflow-hidden">
        {/* Main Button */}
        <PrimaryButton
          onClick={handleToggle}
          icon={isOpen ? "↓" : "→"}
          className="w-full !border-0 !rounded-none"
        >
          {buttonText}
        </PrimaryButton>
        
        {/* Expanding Panel */}
        <div
          style={{ maxHeight: maxHeight }}
          className="overflow-hidden transition-all duration-300 ease-in-out bg-primary"
        >
          {/* Content that determines natural height */}
          <div ref={panelRef} className="p-4">
            <LocationsList 
              isExpanded={true} // Always render content for height measurement
              onClose={handleClose}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 