import { useState } from 'react';

interface AnimatedButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  selected?: boolean;
  persistSelection?: boolean;
}

export default function AnimatedButton({
  children,
  onClick,
  className = '',
  disabled = false,
  selected = false,
  persistSelection = true,
}: AnimatedButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = () => {
    if (disabled) return;

    setIsAnimating(true);

    setTimeout(() => {
      onClick();
    }, 200);

    setTimeout(() => {
      setIsAnimating(false);
    }, 500);
  };

  return (
    <div className="relative w-full">
      <button
        onClick={handleClick}
        disabled={disabled}
        data-selected={selected}
        className={`
          relative w-full text-lg font-semibold rounded-lg p-4 border-2 border-white
          transition-all duration-200 overflow-hidden
          bg-emerald-100 hover:bg-emerald-200 text-emerald-900 shadow-sm
          min-h-[3rem] flex items-center justify-center
          ${selected && (persistSelection || isAnimating)
            ? 'bg-white text-[#56655A] hover:bg-gray-100'
            : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${className}
          ${isAnimating ? 'animate-pulse border-emerald-200' : ''}
        `}
        style={
          isAnimating
            ? {
                boxShadow:
                  '0 0 0 2px rgba(255, 255, 255, 0.6), 0 0 0 4px rgba(255, 255, 255, 0.3)',
                transform: 'scale(1.02)',
              }
            : undefined
        }
      >
        <span className="relative z-10 text-center w-full">{children}</span>
      </button>
    </div>
  );
}
