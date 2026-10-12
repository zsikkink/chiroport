'use client';

import { useId, useRef, useState } from 'react';
import LocationsList from './LocationsDropdown';

interface LocationsWrapperProps {
  buttonText: string;
}

export default function LocationsWrapper({ buttonText }: LocationsWrapperProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div
      className="mx-auto w-[90%] max-w-sm"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && isOpen) {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen(false);
          buttonRef.current?.focus();
        }
      }}
    >
      <div
        className={`mx-auto max-w-full overflow-hidden border border-white/30 bg-gradient-to-br from-[#657b6b] via-[var(--color-header)] to-[#3e5445] transition-[border-radius,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          isOpen
            ? 'w-full rounded-3xl shadow-[0_18px_36px_-16px_rgba(45,65,50,0.4)]'
            : 'w-fit rounded-full shadow-[0_10px_24px_-8px_rgba(45,65,50,0.4)] hover:shadow-[0_14px_28px_-8px_rgba(45,65,50,0.5)]'
        }`}
      >
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="flex min-h-14 w-full items-center rounded-[inherit] bg-transparent px-6 py-3 font-lato text-3xl font-bold leading-tight tracking-tight text-white !shadow-none transition-[background-color,transform] duration-200 hover:!translate-y-0 hover:bg-white/5 active:!translate-y-0 motion-safe:active:!scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white motion-reduce:!transform-none motion-reduce:transition-none sm:text-4xl"
          aria-expanded={isOpen}
          aria-controls={panelId}
        >
          <span className="relative block min-w-0 flex-1 text-center">
            <span
              aria-hidden={isOpen}
              className={`block truncate transition-[opacity,transform] duration-200 motion-reduce:transform-none motion-reduce:transition-none ${
                isOpen ? 'absolute inset-0 -translate-y-2 opacity-0' : 'relative translate-y-0 opacity-100'
              }`}
            >
              {buttonText}
            </span>
            <span
              aria-hidden={!isOpen}
              className={`block truncate transition-[opacity,transform] duration-200 motion-reduce:transform-none motion-reduce:transition-none ${
                isOpen ? 'relative translate-y-0 opacity-100' : 'absolute inset-0 translate-y-2 opacity-0'
              }`}
            >
              Select location
            </span>
          </span>
        </button>

        {/* Hidden locations must not determine the closed button's intrinsic width. */}
        <div
          id={panelId}
          aria-hidden={!isOpen}
          inert={!isOpen}
          className={`grid [contain:inline-size] transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
            isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              className={`w-full px-3 pb-3 pt-1 transition-[opacity,transform] duration-150 motion-reduce:transform-none motion-reduce:transition-none ${
                isOpen ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
              }`}
            >
              <LocationsList />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
