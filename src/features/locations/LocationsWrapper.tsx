'use client';

import { useState } from 'react';
import { PrimaryButton } from '@/components/ui';
import LocationsList from './LocationsDropdown';

interface LocationsWrapperProps {
  buttonText: string;
}

export default function LocationsWrapper({ buttonText }: LocationsWrapperProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={`mx-auto w-[90%] transition-[max-width] duration-300 ${
        isOpen ? 'max-w-3xl' : 'max-w-lg'
      }`}
    >
      <div
        className={`w-full overflow-hidden rounded-2xl border border-transparent transition-colors duration-300 ${
          isOpen
            ? 'bg-[var(--color-header)] shadow-[0_22px_42px_-26px_rgba(15,23,42,0.7)]'
            : 'bg-white shadow-[0_14px_28px_-12px_rgba(15,23,42,0.46),0_4px_10px_-6px_rgba(15,23,42,0.28)]'
        }`}
      >
        <PrimaryButton
          onClick={() => setIsOpen((open) => !open)}
          className={`flex min-h-14 w-full items-center justify-center !rounded-none !border-0 px-3 text-[clamp(1.1rem,4.5vw,2rem)] font-bold tracking-tight transition-colors duration-300 sm:min-h-16 sm:px-4 ${
            isOpen
              ? '!bg-transparent !text-white !shadow-none !ring-0 hover:!bg-white/10 hover:!shadow-none'
              : '!bg-[var(--color-header)] !text-white hover:!bg-[var(--color-primary-dark)]'
          }`}
          aria-expanded={isOpen}
          aria-controls="locations-list-panel"
        >
          <span className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-center">
            {isOpen ? 'Select location' : buttonText}
          </span>
        </PrimaryButton>

        <div
          id="locations-list-panel"
          aria-hidden={!isOpen}
          inert={!isOpen}
          className={`grid bg-[var(--color-header)] transition-[grid-template-rows] duration-300 ${
            isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="w-full p-4">
              <LocationsList />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
