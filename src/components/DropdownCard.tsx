'use client';

import { ReactNode, useState } from 'react';
import { Heading } from './Typography';
import { ChevronRightIcon, ChevronDownIcon } from '@heroicons/react/24/solid';

interface DropdownCardProps {
  title: string;
  children: ReactNode;
  className?: string;
  initiallyOpen?: boolean;
  onClick?: () => void;
}

/**
 * DropdownCard Component
 * 
 * A card component that can expand/collapse to show its content.
 * The entire component is a single frosted glass card that expands to show content.
 */
export default function DropdownCard({ 
  title, 
  children, 
  className = '',
  initiallyOpen = false,
  onClick
}: DropdownCardProps) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className={`w-full mb-4 overflow-hidden transition-all duration-300 ${className}`}>
      <div 
        className="w-full bg-white bg-opacity-30 backdrop-filter backdrop-blur-sm 
                  shadow-lg border border-white border-opacity-30 
                  rounded-lg"
      >
        <button
          onClick={handleClick}
          className="w-full flex justify-between items-center py-5 px-6 
                    hover:bg-opacity-40 text-white
                    transition-all duration-300"
        >
          <Heading className="text-3xl sm:text-3xl font-semibold text-left">{title}</Heading>
          <div className="w-6 h-6 transition-transform duration-300">
            {onClick ? (
              <ChevronRightIcon className="w-6 h-6 text-white" />
            ) : (
              isOpen
                ? <ChevronDownIcon className="w-6 h-6 text-white" />
                : <ChevronRightIcon className="w-6 h-6 text-white" />
            )}
          </div>
        </button>
        
        {isOpen && !onClick && (
          <div className="py-6 px-8">
            {children}
          </div>
        )}
      </div>
    </div>
  );
} 