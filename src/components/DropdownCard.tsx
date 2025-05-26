'use client';

import { ReactNode, useState, useCallback } from 'react';
import { Heading } from './Typography';
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

  // Calculate dynamic text size for card title
  const getTitleTextSize = useCallback(() => {
    const availableWidth = screenWidth * 0.9; // 90% of screen
    const baseSize = Math.max(16, Math.min(28, availableWidth / 18));
    
    return {
      fontSize: `${baseSize}px`,
      lineHeight: '1.3'
    };
  }, [screenWidth]);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      setIsOpen(!isOpen);
    }
  };

  const titleStyle = getTitleTextSize();

  return (
    <div className={`
      w-full 
      mb-3 
      overflow-hidden 
      transition-all duration-300 
      ${className}
    `}>
      <div 
        className={`
          w-full
          bg-white bg-opacity-15 
          backdrop-filter backdrop-blur-sm
          border border-white border-opacity-30
          shadow-md
          rounded-lg transition-all duration-300
          overflow-hidden
          ${isHovered ? 'bg-opacity-25 border-opacity-50 shadow-lg transform scale-[1.01]' : ''}
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
            text-white transition-all duration-300
            overflow-hidden
            font-semibold
            ${isHovered ? 'bg-white/5' : 'hover:bg-white/5'}
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
          <div className={`
            w-5 h-5 
            flex-shrink-0
            transition-all duration-300 
            ${isHovered ? 'transform scale-110' : ''}
          `}>
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
          <div className="
            py-4 
            px-4
            w-full
            overflow-hidden
          ">
            {children}
          </div>
        )}
      </div>
    </div>
  );
} 