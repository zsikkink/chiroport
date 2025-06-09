/**
 * BackButton Atom Component
 * 
 * A simple back navigation button with chevron icon
 */

import { ChevronLeftIcon } from '@heroicons/react/24/solid';

export interface BackButtonProps {
  onClick: () => void;
}

export function BackButton({ onClick }: BackButtonProps) {
  return (
    <button onClick={onClick} aria-label="Go back" className="text-white flex items-center mb-2">
      <ChevronLeftIcon className="w-6 h-6" />
    </button>
  );
} 