'use client';

import { useState, type ReactNode } from 'react';
import { ChevronRightIcon, ChevronDownIcon } from '@heroicons/react/24/solid';

interface DropdownCardProps {
  title: string;
  children: ReactNode;
  className?: string;
  initiallyOpen?: boolean;
  onClick?: () => void;
}

export default function DropdownCard({
  title,
  children,
  className = '',
  initiallyOpen = false,
  onClick,
}: DropdownCardProps) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const controlsId = `dropdown-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  const handleClick = () => {
    if (onClick) onClick();
    else setIsOpen((open) => !open);
  };

  return (
    <div className={`group w-full overflow-hidden ${className}`}>
      <div className="w-full overflow-hidden rounded-xl border border-white/25 bg-white/10 backdrop-blur-md transition-colors duration-200 hover:bg-white/15">
        <button
          type="button"
          onClick={handleClick}
          className="flex min-h-12 w-full items-center justify-between overflow-hidden bg-white/28 px-4 py-4 text-[clamp(1rem,3.5vw,1.75rem)] font-semibold leading-snug text-white !shadow-none transition-colors duration-200 hover:!translate-y-0 hover:bg-white/36 hover:!shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 active:!translate-y-0 active:!shadow-none"
          aria-expanded={onClick ? undefined : isOpen}
          aria-controls={onClick ? undefined : controlsId}
        >
          <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap pr-3 text-left">
            {title}
          </span>
          {onClick || !isOpen ? (
            <ChevronRightIcon className="h-5 w-5 shrink-0 text-slate-100" />
          ) : (
            <ChevronDownIcon className="h-5 w-5 shrink-0 text-slate-100" />
          )}
        </button>

        {!onClick ? (
          <div
            id={controlsId}
            aria-hidden={!isOpen}
            inert={!isOpen}
            className={`grid transition-[grid-template-rows] duration-200 ${
              isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="w-full px-4 pb-4 pt-3">{children}</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
