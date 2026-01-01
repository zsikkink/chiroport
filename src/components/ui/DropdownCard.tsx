'use client';

import React, { ReactNode, useState, useCallback, useEffect, useRef } from 'react';
import { ChevronRightIcon, ChevronDownIcon } from '@heroicons/react/24/solid';

interface DropdownCardProps {
  title: string;
  children: ReactNode;
  className?: string;
  initiallyOpen?: boolean;
  onClick?: () => void;
  screenWidth: number;
}

/**
 * DropdownCard Component
 * 
 * An accessible card component that can expand/collapse to show its content.
 * - Dynamically sizes text based on screen width
 * - Uses proper responsive design principles
 * - Maintains visual hierarchy with proper spacing
 * - Features enhanced hover effects for better UX
 * - Auto-scrolls to show expanded content
 */
export default function DropdownCard({ 
  title, 
  children, 
  className = '',
  initiallyOpen = false,
  onClick,
  screenWidth
}: DropdownCardProps) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Calculate dynamic text size for card title
  const getTitleTextSize = useCallback(() => {
    const availableWidth = screenWidth * 0.9; // 90% of screen
    const baseSize = Math.max(16, Math.min(28, availableWidth / 18));
    
    return {
      fontSize: `${baseSize}px`,
      lineHeight: '1.3'
    };
  }, [screenWidth]);

  // Custom smooth scroll function for more gentle scrolling
  const smoothScrollBy = useCallback((amount: number) => {
    const startPosition = window.pageYOffset;
    const duration = Math.min(800, Math.max(400, Math.abs(amount) * 2)); // Dynamic duration based on distance
    
    let startTime: number | null = null;
    
    const easeInOutQuad = (t: number): number => {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    };
    
    const animateScroll = (currentTime: number) => {
      if (startTime === null) startTime = currentTime;
      
      const timeElapsed = currentTime - startTime;
      const progress = Math.min(timeElapsed / duration, 1);
      const easedProgress = easeInOutQuad(progress);
      
      const currentPosition = startPosition + (amount * easedProgress);
      window.scrollTo(0, currentPosition);
      
      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      }
    };
    
    requestAnimationFrame(animateScroll);
  }, []);

  // Auto-scroll when dropdown opens to ensure content is visible
  useEffect(() => {
    if (!isOpen || onClick || !cardRef.current || !contentRef.current) {
      return;
    }

    // Small delay only to ensure DOM has updated, then scroll immediately
    const scrollTimeout = setTimeout(() => {
      const card = cardRef.current;
      const content = contentRef.current;
      
      if (!card || !content) return;

      // Get current viewport and card information
      const cardRect = card.getBoundingClientRect();
      const contentHeight = content.offsetHeight;
      const viewportHeight = window.innerHeight;
      
      // Calculate positions
      const cardTop = cardRect.top;
      const cardBottom = cardRect.bottom;
      const expandedBottom = cardBottom + contentHeight;
      
      // Only scroll if the expanded content would be cut off
      // Use larger margins for more conservative scrolling
      const topMargin = 40;
      const bottomMargin = 60; // More space at bottom
      
      if (expandedBottom > viewportHeight - bottomMargin) {
        // Calculate more conservative scroll amount
        let scrollAmount;
        
        // If the entire expanded card would fit in viewport, scroll just enough
        if (contentHeight + cardRect.height <= viewportHeight - topMargin - bottomMargin) {
          // Scroll only 70% of what's needed for a gentler approach
          scrollAmount = Math.max(0, (expandedBottom - viewportHeight + bottomMargin) * 0.7);
        } else {
          // For large content, scroll more conservatively
          scrollAmount = Math.max(0, (cardTop - topMargin) * 0.6);
        }
        
        // Only scroll if the amount is meaningful (avoid tiny scrolls)
        if (scrollAmount > 20) {
          // Use custom smooth scroll for even gentler animation
          smoothScrollBy(scrollAmount);
        }
      }
    }, 50); // Minimal delay just for DOM update, then instant scroll

    return () => clearTimeout(scrollTimeout);
  }, [isOpen, onClick, smoothScrollBy]);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      setIsOpen(!isOpen);
    }
  };

  const titleStyle = getTitleTextSize();

  return (
    <div 
      ref={cardRef}
      className={`
        w-full 
        mb-3 
        overflow-hidden 
        transition-all duration-300 
        ${className}
      `}
    >
      <div 
        className={`
          w-full
          bg-white bg-opacity-15 
          backdrop-filter backdrop-blur-sm
          border border-white border-opacity-30
          shadow-md
          rounded-lg transition-colors duration-300
          overflow-hidden
          ${isHovered ? 'bg-opacity-25 border-opacity-50' : ''}
        `}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <button
          onClick={handleClick}
          className={`
            w-full
            flex justify-between items-center 
            py-4 px-4 
            text-white transition-colors duration-300
            overflow-hidden
            font-semibold
            ${isHovered ? 'bg-white/15' : 'hover:bg-white/15'}
          `}
          style={{
            fontSize: titleStyle.fontSize,
            lineHeight: titleStyle.lineHeight,
            minHeight: `${Math.max(48, parseInt(titleStyle.fontSize) * 1.8)}px`
          }}
        >
          <span className="
            text-left 
            flex-1 pr-3
            overflow-hidden
            whitespace-nowrap
            text-ellipsis
          ">
            {title}
          </span>
          <div className="w-5 h-5 flex-shrink-0">
            {onClick ? (
              <ChevronRightIcon className="w-full h-full text-white" />
            ) : (
              isOpen
                ? <ChevronDownIcon className="w-full h-full text-white" />
                : <ChevronRightIcon className="w-full h-full text-white" />
            )}
          </div>
        </button>
        
        {isOpen && !onClick && (
          <div 
            ref={contentRef}
            className="
              py-4 
              px-4
              w-full
              overflow-hidden
            "
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
} 