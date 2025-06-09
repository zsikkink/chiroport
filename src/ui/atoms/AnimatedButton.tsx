/**
 * AnimatedButton Atom Component
 * 
 * A button component with built-in click animations and loading states
 */

import { useState } from 'react';

export interface AnimatedButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  selected?: boolean;
}

export function AnimatedButton({ 
  children, 
  onClick, 
  className = '', 
  disabled = false, 
  selected = false 
}: AnimatedButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = () => {
    if (disabled) return;
    
    // Start animation immediately
    setIsAnimating(true);
    
    // Delay the actual navigation by 0.2 seconds
    setTimeout(() => {
      onClick();
    }, 200);
    
    // Reset animation state after 0.5 seconds
    setTimeout(() => {
      setIsAnimating(false);
    }, 500);
  };

  return (
    <div className="relative w-full">
      <button
        onClick={handleClick}
        disabled={disabled}
        className={`
          relative w-full text-lg font-semibold rounded-lg p-4 border-2 border-white 
          transition-all duration-200 overflow-hidden
          bg-primary hover:bg-[#475549] text-white shadow-lg
          min-h-[3rem] flex items-center justify-center
          ${selected 
            ? 'bg-white text-[#56655A] hover:bg-gray-100' 
            : 'bg-primary hover:bg-[#475549] text-white'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${className}
          ${isAnimating ? 'animate-pulse border-white/80' : ''}
        `}
        style={{
          ...(isAnimating && {
            boxShadow: '0 0 0 2px rgba(255, 255, 255, 0.6), 0 0 0 4px rgba(255, 255, 255, 0.3)',
            transform: 'scale(1.02)',
          })
        }}
      >
        <span className="relative z-10 text-center w-full">
          {children}
        </span>
      </button>
    </div>
  );
} 